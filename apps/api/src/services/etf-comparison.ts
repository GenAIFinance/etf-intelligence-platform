// ETF Comparison Service - FINAL FIX
// apps/api/src/services/etf-comparison.ts

import prisma from '../db';

export class EtfComparisonService {
  async compareETFs(tickers: string[]) {
    try {
      console.log('Comparing ETFs:', tickers);
      
      // Fetch ETFs with _count for holdings
      const etfs = await prisma.etf.findMany({
        where: {
          ticker: { in: tickers },
        },
        include: {
          _count: {
            select: { holdings: true }
          }
        }
      });

      console.log(`Found ${etfs.length} ETFs`);

      if (etfs.length === 0) {
        throw new Error('No ETFs found for the provided tickers');
      }

      // Transform to add holdingsCount for frontend compatibility
      const transformedEtfs = etfs.map(etf => ({
        ...etf,
        holdingsCount: etf._count.holdings,
      }));

      // Calculate highlights
      const highlights = this.calculateHighlights(transformedEtfs);
      
      // Generate insights
      const insights = this.generateInsights(transformedEtfs, highlights);

      return {
        etfs: transformedEtfs,
        highlights,
        insights,
        asOfDate: new Date().toISOString().split('T')[0],
      };
    } catch (error) {
      console.error('Comparison service error:', error);
      throw error;
    }
  }

  private calculateHighlights(etfs: any[]) {
    const highlights = {
      lowestExpenseRatio: null as string | null,
      highestAUM: null as string | null,
      mostDiversified: null as string | null,
      bestValue: null as string | null,
    };

    let lowestER = Infinity;
    let highestAUM = 0;
    let maxHoldings = 0;
    let lowestPB = Infinity;

    etfs.forEach(etf => {
      // Lowest expense ratio
      if (etf.netExpenseRatio && etf.netExpenseRatio < lowestER) {
        lowestER = etf.netExpenseRatio;
        highlights.lowestExpenseRatio = etf.ticker;
      }
      
      // Highest AUM
      if (etf.aum && etf.aum > highestAUM) {
        highestAUM = etf.aum;
        highlights.highestAUM = etf.ticker;
      }
      
      // Most diversified
      if (etf.holdingsCount && etf.holdingsCount > maxHoldings) {
        maxHoldings = etf.holdingsCount;
        highlights.mostDiversified = etf.ticker;
      }
      
      // Best value (lowest P/B)
      if (etf.priceToBook && etf.priceToBook < lowestPB) {
        lowestPB = etf.priceToBook;
        highlights.bestValue = etf.ticker;
      }
    });

    return highlights;
  }

  private generateInsights(etfs: any[], highlights: any): string[] {
    const insights: string[] = [];
    
    // Expense ratio insight
    if (highlights.lowestExpenseRatio) {
      const etf = etfs.find(e => e.ticker === highlights.lowestExpenseRatio);
      if (etf && etf.netExpenseRatio !== null) {
        insights.push(`${etf.ticker} has the lowest expense ratio at ${etf.netExpenseRatio.toFixed(2)}%`);
      }
    }
    
    // AUM insight
    if (highlights.highestAUM) {
      const etf = etfs.find(e => e.ticker === highlights.highestAUM);
      if (etf && etf.aum) {
        const aumInBillions = (etf.aum / 1e9).toFixed(1);
        insights.push(`${etf.ticker} is the largest with $${aumInBillions}B in assets`);
      }
    }
    
    // Diversification insight
    if (highlights.mostDiversified) {
      const etf = etfs.find(e => e.ticker === highlights.mostDiversified);
      if (etf && etf.holdingsCount) {
        insights.push(`${etf.ticker} is the most diversified with ${etf.holdingsCount.toLocaleString()} holdings`);
      }
    }

    return insights;
  }

  calculateExpenseImpact(
    initialInvestment: number,
    expenseRatio1: number,
    expenseRatio2: number,
    years: number
  ) {
    const annualReturn = 0.10;
    
    const fund1 = initialInvestment * Math.pow(1 + annualReturn - expenseRatio1, years);
    const fund2 = initialInvestment * Math.pow(1 + annualReturn - expenseRatio2, years);
    
    return {
      fund1Value: fund1,
      fund2Value: fund2,
      difference: Math.abs(fund1 - fund2),
      betterOption: fund1 > fund2 ? 'fund1' : 'fund2',
    };
  }
}

export const etfComparisonService = new EtfComparisonService();
