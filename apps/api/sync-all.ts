import { prisma } from '../src/db';
import { etfService } from '../src/services/etf';

async function syncAllEtfs() {
  console.log('🚀 Starting full ETF sync...\n');

  const etfs = await prisma.etf.findMany({
    select: { ticker: true, name: true },
    orderBy: { ticker: 'asc' },
  });

  console.log(`📊 Found ${etfs.length} ETFs to sync\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < etfs.length; i++) {
    const etf = etfs[i];
    console.log(`\n[${i + 1}/${etfs.length}] 🔄 Syncing ${etf.ticker}...`);

    try {
      const success = await etfService.syncEtf(etf.ticker);
      if (success) {
        successCount++;
        console.log(`✅ Success: ${etf.ticker}`);
      } else {
        failCount++;
        console.log(`⚠️  Warning: ${etf.ticker} - No data available`);
      }

      // Rate limiting - wait 1 second between calls
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      failCount++;
      console.error(`❌ Error syncing ${etf.ticker}:`, error.message);
    }
  }

  console.log('\n\n========================================');
  console.log('📊 SYNC COMPLETE');
  console.log('========================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Total: ${etfs.length}`);
  console.log('========================================\n');
}

syncAllEtfs()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });