// Load environment variables FIRST - before any other imports
import dotenv from 'dotenv';
import path from 'path';
const envPath = path.resolve(__dirname, '../.env');
console.log('Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env:', result.error);
  process.exit(1);
}

// Verify and log API key status
const apiKey = process.env.EODHD_API_KEY;
console.log('EODHD_API_KEY loaded:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND');

if (!apiKey) {
  console.error('❌ EODHD_API_KEY not found!');
  console.error('Check file:', envPath);
  process.exit(1);
}

import { eodhdService } from '../src/services/eodhd';
import { etfService } from '../src/services/etf';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

/**
 * Load ETFs with Daily API Limit - Multi-Day Batch Loader
 * 
 * Respects your daily API call limit and automatically stops
 * Run this script once per day to gradually load all ETFs
 */

// ============= CONFIGURATION =============
// Adjust these based on your EODHD plan

const DAILY_API_LIMIT = 9000;     // Your daily API call limit
const SAFETY_BUFFER = 50;          // Stop 50 calls before limit (safety margin)
const MAX_CALLS_PER_RUN = DAILY_API_LIMIT - SAFETY_BUFFER; // 950 calls per run

const DELAY_BETWEEN_CALLS = 500;   // 500ms between calls (120/minute)
const SAVE_CHECKPOINT_EVERY = 25;  // Save progress every 25 ETFs

// ==========================================

const PROGRESS_FILE = 'etf-loading-progress.json';
const DAILY_STATS_FILE = 'daily-api-stats.json';

interface Progress {
  totalEtfs: number;
  processed: number;
  succeeded: number;
  failed: number;
  lastProcessedTicker: string;
  failedTickers: string[];
  startedAt: string;
  lastUpdatedAt: string;
  completedDays: number;
  estimatedDaysRemaining: number;
}

interface DailyStats {
  date: string;
  apiCallsUsed: number;
  etfsProcessed: number;
  succeeded: number;
  failed: number;
}

async function loadProgress(): Promise<Progress | null> {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading progress:', error);
  }
  return null;
}

function saveProgress(progress: Progress) {
  progress.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function loadDailyStats(): DailyStats[] {
  try {
    if (fs.existsSync(DAILY_STATS_FILE)) {
      const data = fs.readFileSync(DAILY_STATS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading daily stats:', error);
  }
  return [];
}

function saveDailyStats(stats: DailyStats[]) {
  fs.writeFileSync(DAILY_STATS_FILE, JSON.stringify(stats, null, 2));
}

function getTodayStats(allStats: DailyStats[]): DailyStats {
  const today = new Date().toISOString().split('T')[0];
  const todayStats = allStats.find(s => s.date === today);
  
  if (todayStats) {
    return todayStats;
  }
  
  const newStats: DailyStats = {
    date: today,
    apiCallsUsed: 0,
    etfsProcessed: 0,
    succeeded: 0,
    failed: 0,
  };
  
  allStats.push(newStats);
  return newStats;
}

async function loadEtfsWithDailyLimit() {
  console.log('🚀 ETF Loader - Daily Batch Mode\n');
  console.log('═'.repeat(80));
  console.log('Configuration:');
  console.log(`  📊 Daily API limit: ${DAILY_API_LIMIT} calls`);
  console.log(`  🛡️ Safety buffer: ${SAFETY_BUFFER} calls`);
  console.log(`  ✅ Max calls today: ${MAX_CALLS_PER_RUN} calls`);
  console.log(`  ⏱️ API delay: ${DELAY_BETWEEN_CALLS}ms (${(60000/DELAY_BETWEEN_CALLS).toFixed(0)} calls/min)`);
  console.log('═'.repeat(80));
  console.log('');

  // Load daily stats
  const allStats = loadDailyStats();
  const todayStats = getTodayStats(allStats);
  const today = new Date().toISOString().split('T')[0];

  console.log(`📅 Today: ${today}`);
  console.log(`📈 API calls used today: ${todayStats.apiCallsUsed}/${MAX_CALLS_PER_RUN}`);
  console.log('');

  // Check if already hit limit today
  if (todayStats.apiCallsUsed >= MAX_CALLS_PER_RUN) {
    console.log('🛑 DAILY LIMIT REACHED');
    console.log('');
    console.log(`You've already used ${todayStats.apiCallsUsed} API calls today.`);
    console.log(`The limit is ${MAX_CALLS_PER_RUN} calls per day.`);
    console.log('');
    console.log('💡 Come back tomorrow to continue loading ETFs!');
    console.log('');
    await printProgress();
    return;
  }

  // Calculate remaining calls for today
  const remainingCallsToday = MAX_CALLS_PER_RUN - todayStats.apiCallsUsed;
  console.log(`🎯 Remaining calls today: ${remainingCallsToday}`);
  console.log('');

  // Step 1: Get ETF universe
  console.log('📊 Fetching US ETF universe...');
  const allSymbols = await eodhdService.getExchangeSymbols('US');
  const etfSymbols = allSymbols.filter(s => s.Type === 'ETF');
  console.log(`✅ Found ${etfSymbols.length} ETFs\n`);

  // Step 2: Load or create progress
  let progress = await loadProgress();
  let startIndex = 0;

  if (progress) {
    console.log('📂 Existing Progress:');
    console.log(`   Total ETFs: ${progress.totalEtfs}`);
    console.log(`   Processed: ${progress.processed} (${((progress.processed/progress.totalEtfs)*100).toFixed(1)}%)`);
    console.log(`   Succeeded: ${progress.succeeded}`);
    console.log(`   Failed: ${progress.failed}`);
    console.log(`   Days completed: ${progress.completedDays}`);
    console.log('');

    const lastIndex = etfSymbols.findIndex(s => s.Code === progress.lastProcessedTicker);
    startIndex = lastIndex >= 0 ? lastIndex + 1 : progress.processed;
  } else {
    progress = {
      totalEtfs: etfSymbols.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      lastProcessedTicker: '',
      failedTickers: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      completedDays: 0,
      estimatedDaysRemaining: Math.ceil(etfSymbols.length / MAX_CALLS_PER_RUN),
    };
    console.log('🆕 Starting fresh load\n');
  }

  // Step 3: Calculate how many to process today
  const etfsToProcessToday = Math.min(
    remainingCallsToday,
    etfSymbols.length - startIndex
  );

  if (etfsToProcessToday === 0) {
    console.log('✅ All ETFs loaded!');
    return;
  }

  console.log('🎯 Today\'s Goal:');
  console.log(`   Process ${etfsToProcessToday} ETFs`);
  console.log(`   From index ${startIndex} to ${startIndex + etfsToProcessToday - 1}`);
  console.log('');

  const estimatedTime = (etfsToProcessToday * DELAY_BETWEEN_CALLS) / 1000 / 60;
  console.log(`⏱️ Estimated time: ${estimatedTime.toFixed(0)} minutes`);
  console.log('');
  console.log('═'.repeat(80));
  console.log('');

  // Step 4: Process ETFs
  const etfsForToday = etfSymbols.slice(startIndex, startIndex + etfsToProcessToday);
  let todaySucceeded = 0;
  let todayFailed = 0;

  for (let i = 0; i < etfsForToday.length; i++) {
    const symbol = etfsForToday[i];
    const absoluteIndex = startIndex + i;
    const percentComplete = ((absoluteIndex / etfSymbols.length) * 100).toFixed(1);
    const callsUsedToday = todayStats.apiCallsUsed + i + 1;
    
    console.log(`[${absoluteIndex + 1}/${etfSymbols.length}] (${percentComplete}%) [Today: ${callsUsedToday}/${MAX_CALLS_PER_RUN}] ${symbol.Code}`);
    
    try {
      const synced = await etfService.syncEtf(symbol.Code);
      
      if (synced) {
        progress.succeeded++;
        todaySucceeded++;
        console.log(`  ✅ Success`);
      } else {
        progress.failed++;
        todayFailed++;
        progress.failedTickers.push(symbol.Code);
        console.log(`  ⚠️ No data`);
      }
    } catch (error: any) {
      progress.failed++;
      todayFailed++;
      progress.failedTickers.push(symbol.Code);
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    progress.processed++;
    progress.lastProcessedTicker = symbol.Code;
    todayStats.apiCallsUsed++;
    todayStats.etfsProcessed++;

    // Save checkpoint
    if ((progress.processed % SAVE_CHECKPOINT_EVERY) === 0) {
      saveProgress(progress);
      saveDailyStats(allStats);
      console.log(`  💾 Checkpoint saved`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS));
  }

  // Update stats
  todayStats.succeeded = todaySucceeded;
  todayStats.failed = todayFailed;
  progress.completedDays++;
  progress.estimatedDaysRemaining = Math.ceil((etfSymbols.length - progress.processed) / MAX_CALLS_PER_RUN);

  // Final save
  saveProgress(progress);
  saveDailyStats(allStats);

  console.log('\n' + '═'.repeat(80));
  console.log('\n✅ Today\'s Batch Complete!\n');
  
  // Today's summary
  console.log('📊 Today\'s Statistics:');
  console.log('─'.repeat(80));
  console.log(`API calls used today:  ${todayStats.apiCallsUsed}/${MAX_CALLS_PER_RUN}`);
  console.log(`ETFs processed today:  ${todayStats.etfsProcessed}`);
  console.log(`Succeeded:             ${todaySucceeded}`);
  console.log(`Failed:                ${todayFailed}`);
  console.log('');

  // Overall progress
  console.log('📈 Overall Progress:');
  console.log('─'.repeat(80));
  console.log(`Total progress:        ${progress.processed}/${etfSymbols.length} (${((progress.processed/etfSymbols.length)*100).toFixed(1)}%)`);
  console.log(`Days completed:        ${progress.completedDays}`);
  console.log(`Estimated days left:   ${progress.estimatedDaysRemaining}`);
  console.log('');

  // Database stats
  const dbStats = await getDatabaseStats();
  console.log('💾 Database Summary:');
  console.log('─'.repeat(80));
  console.log(`ETFs:                  ${dbStats.etfs.toLocaleString()}`);
  console.log(`Holdings:              ${dbStats.holdings.toLocaleString()}`);
  console.log(`Sector Weights:        ${dbStats.sectors.toLocaleString()}`);
  console.log(`Theme Classifications: ${dbStats.classifications.toLocaleString()}`);
  console.log('');

  // Next steps
  if (progress.processed < etfSymbols.length) {
    console.log('🔄 What to do next:');
    console.log('─'.repeat(80));
    console.log(`📅 Tomorrow: Run this script again to continue`);
    console.log(`   Will process ${Math.min(MAX_CALLS_PER_RUN, etfSymbols.length - progress.processed)} more ETFs`);
    console.log('');
    console.log(`⏱️ To continue now: Wait until tomorrow (${getNextDay()})`);
    console.log('');
    console.log('💡 Or if you have API calls left on another day, run:');
    console.log('   npx tsx apps/api/scripts/load-etfs-daily.ts');
  } else {
    console.log('🎉 ALL ETFs LOADED!');
    console.log('─'.repeat(80));
    console.log(`Total time: ${progress.completedDays} days`);
    console.log(`Total ETFs: ${progress.succeeded} succeeded, ${progress.failed} failed`);
  }

  console.log('');
}

async function printProgress() {
  const progress = await loadProgress();
  if (!progress) {
    console.log('No progress found. Start loading with:');
    console.log('  npx tsx apps/api/scripts/load-etfs-daily.ts');
    return;
  }

  console.log('📊 Current Progress:');
  console.log('─'.repeat(80));
  console.log(`Total ETFs:           ${progress.totalEtfs}`);
  console.log(`Processed:            ${progress.processed} (${((progress.processed/progress.totalEtfs)*100).toFixed(1)}%)`);
  console.log(`Succeeded:            ${progress.succeeded}`);
  console.log(`Failed:               ${progress.failed}`);
  console.log(`Days completed:       ${progress.completedDays}`);
  console.log(`Estimated days left:  ${progress.estimatedDaysRemaining}`);
  console.log('');

  const dbStats = await getDatabaseStats();
  console.log('💾 Database:');
  console.log(`ETFs: ${dbStats.etfs.toLocaleString()}, Holdings: ${dbStats.holdings.toLocaleString()}`);
}

async function getDatabaseStats() {
  return {
    etfs: await prisma.etf.count(),
    holdings: await prisma.etfHolding.count(),
    sectors: await prisma.etfSectorWeight.count(),
    classifications: await prisma.holdingClassification.count(),
  };
}

function getNextDay(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

// Run the script
loadEtfsWithDailyLimit()
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
