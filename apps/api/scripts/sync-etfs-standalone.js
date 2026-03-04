/**
 * ETF Intelligence - Standalone Sync Script
 * 
 * Zero monorepo dependencies. Runs with plain node.
 * Uses: node-fetch (HTTP) + pg (PostgreSQL)
 * 
 * Run: node sync-etfs-standalone.js
 */

const { Pool } = require('pg');
const https = require('https');

// ============================================================================
// CONFIGURATION — edit these if needed
// ============================================================================

const CONFIG = {
  eodhd_api_key:    process.env.EODHD_API_KEY    || '6982994b580bc8.97426481',
  database_url:     process.env.DATABASE_URL,
  delay_ms:         500,    // 500ms between ETFs = ~120/min, well within limits
  batch_size:       25,     // Save checkpoint every 25 ETFs
  max_etfs:         null,   // Set to a number to limit (e.g. 100 for testing), null = all
  progress_file:    'sync-progress-standalone.json',
};

if (!CONFIG.database_url) {
  console.error('❌ DATABASE_URL not set. Run:');
  console.error('   set DATABASE_URL=postgresql://postgres.xxx:PASSWORD@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true');
  process.exit(1);
}

// ============================================================================
// DATABASE
// ============================================================================

const pool = new Pool({
  connectionString: CONFIG.database_url,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ============================================================================
// EODHD API — plain https calls, no fetch dependency
// ============================================================================

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

async function getExchangeSymbols() {
  const url = `https://eodhd.com/api/exchange-symbol-list/US?api_token=${CONFIG.eodhd_api_key}&fmt=json&type=ETF`;
  return httpsGet(url);
}

async function getEtfFundamentals(ticker) {
  const url = `https://eodhd.com/api/fundamentals/${ticker}.US?api_token=${CONFIG.eodhd_api_key}&fmt=json`;
  return httpsGet(url);
}

async function getHistoricalPrices(ticker) {
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const from = fiveYearsAgo.toISOString().split('T')[0];
  const to = new Date().toISOString().split('T')[0];
  const url = `https://eodhd.com/api/eod/${ticker}.US?api_token=${CONFIG.eodhd_api_key}&fmt=json&from=${from}&to=${to}`;
  return httpsGet(url);
}

// ============================================================================
// HELPERS
// ============================================================================

function safeFloat(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

function determineAssetClass(general, etfData) {
  const stockUS    = safeFloat(etfData?.Asset_Allocation?.['Stock US']?.['Net_Assets_%']);
  const stockNonUS = safeFloat(etfData?.Asset_Allocation?.['Stock non-US']?.['Net_Assets_%']);
  const bond       = safeFloat(etfData?.Asset_Allocation?.Bond?.['Net_Assets_%']);

  const totalStock = (stockUS || 0) + (stockNonUS || 0);
  if (totalStock > 50) return 'Equity';
  if (bond && bond > 50) return 'Fixed Income';

  const cat = (general?.Category || '').toLowerCase();
  if (/equity|stock|growth|value|blend|large|mid|small|cap/i.test(cat)) return 'Equity';
  if (/bond|fixed income|treasury|municipal|corporate/i.test(cat)) return 'Fixed Income';
  if (/commodity|gold|silver|oil|metal/i.test(cat)) return 'Commodity';
  if (/real estate|reit/i.test(cat)) return 'Real Estate';
  if (/currency|inverse|leveraged|volatility/i.test(cat)) return 'Alternative';
  if (/allocation|balanced|target date/i.test(cat)) return 'Mixed Allocation';
  return null;
}

function extractBenchmark(description) {
  if (!description) return null;
  const patterns = [/S&P 500/i, /S&P MidCap 400/i, /NASDAQ[- ]?100/i, /Russell 2000/i,
    /Russell 1000/i, /MSCI World/i, /MSCI EAFE/i, /MSCI Emerging Markets/i,
    /Dow Jones Industrial Average/i];
  for (const p of patterns) {
    const m = description.match(p);
    if (m) return m[0].trim();
  }
  return null;
}

// ============================================================================
// METRICS CALCULATION
// ============================================================================

function calcReturn(prices, days) {
  if (prices.length < 2) return null;
  const sorted = [...prices].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latest = sorted[0].adjusted_close;
  const target = new Date();
  target.setDate(target.getDate() - days);

  let closest = null, minDiff = Infinity;
  for (const p of sorted) {
    const diff = Math.abs(new Date(p.date) - target);
    if (diff < minDiff) { minDiff = diff; closest = p; }
  }
  if (!closest || minDiff > 10 * 86400000) return null;
  return (latest - closest.adjusted_close) / closest.adjusted_close;
}

function calcYTD(prices) {
  if (prices.length < 2) return null;
  const sorted = [...prices].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latest = sorted[0].adjusted_close;
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  let closest = null, minDiff = Infinity;
  for (const p of sorted) {
    if (new Date(p.date) < yearStart) {
      const diff = yearStart - new Date(p.date);
      if (diff < minDiff) { minDiff = diff; closest = p; }
    }
  }
  if (!closest) return null;
  return (latest - closest.adjusted_close) / closest.adjusted_close;
}

function calcDailyReturns(prices) {
  const sorted = [...prices].sort((a, b) => new Date(a.date) - new Date(b.date));
  const returns = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i-1].adjusted_close;
    const curr = sorted[i].adjusted_close;
    if (prev > 0) returns.push((curr - prev) / prev);
  }
  return returns;
}

function calcVolatility(prices) {
  const dr = calcDailyReturns(prices);
  if (dr.length < 20) return null;
  const mean = dr.reduce((s, r) => s + r, 0) / dr.length;
  const variance = dr.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (dr.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

function calcSharpe(prices, rf = 0.05) {
  const ret = calcReturn(prices, 252);
  const vol = calcVolatility(prices);
  if (ret === null || !vol || vol === 0) return null;
  return (ret - rf) / vol;
}

function calcMaxDrawdown(prices) {
  if (prices.length < 2) return null;
  const sorted = [...prices].sort((a, b) => new Date(a.date) - new Date(b.date));
  let peak = sorted[0].adjusted_close, maxDD = 0;
  for (const p of sorted) {
    if (p.adjusted_close > peak) peak = p.adjusted_close;
    const dd = (peak - p.adjusted_close) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function calcBeta(prices, benchPrices) {
  const pm = new Map(), bm = new Map();
  for (const p of prices) pm.set(p.date, p.adjusted_close);
  for (const p of benchPrices) bm.set(p.date, p.adjusted_close);
  const common = [...pm.keys()].filter(d => bm.has(d)).sort();
  if (common.length < 30) return null;

  const ar = [], br = [];
  for (let i = 1; i < common.length; i++) {
    ar.push((pm.get(common[i]) - pm.get(common[i-1])) / pm.get(common[i-1]));
    br.push((bm.get(common[i]) - bm.get(common[i-1])) / bm.get(common[i-1]));
  }
  const am = ar.reduce((s,r) => s+r, 0) / ar.length;
  const bMean = br.reduce((s,r) => s+r, 0) / br.length;
  let cov = 0, vari = 0;
  for (let i = 0; i < ar.length; i++) {
    cov += (ar[i] - am) * (br[i] - bMean);
    vari += Math.pow(br[i] - bMean, 2);
  }
  cov /= ar.length - 1;
  vari /= br.length - 1;
  return vari === 0 ? null : cov / vari;
}

function calcRSI(prices, period = 14) {
  const sorted = [...prices].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sorted.length < period + 1) return null;
  const changes = [];
  for (let i = 1; i < sorted.length; i++)
    changes.push(sorted[i].adjusted_close - sorted[i-1].adjusted_close);
  const recent = changes.slice(-period);
  const gains = recent.filter(c => c > 0);
  const losses = recent.filter(c => c < 0).map(c => Math.abs(c));
  const avgGain = gains.reduce((s,g) => s+g, 0) / period;
  const avgLoss = losses.reduce((s,l) => s+l, 0) / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calcMA(prices, period) {
  const sorted = [...prices].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sorted.length < period) return null;
  return sorted.slice(0, period).reduce((s, p) => s + p.adjusted_close, 0) / period;
}

function calc52WHL(prices) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const recent = prices.filter(p => new Date(p.date) >= oneYearAgo);
  if (!recent.length) return { high: null, low: null };
  const closes = recent.map(p => p.adjusted_close);
  return { high: Math.max(...closes), low: Math.min(...closes) };
}

// ============================================================================
// PROGRESS FILE
// ============================================================================

const fs = require('fs');

function loadProgress() {
  try {
    if (fs.existsSync(CONFIG.progress_file))
      return JSON.parse(fs.readFileSync(CONFIG.progress_file, 'utf-8'));
  } catch {}
  return null;
}

function saveProgress(p) {
  p.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(CONFIG.progress_file, JSON.stringify(p, null, 2));
}

// ============================================================================
// DB OPERATIONS
// ============================================================================

async function upsertEtf(client, data) {
  const sql = `
    INSERT INTO "Etf" (
      ticker, name, exchange, country, currency,
      "assetClass", "strategyType", summary,
      "investmentPhilosophy", "benchmarkIndex",
      "equityAllocation", "bondAllocation", "cashAllocation", "otherAllocation",
      "megaCapAllocation", "bigCapAllocation", "mediumCapAllocation",
      "smallCapAllocation", "microCapAllocation",
      "priceToBook", "priceToSales", "priceToCashFlow", "projectedEarningsGrowth",
      "netExpenseRatio", turnover, aum, "inceptionDate",
      "dividendYield", "betaVsMarket",
      "createdAt", "updatedAt"
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,
      $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,
      NOW(), NOW()
    )
    ON CONFLICT (ticker) DO UPDATE SET
      name=$2, "assetClass"=$6, "strategyType"=$7, summary=$8,
      "investmentPhilosophy"=$9, "benchmarkIndex"=$10,
      "equityAllocation"=$11, "bondAllocation"=$12, "cashAllocation"=$13, "otherAllocation"=$14,
      "megaCapAllocation"=$15, "bigCapAllocation"=$16, "mediumCapAllocation"=$17,
      "smallCapAllocation"=$18, "microCapAllocation"=$19,
      "priceToBook"=$20, "priceToSales"=$21, "priceToCashFlow"=$22, "projectedEarningsGrowth"=$23,
      "netExpenseRatio"=$24, turnover=$25, aum=$26,
      "dividendYield"=$28, "betaVsMarket"=$29,
      "updatedAt"=NOW()
    RETURNING id
  `;

  const vals = [
    data.ticker, data.name, data.exchange, data.country, data.currency,
    data.assetClass, data.strategyType, data.summary,
    data.investmentPhilosophy, data.benchmarkIndex,
    data.equityAllocation, data.bondAllocation, data.cashAllocation, data.otherAllocation,
    data.megaCapAllocation, data.bigCapAllocation, data.mediumCapAllocation,
    data.smallCapAllocation, data.microCapAllocation,
    data.priceToBook, data.priceToSales, data.priceToCashFlow, data.projectedEarningsGrowth,
    data.netExpenseRatio, data.turnover, data.aum, data.inceptionDate,
    data.dividendYield, data.betaVsMarket,
  ];

  const res = await client.query(sql, vals);
  return res.rows[0].id;
}

async function upsertHoldings(client, etfId, holdings, asOfDate) {
  for (const h of holdings) {
    await client.query(`
      INSERT INTO "EtfHolding" ("etfId", "holdingTicker", "holdingName", weight, sector, industry, "asOfDate")
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT ("etfId", "holdingTicker", "asOfDate") DO UPDATE SET
        "holdingName"=$3, weight=$4, sector=$5, industry=$6
    `, [etfId, h.Code, h.Name || h.Code, h['Assets_%'], h.Sector || null, h.Industry || null, asOfDate]);
  }
}

async function upsertSectors(client, etfId, sectors, asOfDate) {
  for (const [sector, data] of Object.entries(sectors)) {
    const weight = safeFloat(data['Equity_%'] || data.Equity_Percentage);
    if (weight && weight > 0) {
      await client.query(`
        INSERT INTO "EtfSectorWeight" ("etfId", sector, weight, "asOfDate")
        VALUES ($1,$2,$3,$4)
        ON CONFLICT ("etfId", sector, "asOfDate") DO UPDATE SET weight=$3
      `, [etfId, sector, weight, asOfDate]);
    }
  }
}

async function upsertPrices(client, ticker, prices) {
  for (const p of prices) {
    if (!p.adjusted_close || p.adjusted_close <= 0) continue;
    const date = new Date(p.date);
    date.setHours(0, 0, 0, 0);
    await client.query(`
      INSERT INTO "PriceBar" (symbol, date, open, high, low, close, volume, "adjustedClose")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (symbol, date) DO UPDATE SET
        open=$3, high=$4, low=$5, close=$6, volume=$7, "adjustedClose"=$8
    `, [ticker, date, p.open, p.high, p.low, p.close, p.volume || 0, p.adjusted_close]);
  }
}

async function upsertMetrics(client, etfId, prices, benchPrices) {
  const asOfDate = new Date(); asOfDate.setHours(0,0,0,0);

  const ret1M    = calcReturn(prices, 21);
  const ret3M    = calcReturn(prices, 63);
  const ret6M    = calcReturn(prices, 126);
  const ret1Y    = calcReturn(prices, 252);
  const ret3Y    = calcReturn(prices, 756);
  const ret5Y    = calcReturn(prices, 1260);
  const retYTD   = calcYTD(prices);
  const volatility  = calcVolatility(prices);
  const sharpe      = calcSharpe(prices);
  const maxDrawdown = calcMaxDrawdown(prices);
  const beta        = calcBeta(prices, benchPrices);
  const rsi14       = calcRSI(prices);
  const ma20        = calcMA(prices, 20);
  const ma50        = calcMA(prices, 50);
  const ma200       = calcMA(prices, 200);
  const { high: hi52w, low: lo52w } = calc52WHL(prices);
  const latestPrice = prices.sort((a,b) => new Date(b.date) - new Date(a.date))[0]?.adjusted_close || null;

  const trailingReturnsJson = JSON.stringify({
    '1M': ret1M, '3M': ret3M, '6M': ret6M,
    '1Y': ret1Y, '3Y': ret3Y, '5Y': ret5Y, 'YTD': retYTD,
  });

  await client.query(`
    INSERT INTO "EtfMetricSnapshot" (
      "etfId", "asOfDate", "trailingReturnsJson",
      "return1M", "return3M", "return6M", "return1Y", "return3Y", "return5Y", "returnYTD",
      volatility, sharpe, "maxDrawdown", beta,
      rsi14, ma20, ma50, ma200, hi52w, lo52w, "latestPrice"
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
    )
    ON CONFLICT ("etfId", "asOfDate") DO UPDATE SET
      "trailingReturnsJson"=$3,
      "return1M"=$4, "return3M"=$5, "return6M"=$6,
      "return1Y"=$7, "return3Y"=$8, "return5Y"=$9, "returnYTD"=$10,
      volatility=$11, sharpe=$12, "maxDrawdown"=$13, beta=$14,
      rsi14=$15, ma20=$16, ma50=$17, ma200=$18,
      hi52w=$19, lo52w=$20, "latestPrice"=$21
  `, [
    etfId, asOfDate, trailingReturnsJson,
    ret1M, ret3M, ret6M, ret1Y, ret3Y, ret5Y, retYTD,
    volatility, sharpe, maxDrawdown, beta,
    rsi14, ma20, ma50, ma200, hi52w, lo52w, latestPrice,
  ]);
}

// ============================================================================
// MAIN SYNC LOOP
// ============================================================================

async function main() {
  console.log('🚀 ETF Intelligence — Standalone Sync\n');
  console.log('═'.repeat(60));

  // Get S&P 500 benchmark prices for beta calculation
  console.log('📈 Loading SPY benchmark prices...');
  let benchPrices = [];
  try {
    benchPrices = await getHistoricalPrices('SPY');
    console.log(`  ✅ ${benchPrices.length} SPY price bars loaded\n`);
  } catch (e) {
    console.warn(`  ⚠️  Could not load SPY prices: ${e.message} — beta will be null\n`);
  }

  // Get ETF universe
  console.log('📊 Fetching US ETF universe from EODHD...');
  const allSymbols = await getExchangeSymbols();
  const etfSymbols = Array.isArray(allSymbols)
    ? allSymbols.filter(s => s.Type === 'ETF')
    : [];
  console.log(`  ✅ ${etfSymbols.length} ETFs found\n`);

  if (etfSymbols.length === 0) {
    console.error('❌ No ETFs returned from EODHD. Check API key.');
    process.exit(1);
  }

  // Load or init progress
  let progress = loadProgress();
  let startIndex = 0;

  if (progress && progress.lastProcessedTicker) {
    const idx = etfSymbols.findIndex(s => s.Code === progress.lastProcessedTicker);
    startIndex = idx >= 0 ? idx + 1 : progress.processed;
    console.log(`📂 Resuming from ${progress.lastProcessedTicker} (${startIndex}/${etfSymbols.length})\n`);
  } else {
    progress = {
      totalEtfs: etfSymbols.length,
      processed: 0, succeeded: 0, failed: 0,
      lastProcessedTicker: '',
      failedTickers: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };
    console.log(`🆕 Starting fresh sync of ${etfSymbols.length} ETFs\n`);
  }

  const limit = CONFIG.max_etfs ? Math.min(startIndex + CONFIG.max_etfs, etfSymbols.length) : etfSymbols.length;
  const toProcess = etfSymbols.slice(startIndex, limit);
  const estMins = Math.ceil((toProcess.length * CONFIG.delay_ms * 2) / 60000);
  console.log(`🎯 Processing ${toProcess.length} ETFs (~${estMins} min estimated)\n`);
  console.log('═'.repeat(60));

  const client = await pool.connect();

  try {
    for (let i = 0; i < toProcess.length; i++) {
      const symbol = toProcess[i];
      const absIdx = startIndex + i;
      const pct = ((absIdx / etfSymbols.length) * 100).toFixed(1);
      process.stdout.write(`[${absIdx+1}/${etfSymbols.length}] (${pct}%) ${symbol.Code} ... `);

      try {
        // ── Step 1: Fundamentals ──────────────────────────────────────────
        const fund = await httpsGet(
          `https://eodhd.com/api/fundamentals/${symbol.Code}.US?api_token=${CONFIG.eodhd_api_key}&fmt=json`
        );

        if (!fund?.General?.Name) {
          console.log('⚠️  No data');
          progress.failed++;
          progress.failedTickers.push(symbol.Code);
        } else {
          const g = fund.General;
          const e = fund.ETF_Data || {};
          const asOfDate = new Date(); asOfDate.setHours(0,0,0,0);

          const equityAllocation = (() => {
            const us = safeFloat(e?.Asset_Allocation?.['Stock US']?.['Net_Assets_%']);
            const non = safeFloat(e?.Asset_Allocation?.['Stock non-US']?.['Net_Assets_%']);
            if (us !== null && non !== null) return us + non;
            return us ?? non ?? null;
          })();

          const etfId = await upsertEtf(client, {
            ticker:               symbol.Code,
            name:                 g.Name,
            exchange:             g.Exchange,
            country:              g.CountryName || 'US',
            currency:             g.CurrencyCode || 'USD',
            assetClass:           determineAssetClass(g, e),
            strategyType:         g.Category || null,
            summary:              g.Description || null,
            investmentPhilosophy: g.Description || null,
            benchmarkIndex:       extractBenchmark(g.Description) || e.Index_Name || null,
            equityAllocation,
            bondAllocation:       safeFloat(e?.Asset_Allocation?.Bond?.['Net_Assets_%']),
            cashAllocation:       safeFloat(e?.Asset_Allocation?.Cash?.['Net_Assets_%']),
            otherAllocation:      safeFloat(e?.Asset_Allocation?.Other?.['Net_Assets_%']),
            megaCapAllocation:    safeFloat(e?.Market_Capitalisation?.Mega),
            bigCapAllocation:     safeFloat(e?.Market_Capitalisation?.Big),
            mediumCapAllocation:  safeFloat(e?.Market_Capitalisation?.Medium),
            smallCapAllocation:   safeFloat(e?.Market_Capitalisation?.Small),
            microCapAllocation:   safeFloat(e?.Market_Capitalisation?.Micro),
            priceToBook:          safeFloat(e?.Valuations_Growth?.Valuations_Rates_Portfolio?.['Price/Book']),
            priceToSales:         safeFloat(e?.Valuations_Growth?.Valuations_Rates_Portfolio?.['Price/Sales']),
            priceToCashFlow:      safeFloat(e?.Valuations_Growth?.Valuations_Rates_Portfolio?.['Price/Cash Flow']),
            projectedEarningsGrowth: safeFloat(e?.Valuations_Growth?.Growth_Rates_Portfolio?.['Long-Term Projected Earnings Growth']),
            netExpenseRatio:      safeFloat(e?.NetExpenseRatio),
            turnover:             safeFloat(e?.AnnualHoldingsTurnover),
            aum:                  safeFloat(e?.TotalAssets),
            inceptionDate:        e?.Inception_Date ? new Date(e.Inception_Date) : null,
            dividendYield:        safeFloat(e?.Yield),
            betaVsMarket:         safeFloat(fund?.Technicals?.Beta),
          });

          // ── Step 2: Holdings ───────────────────────────────────────────
          if (e.Holdings) {
            const holdings = Object.values(e.Holdings).filter(h => h.Code && h['Assets_%'] > 0);
            await upsertHoldings(client, etfId, holdings, asOfDate);
          }

          // ── Step 3: Sectors ────────────────────────────────────────────
          if (e.Sector_Weights) {
            await upsertSectors(client, etfId, e.Sector_Weights, asOfDate);
          }

          // ── Step 4: Prices ─────────────────────────────────────────────
          let prices = [];
          try {
            prices = await httpsGet(
              `https://eodhd.com/api/eod/${symbol.Code}.US?api_token=${CONFIG.eodhd_api_key}&fmt=json&from=${fiveYearsAgo()}&to=${today()}`
            );
            if (Array.isArray(prices) && prices.length > 0) {
              await upsertPrices(client, symbol.Code, prices);
            }
          } catch (priceErr) {
            // Non-fatal — metrics will be null
          }

          // ── Step 5: Metrics ────────────────────────────────────────────
          if (Array.isArray(prices) && prices.length >= 20) {
            await upsertMetrics(client, etfId, prices, benchPrices);
          }

          progress.succeeded++;
          console.log(`✅`);
        }
      } catch (err) {
        console.log(`❌ ${err.message}`);
        progress.failed++;
        progress.failedTickers.push(symbol.Code);
      }

      progress.processed++;
      progress.lastProcessedTicker = symbol.Code;

      // Checkpoint
      if (progress.processed % CONFIG.batch_size === 0) {
        saveProgress(progress);
        console.log(`  💾 Checkpoint: ${progress.processed}/${etfSymbols.length} (${progress.succeeded} ok, ${progress.failed} failed)`);
      }

      // Rate limit
      await new Promise(r => setTimeout(r, CONFIG.delay_ms));
    }
  } finally {
    client.release();
    saveProgress(progress);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Sync complete!\n');
  console.log(`  Processed: ${progress.processed}`);
  console.log(`  Succeeded: ${progress.succeeded}`);
  console.log(`  Failed:    ${progress.failed}`);
  if (progress.failedTickers.length > 0) {
    console.log(`  Failed tickers: ${progress.failedTickers.slice(0, 20).join(', ')}${progress.failedTickers.length > 20 ? '...' : ''}`);
  }

  await pool.end();
}

function fiveYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().split('T')[0];
}

function today() {
  return new Date().toISOString().split('T')[0];
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  pool.end();
  process.exit(1);
});
