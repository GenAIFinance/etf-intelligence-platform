import { PrismaClient } from '@prisma/client';
import { config } from '../src/config';
import { eodhdService } from '../src/services/eodhd';
import { etfService } from '../src/services/etf';

const prisma = new PrismaClient();

// Sample ETF tickers to seed
const SEED_ETFS = [
  // US Market
  'SPY',   // S&P 500
  'QQQ',   // Nasdaq 100
  'IWM',   // Russell 2000
  'VTI',   // Total Stock Market
  'VOO',   // Vanguard S&P 500

  // Sector ETFs
  'XLK',   // Technology
  'XLF',   // Financials
  'XLV',   // Healthcare
  'XLE',   // Energy
  'XLI',   // Industrials

  // Thematic ETFs
  'ARKK',  // ARK Innovation
  'ARKW',  // ARK Internet
  'SOXX',  // Semiconductors
  'TAN',   // Solar
  'LIT',   // Lithium & Battery
  'HACK',  // Cybersecurity
  'IBB',   // Biotech
  'FINX',  // FinTech

  // Fixed Income
  'BND',   // Total Bond
  'TLT',   // 20+ Year Treasury

  // International
  'EFA',   // EAFE (Developed Markets)
  'EEM',   // Emerging Markets
  'VWO',   // Vanguard Emerging Markets
];

async function seed() {
  console.log('🌱 Starting database seed (WITHOUT PRICE DATA)...\n');
  console.log('⚠️ Note: Price data and metrics are skipped (not included in your EODHD plan)\n');

  // Check if API key is configured
  if (!config.eodhd.apiKey) {
    console.error('❌ EODHD_API_KEY is not set. Please configure your .env file.');
    process.exit(1);
  }

  // Seed ETFs from EODHD
  let synced = 0;
  let failed = 0;

  for (const ticker of SEED_ETFS) {
    console.log(`📊 Syncing ${ticker}...`);

    try {
      // Sync ETF profile, holdings, sectors
      const profileSynced = await etfService.syncEtf(ticker);
      if (!profileSynced) {
        console.log(`  ⚠️ Profile not available for ${ticker}`);
        failed++;
        continue;
      }

      console.log(`  ✅ ${ticker} synced successfully`);
      console.log(`     - Profile: ✓`);
      console.log(`     - Holdings: ✓`);
      console.log(`     - Sectors: ✓`);
      console.log(`     - Prices: SKIPPED (not in plan)`);
      console.log(`     - Metrics: SKIPPED (requires prices)`);
      synced++;

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    } catch (error: any) {
      console.log(`  ❌ Failed to sync ${ticker}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Seed completed: ${synced} synced, ${failed} failed`);

  // Print summary
  const etfCount = await prisma.etf.count();
  const holdingCount = await prisma.etfHolding.count();
  const sectorCount = await prisma.etfSectorWeight.count();
  const classificationCount = await prisma.holdingClassification.count();

  console.log('\n📈 Database Summary:');
  console.log(`  - ETFs: ${etfCount}`);
  console.log(`  - Holdings: ${holdingCount}`);
  console.log(`  - Sector Weights: ${sectorCount}`);
  console.log(`  - Theme Classifications: ${classificationCount}`);
  console.log(`  - Price bars: N/A (not included in plan)`);
  console.log(`  - Metrics: N/A (requires price data)`);
  
  console.log('\n💡 What you CAN use:');
  console.log('  ✓ ETF profiles and metadata');
  console.log('  ✓ Complete holdings breakdown');
  console.log('  ✓ Sector allocation');
  console.log('  ✓ Theme exposure analysis');
  console.log('  ✓ Concentration metrics (HHI, Top 10)');
  
  console.log('\n⚠️ What you CANNOT use (requires price data):');
  console.log('  ✗ Price charts');
  console.log('  ✗ Returns analysis');
  console.log('  ✗ Risk metrics (volatility, Sharpe, drawdown)');
  console.log('  ✗ Technical indicators (RSI, moving averages)');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
