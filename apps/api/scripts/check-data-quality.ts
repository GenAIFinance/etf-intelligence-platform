// Data Quality Check Script - FIXED
// apps/api/scripts/check-data-quality.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDataQuality() {
  console.log('🔍 ETF Intelligence - Data Quality Check\n');
  console.log('='.repeat(60));

  try {
    // 1. Total ETFs
    const totalETFs = await prisma.etf.count();
    console.log(`\n📊 Total ETFs in Database: ${totalETFs.toLocaleString()}`);

    if (totalETFs === 0) {
      console.log('\n⚠️  No ETFs found in database!');
      console.log('Run sync script first: npx tsx scripts/sync-all.ts');
      return;
    }

    // 2. ETFs with holdings
    const etfsWithHoldings = await prisma.etf.count({
      where: {
        holdings: {
          some: {}
        }
      }
    });
    const holdingsCoverage = totalETFs > 0 ? ((etfsWithHoldings / totalETFs) * 100).toFixed(1) : '0.0';
    console.log(`\n📁 Holdings Data:`);
    console.log(`   ✓ ETFs with holdings: ${etfsWithHoldings.toLocaleString()} (${holdingsCoverage}%)`);
    console.log(`   ✗ ETFs without holdings: ${(totalETFs - etfsWithHoldings).toLocaleString()}`);

    // 3. ETFs with 18 investment detail fields
    const fieldsToCheck = [
      { label: 'Investment Philosophy', field: 'investmentPhilosophy' },
      { label: 'Benchmark Index', field: 'benchmarkIndex' },
      { label: 'Equity Allocation', field: 'equityAllocation' },
      { label: 'Market Cap Data', field: 'megaCapAllocation' },
      { label: 'Valuations (P/B)', field: 'priceToBook' },
      { label: 'Net Expense Ratio', field: 'netExpenseRatio' },
    ];

    console.log(`\n💎 Investment Detail Fields Coverage:`);
    for (const { label, field } of fieldsToCheck) {
      const count = await prisma.etf.count({
        where: {
          [field]: { not: null }
        }
      });
      const coverage = totalETFs > 0 ? ((count / totalETFs) * 100).toFixed(1) : '0.0';
      console.log(`   ${label}: ${count.toLocaleString()} (${coverage}%)`);
    }

    // 4. Asset class breakdown
    const assetClasses = await prisma.etf.groupBy({
      by: ['assetClass'],
      _count: true,
      orderBy: {
        _count: {
          assetClass: 'desc'
        }
      },
      take: 10
    });

    console.log(`\n📈 Top Asset Classes:`);
    assetClasses.forEach(ac => {
      const percentage = totalETFs > 0 ? ((ac._count / totalETFs) * 100).toFixed(1) : '0.0';
      console.log(`   ${ac.assetClass || 'N/A'}: ${ac._count.toLocaleString()} (${percentage}%)`);
    });

    // 5. Check specific popular ETFs
    const popularTickers = ['SPY', 'VOO', 'QQQ', 'VTI', 'BND', 'AGG', 'IVV', 'VEA'];
    console.log(`\n⭐ Popular ETFs Status:`);
    
    for (const ticker of popularTickers) {
      const etf = await prisma.etf.findUnique({
        where: { ticker },
        include: {
          _count: {
            select: { holdings: true }
          }
        }
      });

      if (etf) {
        const hasFields = etf.netExpenseRatio !== null;
        const holdingsCount = etf._count.holdings;
        console.log(`   ${ticker}: ✓ Exists | Holdings: ${holdingsCount.toLocaleString()} | Fields: ${hasFields ? '✓' : '✗'}`);
      } else {
        console.log(`   ${ticker}: ✗ Not in database`);
      }
    }

    // 6. ETFs without key data
    const withoutExpenseRatio = await prisma.etf.count({
      where: { netExpenseRatio: null }
    });
    const withoutAUM = await prisma.etf.count({
      where: { aum: null }
    });

    console.log(`\n⚠️  Missing Key Data:`);
    console.log(`   ETFs without expense ratio: ${withoutExpenseRatio.toLocaleString()}`);
    console.log(`   ETFs without AUM: ${withoutAUM.toLocaleString()}`);

    // 7. Data freshness
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentlyUpdated = await prisma.etf.count({
      where: {
        updatedAt: {
          gte: sevenDaysAgo
        }
      }
    });

    console.log(`\n🕒 Data Freshness:`);
    console.log(`   Updated in last 7 days: ${recentlyUpdated.toLocaleString()}`);

    // 8. Sample ETFs with no holdings (largest by AUM)
    console.log(`\n📋 Largest ETFs Without Holdings (top 10):`);
    const noHoldingsETFs = await prisma.etf.findMany({
      where: {
        holdings: {
          none: {}
        }
      },
      select: {
        ticker: true,
        name: true,
        assetClass: true,
        aum: true,
      },
      orderBy: {
        aum: 'desc'
      },
      take: 10,
    });

    if (noHoldingsETFs.length > 0) {
      noHoldingsETFs.forEach(etf => {
        const aumDisplay = etf.aum ? `$${(etf.aum / 1e9).toFixed(1)}B` : 'N/A';
        console.log(`   ${etf.ticker}: ${etf.name.substring(0, 40)}... (${etf.assetClass || 'N/A'}) - AUM: ${aumDisplay}`);
      });
    } else {
      console.log(`   ✓ All ETFs have holdings data!`);
    }

    // 9. Summary statistics
    console.log(`\n📊 Summary Statistics:`);
    
    const avgResult = await prisma.etf.aggregate({
      _avg: {
        netExpenseRatio: true,
        aum: true,
      },
      _count: {
        ticker: true,
      },
      where: {
        netExpenseRatio: { not: null },
        aum: { not: null },
      }
    });

    if (avgResult._avg.netExpenseRatio !== null) {
      console.log(`   Average Expense Ratio: ${avgResult._avg.netExpenseRatio.toFixed(2)}%`);
    }
    if (avgResult._avg.aum !== null) {
      console.log(`   Average AUM: $${(avgResult._avg.aum / 1e9).toFixed(2)}B`);
    }
    console.log(`   ETFs with complete data: ${avgResult._count.ticker.toLocaleString()}`);

    // 10. Data quality score
    const qualityMetrics = {
      hasHoldings: (etfsWithHoldings / totalETFs) * 100,
      hasExpenseRatio: ((totalETFs - withoutExpenseRatio) / totalETFs) * 100,
      hasAUM: ((totalETFs - withoutAUM) / totalETFs) * 100,
    };

    const overallQuality = (qualityMetrics.hasHoldings + qualityMetrics.hasExpenseRatio + qualityMetrics.hasAUM) / 3;

    console.log(`\n🎯 Overall Data Quality Score: ${overallQuality.toFixed(1)}%`);
    
    if (overallQuality >= 80) {
      console.log(`   ✅ EXCELLENT - Ready for production`);
    } else if (overallQuality >= 60) {
      console.log(`   ⚠️  GOOD - Some gaps but usable`);
    } else if (overallQuality >= 40) {
      console.log(`   ⚠️  FAIR - Consider running more syncs`);
    } else {
      console.log(`   ❌ POOR - Run sync scripts to improve data`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✓ Data quality check complete!\n');

  } catch (error) {
    console.error('Error checking data quality:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkDataQuality();
