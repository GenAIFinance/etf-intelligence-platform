import { prisma } from '../src/db';
import { etfService } from '../src/services/etf';

async function syncRemainingEtfs() {
  console.log('🚀 Syncing remaining ETFs with missing data...\n');

  // Find ETFs missing the new fields
  const etfs = await prisma.etf.findMany({
    where: {
      OR: [
        { netExpenseRatio: null },
        { benchmarkIndex: null },
        { equityAllocation: null },
      ],
    },
    select: { ticker: true, name: true },
    orderBy: { ticker: 'asc' },
  });

  console.log(`📊 Found ${etfs.length} ETFs needing sync\n`);

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
        console.log(`⚠️  Warning: ${etf.ticker} - No data`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      failCount++;
      console.error(`❌ Error: ${etf.ticker}:`, error.message);
    }
  }

  console.log('\n========================================');
  console.log('📊 SYNC COMPLETE');
  console.log('========================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Total: ${etfs.length}`);
  console.log('========================================\n');
}

syncRemainingEtfs()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 