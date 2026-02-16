import { prisma } from '../src/db';
import { etfService } from '../src/services/etf';

async function syncRobust() {
  console.log('🚀 Robust ETF Sync with Timeout Protection\n');

  const etfs = await prisma.etf.findMany({
    where: {
      OR: [
        { netExpenseRatio: null },
        { benchmarkIndex: null },
      ],
    },
    select: { ticker: true, name: true },
    orderBy: { ticker: 'asc' },
  });

  console.log(`📊 Found ${etfs.length} ETFs to sync\n`);

  let success = 0;
  let fail = 0;
  let timeout = 0;

  for (let i = 0; i < etfs.length; i++) {
    const etf = etfs[i];
    const pct = ((i + 1) / etfs.length * 100).toFixed(1);
    
    console.log(`[${i + 1}/${etfs.length}] ${pct}% - ${etf.ticker}`);

    try {
      // Race between sync and timeout
      const syncPromise = etfService.syncEtf(etf.ticker);
      const timeoutPromise = new Promise<boolean>((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 20000) // 20 sec max
      );
      
      const result = await Promise.race([syncPromise, timeoutPromise]);
      
      if (result) {
        success++;
        console.log(`✅ ${etf.ticker}`);
      } else {
        fail++;
        console.log(`⚠️  ${etf.ticker} - No data`);
      }
    } catch (error: any) {
      if (error.message === 'TIMEOUT') {
        timeout++;
        console.log(`⏱️  ${etf.ticker} - TIMEOUT (skipped)`);
      } else {
        fail++;
        console.log(`❌ ${etf.ticker} - ${error.message}`);
      }
    }

    // Small delay
    await new Promise(r => setTimeout(r, 1000));
    
    // Progress checkpoint
    if ((i + 1) % 100 === 0) {
      console.log(`\n💾 Checkpoint: ✅${success} ⚠️${fail} ⏱️${timeout}\n`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`Success: ${success}`);
  console.log(`Failed: ${fail}`);
  console.log(`Timeout: ${timeout}`);
  console.log(`Total: ${etfs.length}`);
  console.log('='.repeat(60));
}

syncRobust()
  .catch(console.error)
  .finally(() => prisma.$disconnect());