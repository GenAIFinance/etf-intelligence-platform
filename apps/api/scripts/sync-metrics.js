/**
 * ETF Intelligence — Full Metrics Sync Script
 *
 * ============================================================================
 * MODES
 * ============================================================================
 *
 *  --daily          1 call/ETF  Last 45 days prices → latestPrice, return1M,
 *                               return3M, avgVolume30d. Run every trading day.
 *
 *  (no flag)        1 call/ETF  Fundamentals → fundFamily, 52W hi/lo,
 *                               MA50, MA200, beta. Run weekly (Sunday).
 *
 *  --prices-only    1 call/ETF  5Y prices → all returns + vol + Sharpe +
 *                               maxDrawdown + avgVolume30d. Run monthly.
 *
 *  --full           2 calls/ETF Both fundamentals + 5Y prices. Full refresh.
 *                               Run monthly or after DB reset.
 *
 * ============================================================================
 * OPTIONS (combine with any mode)
 * ============================================================================
 *
 *  --test           Process first 10 ETFs only — always test before full run
 *  --top 500        Process top N ETFs by AUM (e.g. --top 500)
 *  --reset          Delete progress file and start from scratch
 *
 * ============================================================================
 * RECOMMENDED SCHEDULE
 * ============================================================================
 *
 *  Daily   (Mon–Fri after 4pm ET): node sync-metrics.js --daily
 *  Weekly  (Sunday):               node sync-metrics.js
 *  Monthly (1st of month):         node sync-metrics.js --prices-only
 *
 * ============================================================================
 * SETUP
 * ============================================================================
 *
 *  set EODHD_API_KEY=your_key
 *  set DATABASE_URL=postgresql://...
 *  node sync-metrics.js --daily --test
 */

'use strict';

const { Pool } = require('pg');
const https    = require('https');
const fs       = require('fs');

// ============================================================================
// ARGS
// ============================================================================

const ARGS             = process.argv.slice(2);
const MODE_DAILY       = ARGS.includes('--daily');
const MODE_PRICES_ONLY = ARGS.includes('--prices-only');
const MODE_FULL        = ARGS.includes('--full');
const MODE_TEST        = ARGS.includes('--test');
const MODE_RESET       = ARGS.includes('--reset');
const TOP_N            = (() => {
  const idx = ARGS.indexOf('--top');
  if (idx >= 0 && ARGS[idx + 1]) {
    const n = parseInt(ARGS[idx + 1], 10);
    return isNaN(n) ? null : n;
  }
  return null;
})();

// Derive mode name for progress file naming and labels
const MODE_NAME = MODE_DAILY       ? 'daily'
                : MODE_FULL        ? 'full'
                : MODE_PRICES_ONLY ? 'prices'
                : 'technicals';

// ============================================================================
// CONFIG
// ============================================================================

const CONFIG = {
  eodhd_api_key:  process.env.EODHD_API_KEY,
  database_url:   process.env.DATABASE_URL,
  delay_ms:       300,    // 300ms between ETFs — safe for 100k/day EODHD limit
  batch_size:     50,     // checkpoint + progress save every N ETFs
  risk_free_rate: 0.05,   // 5% annual risk-free rate for Sharpe calculation
  retry_attempts: 3,      // retries on rate-limit or network errors
  retry_base_ms:  2000,   // base delay for exponential backoff (2s → 4s → 8s)
  progress_file:  `sync-progress-${MODE_NAME}${TOP_N ? `-top${TOP_N}` : ''}.json`,
};

// ── Validation ────────────────────────────────────────────────────────────────

if (!CONFIG.eodhd_api_key) {
  console.error('❌ EODHD_API_KEY not set.');
  console.error('   set EODHD_API_KEY=your_key_here');
  process.exit(1);
}

if (!CONFIG.database_url) {
  console.error('❌ DATABASE_URL not set.');
  console.error('   set DATABASE_URL=postgresql://postgres.xxx:PASSWORD@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true');
  process.exit(1);
}

if ([MODE_DAILY, MODE_PRICES_ONLY, MODE_FULL].filter(Boolean).length > 1) {
  console.error('❌ Conflicting mode flags. Use only one of: --daily, --prices-only, --full');
  process.exit(1);
}

// ============================================================================
// HTTP — with retry + backoff
// ============================================================================

let apiCallCount = 0;

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        apiCallCount++;
        if (res.statusCode === 429) {
          reject(new RateLimitError('Rate limit hit (429)'));
          return;
        }
        if (res.statusCode >= 500) {
          reject(new Error(`EODHD server error ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`JSON parse error — response: ${data.substring(0, 120)}`));
        }
      });
    }).on('error', reject);
  });
}

class RateLimitError extends Error {
  constructor(msg) { super(msg); this.name = 'RateLimitError'; }
}

async function httpsGetWithRetry(url) {
  let lastErr;
  for (let attempt = 1; attempt <= CONFIG.retry_attempts; attempt++) {
    try {
      return await httpsGet(url);
    } catch (err) {
      lastErr = err;
      const isRetryable = err instanceof RateLimitError || err.message.includes('server error');
      if (!isRetryable || attempt === CONFIG.retry_attempts) throw err;
      const waitMs = CONFIG.retry_base_ms * Math.pow(2, attempt - 1);
      console.log(`\n  ⏳ Retry ${attempt}/${CONFIG.retry_attempts} in ${waitMs / 1000}s — ${err.message}`);
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

// ============================================================================
// UTILITIES
// ============================================================================

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function safeFloat(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

function formatDuration(ms) {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function isWeekend() {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

// ============================================================================
// DATE HELPERS
// ============================================================================

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function fiveYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().split('T')[0];
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ============================================================================
// METRICS CALCULATIONS — pure functions, no side effects
// ============================================================================

function calcReturn(prices, days) {
  if (!prices || prices.length < 2) return null;
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
  if (!prices || prices.length < 2) return null;
  const sorted = [...prices].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latest = sorted[0].adjusted_close;
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  let closest = null, minDiff = Infinity;
  for (const p of sorted) {
    const d = new Date(p.date);
    if (d < yearStart) {
      const diff = yearStart - d;
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
    const prev = sorted[i - 1].adjusted_close;
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

function calcSharpe(prices, rf) {
  const ret1Y = calcReturn(prices, 252);
  const vol   = calcVolatility(prices);
  if (ret1Y === null || vol === null || vol === 0) return null;
  return (ret1Y - rf) / vol;
}

function calcMaxDrawdown(prices) {
  if (!prices || prices.length < 2) return null;
  const sorted = [...prices].sort((a, b) => new Date(a.date) - new Date(b.date));
  let peak = sorted[0].adjusted_close;
  let maxDD = 0;
  for (const p of sorted) {
    if (p.adjusted_close > peak) peak = p.adjusted_close;
    const dd = (peak - p.adjusted_close) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function calcAvgVolume30d(prices) {
  if (!prices || prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => new Date(b.date) - new Date(a.date));
  const last30 = sorted.slice(0, 30);
  if (last30.length === 0) return null;
  const total = last30.reduce((sum, p) => sum + (safeFloat(p.volume) ?? 0), 0);
  return total / last30.length;
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

/**
 * Technicals mode — writes 52W hi/lo, MAs, beta to EtfMetricSnapshot.
 * COALESCE ensures existing values are preserved if new value is null.
 */
async function saveTechnicals(client, etfId, tech) {
  const asOfDate = new Date(); asOfDate.setHours(0, 0, 0, 0);
  await client.query(`
    INSERT INTO "EtfMetricSnapshot" (
      "etfId", "asOfDate", "trailingReturnsJson",
      hi52w, lo52w, ma50, ma200, beta
    ) VALUES ($1, $2, '{}', $3, $4, $5, $6, $7)
    ON CONFLICT ("etfId", "asOfDate") DO UPDATE SET
      hi52w  = COALESCE($3, "EtfMetricSnapshot".hi52w),
      lo52w  = COALESCE($4, "EtfMetricSnapshot".lo52w),
      ma50   = COALESCE($5, "EtfMetricSnapshot".ma50),
      ma200  = COALESCE($6, "EtfMetricSnapshot".ma200),
      beta   = COALESCE($7, "EtfMetricSnapshot".beta)
  `, [
    etfId, asOfDate,
    tech.hi52w, tech.lo52w, tech.ma50, tech.ma200, tech.beta,
  ]);
}

/**
 * Daily mode — writes only short-term metrics from 45-day price window.
 * Preserves existing long-term metrics (3Y/5Y returns, vol, Sharpe, maxDD).
 */
async function saveDailyMetrics(client, etfId, prices) {
  const asOfDate    = new Date(); asOfDate.setHours(0, 0, 0, 0);
  const sorted      = [...prices].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latestPrice = sorted[0]?.adjusted_close ?? null;
  const ret1M       = calcReturn(prices, 21);
  const ret3M       = calcReturn(prices, 63);
  const avgVol30d   = calcAvgVolume30d(prices);

  await client.query(`
    INSERT INTO "EtfMetricSnapshot" (
      "etfId", "asOfDate", "trailingReturnsJson",
      "latestPrice", "return1M", "return3M", "avgVolume30d"
    ) VALUES ($1, $2, '{}', $3, $4, $5, $6)
    ON CONFLICT ("etfId", "asOfDate") DO UPDATE SET
      "latestPrice"  = COALESCE($3, "EtfMetricSnapshot"."latestPrice"),
      "return1M"     = COALESCE($4, "EtfMetricSnapshot"."return1M"),
      "return3M"     = COALESCE($5, "EtfMetricSnapshot"."return3M"),
      "avgVolume30d" = COALESCE($6, "EtfMetricSnapshot"."avgVolume30d")
  `, [etfId, asOfDate, latestPrice, ret1M, ret3M, avgVol30d]);
}

/**
 * Prices mode — writes all returns, risk metrics, and avgVolume30d.
 * Used by both --prices-only and --full modes.
 */
async function savePricesAndMetrics(client, etfId, prices) {
  const asOfDate    = new Date(); asOfDate.setHours(0, 0, 0, 0);
  const ret1M       = calcReturn(prices, 21);
  const ret3M       = calcReturn(prices, 63);
  const ret6M       = calcReturn(prices, 126);
  const ret1Y       = calcReturn(prices, 252);
  const ret3Y       = (() => { const r = calcReturn(prices, 756);  return r !== null ? Math.pow(1 + r, 1/3) - 1 : null; })();
  const ret5Y       = (() => { const r = calcReturn(prices, 1260); return r !== null ? Math.pow(1 + r, 1/5) - 1 : null; })();
  const retYTD      = calcYTD(prices);
  const vol         = calcVolatility(prices);
  const sharpe      = calcSharpe(prices, CONFIG.risk_free_rate);
  const maxDD       = calcMaxDrawdown(prices);
  const avgVol30d   = calcAvgVolume30d(prices);
  const sorted      = [...prices].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latestPrice = sorted[0]?.adjusted_close ?? null;

  await client.query(`
    INSERT INTO "EtfMetricSnapshot" (
      "etfId", "asOfDate", "trailingReturnsJson",
      "return1M", "return3M", "return6M", "return1Y", "return3Y", "return5Y", "returnYTD",
      volatility, sharpe, "maxDrawdown", "latestPrice", "avgVolume30d"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    ON CONFLICT ("etfId", "asOfDate") DO UPDATE SET
      "trailingReturnsJson" = $3,
      "return1M"    = $4,  "return3M"    = $5,  "return6M"  = $6,
      "return1Y"    = $7,  "return3Y"    = $8,  "return5Y"  = $9,  "returnYTD" = $10,
      volatility    = $11, sharpe        = $12, "maxDrawdown" = $13,
      "latestPrice" = $14, "avgVolume30d" = $15
  `, [
    etfId, asOfDate,
    JSON.stringify({ '1M': ret1M, '3M': ret3M, '6M': ret6M, '1Y': ret1Y, '3Y': ret3Y, '5Y': ret5Y, 'YTD': retYTD }),
    ret1M, ret3M, ret6M, ret1Y, ret3Y, ret5Y, retYTD,
    vol, sharpe, maxDD, latestPrice, avgVol30d,
  ]);
}

/**
 * Writes fundFamily to the Etf row.
 * Called during technicals and full modes — 0 extra API calls.
 */
async function saveEtfMeta(client, etfId, fundFamily) {
  if (!fundFamily) return;
  await client.query(
    `UPDATE "Etf" SET "fundFamily" = $2 WHERE id = $1`,
    [etfId, fundFamily.trim()]
  );
}

// ============================================================================
// PROGRESS
// ============================================================================

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

function deleteProgress() {
  if (fs.existsSync(CONFIG.progress_file)) {
    fs.unlinkSync(CONFIG.progress_file);
    console.log(`🗑  Progress file deleted: ${CONFIG.progress_file}`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // ── Header ─────────────────────────────────────────────────────────────────
  console.log('\n🚀 ETF Intelligence — Metrics Sync');
  console.log('═'.repeat(60));

  const modeLabel = MODE_DAILY       ? 'DAILY       — latestPrice, return1M, return3M, avgVolume30d'
                  : MODE_FULL        ? 'FULL        — technicals + 5Y prices (all metrics)'
                  : MODE_PRICES_ONLY ? 'PRICES ONLY — 5Y prices, all returns + risk metrics'
                  :                    'TECHNICALS  — fundFamily, 52W hi/lo, MA50, MA200, beta';

  console.log(`  Mode:      ${modeLabel}`);
  console.log(`  API calls: ${MODE_FULL ? '2 per ETF' : '1 per ETF'}`);
  if (TOP_N)      console.log(`  Scope:     Top ${TOP_N} ETFs by AUM`);
  if (MODE_TEST)  console.log('  ⚠️  TEST MODE — first 10 ETFs only');

  // ── Weekend warning (prices don't update on non-trading days) ──────────────
  if (MODE_DAILY && isWeekend()) {
    console.log('\n  ⚠️  WARNING: Today is a weekend. Price data will not have changed.');
    console.log('     Run --daily on trading days (Mon–Fri) after 4pm ET for fresh data.');
  }

  // ── Reset progress if requested ────────────────────────────────────────────
  if (MODE_RESET) deleteProgress();

  console.log('═'.repeat(60));

  // ── Load ETF list ───────────────────────────────────────────────────────────
  const dbClient = await pool.connect();
  let etfs;
  try {
    let query = `SELECT id, ticker FROM "Etf" ORDER BY aum DESC NULLS LAST`;
    if (TOP_N) query += ` LIMIT ${TOP_N}`;
    const res = await dbClient.query(query);
    etfs = MODE_TEST ? res.rows.slice(0, 10) : res.rows;
    console.log(`\n📊 ${etfs.length} ETFs to process`);
  } finally {
    dbClient.release();
  }

  // ── Estimates ───────────────────────────────────────────────────────────────
  const callsPerEtf = MODE_FULL ? 2 : 1;
  const totalCalls  = etfs.length * callsPerEtf;
  const estMs       = etfs.length * CONFIG.delay_ms * callsPerEtf;
  console.log(`📡 ~${totalCalls} API calls  |  ⏱ ~${formatDuration(estMs)} estimated`);
  console.log('═'.repeat(60));

  // ── Load / init progress ────────────────────────────────────────────────────
  let progress   = loadProgress();
  let startIndex = 0;

  if (progress?.lastProcessedTicker) {
    const idx = etfs.findIndex(e => e.ticker === progress.lastProcessedTicker);
    startIndex = idx >= 0 ? idx + 1 : progress.processed;
    const remaining = etfs.length - startIndex;
    console.log(`\n📂 Resuming from ${progress.lastProcessedTicker} (${startIndex}/${etfs.length}, ${remaining} remaining)\n`);
  } else {
    progress = {
      mode: MODE_NAME, total: etfs.length, processed: 0,
      succeeded: 0, failed: 0, skipped: 0,
      lastProcessedTicker: '', failedTickers: [],
      startedAt: new Date().toISOString(),
    };
    console.log('\n🆕 Starting fresh\n');
  }

  // ── Main loop ───────────────────────────────────────────────────────────────
  const toProcess = etfs.slice(startIndex);
  const client    = await pool.connect();
  const startTime = Date.now();

  try {
    for (let i = 0; i < toProcess.length; i++) {
      const etf    = toProcess[i];
      const absIdx = startIndex + i;
      const pct    = ((absIdx / etfs.length) * 100).toFixed(1);

      // ETA calculation
      const elapsed  = Date.now() - startTime;
      const doneNow  = i + 1;
      const msPerEtf = doneNow > 0 ? elapsed / doneNow : CONFIG.delay_ms;
      const remaining = toProcess.length - doneNow;
      const etaStr   = doneNow > 5 ? ` ETA ${formatDuration(remaining * msPerEtf)}` : '';

      process.stdout.write(`[${absIdx + 1}/${etfs.length}] (${pct}%)${etaStr} ${etf.ticker.padEnd(8)} `);

      try {

        // ── DAILY MODE — 45 days prices, short-term metrics only ────────────
        if (MODE_DAILY) {
          const prices = await httpsGetWithRetry(
            `https://eodhd.com/api/eod/${etf.ticker}.US?api_token=${CONFIG.eodhd_api_key}&fmt=json&from=${daysAgo(60)}&to=${today()}`
          );
          if (!Array.isArray(prices) || prices.length < 5) {
            console.log(`⚠️  Insufficient data (${Array.isArray(prices) ? prices.length : typeof prices} bars)`);
            progress.skipped++;
          } else {
            await saveDailyMetrics(client, etf.id, prices);
            console.log(`✅ ${prices.length} bars`);
            progress.succeeded++;
          }

        // ── PRICES ONLY — 5Y prices, all return + risk metrics ──────────────
        } else if (MODE_PRICES_ONLY) {
          const prices = await httpsGetWithRetry(
            `https://eodhd.com/api/eod/${etf.ticker}.US?api_token=${CONFIG.eodhd_api_key}&fmt=json&from=${fiveYearsAgo()}&to=${today()}`
          );
          if (!Array.isArray(prices) || prices.length < 20) {
            console.log(`⚠️  Insufficient data (${Array.isArray(prices) ? prices.length : typeof prices} bars)`);
            progress.skipped++;
          } else {
            await savePricesAndMetrics(client, etf.id, prices);
            console.log(`✅ ${prices.length} bars`);
            progress.succeeded++;
          }

        // ── TECHNICALS + optional FULL ───────────────────────────────────────
        } else {
          // Step 1: Fundamentals — always fetched in technicals + full modes
          const fund = await httpsGetWithRetry(
            `https://eodhd.com/api/fundamentals/${etf.ticker}.US?api_token=${CONFIG.eodhd_api_key}&fmt=json`
          );
          const tech       = fund?.Technicals;
          const fundFamily = fund?.ETF_Data?.Company_Name ?? null;

          if (!tech) {
            console.log('⚠️  No Technicals in response');
            progress.skipped++;
          } else {
            await saveTechnicals(client, etf.id, {
              hi52w: safeFloat(tech['52WeekHigh']),
              lo52w: safeFloat(tech['52WeekLow']),
              ma50:  safeFloat(tech['50DayMA']),
              ma200: safeFloat(tech['200DayMA']),
              beta:  safeFloat(tech['Beta']),
            });
            await saveEtfMeta(client, etf.id, fundFamily);

            // Step 2: Prices — only in full mode
            if (MODE_FULL) {
              const prices = await httpsGetWithRetry(
                `https://eodhd.com/api/eod/${etf.ticker}.US?api_token=${CONFIG.eodhd_api_key}&fmt=json&from=${fiveYearsAgo()}&to=${today()}`
              );
              if (!Array.isArray(prices) || prices.length < 20) {
                console.log(`⚠️  Insufficient price data (${Array.isArray(prices) ? prices.length : typeof prices} bars)`);
                progress.skipped++;
              } else {
                await savePricesAndMetrics(client, etf.id, prices);
                console.log(`✅ tech + ${prices.length} bars | ${fundFamily ?? 'no family'}`);
                progress.succeeded++;
              }
            } else {
              console.log(`✅ tech | ${fundFamily ?? 'no family'}`);
              progress.succeeded++;
            }
          }
        }

      } catch (err) {
        const msg = err.message.substring(0, 80);
        console.log(`❌ ${msg}`);
        progress.failed++;
        if (!progress.failedTickers.includes(etf.ticker))
          progress.failedTickers.push(etf.ticker);
      }

      progress.processed++;
      progress.lastProcessedTicker = etf.ticker;

      // Checkpoint every batch_size ETFs
      if (progress.processed % CONFIG.batch_size === 0) {
        saveProgress(progress);
        const elapsed = formatDuration(Date.now() - startTime);
        console.log(`\n  💾 Checkpoint [${progress.processed}/${etfs.length}] | ✅${progress.succeeded} ⚠️${progress.skipped} ❌${progress.failed} | elapsed ${elapsed}\n`);
      }

      await sleep(CONFIG.delay_ms);
    }
  } finally {
    client.release();
    saveProgress(progress);
  }

  // ── Final summary ───────────────────────────────────────────────────────────
  const totalTime = formatDuration(Date.now() - startTime);
  console.log('\n' + '═'.repeat(60));
  console.log(`✅ Sync complete in ${totalTime}\n`);
  console.log(`  Total ETFs:  ${progress.processed}`);
  console.log(`  Succeeded:   ${progress.succeeded}`);
  console.log(`  Skipped:     ${progress.skipped}`);
  console.log(`  Failed:      ${progress.failed}`);
  console.log(`  API calls:   ${apiCallCount}`);
  if (progress.failedTickers.length > 0)
    console.log(`  Failed:      ${progress.failedTickers.slice(0, 20).join(', ')}${progress.failedTickers.length > 20 ? ` +${progress.failedTickers.length - 20} more` : ''}`);

  await pool.end();
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  pool.end();
  process.exit(1);
});
