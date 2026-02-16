import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeDuplicates() {
  console.log('Finding duplicate holdings...\n');
  
  // Find all holdings grouped by etfId + holdingTicker
  const allHoldings = await prisma.etfHolding.findMany({
    orderBy: [
      { etfId: 'asc' },
      { holdingTicker: 'asc' },
      { id: 'asc' }
    ]
  });
  
  const seen = new Map<string, number>();
  const toDelete: number[] = [];
  
  for (const holding of allHoldings) {
    const key = `${holding.etfId}-${holding.holdingTicker}`;
    
    if (seen.has(key)) {
      // Duplicate found!
      toDelete.push(holding.id);
    } else {
      seen.set(key, holding.id);
    }
  }
  
  console.log(`Found ${toDelete.length} duplicate holdings`);
  
  if (toDelete.length > 0) {
    console.log('Deleting duplicates...');
    
    await prisma.etfHolding.deleteMany({
      where: {
        id: { in: toDelete }
      }
    });
    
    console.log('✅ Duplicates removed!');
  } else {
    console.log('✅ No duplicates found');
  }
  
  await prisma.$disconnect();
}

removeDuplicates().catch(console.error);