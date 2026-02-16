import { config } from '../config';
import { TrailingReturns } from '@etf-intelligence/shared';

const TRADING_DAYS_PER_YEAR = 252;

interface PricePoint {
  date: Date;
  close: number;
  adjustedClose: number;
}

// Calculate returns for a given period
export function calculateReturn(prices: PricePoint[], days: number): number | null {
  if (prices.length < 2) return null;

  const sortedPrices = [...prices].sort((a, b) => b.date.getTime() - a.date.getTime());
  const latestPrice = sortedPrices[0].adjustedClose;

  // Find the price closest to 'days' ago
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - days);

  let closestPrice: PricePoint | null = null;
  let minDiff = Infinity;

  for (const price of sortedPrices) {
    const diff = Math.abs(price.date.getTime() - targetDate.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closestPrice = price;
    }
  }

  if (!closestPrice || minDiff > 10 * 24 * 60 * 60 * 1000) {
    // No price within 10 days of target
    return null;
  }

  return (latestPrice - closestPrice.adjustedClose) / closestPrice.adjustedClose;
}

// Calculate YTD return
export function calculateYtdReturn(prices: PricePoint[]): number | null {
  if (prices.length < 2) return null;

  const sortedPrices = [...prices].sort((a, b) => b.date.getTime() - a.date.getTime());
  const latestPrice = sortedPrices[0].adjustedClose;

  // Find the last trading day of the previous year
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);

  let closestPrice: PricePoint | null = null;
  let minDiff = Infinity;

  for (const price of sortedPrices) {
    if (price.date < yearStart) {
      const diff = yearStart.getTime() - price.date.getTime();
      if (diff < minDiff) {
        minDiff = diff;
        closestPrice = price;
      }
    }
  }

  if (!closestPrice) return null;

  return (latestPrice - closestPrice.adjustedClose) / closestPrice.adjustedClose;
}

// Calculate all trailing returns
export function calculateTrailingReturns(prices: PricePoint[]): TrailingReturns {
  return {
    '1M': calculateReturn(prices, 21),
    '3M': calculateReturn(prices, 63),
    '6M': calculateReturn(prices, 126),
    '1Y': calculateReturn(prices, 252),
    '3Y': calculateReturn(prices, 756),
    '5Y': calculateReturn(prices, 1260),
    'YTD': calculateYtdReturn(prices),
  };
}

// Calculate daily returns
export function calculateDailyReturns(prices: PricePoint[]): number[] {
  const sortedPrices = [...prices].sort((a, b) => a.date.getTime() - b.date.getTime());
  const returns: number[] = [];

  for (let i = 1; i < sortedPrices.length; i++) {
    const prevPrice = sortedPrices[i - 1].adjustedClose;
    const currPrice = sortedPrices[i].adjustedClose;
    returns.push((currPrice - prevPrice) / prevPrice);
  }

  return returns;
}

// Calculate annualized volatility
export function calculateVolatility(prices: PricePoint[]): number | null {
  const dailyReturns = calculateDailyReturns(prices);
  if (dailyReturns.length < 20) return null;

  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
  const squaredDiffs = dailyReturns.map((r) => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (dailyReturns.length - 1);
  const dailyVol = Math.sqrt(variance);

  // Annualize
  return dailyVol * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

// Calculate Sharpe ratio
export function calculateSharpe(prices: PricePoint[], riskFreeRate?: number): number | null {
  const annualReturn = calculateReturn(prices, 252);
  const volatility = calculateVolatility(prices);

  if (annualReturn === null || volatility === null || volatility === 0) return null;

  const rf = riskFreeRate ?? config.riskFreeRate;
  return (annualReturn - rf) / volatility;
}

// Calculate maximum drawdown
export function calculateMaxDrawdown(prices: PricePoint[]): number | null {
  if (prices.length < 2) return null;

  const sortedPrices = [...prices].sort((a, b) => a.date.getTime() - b.date.getTime());
  const adjustedCloses = sortedPrices.map((p) => p.adjustedClose);

  let maxDrawdown = 0;
  let peak = adjustedCloses[0];

  for (const price of adjustedCloses) {
    if (price > peak) {
      peak = price;
    }
    const drawdown = (peak - price) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

// Calculate beta vs benchmark
export function calculateBeta(
  prices: PricePoint[],
  benchmarkPrices: PricePoint[]
): number | null {
  // Align dates
  const priceMap = new Map<string, number>();
  const benchmarkMap = new Map<string, number>();

  for (const p of prices) {
    priceMap.set(p.date.toISOString().split('T')[0], p.adjustedClose);
  }
  for (const p of benchmarkPrices) {
    benchmarkMap.set(p.date.toISOString().split('T')[0], p.adjustedClose);
  }

  // Find common dates
  const commonDates = [...priceMap.keys()].filter((d) => benchmarkMap.has(d)).sort();
  if (commonDates.length < 30) return null;

  // Calculate returns
  const assetReturns: number[] = [];
  const benchmarkReturns: number[] = [];

  for (let i = 1; i < commonDates.length; i++) {
    const prevDate = commonDates[i - 1];
    const currDate = commonDates[i];

    const assetPrev = priceMap.get(prevDate)!;
    const assetCurr = priceMap.get(currDate)!;
    const benchPrev = benchmarkMap.get(prevDate)!;
    const benchCurr = benchmarkMap.get(currDate)!;

    assetReturns.push((assetCurr - assetPrev) / assetPrev);
    benchmarkReturns.push((benchCurr - benchPrev) / benchPrev);
  }

  // Calculate covariance and variance
  const assetMean = assetReturns.reduce((s, r) => s + r, 0) / assetReturns.length;
  const benchMean = benchmarkReturns.reduce((s, r) => s + r, 0) / benchmarkReturns.length;

  let covariance = 0;
  let variance = 0;

  for (let i = 0; i < assetReturns.length; i++) {
    covariance += (assetReturns[i] - assetMean) * (benchmarkReturns[i] - benchMean);
    variance += Math.pow(benchmarkReturns[i] - benchMean, 2);
  }

  covariance /= assetReturns.length - 1;
  variance /= benchmarkReturns.length - 1;

  if (variance === 0) return null;

  return covariance / variance;
}

// Calculate RSI(14)
export function calculateRSI(prices: PricePoint[], period: number = 14): number | null {
  const sortedPrices = [...prices].sort((a, b) => a.date.getTime() - b.date.getTime());
  if (sortedPrices.length < period + 1) return null;

  const changes: number[] = [];
  for (let i = 1; i < sortedPrices.length; i++) {
    changes.push(sortedPrices[i].adjustedClose - sortedPrices[i - 1].adjustedClose);
  }

  // Get last 'period' changes
  const recentChanges = changes.slice(-period);

  const gains = recentChanges.filter((c) => c > 0);
  const losses = recentChanges.filter((c) => c < 0).map((c) => Math.abs(c));

  const avgGain = gains.length > 0 ? gains.reduce((s, g) => s + g, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, l) => s + l, 0) / period : 0;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Calculate moving average
export function calculateMA(prices: PricePoint[], period: number): number | null {
  const sortedPrices = [...prices].sort((a, b) => b.date.getTime() - a.date.getTime());
  if (sortedPrices.length < period) return null;

  const recentPrices = sortedPrices.slice(0, period);
  const sum = recentPrices.reduce((s, p) => s + p.adjustedClose, 0);
  return sum / period;
}

// Calculate 52-week high and low
export function calculate52WeekHighLow(prices: PricePoint[]): { high: number | null; low: number | null } {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const yearPrices = prices.filter((p) => p.date >= oneYearAgo);
  if (yearPrices.length === 0) return { high: null, low: null };

  const highs = yearPrices.map((p) => p.adjustedClose);
  const lows = yearPrices.map((p) => p.adjustedClose);

  return {
    high: Math.max(...highs),
    low: Math.min(...lows),
  };
}

// Calculate HHI (Herfindahl-Hirschman Index) for concentration
export function calculateHHI(weights: number[]): number {
  return weights.reduce((sum, w) => sum + Math.pow(w, 2), 0);
}

// Calculate top 10 weight
export function calculateTop10Weight(weights: number[]): number {
  const sorted = [...weights].sort((a, b) => b - a);
  return sorted.slice(0, 10).reduce((sum, w) => sum + w, 0);
}
