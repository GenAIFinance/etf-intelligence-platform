import { describe, it, expect } from 'vitest';
import {
  calculateReturn,
  calculateYtdReturn,
  calculateTrailingReturns,
  calculateDailyReturns,
  calculateVolatility,
  calculateSharpe,
  calculateMaxDrawdown,
  calculateBeta,
  calculateRSI,
  calculateMA,
  calculate52WeekHighLow,
  calculateHHI,
  calculateTop10Weight,
} from '../services/metrics';

// Helper to create test price data
function createPriceData(
  values: number[],
  startDate: Date = new Date('2023-01-01')
): { date: Date; close: number; adjustedClose: number }[] {
  return values.map((price, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    return { date, close: price, adjustedClose: price };
  });
}

describe('Metrics Calculations', () => {
  describe('calculateReturn', () => {
    it('should calculate positive return correctly', () => {
      const prices = createPriceData([100, 105, 110]);
      const result = calculateReturn(prices, 2);
      expect(result).toBeCloseTo(0.1, 2); // 10% return
    });

    it('should calculate negative return correctly', () => {
      const prices = createPriceData([100, 95, 90]);
      const result = calculateReturn(prices, 2);
      expect(result).toBeCloseTo(-0.1, 2); // -10% return
    });

    it('should return null for insufficient data', () => {
      const prices = createPriceData([100]);
      const result = calculateReturn(prices, 30);
      expect(result).toBeNull();
    });
  });

  describe('calculateDailyReturns', () => {
    it('should calculate daily returns correctly', () => {
      const prices = createPriceData([100, 110, 99]);
      const returns = calculateDailyReturns(prices);
      expect(returns).toHaveLength(2);
      expect(returns[0]).toBeCloseTo(0.1, 4); // 10% up
      expect(returns[1]).toBeCloseTo(-0.1, 4); // 10% down
    });
  });

  describe('calculateVolatility', () => {
    it('should calculate annualized volatility', () => {
      // Create stable price data with small movements
      const prices = createPriceData(
        Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i) * 5)
      );
      const vol = calculateVolatility(prices);
      expect(vol).toBeGreaterThan(0);
      expect(vol).toBeLessThan(1); // Reasonable annual volatility
    });

    it('should return null for insufficient data', () => {
      const prices = createPriceData([100, 101, 102]);
      const vol = calculateVolatility(prices);
      expect(vol).toBeNull();
    });
  });

  describe('calculateMaxDrawdown', () => {
    it('should calculate max drawdown correctly', () => {
      const prices = createPriceData([100, 120, 90, 95]); // Peak at 120, trough at 90
      const drawdown = calculateMaxDrawdown(prices);
      expect(drawdown).toBeCloseTo(0.25, 2); // 25% drawdown from 120 to 90
    });

    it('should return 0 for monotonically increasing prices', () => {
      const prices = createPriceData([100, 110, 120, 130]);
      const drawdown = calculateMaxDrawdown(prices);
      expect(drawdown).toBe(0);
    });
  });

  describe('calculateBeta', () => {
    it('should calculate beta correctly for perfectly correlated assets', () => {
      const assetPrices = createPriceData([100, 110, 121, 133.1]);
      const benchmarkPrices = createPriceData([100, 110, 121, 133.1]);
      const beta = calculateBeta(assetPrices, benchmarkPrices);
      expect(beta).toBeCloseTo(1, 1); // Beta of 1 for same returns
    });

    it('should return null for insufficient data', () => {
      const assetPrices = createPriceData([100, 101]);
      const benchmarkPrices = createPriceData([100, 101]);
      const beta = calculateBeta(assetPrices, benchmarkPrices);
      expect(beta).toBeNull();
    });
  });

  describe('calculateRSI', () => {
    it('should calculate RSI in valid range', () => {
      const prices = createPriceData(
        Array.from({ length: 30 }, (_, i) => 100 + i + Math.random() * 5)
      );
      const rsi = calculateRSI(prices);
      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('should return 100 for only gains', () => {
      const prices = createPriceData([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115]);
      const rsi = calculateRSI(prices);
      expect(rsi).toBe(100);
    });
  });

  describe('calculateMA', () => {
    it('should calculate moving average correctly', () => {
      const prices = createPriceData([100, 102, 104, 106, 108]);
      const ma3 = calculateMA(prices, 3);
      // MA of last 3: (108 + 106 + 104) / 3 = 106
      expect(ma3).toBeCloseTo(106, 1);
    });

    it('should return null for insufficient data', () => {
      const prices = createPriceData([100, 101]);
      const ma20 = calculateMA(prices, 20);
      expect(ma20).toBeNull();
    });
  });

  describe('calculate52WeekHighLow', () => {
    it('should find high and low correctly', () => {
      const prices = createPriceData([100, 150, 80, 120]);
      const { high, low } = calculate52WeekHighLow(prices);
      expect(high).toBe(150);
      expect(low).toBe(80);
    });
  });

  describe('calculateHHI', () => {
    it('should calculate HHI for concentrated portfolio', () => {
      // One holding with 100% weight
      const hhi = calculateHHI([1]);
      expect(hhi).toBe(1); // Max concentration
    });

    it('should calculate HHI for diversified portfolio', () => {
      // 10 equal holdings
      const hhi = calculateHHI(Array(10).fill(0.1));
      expect(hhi).toBeCloseTo(0.1, 2);
    });
  });

  describe('calculateTop10Weight', () => {
    it('should calculate top 10 weight correctly', () => {
      const weights = [0.15, 0.12, 0.1, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.01, 0.01];
      const top10 = calculateTop10Weight(weights);
      // Sum of first 10: 0.15+0.12+0.1+0.08+0.07+0.06+0.05+0.04+0.03+0.02 = 0.72
      expect(top10).toBeCloseTo(0.72, 2);
    });

    it('should handle portfolios with less than 10 holdings', () => {
      const weights = [0.5, 0.3, 0.2];
      const top10 = calculateTop10Weight(weights);
      expect(top10).toBe(1);
    });
  });
});

describe('Theme Classification', () => {
  it('should be importable from shared package', async () => {
    const { classifyHolding, THEME_TAXONOMY } = await import('@etf-intelligence/shared');
    expect(THEME_TAXONOMY).toBeDefined();
    expect(classifyHolding).toBeDefined();
  });
});
