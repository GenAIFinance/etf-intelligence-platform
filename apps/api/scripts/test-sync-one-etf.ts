// Test: Sync one ETF and check if fields are populated
// Save as: apps/api/scripts/test-sync-one-etf.ts
// Run: cd apps/api && npx tsx scripts/test-sync-one-etf.ts

import { PrismaClient } from '@prisma/client';
import { etfService } from '../src/services/etf';

const prisma = new PrismaClient();

async function testSyncOne() {
  console.log('🧪 Testing ETF Sync with Fixed Field Names\n');
  console.log('='.repeat(60));

  const ticker = 'SPY';

  try {
    console.log(`\n📡 Syncing ${ticker}...`);
    
    const success = await etfService.syncEtf(ticker);
    
    if (!success) {
      console.error(`❌ Sync failed for ${ticker}`);
      process.exit(1);
    }

    console.log(`✅ Sync completed for ${ticker}`);

    // Fetch the ETF from database
    console.log(`\n📊 Checking database for ${ticker}...`);
    
    const etf = await prisma.etf.findUnique({
      where: { ticker },
    });

    if (!etf) {
      console.error(`❌ ETF not found in database after sync!`);
      process.exit(1);
    }

    console.log('\n📈 Investment Detail Fields Status:\n');

    // Check each field group
    const checks = [
      { name: 'Investment Philosophy', value: etf.investmentPhilosophy, expected: true },
      { name: 'Benchmark Index', value: etf.benchmarkIndex, expected: true },
      { name: 'Equity Allocation', value: etf.equityAllocation, expected: true },
      { name: 'Bond Allocation', value: etf.bondAllocation, expected: false }, // SPY has no bonds
      { name: 'Cash Allocation', value: etf.cashAllocation, expected: true },
      { name: 'Mega Cap %', value: etf.megaCapAllocation, expected: true },
      { name: 'Large Cap %', value: etf.bigCapAllocation, expected: true },
      { name: 'Mid Cap %', value: etf.mediumCapAllocation, expected: true },
      { name: 'Small Cap %', value: etf.smallCapAllocation, expected: true },
      { name: 'Price/Book', value: etf.priceToBook, expected: true },
      { name: 'Price/Sales', value: etf.priceToSales, expected: true },
      { name: 'Price/Cash Flow', value: etf.priceToCashFlow, expected: true },
      { name: 'Projected Earnings Growth', value: etf.projectedEarningsGrowth, expected: true },
      { name: 'Net Expense Ratio', value: etf.netExpenseRatio, expected: true },
      { name: 'AUM', value: etf.aum, expected: true },
    ];

    let successCount = 0;
    let failCount = 0;

    for (const check of checks) {
      const hasValue = check.value !== null && check.value !== undefined;
      const status = hasValue ? '✅' : '❌';
      const valueDisplay = hasValue ? 
        (typeof check.value === 'number' ? check.value.toFixed(2) : String(check.value).substring(0, 50)) 
        : 'NULL';
      
      console.log(`${status} ${check.name}: ${valueDisplay}`);
      
      if (check.expected && hasValue) successCount++;
      if (check.expected && !hasValue) failCount++;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Results: ${successCount} fields populated, ${failCount} missing\n`);

    if (failCount === 0) {
      console.log('✅ SUCCESS! All expected fields are now populated!');
      console.log('   The fix is working correctly.\n');
      console.log('💡 Next step: Re-sync all ETFs to populate the database');
      console.log('   Run: npx tsx scripts/sync-all.ts\n');
    } else {
      console.log('⚠️  Some fields are still missing.');
      console.log('   This might be normal if EODHD doesn\'t have the data.');
      console.log('   Or the field extraction code needs more adjustment.\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testSyncOne();
