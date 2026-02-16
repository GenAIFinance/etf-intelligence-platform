// ETF Rankings Service - FINAL FIX
// apps/api/src/services/rankings.ts

import prisma from '../db';

export interface RankingItem {
  rank: number;
  ticker: string;
  name: string;
  value: number;
  formattedValue: string;
  secondaryValue?: number;
  formattedSecondaryValue?: string;
}

export interface RankingsResponse {
  top10: {
    byAUM: RankingItem[];
    lowestExpenseRatio: RankingItem[];
    lowestAnnualCost: RankingItem[];
    highestSavings: RankingItem[];
    mostDiversified: RankingItem[];
  };
  meta: {
    totalETFs: number;
    lastUpdated: string;
    investmentAmount: number;
  };
}

export class RankingsService {
  
  /**
   * Get all Top 10 rankings for dashboard
   */
  async getTop10Rankings(investmentAmount: number = 10000): Promise<RankingsResponse> {
    console.log('📊 Fetching Top 10 rankings...');

    // Fetch all ETFs with necessary fields (removed holdingsCount)
    const etfs = await prisma.etf.findMany({
      select: {
        ticker: true,
        name: true,
        aum: true,
        netExpenseRatio: true,
        assetClass: true,
        _count: {
          select: { holdings: true }
        }
      },
    });

    console.log(`✓ Loaded ${etfs.length} ETFs`);

    // Compute category medians for savings calculation
    const categoryMedians = this.computeCategoryMedians(etfs);

    const rankings: RankingsResponse = {
      top10: {
        byAUM: this.getTopByAUM(etfs),
        lowestExpenseRatio: this.getLowestExpenseRatio(etfs),
        lowestAnnualCost: this.getLowestAnnualCost(etfs, investmentAmount),
        highestSavings: this.getHighestSavings(etfs, categoryMedians, investmentAmount),
        mostDiversified: this.getMostDiversified(etfs),
      },
      meta: {
        totalETFs: etfs.length,
        lastUpdated: new Date().toISOString(),
        investmentAmount,
      },
    };

    console.log('✓ Rankings computed successfully');
    return rankings;
  }

  /**
   * Top 10 ETFs by AUM (Largest)
   */
  private getTopByAUM(etfs: any[]): RankingItem[] {
    return etfs
      .filter(e => e.aum !== null && e.aum > 0)
      .sort((a, b) => (b.aum || 0) - (a.aum || 0))
      .slice(0, 10)
      .map((etf, index) => ({
        rank: index + 1,
        ticker: etf.ticker,
        name: etf.name,
        value: etf.aum!,
        formattedValue: this.formatAUM(etf.aum!),
      }));
  }

  /**
   * Top 10 ETFs with Lowest Expense Ratio
   */
  private getLowestExpenseRatio(etfs: any[]): RankingItem[] {
    return etfs
      .filter(e => e.netExpenseRatio !== null && e.netExpenseRatio >= 0)
      .sort((a, b) => (a.netExpenseRatio || Infinity) - (b.netExpenseRatio || Infinity))
      .slice(0, 10)
      .map((etf, index) => ({
        rank: index + 1,
        ticker: etf.ticker,
        name: etf.name,
        value: etf.netExpenseRatio!,
        formattedValue: `${etf.netExpenseRatio!.toFixed(2)}%`,
      }));
  }

  /**
   * Top 10 ETFs with Lowest Annual Cost (for $10k investment)
   */
  private getLowestAnnualCost(etfs: any[], investment: number): RankingItem[] {
    return etfs
      .filter(e => e.netExpenseRatio !== null && e.netExpenseRatio >= 0)
      .map(etf => ({
        ...etf,
        annualCost: investment * (etf.netExpenseRatio / 100),
      }))
      .sort((a, b) => a.annualCost - b.annualCost)
      .slice(0, 10)
      .map((etf, index) => ({
        rank: index + 1,
        ticker: etf.ticker,
        name: etf.name,
        value: etf.annualCost,
        formattedValue: `$${etf.annualCost.toFixed(2)}/yr`,
        secondaryValue: etf.netExpenseRatio,
        formattedSecondaryValue: `${etf.netExpenseRatio.toFixed(2)}%`,
      }));
  }

  /**
   * Compute median expense ratio for each category
   */
  private computeCategoryMedians(etfs: any[]): Map<string, number> {
    const byCategory = new Map<string, number[]>();
    
    // Group expense ratios by category
    etfs.forEach(etf => {
      if (etf.netExpenseRatio === null || etf.netExpenseRatio < 0) return;
      
      const category = etf.assetClass || 'Other';
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push(etf.netExpenseRatio);
    });

    // Calculate median for each category
    const medians = new Map<string, number>();
    byCategory.forEach((values, category) => {
      if (values.length === 0) return;
      
      values.sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      const median = values.length % 2 === 0
        ? (values[mid - 1] + values[mid]) / 2
        : values[mid];
      
      medians.set(category, median);
    });

    return medians;
  }

  /**
   * Top 10 ETFs with Highest Savings vs Category Median
   */
  private getHighestSavings(
    etfs: any[], 
    categoryMedians: Map<string, number>,
    investment: number
  ): RankingItem[] {
    return etfs
      .filter(e => 
        e.netExpenseRatio !== null && 
        e.netExpenseRatio >= 0 &&
        e.assetClass &&
        categoryMedians.has(e.assetClass)
      )
      .map(etf => {
        const categoryMedian = categoryMedians.get(etf.assetClass!)!;
        const savingsBps = (categoryMedian - etf.netExpenseRatio) * 10000;
        const savingsUSD = investment * (categoryMedian - etf.netExpenseRatio) / 100;
        
        return {
          ...etf,
          categoryMedian,
          savingsUSD,
          savingsBps,
        };
      })
      .filter(e => e.savingsUSD > 0)
      .sort((a, b) => b.savingsUSD - a.savingsUSD)
      .slice(0, 10)
      .map((etf, index) => ({
        rank: index + 1,
        ticker: etf.ticker,
        name: etf.name,
        value: etf.savingsUSD,
        formattedValue: `$${etf.savingsUSD.toFixed(2)}/yr`,
        secondaryValue: etf.savingsBps,
        formattedSecondaryValue: `${etf.savingsBps.toFixed(0)} bps`,
      }));
  }

  /**
   * Top 10 Most Diversified ETFs (by holdings count from relation)
   */
  private getMostDiversified(etfs: any[]): RankingItem[] {
    return etfs
      .filter(e => e._count.holdings > 0)
      .sort((a, b) => b._count.holdings - a._count.holdings)
      .slice(0, 10)
      .map((etf, index) => ({
        rank: index + 1,
        ticker: etf.ticker,
        name: etf.name,
        value: etf._count.holdings,
        formattedValue: `${etf._count.holdings.toLocaleString()} holdings`,
      }));
  }

  /**
   * Format AUM for display
   */
  private formatAUM(aum: number): string {
    if (aum >= 1e9) return `$${(aum / 1e9).toFixed(1)}B`;
    if (aum >= 1e6) return `$${(aum / 1e6).toFixed(1)}M`;
    if (aum >= 1e3) return `$${(aum / 1e3).toFixed(1)}K`;
    return `$${aum.toFixed(0)}`;
  }
}

export const rankingsService = new RankingsService();
