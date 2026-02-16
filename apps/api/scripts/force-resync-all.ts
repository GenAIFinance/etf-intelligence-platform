// Force re-sync ALL ETFs to populate the newly fixed fields
// Save as: apps/api/scripts/force-resync-all.ts
// Run: cd apps/api && npx tsx scripts/force-resync-all.ts

import { PrismaClient } from '@prisma/client';
import { etfService } from '../src/services/etf';

const prisma = new PrismaClient();

async function forceResyncAll() {
  console.log('🚀 Force Re-Syncing ALL ETFs with Fixed Field Extraction\n');
  console.log('='.repeat(60));

  // Get ALL ETFs (no filter)
  const etfs = await prisma.etf.findMany({
    select: { ticker: true, name: true },
    orderBy: { ticker: 'asc' },
  });

  console.log(`\n📊 Total ETFs to sync: ${etfs.length}`);
  console.log(`⏱️  Estimated time: ${Math.round((etfs.length * 1.5) / 60)} minutes\n`);
  console.log('='.repeat(60));

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  const startTime = Date.now();

  for (let i = 0; i < etfs.length; i++) {
    const etf = etfs[i];
    
    // Progress indicator every 50 ETFs
    if (i % 50 === 0 && i > 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = i / elapsed;
      const remaining = (etfs.length - i) / rate;
      console.log(`\n📊 Progress: ${i}/${etfs.length} (${((i/etfs.length)*100).toFixed(1)}%)`);
      console.log(`⏱️  Est. remaining: ${Math.round(remaining / 60)} minutes\n`);
    }

    console.log(`[${i + 1}/${etfs.length}] 🔄 Syncing ${etf.ticker}...`);

    try {
      const success = await etfService.syncEtf(etf.ticker);
      
      if (success) {
        successCount++;
        console.log(`✅ Synced ETF: ${etf.ticker} (${etf.name?.substring(0, 40)}...)`);
      } else {
        skippedCount++;
        console.log(`⚠️  Skipped: ${etf.ticker} - No data available from EODHD`);
      }

      // Rate limiting: 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
    } catch (error: any) {
      failCount++;
      console.error(`❌ Error: ${etf.ticker} - ${error.message}`);
      
      // Continue on error
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);

  console.log('\n' + '='.repeat(60));
  console.log('📊 SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Successfully synced: ${successCount}`);
  console.log(`⚠️  Skipped (no data): ${skippedCount}`);
  console.log(`❌ Failed (errors): ${failCount}`);
  console.log(`📈 Total processed: ${etfs.length}`);
  console.log(`⏱️  Time taken: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log('='.repeat(60));
  
  console.log('\n💡 Next steps:');
  console.log('   1. Run data quality check: npx tsx scripts/check-data-quality.ts');
  console.log('   2. Verify allocations/valuations are now populated');
  console.log('   3. Build comparison tool with complete data!\n');
}

forceResyncAll()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
