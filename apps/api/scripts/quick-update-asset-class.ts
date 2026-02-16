import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function determineAssetClassFromStrategy(strategyType: string | null): string | null {
  if (!strategyType) return null;
  
  const category = strategyType.toLowerCase();
  
  if (category.match(/equity|stock|growth|value|blend|large|mid|small|cap/i)) return 'Equity';
  if (category.match(/bond|fixed income|treasury|municipal|corporate debt/i)) return 'Fixed Income';
  if (category.match(/commodity|gold|silver|oil|energy|metal/i)) return 'Commodity';
  if (category.match(/real estate|reit/i)) return 'Real Estate';
  if (category.match(/currency|forex|volatility|vix|inverse|leveraged|short/i)) return 'Alternative';
  if (category.match(/allocation|balanced|target date|target risk|moderate/i)) return 'Mixed Allocation';
  
  return null;
}

async function quickUpdate() {
  const etfs = await prisma.etf.findMany({
    where: { assetClass: null },
    select: { id: true, strategyType: true }
  });
  
  console.log(`Updating ${etfs.length} ETFs with null asset class...\n`);
  
  let updated = 0;
  for (const etf of etfs) {
    const assetClass = determineAssetClassFromStrategy(etf.strategyType);
    if (assetClass) {
      await prisma.etf.update({
        where: { id: etf.id },
        data: { assetClass }
      });
      updated++;
    }
  }
  
  console.log(`✅ Updated ${updated} ETFs in database`);
  await prisma.$disconnect();
}

quickUpdate();