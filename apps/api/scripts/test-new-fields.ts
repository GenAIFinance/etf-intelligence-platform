// ETF Intelligence - Test & Verification Script
// Place this file in: apps/api/scripts/test-new-fields.ts
// Run with: npx tsx scripts/test-new-fields.ts [command]
//
// Commands:
//   check    - Check existing ETFs in database (0 API calls)
//   test     - Add fake test data for SPY (0 API calls)
//   sync     - Sync 5 real ETFs (5 API calls)

import { prisma } from '../src/db';
import { etfService } from '../src/services/etf';

const TEST_TICKERS = ['SPY', 'QQQ', 'AGG', 'IWM', 'VTI'];

// ============================================================================
// CHECK EXISTING ETFs - UPDATED FOR REAL-TIME PROGRESS
// ============================================================================

async function checkExisting() {
  console.log('📊 Checking ETF sync status...\n');

  const total = await prisma.etf.count();
  
  // Count ETFs with ANY of the new fields populated
  const synced = await prisma.etf.count({
    where: {
      OR: [
        { netExpenseRatio: { not: null } },
        { benchmarkIndex: { not: null } },
        { equityAllocation: { not: null } },
        { priceToBook: { not: null } },
      ],
    },
  });

  const needsSync = total - synced;
  const progress = ((synced / total) * 100).toFixed(1);

  console.log(`Total ETFs in database: ${total}`);
  console.log(`✅ ETFs synced with new fields: ${synced}`);
  console.log(`❌ ETFs needing sync: ${needsSync}`);
  console.log(`📊 Progress: ${progress}%\n`);

  // Progress bar
  const barLength = 50;
  const filledLength = Math.floor((synced / total) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  console.log(`[${bar}] ${progress}%\n`);

  // Show recently synced ETFs
  const recentSyncs = await prisma.etf.findMany({
    where: {
      netExpenseRatio: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: { 
      ticker: true, 
      name: true, 
      netExpenseRatio: true, 
      benchmarkIndex: true,
      updatedAt: true 
    },
  });

  if (recentSyncs.length > 0) {
    console.log('Recently synced ETFs:');
    recentSyncs.forEach((etf) => {
      const expenseRatio = etf.netExpenseRatio ? `${etf.netExpenseRatio.toFixed(2)}%` : 'N/A';
      const benchmark = etf.benchmarkIndex ? ` | ${etf.benchmarkIndex}` : '';
      console.log(`  ✅ ${etf.ticker.padEnd(6)} - ${etf.name.substring(0, 40).padEnd(40)} (${expenseRatio}${benchmark})`);
    });
    console.log();
  }

  // Estimate time remaining
  if (needsSync > 0) {
    const etfsPerMinute = 30; // ~2 seconds per ETF
    const minutesRemaining = Math.ceil(needsSync / etfsPerMinute);
    const hours = Math.floor(minutesRemaining / 60);
    const mins = minutesRemaining % 60;
    
    console.log(`⏱️  Estimated time remaining: ${hours}h ${mins}m`);
    console.log(`📈 Syncing at ~30 ETFs/minute\n`);
  } else {
    console.log('🎉 ALL ETFs SYNCED! You have complete data for all 18 fields!\n');
  }

  // Sample of unsynced ETFs
  if (needsSync > 0) {
    const unsyncedSample = await prisma.etf.findMany({
      where: {
        AND: [
          { netExpenseRatio: null },
          { benchmarkIndex: null },
        ],
      },
      orderBy: { ticker: 'asc' },
      take: 10,
      select: { ticker: true, name: true },
    });

    if (unsyncedSample.length > 0) {
      console.log('Sample unsynced ETFs:');
      unsyncedSample.forEach((etf) => {
        console.log(`  ❌ ${etf.ticker.padEnd(6)} - ${etf.name.substring(0, 50)}`);
      });
      console.log();
    }
  }
}

// ============================================================================
// ADD TEST DATA
// ============================================================================

async function addTestData() {
  console.log('🧪 Adding test data for SPY (no API calls)...\n');

  await prisma.etf.upsert({
    where: { ticker: 'SPY' },
    create: {
      ticker: 'SPY',
      name: 'SPDR S&P 500 ETF Trust',
      exchange: 'NYSE Arca',
      country: 'USA',
      currency: 'USD',
      assetClass: 'Equity',
      strategyType: 'Large Blend',
      summary: 'The SPY ETF tracks the S&P 500 index, providing broad exposure to large-cap U.S. equities.',
      
      // Investment Details
      investmentPhilosophy: 'Seeks to provide investment results that correspond to the price and yield performance of the S&P 500 Index.',
      benchmarkIndex: 'S&P 500',
      
      // Asset Allocation
      equityAllocation: 99.5,
      bondAllocation: 0,
      cashAllocation: 0.5,
      otherAllocation: 0,
      
      // Market Cap
      megaCapAllocation: 45.2,
      bigCapAllocation: 42.8,
      mediumCapAllocation: 10.5,
      smallCapAllocation: 1.5,
      microCapAllocation: 0,
      
      // Valuations
      priceToBook: 4.8,
      priceToSales: 2.9,
      priceToCashFlow: 18.5,
      projectedEarningsGrowth: 12.5,
      
      // Cost metrics
      netExpenseRatio: 0.09,
      
      aum: 450000000000,
      turnover: 4.0,
      inceptionDate: new Date('1993-01-22'),
    },
    update: {
      investmentPhilosophy: 'Seeks to provide investment results that correspond to the price and yield performance of the S&P 500 Index.',
      benchmarkIndex: 'S&P 500',
      equityAllocation: 99.5,
      bondAllocation: 0,
      cashAllocation: 0.5,
      otherAllocation: 0,
      megaCapAllocation: 45.2,
      bigCapAllocation: 42.8,
      mediumCapAllocation: 10.5,
      smallCapAllocation: 1.5,
      microCapAllocation: 0,
      priceToBook: 4.8,
      priceToSales: 2.9,
      priceToCashFlow: 18.5,
      projectedEarningsGrowth: 12.5,
      
      // Cost metrics
      netExpenseRatio: 0.09,
    },
  });

  console.log('✅ Test data added for SPY');
  console.log('\n📍 Next steps:');
  console.log('   1. Start your dev server: npm run dev');
  console.log('   2. Visit: http://localhost:3000/etf/SPY');
  console.log('   3. You should see all 4 new cards with data!\n');
}

// ============================================================================
// SYNC REAL ETFs
// ============================================================================

async function syncRealEtfs() {
  console.log('🔄 Syncing 5 ETFs with real data from EODHD...');
  console.log(`⚠️  This will use ${TEST_TICKERS.length} API calls\n`);

  let successCount = 0;
  let failCount = 0;

  for (const ticker of TEST_TICKERS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${ticker}`);
    console.log('='.repeat(60));

    try {
      const success = await etfService.syncEtf(ticker);

      if (success) {
        successCount++;
        const etf = await prisma.etf.findUnique({
          where: { ticker },
          select: {
            ticker: true,
            name: true,
            benchmarkIndex: true,
            equityAllocation: true,
            bondAllocation: true,
            cashAllocation: true,
            bigCapAllocation: true,
            priceToBook: true,
            priceToSales: true,
            projectedEarningsGrowth: true,
            netExpenseRatio: true,
          },
        });

        console.log('\n✅ Successfully synced with new fields:');
        console.log(`   Benchmark: ${etf?.benchmarkIndex || 'N/A'}`);
        console.log(`   Equity: ${etf?.equityAllocation?.toFixed(1) || 'N/A'}%`);
        console.log(`   Bonds: ${etf?.bondAllocation?.toFixed(1) || 'N/A'}%`);
        console.log(`   Cash: ${etf?.cashAllocation?.toFixed(1) || 'N/A'}%`);
        console.log(`   Large Cap: ${etf?.bigCapAllocation?.toFixed(1) || 'N/A'}%`);
        console.log(`   P/B Ratio: ${etf?.priceToBook?.toFixed(2) || 'N/A'}`);
        console.log(`   P/S Ratio: ${etf?.priceToSales?.toFixed(2) || 'N/A'}`);
        console.log(`   Earnings Growth: ${etf?.projectedEarningsGrowth?.toFixed(1) || 'N/A'}%`);
        console.log(`   Expense Ratio: ${etf?.netExpenseRatio?.toFixed(2) || 'N/A'}%`);
      } else {
        failCount++;
        console.log('❌ Sync failed - no data available from EODHD');
      }
    } catch (error: any) {
      failCount++;
      console.error(`❌ Error syncing ${ticker}:`, error.message);
    }

    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('📊 SYNC SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Total: ${TEST_TICKERS.length}`);
  console.log('='.repeat(60));
  
  console.log('\n✨ View results at:');
  TEST_TICKERS.forEach(ticker => {
    console.log(`   http://localhost:3000/etf/${ticker}`);
  });
  console.log('='.repeat(60) + '\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const command = process.argv[2] || 'help';

  try {
    switch (command) {
      case 'check':
        await checkExisting();
        break;
      
      case 'test':
        await addTestData();
        break;
      
      case 'sync':
        await syncRealEtfs();
        break;
      
      default:
        console.log('ETF Intelligence - Test & Verification Tool\n');
        console.log('Usage: npx tsx scripts/test-new-fields.ts [command]\n');
        console.log('Commands:');
        console.log('  check    Check existing ETFs in database (0 API calls)');
        console.log('  test     Add fake test data for SPY (0 API calls)');
        console.log('  sync     Sync 5 real ETFs from EODHD (5 API calls)\n');
        console.log('Examples:');
        console.log('  npx tsx scripts/test-new-fields.ts check');
        console.log('  npx tsx scripts/test-new-fields.ts test');
        console.log('  npx tsx scripts/test-new-fields.ts sync\n');
        break;
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
