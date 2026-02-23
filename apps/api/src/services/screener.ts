// ETF Diagnostic Screener Service
// apps/api/src/services/screener.ts

import prisma from '../db';

// ============================================================================
// TYPES
// ============================================================================

export type Objective = 'growth' | 'income' | 'preservation';
export type RiskProfile = 'low' | 'medium' | 'high';
export type EsgPreference = 'no_preference' | 'prefer' | 'exclude';
export type SortBy = 'totalScore' | 'expenseRatio' | 'sharpeRatio' | 'volatility';

export interface ScreenerConstraints {
  excludeSectors: string[];
  esgPreference: EsgPreference;
  maxExpenseRatio: number | null;  // decimal e.g. 0.005
  minAUM: number | null;           // dollars e.g. 1e9
  minSharpe: number | null;        // e.g. 0.5
  minReturn3Y: number | null;      // decimal e.g. 0.05 = 5%
  minReturn5Y: number | null;      // decimal e.g. 0.08 = 8%
  maxVolatility: number | null;    // decimal e.g. 0.20 = 20%
}

export interface ScreenerRequest {
  objective: Objective;
  riskProfile: RiskProfile;
  constraints: ScreenerConstraints;
  page?: number;
  pageSize?: number;
  sortBy?: SortBy;
}

export interface MetricContributor {
  metricName: string;
  weight: number;      // 0-100
  rawValue: number | null;
  contribution: number;
}

export interface ScreenerResult {
  ticker: string;
  name: string;
  totalScore: number;
  confidenceBand: 'High' | 'Medium' | 'Low';
  dataCompleteness: number;
  expenseRatio: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  sharpeRatio: number | null;
  annualized3Y: number | null;
  annualized5Y: number | null;
  aum: number | null;
  assetClass: string | null;
  contributors: MetricContributor[];
}

export interface ScreenerResponse {
  data: ScreenerResult[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  diagnosisSummary: string;
}

// ============================================================================
// WEIGHT PROFILES — extracted from diagnostic package
// objective × riskProfile → metric weights (must sum to 1.0)
// ============================================================================

const WEIGHTS: Record<Objective, Record<RiskProfile, Partial<Record<string, number>>>> = {
  growth: {
    low:    { sharpeRatio: .30, volatility: .25, expenseRatio: .20, annualized5Y: .15, maxDrawdown: .10 },
    medium: { annualized5Y: .30, sharpeRatio: .25, expenseRatio: .20, volatility: .15, maxDrawdown: .10 },
    high:   { annualized5Y: .35, sharpeRatio: .25, annualized3Y: .20, expenseRatio: .15, volatility: .05 },
  },
  income: {
    low:    { volatility: .30, maxDrawdown: .25, expenseRatio: .20, sharpeRatio: .15, annualized3Y: .10 },
    medium: { sharpeRatio: .25, expenseRatio: .25, volatility: .20, maxDrawdown: .15, annualized3Y: .15 },
    high:   { annualized3Y: .30, sharpeRatio: .25, expenseRatio: .20, volatility: .15, maxDrawdown: .10 },
  },
  preservation: {
    low:    { volatility: .35, maxDrawdown: .30, expenseRatio: .20, sharpeRatio: .10, annualized3Y: .05 },
    medium: { maxDrawdown: .30, volatility: .25, expenseRatio: .20, sharpeRatio: .15, annualized3Y: .10 },
    high:   { sharpeRatio: .25, maxDrawdown: .25, volatility: .20, expenseRatio: .15, annualized3Y: .15 },
  },
};

// ============================================================================
// NORMALIZATION RANGES — extracted from diagnostic package
// [min, max, invert] — invert=true means lower value = better score
// ============================================================================

const NORM_RANGES: Record<string, [number, number, boolean]> = {
  volatility:    [0.05,   0.40,  true],   // lower vol = better
  maxDrawdown:   [0.00,   0.50,  true],   // lower drawdown = better (stored as positive decimal)
  sharpeRatio:   [0,      2.5,   false],  // higher sharpe = better
  annualized3Y:  [-0.10,  0.30,  false],  // higher return = better
  annualized5Y:  [-0.05,  0.25,  false],  // higher return = better
  expenseRatio:  [0.0001, 0.01,  true],   // lower cost = better
};

// ============================================================================
// METRIC TOOLTIPS
// ============================================================================

export const METRIC_TOOLTIPS: Record<string, string> = {
  volatility:   'Why it matters: higher volatility means larger swings, which can be emotionally and financially hard to tolerate.',
  maxDrawdown:  'Why it matters: it estimates the worst loss you might experience in a severe downturn.',
  sharpeRatio:  'Why it matters: it shows how efficiently an ETF has delivered returns relative to the risk taken.',
  annualized3Y: 'Why it matters: it shows how the ETF has compounded over 3 years, smoothing out short-term noise.',
  annualized5Y: 'Why it matters: it shows how the ETF has compounded over 5 years, smoothing out short-term noise.',
  expenseRatio: 'Why it matters: fees compound against you every year, even when markets are flat.',
};

// ============================================================================
// PURE SCORING FUNCTIONS
// ============================================================================

/**
 * Normalize a value to 0-100 score within [min, max] range.
 * If invert=true, lower values score higher (e.g. volatility, drawdown).
 */
function normalize(value: number | null, min: number, max: number, invert: boolean): number {
  if (value === null || value === undefined) return 0;
  const clamped = Math.max(min, Math.min(max, value));
  const score = ((clamped - min) / (max - min)) * 100;
  return invert ? 100 - score : score;
}

/**
 * Calculate confidence band based on data completeness and AUM.
 */
function getConfidenceBand(etf: any): { band: 'High' | 'Medium' | 'Low'; completeness: number; reason?: string } {
  const hasVol      = etf.volatility != null;
  const hasDrawdown = etf.maxDrawdown != null;
  const hasSharpe   = etf.sharpeRatio != null;
  const has3Y       = etf.annualized3Y != null;
  const has5Y       = etf.annualized5Y != null;
  const completeness = [hasVol, hasDrawdown, hasSharpe, has3Y, has5Y].filter(Boolean).length / 5 * 100;
  const largeFund = (etf.aum ?? 0) > 1e9;

  if (completeness >= 80 && largeFund) return { band: 'High', completeness };
  if (completeness >= 50) return {
    band: 'Medium',
    completeness,
    reason: !has5Y ? 'Limited historical data (< 5 years)' : 'Smaller fund size',
  };
  return { band: 'Low', completeness, reason: 'Insufficient metric data' };
}

/**
 * Score a single ETF given objective + risk profile weights.
 */
function scoreEtf(etf: any, weights: Record<string, number>): { score: number; contributors: MetricContributor[] } {
  const metrics: Record<string, number | null> = {
    volatility:   etf.volatility,
    maxDrawdown:  etf.maxDrawdown,
    sharpeRatio:  etf.sharpeRatio,
    annualized3Y: etf.annualized3Y,
    annualized5Y: etf.annualized5Y,
    expenseRatio: etf.netExpenseRatio,
  };

  let totalScore = 0;
  const contributors: MetricContributor[] = [];

  for (const [metric, weight] of Object.entries(weights)) {
    if (!weight) continue;
    const [min, max, invert] = NORM_RANGES[metric];
    const rawValue = metrics[metric] ?? null;
    const contribution = normalize(rawValue, min, max, invert) * weight;
    totalScore += contribution;
    contributors.push({ metricName: metricLabel(metric), weight: weight * 100, rawValue, contribution });
  }

  contributors.sort((a, b) => b.contribution - a.contribution);
  return { score: Math.round(totalScore * 10) / 10, contributors };
}

function metricLabel(key: string): string {
  const labels: Record<string, string> = {
    volatility:   'Volatility',
    maxDrawdown:  'Max Drawdown',
    sharpeRatio:  'Sharpe Ratio',
    annualized3Y: '3Y Ann. Return',
    annualized5Y: '5Y Ann. Return',
    expenseRatio: 'Expense Ratio',
  };
  return labels[key] ?? key;
}

function buildSummary(objective: Objective, riskProfile: RiskProfile, constraints: ScreenerConstraints, count: number): string {
  const goalLabel = { growth: 'capital growth', income: 'income generation', preservation: 'capital preservation' }[objective];
  const riskLabel = {
    low:    'conservative approach with emphasis on stability',
    medium: 'balanced approach weighing returns against risk',
    high:   'growth-oriented approach accepting higher volatility',
  }[riskProfile];

  let summary = `Based on your goal of ${goalLabel} with a ${riskLabel}, I found ${count} ETFs that match your criteria.`;
  if (constraints.maxExpenseRatio) summary += ` Filtered to expense ratios below ${(constraints.maxExpenseRatio * 100).toFixed(2)}%.`;
  if (constraints.minAUM) summary += ` Limited to funds with AUM above $${(constraints.minAUM / 1e9).toFixed(1)}B.`;
  if (constraints.minSharpe) summary += ` Minimum Sharpe ratio of ${constraints.minSharpe.toFixed(1)}.`;
  if (constraints.minReturn3Y) summary += ` Minimum 3Y return of ${(constraints.minReturn3Y * 100).toFixed(0)}%.`;
  if (constraints.minReturn5Y) summary += ` Minimum 5Y return of ${(constraints.minReturn5Y * 100).toFixed(0)}%.`;
  if (constraints.maxVolatility) summary += ` Maximum volatility of ${(constraints.maxVolatility * 100).toFixed(0)}%.`;
  if (constraints.esgPreference === 'prefer') summary += ' Prioritizing ESG-focused funds.';
  return summary.trim();
}

// ============================================================================
// SCREENER SERVICE
// ============================================================================

export class ScreenerService {

  async screen(req: ScreenerRequest): Promise<ScreenerResponse> {
    const { objective, riskProfile, constraints, page = 1, pageSize = 25, sortBy = 'totalScore' } = req;

    // Fetch all ETFs
    const etfs = await prisma.etf.findMany({
      select: {
        id: true,
        ticker: true,
        name: true,
        aum: true,
        netExpenseRatio: true,
        assetClass: true,
        summary: true,
      },
    });

    // Fetch latest metric snapshot per ETF separately (mirrors existing service pattern)
    const snapshots = await prisma.etfMetricSnapshot.findMany({
      where: {
        OR: [
          { volatility: { not: null } },
          { sharpe: { not: null } },
          { maxDrawdown: { not: null } },
          { return3Y: { not: null } },
          { return5Y: { not: null } },
        ],
      },
      orderBy: { asOfDate: 'desc' },
      select: {
        etfId: true,
        volatility: true,
        sharpe: true,
        maxDrawdown: true,
        return3Y: true,
        return5Y: true,
      },
    });

    // Deduplicate — keep latest snapshot per ETF
    const latestSnap = new Map<number, typeof snapshots[0]>();
    for (const s of snapshots) {
      if (!latestSnap.has(s.etfId)) latestSnap.set(s.etfId, s);
    }

    // Flatten ETF + snapshot into single object
    const flatEtfs = etfs.map(e => {
      const snap = latestSnap.get(e.id) ?? {};
      return {
        ticker: e.ticker,
        name: e.name,
        aum: e.aum,
        netExpenseRatio: e.netExpenseRatio,
        assetClass: e.assetClass,
        summary: e.summary,
        volatility:   (snap as any).volatility ?? null,
        sharpeRatio:  (snap as any).sharpe ?? null,
        maxDrawdown:  (snap as any).maxDrawdown ?? null,
        annualized3Y: (snap as any).return3Y ?? null,
        annualized5Y: (snap as any).return5Y ?? null,
      };
    });

    // Apply filters
    const filtered = flatEtfs.filter(etf => {
      // Expense ratio filter
      if (constraints.maxExpenseRatio !== null && etf.netExpenseRatio !== null) {
        if (etf.netExpenseRatio > constraints.maxExpenseRatio) return false;
      }
      // AUM filter
      if (constraints.minAUM !== null && etf.aum !== null) {
        if (etf.aum < constraints.minAUM) return false;
      }
      // Sector exclusion — keyword match in name + summary
      if (constraints.excludeSectors.length > 0) {
        const text = `${etf.name} ${etf.summary ?? ''}`.toLowerCase();
        for (const sector of constraints.excludeSectors) {
          if (text.includes(sector.toLowerCase())) return false;
        }
      }
      // ESG filter
      if (constraints.esgPreference === 'prefer') {
        const text = `${etf.name} ${etf.summary ?? ''}`.toLowerCase();
        if (!text.includes('esg') && !text.includes('sustainable') && !text.includes('responsible')) return false;
      } else if (constraints.esgPreference === 'exclude') {
        const text = `${etf.name} ${etf.summary ?? ''}`.toLowerCase();
        if (text.includes('esg') || text.includes('sustainable')) return false;
      }
      // Minimum Sharpe ratio — only filter if ETF has data (don't penalize missing data)
      if (constraints.minSharpe !== null && etf.sharpeRatio !== null) {
        if (etf.sharpeRatio < constraints.minSharpe) return false;
      }
      // Minimum 3Y annualized return
      if (constraints.minReturn3Y !== null && etf.annualized3Y !== null) {
        if (etf.annualized3Y < constraints.minReturn3Y) return false;
      }
      // Minimum 5Y annualized return
      if (constraints.minReturn5Y !== null && etf.annualized5Y !== null) {
        if (etf.annualized5Y < constraints.minReturn5Y) return false;
      }
      // Maximum volatility
      if (constraints.maxVolatility !== null && etf.volatility !== null) {
        if (etf.volatility > constraints.maxVolatility) return false;
      }
      return true;
    });

    // Score each ETF
    const weights = WEIGHTS[objective][riskProfile];
    const scored: ScreenerResult[] = filtered.map(etf => {
      const { score, contributors } = scoreEtf(etf, weights);
      const { band, completeness } = getConfidenceBand(etf);
      return {
        ticker: etf.ticker,
        name: etf.name,
        totalScore: score,
        confidenceBand: band,
        dataCompleteness: completeness,
        expenseRatio: etf.netExpenseRatio,
        volatility: etf.volatility,
        maxDrawdown: etf.maxDrawdown,
        sharpeRatio: etf.sharpeRatio,
        annualized3Y: etf.annualized3Y,
        annualized5Y: etf.annualized5Y,
        aum: etf.aum,
        assetClass: etf.assetClass,
        contributors,
      };
    });

    // Sort
    scored.sort((a, b) => {
      switch (sortBy) {
        case 'expenseRatio': return (a.expenseRatio ?? Infinity) - (b.expenseRatio ?? Infinity);
        case 'sharpeRatio':  return (b.sharpeRatio ?? 0) - (a.sharpeRatio ?? 0);
        case 'volatility':   return (a.volatility ?? 1) - (b.volatility ?? 1);
        default:             return b.totalScore - a.totalScore;
      }
    });

    // Paginate
    const total = scored.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const data = scored.slice(start, start + pageSize);

    return {
      data,
      pagination: { page, pageSize, total, totalPages },
      diagnosisSummary: buildSummary(objective, riskProfile, constraints, total),
    };
  }
}

export const screenerService = new ScreenerService();
