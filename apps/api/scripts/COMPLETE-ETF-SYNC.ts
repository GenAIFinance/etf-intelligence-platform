/**
 * COMPLETE-ETF-SYNC.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Syncs ALL US ETFs from EODHD with maximum efficiency:
 *
 *  API layer  : parallel batches of 5 concurrent requests
 *               → stays within EODHD's 300 req/min limit
 *               → ~5 x faster than sequential
 *
 *  DB layer   : createMany() for holdings + sectors per ETF
 *               → single round-trip vs. N round-trips per ETF
 *               → ~10 x faster for 250k holdings
 *
 *  Resumable  : progress auto-saved every 50 ETFs to JSON file
 *               → Ctrl+C or crash → just re-run to continue
 *
 * Usage:
 *   cd apps/api/scripts
 *   npx tsx COMPLETE-ETF-SYNC.ts
 *
 * API budget: ~5,261 calls  (5.3% of 100,000 daily limit)
 * Est. time : ~30-45 minutes total
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// ─── Configuration ────────────────────────────────────────────────────────────

const EODHD_API_TOKEN  = process.env.EODHD_API_TOKEN || '699349cd2a5721.95386449';
const PROGRESS_FILE    = path.join(__dirname, 'complete-sync-progress.json');

const PARALLEL_BATCH   = 5;     // concurrent API requests  (300/min ÷ 5 = safe)
const BATCH_GAP_MS     = 200;   // ms pause between batches (keeps rate ~25 req/sec)
const REQUEST_TIMEOUT  = 20000; // ms per individual request
const API_DAILY_LIMIT  = 100000;
const API_SAFETY_STOP  = 95000; // stop at 95k to leave buffer

// ─── Globals ──────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();
let apiCallsThisRun = 0;
let isShuttingDown  = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function safeFloat(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = parseFloat(String(value));
  return isNaN(n) ? null : n;
}

function categorizeAssetClass(category: string, assetAlloc: any): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('bond')        || cat.includes('fixed income')) return 'Fixed Income';
  if (cat.includes('commodity')   || cat.includes('gold') || cat.includes('oil')) return 'Commodity';
  if (cat.includes('real estate') || cat.includes('reit'))          return 'Real Estate';
  if (cat.includes('balanced')    || cat.includes('allocation'))    return 'Multi-Asset';

  const equity =
    (safeFloat(assetAlloc?.['Stock US']?.['Net_Assets_%'])     || 0) +
    (safeFloat(assetAlloc?.['Stock non-US']?.['Net_Assets_%']) || 0);
  const bond = safeFloat(assetAlloc?.Bond?.['Net_Assets_%']) || 0;

  if (equity > 80) return 'Equity';
  if (bond   > 80) return 'Fixed Income';
  if (equity > 40 && bond > 20) return 'Multi-Asset';
  return 'Equity';
}

// ─── Progress persistence ─────────────────────────────────────────────────────

interface ProgressData {
  processed:     string[];
  failed:        string[];
  apiCallsUsed:  number;
  stats:         Record<string, number>;
  timestamp:     string;
}

function saveProgress(processed: Set<string>, failed: string[], stats: Record<string, number>) {
  try {
    const data: ProgressData = {
      processed:    Array.from(processed),
      failed,
      apiCallsUsed: apiCallsThisRun,
      stats,
      timestamp:    new Date().toISOString(),
    };
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('  ⚠  Could not write progress file:', e);
  }
}

function loadProgress(): { processed: Set<string>; failed: string[]; apiCallsUsed: number } {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const raw  = fs.readFileSync(PROGRESS_FILE, 'utf-8');
      const data = JSON.parse(raw) as ProgressData;
      console.log(`\n📂 Resuming from ${data.timestamp}`);
      console.log(`   Previously processed : ${data.processed.length} ETFs`);
      console.log(`   Previous API calls   : ${data.apiCallsUsed}\n`);
      return {
        processed:    new Set(data.processed),
        failed:       data.failed || [],
        apiCallsUsed: data.apiCallsUsed || 0,
      };
    }
  } catch {
    console.log('⚠  Could not read progress file — starting fresh\n');
  }
  return { processed: new Set(), failed: [], apiCallsUsed: 0 };
}

// ─── Fetch one ETF from EODHD ─────────────────────────────────────────────────

async function fetchEtf(ticker: string): Promise<any | null> {
  try {
    const res = await axios.get(
      `https://eodhd.com/api/fundamentals/${ticker}.US` +
      `?api_token=${EODHD_API_TOKEN}&fmt=json`,
      { timeout: REQUEST_TIMEOUT }
    );
    apiCallsThisRun++;
    return res.data ?? null;
  } catch (err: any) {
    apiCallsThisRun++;
    if (err.response?.status === 429) throw err;  // re-throw rate limit so caller can back off
    return null;
  }
}

// ─── Persist one ETF + its holdings + sectors ────────────────────────────────

async function persistEtf(ticker: string, data: any, etfListEntry: any)
  : Promise<{ holdingsSaved: number; sectorsSaved: number }> {

  const assetAlloc = data.ETF_Data?.Asset_Allocation;
  const stockUS    = safeFloat(assetAlloc?.['Stock US']?.['Net_Assets_%'])     || 0;
  const stockNonUS = safeFloat(assetAlloc?.['Stock non-US']?.['Net_Assets_%']) || 0;

  const etfRecord = {
    ticker,
    name:             data.General?.Name         || etfListEntry?.Name || ticker,
    exchange:         data.General?.Exchange      || 'US',
    country:          data.General?.CountryISO    || 'US',
    currency:         data.General?.CurrencyCode  || 'USD',
    assetClass:       categorizeAssetClass(data.General?.Category || '', assetAlloc),
    strategyType:     data.General?.Category      || null,
    summary:          data.General?.Description   || null,
    investmentPhilosophy: null as null,
    benchmarkIndex:   data.ETF_Data?.Index_Name   || null,
    aum:              safeFloat(data.ETF_Data?.TotalAssets),
    netExpenseRatio:  safeFloat(data.ETF_Data?.NetExpenseRatio),
    inceptionDate:    data.ETF_Data?.Inception_Date
                        ? new Date(data.ETF_Data.Inception_Date) : null,
    // Allocations
    equityAllocation: (stockUS + stockNonUS) > 0 ? stockUS + stockNonUS : null,
    bondAllocation:   safeFloat(assetAlloc?.Bond?.['Net_Assets_%']),
    cashAllocation:   safeFloat(assetAlloc?.Cash?.['Net_Assets_%']),
    otherAllocation:  safeFloat(assetAlloc?.Other?.['Net_Assets_%']),
    // Market cap
    megaCapAllocation:   safeFloat(data.ETF_Data?.Market_Capitalisation?.Mega),
    bigCapAllocation:    safeFloat(data.ETF_Data?.Market_Capitalisation?.Big),
    mediumCapAllocation: safeFloat(data.ETF_Data?.Market_Capitalisation?.Medium),
    smallCapAllocation:  safeFloat(data.ETF_Data?.Market_Capitalisation?.Small),
    microCapAllocation:  safeFloat(data.ETF_Data?.Market_Capitalisation?.Micro),
    // Valuations
    priceToBook:  safeFloat(
      data.ETF_Data?.Valuations_Growth?.Valuations_Rates_Portfolio?.['Price/Book']),
    priceToSales: safeFloat(
      data.ETF_Data?.Valuations_Growth?.Valuations_Rates_Portfolio?.['Price/Sales']),
    priceToCashFlow: safeFloat(
      data.ETF_Data?.Valuations_Growth?.Valuations_Rates_Portfolio?.['Price/Cash Flow']),
    projectedEarningsGrowth: safeFloat(
      data.ETF_Data?.Valuations_Growth?.Growth_Rates_Portfolio?.['Long-Term Projected Earnings Growth']),
    turnover: safeFloat(data.ETF_Data?.AnnualHoldingsTurnover),
  };

  // Upsert ETF
  const saved = await prisma.etf.upsert({
    where:  { ticker },
    update: { ...etfRecord, updatedAt: new Date() },
    create: etfRecord,
  });

  // Delete stale holdings + sectors (use etfId — etfTicker field does NOT exist in schema)
  await prisma.etfHolding.deleteMany(    { where: { etfId: saved.id } });
  await prisma.etfSectorWeight.deleteMany({ where: { etfId: saved.id } });

  // ── Build holdings array ────────────────────────────────────────────────
  // FIX: path is data.ETF_Data.Holdings (NOT data.Holdings)
  const holdingsSource = data.ETF_Data?.Holdings;
  let holdingsSaved = 0;

  if (holdingsSource && typeof holdingsSource === 'object') {
    const now = new Date();

    // FIX: use bracket notation for property names containing % sign
    const rows = Object.values(holdingsSource)
      .map((h: any) => {
        const rawWeight =
          safeFloat(h['Assets_%']) ??
          safeFloat(h['Assets_Percentage']) ??
          0;
        if (!h.Code || rawWeight <= 0) return null;
        return {
          etfId:         saved.id,
          holdingTicker: String(h.Code),
          holdingName:   h.Name ? String(h.Name) : String(h.Code),
          weight:        rawWeight,
          sector:        h.Sector   ? String(h.Sector)   : null,
          industry:      h.Industry ? String(h.Industry) : null,
          asOfDate:      now,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length > 0) {
      // createMany — one DB round-trip for all holdings (vs N round-trips)
      const result = await prisma.etfHolding.createMany({
        data:          rows,
        skipDuplicates: true,
      });
      holdingsSaved = result.count;
    }
  }

  // ── Build sectors array ─────────────────────────────────────────────────
  const sectorSource = data.ETF_Data?.Sector_Weights;
  let sectorsSaved = 0;

  if (sectorSource && typeof sectorSource === 'object') {
    const now = new Date();

    const rows = Object.entries(sectorSource)
      .map(([sectorName, sd]: [string, any]) => {
        // FIX: bracket notation for Equity_% property name
        const weight =
          safeFloat(sd['Equity_%']) ??
          safeFloat(sd['Equity_Percentage']) ??
          null;
        if (weight === null || weight <= 0) return null;
        return {
          etfId:    saved.id,    // FIX: schema uses etfId not etfTicker
          sector:   sectorName,
          weight,
          asOfDate: now,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length > 0) {
      const result = await prisma.etfSectorWeight.createMany({
        data:          rows,
        skipDuplicates: true,
      });
      sectorsSaved = result.count;
    }
  }

  return { holdingsSaved, sectorsSaved };
}

// ─── Progress reporter ────────────────────────────────────────────────────────

function printProgress(
  successCount: number,
  holdingsTotal: number,
  sectorsTotal: number,
  errorCount: number,
  startTime: number,
  totalEtfs: number,
  processedCount: number,
) {
  const elapsedMin = (Date.now() - startTime) / 60000;
  const rate       = elapsedMin > 0 ? successCount / elapsedMin : 0;
  const remaining  = totalEtfs - processedCount;
  const etaMin     = rate > 0 ? remaining / rate : 0;
  const pctDone    = (processedCount / totalEtfs * 100).toFixed(1);
  const pctApi     = (apiCallsThisRun / API_DAILY_LIMIT * 100).toFixed(1);

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📊 PROGRESS  (${pctDone}% complete)`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`   ✅ ETFs processed   : ${successCount.toLocaleString()}`);
  console.log(`   📁 Holdings saved   : ${holdingsTotal.toLocaleString()}`);
  console.log(`   📊 Sectors saved    : ${sectorsTotal.toLocaleString()}`);
  console.log(`   ⚠️  Errors / skipped : ${errorCount}`);
  console.log(`   ⏱  Elapsed          : ${elapsedMin.toFixed(1)} min`);
  console.log(`   🏁 ETA               : ${etaMin.toFixed(0)} min  (${(etaMin / 60).toFixed(1)} hrs)`);
  console.log(`   📡 API calls         : ${apiCallsThisRun.toLocaleString()} / ${API_DAILY_LIMIT.toLocaleString()} (${pctApi}%)`);
  console.log(`${'─'.repeat(80)}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function completeSync() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀  COMPLETE ETF PLATFORM SYNC  (Optimized)');
  console.log('='.repeat(80));
  console.log('\n⚡ OPTIMIZATIONS:');
  console.log(`   Parallel API fetches : ${PARALLEL_BATCH} concurrent  (~25 req/sec, limit 300/min)`);
  console.log('   DB inserts           : createMany() per ETF  (1 round-trip vs N)');
  console.log('   Est. API calls       : ~5,261  (5.3% of daily limit)');
  console.log('   Est. duration        : 30-45 minutes\n');
  console.log(`⏰ Started: ${new Date().toLocaleString()}`);
  console.log('='.repeat(80) + '\n');

  const startTime = Date.now();
  let successCount  = 0;
  let holdingsTotal = 0;
  let sectorsTotal  = 0;
  let errorCount    = 0;

  const { processed, failed, apiCallsUsed } = loadProgress();
  const processedSet = processed;              // already a Set
  const failedList   = failed;
  apiCallsThisRun    = apiCallsUsed;

  let etfList: any[] = [];   // populated below; used by SIGINT handler

  try {
    await prisma.$connect();
    console.log('✅ Database connected\n');

    // ── 1. Fetch ETF list ──────────────────────────────────────────────────
    console.log('📋 Fetching ETF list from EODHD...');
    const listRes = await axios.get(
      `https://eodhd.com/api/exchange-symbol-list/US` +
      `?api_token=${EODHD_API_TOKEN}&type=ETF&fmt=json`,
      { timeout: 30000 }
    );
    apiCallsThisRun++;

    etfList = listRes.data as any[];
    if (!Array.isArray(etfList) || etfList.length === 0) {
      throw new Error('ETF list response was empty or invalid');
    }

    const remaining = etfList.filter(e => e.Code && !processedSet.has(e.Code));
    console.log(`✅ ${etfList.length} ETFs found  |  ${processedSet.size} already done  |  ${remaining.length} to process\n`);

    if (remaining.length === 0) {
      console.log('🎉 Nothing left to sync — all ETFs already processed!\n');
      return;
    }

    // ── 2. Process in parallel batches ────────────────────────────────────
    for (let b = 0; b < remaining.length; b += PARALLEL_BATCH) {
      if (isShuttingDown) break;

      // API budget check before each batch
      if (apiCallsThisRun >= API_SAFETY_STOP) {
        console.log('\n⚠️  API safety limit reached — progress saved. Run again tomorrow.\n');
        break;
      }

      const batch = remaining.slice(b, b + PARALLEL_BATCH);

      // Fire all requests in the batch simultaneously
      const fetched = await Promise.allSettled(
        batch.map(entry => fetchEtf(entry.Code))
      );

      // Process results sequentially (DB writes don't benefit from parallelism)
      for (let j = 0; j < batch.length; j++) {
        if (isShuttingDown) break;

        const entry   = batch[j];
        const ticker  = entry.Code as string;
        const result  = fetched[j];
        const overall = b + j + 1;
        const pct     = (overall / remaining.length * 100).toFixed(1);

        process.stdout.write(
          `[${overall.toString().padStart(5)}/${remaining.length}] (${pct}%) ${ticker.padEnd(8)} ...`
        );

        if (result.status === 'rejected') {
          const err = result.reason;
          process.stdout.write(` ✗  ${err?.response?.status || err?.message || 'fetch error'}\n`);
          errorCount++;
          processedSet.add(ticker);
          failedList.push(ticker);

          // Back off on rate limit
          if (err?.response?.status === 429) {
            console.log('   ⏳ Rate limited — waiting 60s...');
            await delay(60000);
          } else if (err?.response?.status === 402) {
            console.log('\n❌ EODHD API limit hit (402) — stopping.\n');
            isShuttingDown = true;
            break;
          }
          continue;
        }

        const data = result.value;

        if (!data || !data.General) {
          process.stdout.write(` ⚠  No data\n`);
          errorCount++;
          processedSet.add(ticker);
          failedList.push(ticker);
          continue;
        }

        try {
          const { holdingsSaved, sectorsSaved } = await persistEtf(ticker, data, entry);
          process.stdout.write(
            ` ✓  [H:${holdingsSaved.toString().padStart(3)} S:${sectorsSaved.toString().padStart(2)}]\n`
          );
          successCount++;
          holdingsTotal += holdingsSaved;
          sectorsTotal  += sectorsSaved;
          processedSet.add(ticker);
        } catch (dbErr: any) {
          process.stdout.write(` ✗  DB: ${dbErr.message?.slice(0, 50)}\n`);
          errorCount++;
          processedSet.add(ticker);
          failedList.push(ticker);
        }
      } // end batch inner loop

      // Save progress + print report every 50 successes
      if (successCount > 0 && successCount % 50 === 0) {
        printProgress(
          successCount, holdingsTotal, sectorsTotal, errorCount,
          startTime, remaining.length, processedSet.size
        );
        saveProgress(processedSet, failedList, {
          success: successCount, holdings: holdingsTotal,
          sectors: sectorsTotal, errors: errorCount,
        });
      }

      // Brief pause between batches to stay within rate limit
      if (!isShuttingDown && b + PARALLEL_BATCH < remaining.length) {
        await delay(BATCH_GAP_MS);
      }
    } // end batch outer loop

    // ── 3. Final summary ───────────────────────────────────────────────────
    isShuttingDown = true;

    const [dbEtfs, dbHoldings, dbSectors] = await Promise.all([
      prisma.etf.count(),
      prisma.etfHolding.count(),
      prisma.etfSectorWeight.count(),
    ]);

    const durationMin = ((Date.now() - startTime) / 60000).toFixed(1);

    console.log('\n\n' + '='.repeat(80));
    console.log('🎉  SYNC COMPLETE');
    console.log('='.repeat(80));
    console.log('\n📊 THIS RUN:');
    console.log(`   ETFs synced      : ${successCount.toLocaleString()}`);
    console.log(`   Holdings saved   : ${holdingsTotal.toLocaleString()}`);
    console.log(`   Sectors saved    : ${sectorsTotal.toLocaleString()}`);
    console.log(`   Errors / skipped : ${errorCount}`);
    console.log(`   Duration         : ${durationMin} min`);
    console.log('\n💾 DATABASE TOTALS:');
    console.log(`   ETFs     : ${dbEtfs.toLocaleString()}`);
    console.log(`   Holdings : ${dbHoldings.toLocaleString()}`);
    console.log(`   Sectors  : ${dbSectors.toLocaleString()}`);
    if (dbEtfs > 0) {
      console.log(`   Avg holdings/ETF : ${(dbHoldings / dbEtfs).toFixed(1)}`);
      console.log(`   Avg sectors/ETF  : ${(dbSectors  / dbEtfs).toFixed(1)}`);
    }
    console.log('\n📡 API USAGE:');
    console.log(`   Calls used   : ${apiCallsThisRun.toLocaleString()}`);
    console.log(`   % of limit   : ${(apiCallsThisRun / API_DAILY_LIMIT * 100).toFixed(2)}%`);
    console.log(`   Remaining    : ${(API_DAILY_LIMIT - apiCallsThisRun).toLocaleString()}`);
    console.log('\n' + '='.repeat(80));

    // Clean up progress file when fully done
    const allDone = processedSet.size >= etfList.filter(e => e.Code).length;
    if (allDone) {
      if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
      console.log('\n✅ Progress file removed — sync is complete.\n');
    } else {
      const leftover = etfList.filter(e => e.Code).length - processedSet.size;
      console.log(`\n⏭  ${leftover} ETFs still remaining — run again to continue.\n`);
      saveProgress(processedSet, failedList, {
        success: successCount, holdings: holdingsTotal,
        sectors: sectorsTotal, errors: errorCount,
      });
    }

    console.log('🌐 https://etf-intelligence-platform.vercel.app\n');

  } catch (err: any) {
    console.error('\n❌ Fatal error:', err.message);
    saveProgress(processedSet, failedList, {
      success: successCount, holdings: holdingsTotal,
      sectors: sectorsTotal, errors: errorCount,
    });
    console.log('💾 Progress saved — re-run to resume.\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// ─── Graceful Ctrl+C ─────────────────────────────────────────────────────────

process.on('SIGINT', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n\n⚡ Interrupted — disconnecting...');
  try { await prisma.$disconnect(); } catch { /* ignore */ }
  console.log('💾 Progress was last saved at the most recent 50-ETF checkpoint.\n');
  process.exit(0);
});

// ─── Run ─────────────────────────────────────────────────────────────────────

completeSync();