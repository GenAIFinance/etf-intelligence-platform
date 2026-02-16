import { prisma } from '../src/db';

async function diagnose() {
  console.log('🔍 Diagnosing Sync Status\n');

  const total = await prisma.etf.count();

  // Count by different criteria
  const hasExpenseRatio = await prisma.etf.count({
    where: { netExpenseRatio: { not: null } },
  });

  const hasBenchmark = await prisma.etf.count({
    where: { benchmarkIndex: { not: null } },
  });

  const hasEquity = await prisma.etf.count({
    where: { equityAllocation: { not: null } },
  });

  const hasValuations = await prisma.etf.count({
    where: { priceToBook: { not: null } },
  });

  const hasAnyNewField = await prisma.etf.count({
    where: {
      OR: [
        { netExpenseRatio: { not: null } },
        { benchmarkIndex: { not: null } },
        { equityAllocation: { not: null } },
        { priceToBook: { not: null } },
      ],
    },
  });

  console.log('Field Population Status:');
  console.log('═'.repeat(60));
  console.log(`Total ETFs:              ${total}`);
  console.log(`Has Expense Ratio:       ${hasExpenseRatio} (${(hasExpenseRatio/total*100).toFixed(1)}%)`);
  console.log(`Has Benchmark:           ${hasBenchmark} (${(hasBenchmark/total*100).toFixed(1)}%)`);
  console.log(`Has Equity Allocation:   ${hasEquity} (${(hasEquity/total*100).toFixed(1)}%)`);
  console.log(`Has Valuations:          ${hasValuations} (${(hasValuations/total*100).toFixed(1)}%)`);
  console.log(`Has ANY new field:       ${hasAnyNewField} (${(hasAnyNewField/total*100).toFixed(1)}%)`);
  console.log('═'.repeat(60));

  // Show sample of ETFs without data
  console.log('\nSample ETFs with NO new fields:');
  const noData = await prisma.etf.findMany({
    where: {
      AND: [
        { netExpenseRatio: null },
        { benchmarkIndex: null },
        { equityAllocation: null },
      ],
    },
    take: 20,
    select: { ticker: true, name: true, assetClass: true },
  });

  noData.forEach(etf => {
    console.log(`  ❌ ${etf.ticker.padEnd(6)} - ${etf.name.substring(0, 50).padEnd(50)} [${etf.assetClass || 'Unknown'}]`);
  });

  // Show sample of ETFs WITH data
  console.log('\nSample ETFs WITH new fields:');
  const withData = await prisma.etf.findMany({
    where: {
      netExpenseRatio: { not: null },
    },
    take: 10,
    select: { 
      ticker: true, 
      name: true, 
      netExpenseRatio: true,
      equityAllocation: true,
      benchmarkIndex: true,
    },
  });

  withData.forEach(etf => {
    const expense = etf.netExpenseRatio ? `${etf.netExpenseRatio.toFixed(2)}%` : 'N/A';
    const equity = etf.equityAllocation ? `${etf.equityAllocation.toFixed(0)}% equity` : '';
    console.log(`  ✅ ${etf.ticker.padEnd(6)} - ${etf.name.substring(0, 35).padEnd(35)} ${expense} ${equity}`);
  });

  await prisma.$disconnect();
}

diagnose().catch(console.error);