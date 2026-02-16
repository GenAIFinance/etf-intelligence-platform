// ETF Comparison Service
// apps/api/src/services/etf-comparison.ts

import { prisma } from '../db';

export interface ComparisonETF {
  ticker: string;
  name: string;
  assetClass: string | null;
  strategyType: string | null;
  
  // Fees
  netExpenseRatio: number | null;
  
  // Fund basics
  aum: number | null;
  inceptionDate: Date | null;
  
  // Investment details
  investmentPhilosophy: string | null;
  benchmarkIndex: string | null;
  
  // Asset allocation
  equityAllocation: number | null;
  bondAllocation: number | null;
  cashAllocation: number | null;
  otherAllocation: number | null;
  
  // Market cap breakdown
  megaCapAllocation: number | null;
  bigCapAllocation: number | null;
  mediumCapAllocation: number | null;
  smallCapAllocation: number | null;
  microCapAllocation: number | null;
  
  // Valuations
  priceToBook: number | null;
  priceToSales: number | null;
  priceToCashFlow: number | null;
  projectedEarningsGrowth: number | null;
  
  // Holdings
  holdingsCount: number;
}

export interface ComparisonHighlights {
  lowestExpenseRatio: string | null;
  highestAUM: string | null;
  mostDiversified: string | null;
  bestValue: string | null; // Lowest P/B
}

export interface ComparisonResponse {
  etfs: ComparisonETF[];
  highlights: ComparisonHighlights;
  insights: string[];
  asOfDate: string;
}

export class ETFComparisonService {
  
  /**
   * Compare 2-4 ETFs side by side
   */
  async compareETFs(tickers: string[]): Promise<ComparisonResponse> {
    // Validate input
    if (tickers.length < 2 || tickers.length > 4) {
      throw new Error('Please provide 2-4 ETF tickers for comparison');
    }

    // Normalize tickers
    const normalizedTickers = tickers.map(t => t.toUpperCase().trim());

    // Fetch ETFs with holdings count
    const etfs = await prisma.etf.findMany({
      where: {
        ticker: { in: normalizedTickers }
      },
      include: {
        _count: {
          select: { holdings: true }
        }
      }
    });

    if (etfs.length === 0) {
      throw new Error('No ETFs found with the provided tickers');
    }

    if (etfs.length !== normalizedTickers.length) {
      const found = etfs.map(e => e.ticker);
      const missing = normalizedTickers.filter(t => !found.includes(t));
      throw new Error(`ETFs not found: ${missing.join(', ')}`);
    }

    // Transform to comparison format
    const comparisonETFs: ComparisonETF[] = etfs.map(etf => ({
      ticker: etf.ticker,
      name: etf.name,
      assetClass: etf.assetClass,
      strategyType: etf.strategyType,
      netExpenseRatio: etf.netExpenseRatio,
      aum: etf.aum,
      inceptionDate: etf.inceptionDate,
      investmentPhilosophy: etf.investmentPhilosophy,
      benchmarkIndex: etf.benchmarkIndex,
      equityAllocation: etf.equityAllocation,
      bondAllocation: etf.bondAllocation,
      cashAllocation: etf.cashAllocation,
      otherAllocation: etf.otherAllocation,
      megaCapAllocation: etf.megaCapAllocation,
      bigCapAllocation: etf.bigCapAllocation,
      mediumCapAllocation: etf.mediumCapAllocation,
      smallCapAllocation: etf.smallCapAllocation,
      microCapAllocation: etf.microCapAllocation,
      priceToBook: etf.priceToBook,
      priceToSales: etf.priceToSales,
      priceToCashFlow: etf.priceToCashFlow,
      projectedEarningsGrowth: etf.projectedEarningsGrowth,
      holdingsCount: etf._count.holdings,
    }));

    // Compute highlights
    const highlights = this.computeHighlights(comparisonETFs);
    
    // Generate insights
    const insights = this.generateInsights(comparisonETFs, highlights);

    return {
      etfs: comparisonETFs,
      highlights,
      insights,
      asOfDate: new Date().toISOString().split('T')[0],
    };
  }

  /**
   * Compute best values across comparison
   */
  private computeHighlights(etfs: ComparisonETF[]): ComparisonHighlights {
    let lowestExpenseRatio: string | null = null;
    let highestAUM: string | null = null;
    let mostDiversified: string | null = null;
    let bestValue: string | null = null;

    let minExpense = Infinity;
    let maxAUM = -Infinity;
    let maxHoldings = -Infinity;
    let minPB = Infinity;

    for (const etf of etfs) {
      // Lowest expense ratio
      if (etf.netExpenseRatio !== null && etf.netExpenseRatio < minExpense) {
        minExpense = etf.netExpenseRatio;
        lowestExpenseRatio = etf.ticker;
      }

      // Highest AUM (liquidity)
      if (etf.aum !== null && etf.aum > maxAUM) {
        maxAUM = etf.aum;
        highestAUM = etf.ticker;
      }

      // Most diversified (most holdings)
      if (etf.holdingsCount > maxHoldings) {
        maxHoldings = etf.holdingsCount;
        mostDiversified = etf.ticker;
      }

      // Best value (lowest P/B)
      if (etf.priceToBook !== null && etf.priceToBook < minPB) {
        minPB = etf.priceToBook;
        bestValue = etf.ticker;
      }
    }

    return {
      lowestExpenseRatio,
      highestAUM,
      mostDiversified,
      bestValue,
    };
  }

  /**
   * Generate comparison insights
   */
  private generateInsights(etfs: ComparisonETF[], highlights: ComparisonHighlights): string[] {
    const insights: string[] = [];

    // Check if all track same benchmark
    const benchmarks = new Set(etfs.map(e => e.benchmarkIndex).filter(Boolean));
    if (benchmarks.size === 1 && [...benchmarks][0]) {
      insights.push(`All ETFs track ${[...benchmarks][0]}`);
    } else if (benchmarks.size > 1) {
      insights.push('Different benchmarks tracked - strategies may differ');
    }

    // Expense ratio variance
    const expenses = etfs.map(e => e.netExpenseRatio).filter(e => e !== null) as number[];
    if (expenses.length > 1) {
      const maxExpense = Math.max(...expenses);
      const minExpense = Math.min(...expenses);
      const diff = (maxExpense - minExpense) * 100; // Convert to basis points
      
      if (diff > 0.1) { // More than 10 basis points difference
        insights.push(`Expense ratios vary by ${diff.toFixed(0)} basis points`);
      } else {
        insights.push('Expense ratios are very similar');
      }
    }

    // Asset allocation similarity
    const hasAllocation = etfs.every(e => e.equityAllocation !== null);
    if (hasAllocation) {
      const equityPercentages = etfs.map(e => e.equityAllocation!);
      const avgEquity = equityPercentages.reduce((a, b) => a + b, 0) / equityPercentages.length;
      
      if (avgEquity > 95) {
        insights.push('All ETFs are primarily equity-focused (95%+ stocks)');
      } else if (avgEquity < 50) {
        insights.push('Mixed asset allocation with significant bond exposure');
      }
    }

    // Market cap concentration
    const hasMegaCap = etfs.every(e => e.megaCapAllocation !== null);
    if (hasMegaCap) {
      const avgMega = etfs.reduce((sum, e) => sum + (e.megaCapAllocation || 0), 0) / etfs.length;
      
      if (avgMega > 50) {
        insights.push('Heavy concentration in mega-cap stocks');
      } else if (avgMega < 20) {
        insights.push('Diverse market cap exposure beyond mega-caps');
      }
    }

    // Valuation comparison
    const pbValues = etfs.map(e => e.priceToBook).filter(p => p !== null) as number[];
    if (pbValues.length > 1) {
      const maxPB = Math.max(...pbValues);
      const minPB = Math.min(...pbValues);
      
      if ((maxPB - minPB) > 1.0) {
        insights.push('Significant valuation differences - growth vs value tilt');
      } else {
        insights.push('Similar valuation profiles');
      }
    }

    // Diversification
    if (highlights.mostDiversified) {
      const mostDiv = etfs.find(e => e.ticker === highlights.mostDiversified);
      if (mostDiv && mostDiv.holdingsCount > 500) {
        insights.push(`${mostDiv.ticker} offers broadest diversification with ${mostDiv.holdingsCount} holdings`);
      }
    }

    return insights;
  }

  /**
   * Calculate dollar impact of expense ratio difference over time
   */
  calculateExpenseImpact(
    initialInvestment: number,
    expenseRatio1: number,
    expenseRatio2: number,
    years: number,
    annualReturn: number = 0.10 // Assume 10% annual return
  ): {
    fund1Final: number;
    fund2Final: number;
    difference: number;
  } {
    // Future value with expenses deducted
    const fund1Final = initialInvestment * Math.pow(1 + annualReturn - expenseRatio1, years);
    const fund2Final = initialInvestment * Math.pow(1 + annualReturn - expenseRatio2, years);
    
    return {
      fund1Final,
      fund2Final,
      difference: Math.abs(fund1Final - fund2Final),
    };
  }
}

export const etfComparisonService = new ETFComparisonService();
