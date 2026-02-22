// ETF Rankings Service
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
    highestReturn3Y: RankingItem[];
    highestReturn5Y: RankingItem[];
    lowestExpenseRatio: RankingItem[];
    highestSharpe: RankingItem[];
    lowestDrawdown: RankingItem[];
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

    // Fetch ETFs with holdings count
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

    // Fetch latest metric snapshot per ETF
    // Use subquery approach: get most recent asOfDate per etfId
    const snapshots = await prisma.etfMetricSnapshot.findMany({
      where: {
        OR: [
          { return3Y: { not: null } },
          { return5Y: { not: null } },
          { sharpe: { not: null } },
          { maxDrawdown: { not: null } },
        ]
      },
      orderBy: { asOfDate: 'desc' },
      select: {
        etfId: true,
        asOfDate: true,
        return3Y: true,
        return5Y: true,
        sharpe: true,
        maxDrawdown: true,
        etf: {
          select: { ticker: true, name: true }
        }
      },
    });

    // Deduplicate — keep only the latest snapshot per ETF
    const latestSnapshots = new Map<string, typeof snapshots[0]>();
    for (const s of snapshots) {
      const key = String(s.etfId);
      if (!latestSnapshots.has(key)) {
        latestSnapshots.set(key, s);
      }
    }
    const snapshotList = Array.from(latestSnapshots.values());

    console.log(`✓ Loaded ${etfs.length} ETFs, ${snapshotList.length} metric snapshots`);

    const rankings: RankingsResponse = {
      top10: {
        highestReturn3Y:   this.getHighestReturn3Y(snapshotList),
        highestReturn5Y:   this.getHighestReturn5Y(snapshotList),
        lowestExpenseRatio: this.getLowestExpenseRatio(etfs),
        highestSharpe:     this.getHighestSharpe(snapshotList),
        lowestDrawdown:    this.getLowestDrawdown(snapshotList),
        mostDiversified:   this.getMostDiversified(etfs),
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
   * Top 10 ETFs by highest 3Y trailing return
   */
  private getHighestReturn3Y(snapshots: any[]): RankingItem[] {
    return snapshots
      .filter(s => s.return3Y !== null && s.return3Y !== undefined)
      .sort((a, b) => (b.return3Y ?? -Infinity) - (a.return3Y ?? -Infinity))
      .slice(0, 10)
      .map((s, index) => ({
        rank: index + 1,
        ticker: s.etf.ticker,
        name: s.etf.name,
        value: s.return3Y!,
        formattedValue: this.formatReturn(s.return3Y!),
      }));
  }

  /**
   * Top 10 ETFs by highest 5Y trailing return
   */
  private getHighestReturn5Y(snapshots: any[]): RankingItem[] {
    return snapshots
      .filter(s => s.return5Y !== null && s.return5Y !== undefined)
      .sort((a, b) => (b.return5Y ?? -Infinity) - (a.return5Y ?? -Infinity))
      .slice(0, 10)
      .map((s, index) => ({
        rank: index + 1,
        ticker: s.etf.ticker,
        name: s.etf.name,
        value: s.return5Y!,
        formattedValue: this.formatReturn(s.return5Y!),
      }));
  }

  /**
   * Top 10 ETFs with lowest expense ratio
   */
  private getLowestExpenseRatio(etfs: any[]): RankingItem[] {
    return etfs
      .filter(e => e.netExpenseRatio !== null && e.netExpenseRatio >= 0)
      .sort((a, b) => (a.netExpenseRatio ?? Infinity) - (b.netExpenseRatio ?? Infinity))
      .slice(0, 10)
      .map((etf, index) => ({
        rank: index + 1,
        ticker: etf.ticker,
        name: etf.name,
        value: etf.netExpenseRatio!,
        formattedValue: `${(etf.netExpenseRatio! * 100).toFixed(2)}%`,
      }));
  }

  /**
   * Top 10 ETFs by highest Sharpe ratio (best risk-adjusted return)
   */
  private getHighestSharpe(snapshots: any[]): RankingItem[] {
    return snapshots
      .filter(s => s.sharpe !== null && s.sharpe !== undefined)
      .sort((a, b) => (b.sharpe ?? -Infinity) - (a.sharpe ?? -Infinity))
      .slice(0, 10)
      .map((s, index) => ({
        rank: index + 1,
        ticker: s.etf.ticker,
        name: s.etf.name,
        value: s.sharpe!,
        formattedValue: s.sharpe!.toFixed(2),
      }));
  }

  /**
   * Top 10 ETFs with lowest max drawdown (most defensive)
   */
  private getLowestDrawdown(snapshots: any[]): RankingItem[] {
    return snapshots
      .filter(s => s.maxDrawdown !== null && s.maxDrawdown !== undefined && s.maxDrawdown >= 0)
      .sort((a, b) => (a.maxDrawdown ?? Infinity) - (b.maxDrawdown ?? Infinity))
      .slice(0, 10)
      .map((s, index) => ({
        rank: index + 1,
        ticker: s.etf.ticker,
        name: s.etf.name,
        value: s.maxDrawdown!,
        formattedValue: `-${(s.maxDrawdown! * 100).toFixed(1)}%`,
      }));
  }

  /**
   * Top 10 most diversified ETFs by holdings count
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
   * Format return as percentage string with sign
   */
  private formatReturn(value: number): string {
    const pct = (value * 100).toFixed(1);
    return value >= 0 ? `+${pct}%` : `${pct}%`;
  }


}

export const rankingsService = new RankingsService();