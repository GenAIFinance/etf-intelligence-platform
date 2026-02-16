// Test script to sync only a few ETFs to verify new fields
// Run with: npx tsx apps/api/src/scripts/test-sync.ts

import { etfService } from '../services/etf';
import { prisma } from '../db';

// Test with just these 5 popular ETFs
const TEST_TICKERS = [
  'SPY',   // S&P 500 - Large cap equity
  'QQQ',   // NASDAQ 100 - Tech heavy
  'AGG',   // Bond ETF - Fixed income
  'IWM',   // Russell 2000 - Small cap
  'VTI',   // Total market - Diversified
];

async function testSync() {
  console.log('🧪 Testing new investment detail fields with 5 ETFs...\n');
  console.log(`API calls required: ${TEST_TICKERS.length} fundamentals calls\n`);

  for (const ticker of TEST_TICKERS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${ticker}`);
    console.log('='.repeat(60));

    try {
      // Only sync fundamentals (no prices or metrics to save API calls)
      const success = await etfService.syncEtf(ticker);

      if (success) {
        // Verify the new fields were populated
        const etf = await prisma.etf.findUnique({
          where: { ticker },
          select: {
            ticker: true,
            name: true,
            investmentPhilosophy: true,
            benchmarkIndex: true,
            equityAllocation: true,
            bondAllocation: true,
            cashAllocation: true,
            otherAllocation: true,
            megaCapAllocation: true,
            bigCapAllocation: true,
            mediumCapAllocation: true,
            smallCapAllocation: true,
            microCapAllocation: true,
            priceToBook: true,
            priceToSales: true,
            priceToCashFlow: true,
            projectedEarningsGrowth: true,
          },
        });

        console.log('\n✅ New fields populated:');
        console.log(`  Benchmark: ${etf?.benchmarkIndex || 'N/A'}`);
        console.log(`  Equity: ${etf?.equityAllocation?.toFixed(1) || 'N/A'}%`);
        console.log(`  Bonds: ${etf?.bondAllocation?.toFixed(1) || 'N/A'}%`);
        console.log(`  Large Cap: ${etf?.bigCapAllocation?.toFixed(1) || 'N/A'}%`);
        console.log(`  P/B Ratio: ${etf?.priceToBook?.toFixed(2) || 'N/A'}`);
        console.log(`  Earnings Growth: ${etf?.projectedEarningsGrowth?.toFixed(1) || 'N/A'}%`);
      } else {
        console.log('❌ Sync failed');
      }
    } catch (error) {
      console.error(`❌ Error syncing ${ticker}:`, error);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('✅ Test complete! Check your dashboard at:');
  console.log('   http://localhost:3000/etf/SPY');
  console.log('   http://localhost:3000/etf/QQQ');
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

testSync();
