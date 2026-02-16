// Check what ETFs are already in your database
// Run with: npx tsx apps/api/src/scripts/check-existing-etfs.ts

import { prisma } from '../db';

async function checkExistingEtfs() {
  console.log('📊 Checking existing ETFs in database...\n');

  const etfs = await prisma.etf.findMany({
    select: {
      ticker: true,
      name: true,
      updatedAt: true,
      // Check if new fields already exist (null = needs sync)
      benchmarkIndex: true,
      equityAllocation: true,
      priceToBook: true,
    },
    orderBy: { ticker: 'asc' },
  });

  console.log(`Total ETFs in database: ${etfs.length}\n`);

  const needsSync = etfs.filter(
    etf => !etf.benchmarkIndex && !etf.equityAllocation && !etf.priceToBook
  );

  console.log(`ETFs needing sync: ${needsSync.length}`);
  console.log(`ETFs already synced: ${etfs.length - needsSync.length}\n`);

  if (etfs.length > 0) {
    console.log('Sample ETFs in your database:');
    etfs.slice(0, 10).forEach(etf => {
      const hasNewFields = etf.benchmarkIndex || etf.equityAllocation ? '✅' : '❌';
      console.log(`  ${hasNewFields} ${etf.ticker} - ${etf.name}`);
    });
  }

  await prisma.$disconnect();
}

checkExistingEtfs();
