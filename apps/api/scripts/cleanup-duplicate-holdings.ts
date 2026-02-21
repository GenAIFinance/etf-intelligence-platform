import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function cleanupDuplicates() {
  console.log('🔍 Finding duplicate holdings in Supabase...\n');

  const allHoldings = await prisma.etfHolding.findMany({
    orderBy: [
      { etfId: 'asc' },
      { holdingTicker: 'asc' },
      { asOfDate: 'asc' },
      { id: 'desc' }, // highest id first = keep this one, delete the rest
    ],
    select: { id: true, etfId: true, holdingTicker: true, asOfDate: true }
  });

  console.log(`Total holdings rows: ${allHoldings.length}`);

  // Keep first occurrence per etfId+ticker+date (which has highest id due to sort)
  const seen = new Set<string>();
  const toDelete: number[] = [];

  for (const h of allHoldings) {
    const key = `${h.etfId}-${h.holdingTicker.toUpperCase()}-${h.asOfDate.toISOString()}`;
    if (seen.has(key)) {
      toDelete.push(h.id);
    } else {
      seen.add(key); // Set uses .add() not .set()
    }
  }

  console.log(`Duplicates to delete: ${toDelete.length}`);
  console.log(`Clean holdings after: ${allHoldings.length - toDelete.length}`);

  if (toDelete.length === 0) {
    console.log('\n✅ No duplicates found - database is clean!');
    await prisma.$disconnect();
    return;
  }

  // Delete in batches of 1000 to avoid timeout
  const batchSize = 1000;
  const totalBatches = Math.ceil(toDelete.length / batchSize);

  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);
    await prisma.etfHolding.deleteMany({ where: { id: { in: batch } } });
    console.log(`  Deleted batch ${Math.floor(i / batchSize) + 1}/${totalBatches}`);
  }

  console.log('\n✅ Cleanup complete! Database is now deduplicated.');
  await prisma.$disconnect();
}

cleanupDuplicates().catch((err) => {
  console.error('❌ Cleanup failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
