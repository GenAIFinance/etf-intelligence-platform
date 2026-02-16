// Test script to verify asset class detection
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { etfService } from '../src/services/etf';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testUpdate() {
  console.log('Testing asset class update for SPY...\n');
  
  // Re-sync SPY
  const result = await etfService.syncEtf('SPY');
  console.log('Sync result:', result);
  
  // Check database
  const spy = await prisma.etf.findUnique({
    where: { ticker: 'SPY' }
  });
  
  console.log('\nSPY in database:');
  console.log('  Ticker:', spy?.ticker);
  console.log('  Name:', spy?.name);
  console.log('  Asset Class:', spy?.assetClass);
  console.log('  Strategy Type:', spy?.strategyType);
  console.log('  AUM:', spy?.aum?.toLocaleString());
  
  if (!spy?.assetClass) {
    console.log('\n❌ Asset Class is still NULL!');
    console.log('Debug: Check if determineAssetClass function exists in etf.ts');
  } else {
    console.log('\n✅ Asset Class detected successfully!');
  }
  
  if (!spy?.aum || spy.aum < 100000000) {
    console.log('\n⚠️ AUM seems too low or null!');
    console.log('Expected: >$400 billion for SPY');
  } else if (spy.aum > 50000000000) {
    console.log('\n✅ AUM is correct (>$50B)');
  }
  
  await prisma.$disconnect();
}

testUpdate().catch(console.error);
