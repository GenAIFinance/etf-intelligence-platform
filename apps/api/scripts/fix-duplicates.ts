import { prisma } from '../src/db';

async function fixDuplicates() {
  console.log('🔍 Finding duplicate holdings...\n');

  const etfs = await prisma.etf.findMany({
    select: { id: true, ticker: true, name: true },
  });

  let totalDuplicates = 0;
  let totalCleaned = 0;

  for (const etf of etfs) {
    // Get all holdings for this ETF
    const holdings = await prisma.etfHolding.findMany({
      where: { etfId: etf.id },
      orderBy: [
        { holdingTicker: 'asc' },
        { asOfDate: 'desc' },
      ],
    });

    // Group by ticker
    const grouped = new Map<string, any[]>();
    
    for (const holding of holdings) {
      const key = holding.holdingTicker;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(holding);
    }

    // Find duplicates
    let duplicatesInEtf = 0;
    
    for (const [ticker, instances] of grouped.entries()) {
      if (instances.length > 1) {
        // Keep the most recent one, delete the rest
        const toKeep = instances[0]; // Already sorted by asOfDate desc
        const toDelete = instances.slice(1);
        
        for (const dup of toDelete) {
          await prisma.etfHolding.delete({
            where: { id: dup.id },
          });
          duplicatesInEtf++;
          totalDuplicates++;
        }
      }
    }

    if (duplicatesInEtf > 0) {
      console.log(`✅ ${etf.ticker}: Removed ${duplicatesInEtf} duplicates`);
      totalCleaned++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 CLEANUP COMPLETE');
  console.log('='.repeat(60));
  console.log(`ETFs cleaned: ${totalCleaned}`);
  console.log(`Total duplicates removed: ${totalDuplicates}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

fixDuplicates().catch(console.error);