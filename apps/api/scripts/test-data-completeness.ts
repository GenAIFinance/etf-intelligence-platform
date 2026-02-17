import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FieldStats {
  fieldName: string;
  populated: number;
  null: number;
  percentage: number;
  sampleValues: any[];
}

async function testDataCompleteness() {
  console.log('🔍 ETF DATA COMPLETENESS TEST\n');
  console.log('=' .repeat(80));
  console.log('Testing all fields to ensure proper EODHD sync\n');
  
  try {
    await prisma.$connect();
    
    // Get all ETFs
    const etfs = await prisma.etf.findMany({
      take: 1000, // Test first 1000 ETFs
    });
    
    const totalEtfs = await prisma.etf.count();
    console.log(`📊 Total ETFs in database: ${totalEtfs}`);
    console.log(`🔬 Analyzing sample of ${etfs.length} ETFs\n`);
    
    if (etfs.length === 0) {
      console.log('❌ No ETFs found in database!\n');
      return;
    }
    
    // Define all fields to check
    const fieldsToCheck = [
      // Basic required fields
      'ticker', 'name', 'assetClass', 'exchange', 'country', 'currency',
      
      // Financial metrics
      'aum', 'netExpenseRatio',
      
      // Descriptive fields
      'strategyType', 'summary', 'investmentPhilosophy', 'benchmarkIndex',
      
      // Dates
      'inceptionDate',
      
      // Asset allocations
      'equityAllocation', 'bondAllocation', 'cashAllocation', 'otherAllocation',
      
      // Market cap allocations
      'megaCapAllocation', 'bigCapAllocation', 'mediumCapAllocation', 
      'smallCapAllocation', 'microCapAllocation',
      
      // Valuation metrics
      'priceToBook', 'priceToSales', 'priceToCashFlow', 'projectedEarningsGrowth',
      
      // Portfolio characteristics
      'turnover',
    ];
    
    const stats: FieldStats[] = [];
    
    // Analyze each field
    for (const field of fieldsToCheck) {
      let populated = 0;
      let nullCount = 0;
      const sampleValues: any[] = [];
      
      for (const etf of etfs) {
        const value = (etf as any)[field];
        
        if (value !== null && value !== undefined && value !== '') {
          populated++;
          if (sampleValues.length < 3) {
            sampleValues.push(value);
          }
        } else {
          nullCount++;
        }
      }
      
      stats.push({
        fieldName: field,
        populated,
        null: nullCount,
        percentage: (populated / etfs.length) * 100,
        sampleValues,
      });
    }
    
    // Print results
    console.log('=' .repeat(80));
    console.log('FIELD COMPLETENESS REPORT');
    console.log('=' .repeat(80));
    console.log();
    
    // Critical fields (should be 100%)
    console.log('🔴 CRITICAL FIELDS (Should be 100%):');
    console.log('-'.repeat(80));
    const criticalFields = ['ticker', 'name', 'assetClass', 'exchange', 'country', 'currency'];
    for (const field of criticalFields) {
      const stat = stats.find(s => s.fieldName === field)!;
      const status = stat.percentage === 100 ? '✅' : '❌';
      console.log(`${status} ${field.padEnd(25)} ${stat.percentage.toFixed(1)}% populated (${stat.populated}/${etfs.length})`);
      if (stat.sampleValues.length > 0) {
        console.log(`   Samples: ${stat.sampleValues.slice(0, 3).join(', ')}`);
      }
    }
    
    console.log();
    
    // Important financial fields
    console.log('🟡 IMPORTANT FINANCIAL FIELDS (Should be >80%):');
    console.log('-'.repeat(80));
    const importantFields = ['aum', 'netExpenseRatio', 'inceptionDate'];
    for (const field of importantFields) {
      const stat = stats.find(s => s.fieldName === field)!;
      const status = stat.percentage > 80 ? '✅' : stat.percentage > 50 ? '⚠️' : '❌';
      console.log(`${status} ${field.padEnd(25)} ${stat.percentage.toFixed(1)}% populated (${stat.populated}/${etfs.length})`);
      if (stat.sampleValues.length > 0) {
        console.log(`   Samples: ${stat.sampleValues.slice(0, 3).map(v => {
          if (v instanceof Date) return v.toISOString().split('T')[0];
          if (typeof v === 'number') return v.toFixed(4);
          return v;
        }).join(', ')}`);
      }
    }
    
    console.log();
    
    // Optional fields
    console.log('🟢 OPTIONAL FIELDS (May vary by ETF):');
    console.log('-'.repeat(80));
    const optionalFields = stats.filter(s => 
      !criticalFields.includes(s.fieldName) && 
      !importantFields.includes(s.fieldName)
    );
    
    for (const stat of optionalFields) {
      const status = stat.percentage > 50 ? '✅' : stat.percentage > 20 ? '⚠️' : '❌';
      console.log(`${status} ${stat.fieldName.padEnd(25)} ${stat.percentage.toFixed(1)}% populated (${stat.populated}/${etfs.length})`);
    }
    
    console.log();
    console.log('=' .repeat(80));
    
    // Overall assessment
    const criticalOk = criticalFields.every(f => {
      const stat = stats.find(s => s.fieldName === f)!;
      return stat.percentage === 100;
    });
    
    const importantOk = importantFields.every(f => {
      const stat = stats.find(s => s.fieldName === f)!;
      return stat.percentage > 80;
    });
    
    console.log('\n📋 OVERALL ASSESSMENT:\n');
    
    if (criticalOk && importantOk) {
      console.log('✅ DATA SYNC QUALITY: EXCELLENT');
      console.log('   All critical and important fields are properly populated.');
      console.log('   Your website should display data correctly on all pages.');
    } else if (criticalOk) {
      console.log('⚠️  DATA SYNC QUALITY: GOOD');
      console.log('   Critical fields are populated but some important fields are missing.');
      console.log('   Basic functionality will work but some details may be missing.');
    } else {
      console.log('❌ DATA SYNC QUALITY: POOR');
      console.log('   Critical fields are missing. Sync may have failed.');
      console.log('   Website may not display data correctly.');
    }
    
    // Detailed sample ETF
    console.log('\n' + '=' .repeat(80));
    console.log('📊 SAMPLE ETF DETAIL (First ETF with most data):');
    console.log('=' .repeat(80));
    
    // Find ETF with most populated fields
    let mostComplete = etfs[0];
    let maxFields = 0;
    
    for (const etf of etfs) {
      let fieldCount = 0;
      for (const field of fieldsToCheck) {
        if ((etf as any)[field] !== null && (etf as any)[field] !== undefined) {
          fieldCount++;
        }
      }
      if (fieldCount > maxFields) {
        maxFields = fieldCount;
        mostComplete = etf;
      }
    }
    
    console.log(`\nTicker: ${mostComplete.ticker}`);
    console.log(`Name: ${mostComplete.name}`);
    console.log(`Asset Class: ${mostComplete.assetClass}`);
    console.log(`\nFinancial Data:`);
    console.log(`  AUM: ${mostComplete.aum ? '$' + mostComplete.aum.toLocaleString() : 'N/A'}`);
    console.log(`  Net Expense Ratio: ${mostComplete.netExpenseRatio ? (mostComplete.netExpenseRatio * 100).toFixed(2) + '%' : 'N/A'}`);
    console.log(`  Inception Date: ${mostComplete.inceptionDate || 'N/A'}`);
    console.log(`\nAsset Allocation:`);
    console.log(`  Equity: ${mostComplete.equityAllocation ? mostComplete.equityAllocation.toFixed(1) + '%' : 'N/A'}`);
    console.log(`  Bond: ${mostComplete.bondAllocation ? mostComplete.bondAllocation.toFixed(1) + '%' : 'N/A'}`);
    console.log(`  Cash: ${mostComplete.cashAllocation ? mostComplete.cashAllocation.toFixed(1) + '%' : 'N/A'}`);
    console.log(`\nValuation Metrics:`);
    console.log(`  P/B: ${mostComplete.priceToBook || 'N/A'}`);
    console.log(`  P/S: ${mostComplete.priceToSales || 'N/A'}`);
    console.log(`  P/CF: ${mostComplete.priceToCashFlow || 'N/A'}`);
    
    console.log('\n' + '=' .repeat(80));
    
    // Check for related data
    console.log('\n🔍 CHECKING RELATED DATA:\n');
    
    const sampleEtf = etfs[0];
    
    // Check holdings
    const holdings = await prisma.etfHolding.count({
      where: { etfTicker: sampleEtf.ticker }
    });
    console.log(`Holdings for ${sampleEtf.ticker}: ${holdings > 0 ? '✅ ' + holdings + ' holdings' : '❌ No holdings data'}`);
    
    // Check sector weights
    const sectors = await prisma.etfSectorWeight.count({
      where: { etfTicker: sampleEtf.ticker }
    });
    console.log(`Sector weights for ${sampleEtf.ticker}: ${sectors > 0 ? '✅ ' + sectors + ' sectors' : '❌ No sector data'}`);
    
    // Check metrics
    const metrics = await prisma.etfMetricSnapshot.count({
      where: { etfTicker: sampleEtf.ticker }
    });
    console.log(`Metric snapshots for ${sampleEtf.ticker}: ${metrics > 0 ? '✅ ' + metrics + ' snapshots' : '⚠️  No metrics yet'}`);
    
    console.log('\n' + '=' .repeat(80));
    console.log('\n💡 RECOMMENDATIONS:\n');
    
    if (!criticalOk || !importantOk) {
      console.log('1. ❌ Re-run the full sync with proper error handling');
      console.log('2. ❌ Check EODHD API token is valid and has correct permissions');
      console.log('3. ❌ Verify EODHD API is returning complete data');
    }
    
    if (holdings === 0) {
      console.log('4. ⚠️  Holdings data not synced - ETF detail pages will be incomplete');
      console.log('   Run holdings sync script to populate this data');
    }
    
    if (sectors === 0) {
      console.log('5. ⚠️  Sector allocation data not synced - charts will be empty');
      console.log('   Run sector sync script to populate this data');
    }
    
    console.log('\n✅ Test complete!\n');
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDataCompleteness();
