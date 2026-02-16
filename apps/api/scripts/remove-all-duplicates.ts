import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeDuplicates() {
  // 1. Remove duplicate holdings
  console.log('Finding duplicate holdings...');
  
  const allHoldings = await prisma.etfHolding.findMany({
    orderBy: [{ etfId: 'asc' }, { holdingTicker: 'asc' }, { id: 'asc' }]
  });
  
  const seenHoldings = new Map<string, number>();
  const holdingsToDelete: number[] = [];
  
  for (const h of allHoldings) {
    const key = `${h.etfId}-${h.holdingTicker}`;
    if (seenHoldings.has(key)) {
      holdingsToDelete.push(h.id);
    } else {
      seenHoldings.set(key, h.id);
    }
  }
  
  console.log(`Found ${holdingsToDelete.length} duplicate holdings`);
  
  if (holdingsToDelete.length > 0) {
    await prisma.etfHolding.deleteMany({
      where: { id: { in: holdingsToDelete } }
    });
    console.log('✅ Holdings cleaned');
  } else {
    console.log('✅ No duplicate holdings');
  }
  
  // 2. Remove duplicate sectors
  console.log('\nFinding duplicate sectors...');
  
  const allSectors = await prisma.etfSectorWeight.findMany({
    orderBy: [{ etfId: 'asc' }, { sector: 'asc' }, { id: 'asc' }]
  });
  
  const seenSectors = new Map<string, number>();
  const sectorsToDelete: number[] = [];
  
  for (const s of allSectors) {
    const key = `${s.etfId}-${s.sector}`;
    if (seenSectors.has(key)) {
      sectorsToDelete.push(s.id);
    } else {
      seenSectors.set(key, s.id);
    }
  }
  
  console.log(`Found ${sectorsToDelete.length} duplicate sectors`);
  
  if (sectorsToDelete.length > 0) {
    await prisma.etfSectorWeight.deleteMany({
      where: { id: { in: sectorsToDelete } }
    });
    console.log('✅ Sectors cleaned');
  } else {
    console.log('✅ No duplicate sectors');
  }
  
  // 3. Check for duplicate theme classifications (by etfId + holdingTicker)
  console.log('\nFinding duplicate theme classifications...');
  
  const allClassifications = await prisma.holdingClassification.findMany({
    orderBy: [{ etfId: 'asc' }, { holdingTicker: 'asc' }, { id: 'asc' }]
  });
  
  const seenClassifications = new Map<string, number>();
  const classificationsToDelete: number[] = [];
  
  for (const c of allClassifications) {
    const key = `${c.etfId}-${c.holdingTicker}`;
    if (seenClassifications.has(key)) {
      classificationsToDelete.push(c.id);
    } else {
      seenClassifications.set(key, c.id);
    }
  }
  
  console.log(`Found ${classificationsToDelete.length} duplicate classifications`);
  
  if (classificationsToDelete.length > 0) {
    await prisma.holdingClassification.deleteMany({
      where: { id: { in: classificationsToDelete } }
    });
    console.log('✅ Classifications cleaned');
  } else {
    console.log('✅ No duplicate classifications');
  }
  
  console.log('\n🎉 All duplicates removed!');
  await prisma.$disconnect();
}

removeDuplicates().catch(console.error);
