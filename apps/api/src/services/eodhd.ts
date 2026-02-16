import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { CacheService } from './cache';
import {
  EodhdEtfData,
  EodhdHistoricalPrice,
  EodhdExchangeSymbol,
} from '@etf-intelligence/shared';

// Rate limiter for EODHD API
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(requestsPerMinute: number) {
    this.maxTokens = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.lastRefill = Date.now();
    this.refillRate = requestsPerMinute / 60000; // per millisecond
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.refill();
    }
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

export class EodhdService {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;

  constructor() {
    this.client = axios.create({
      baseURL: config.eodhd.baseUrl,
      timeout: 30000,
    });
    this.rateLimiter = new RateLimiter(config.eodhd.requestsPerMinute);
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    await this.rateLimiter.acquire();

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.client.get(endpoint, {
          params: {
            api_token: config.eodhd.apiKey,
            fmt: 'json',
            ...params,
          },
        });
        return response.data;
      } catch (error: any) {
        lastError = error;
        if (error.response?.status === 429) {
          // Rate limited, wait and retry
          const waitTime = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else if (error.response?.status >= 500) {
          // Server error, retry with backoff
          const waitTime = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          throw error;
        }
      }
    }

    throw lastError;
  }

  // Get list of ETFs from an exchange
  async getExchangeSymbols(exchange: string): Promise<EodhdExchangeSymbol[]> {
    const cacheKey = `eodhd:symbols:${exchange}`;
    const cached = await CacheService.get<EodhdExchangeSymbol[]>(cacheKey);
    if (cached) return cached;

    const data = await this.request<EodhdExchangeSymbol[]>(
      `/exchange-symbol-list/${exchange}`
    );

    // Filter for ETFs only
    const etfs = data.filter((s) => s.Type === 'ETF');

    await CacheService.set(cacheKey, etfs, config.cache.etfProfile);
    return etfs;
  }

  // Get ETF fundamentals (profile, holdings, sector weights)
  async getEtfFundamentals(ticker: string): Promise<EodhdEtfData | null> {
    const cacheKey = CacheService.keys.etfProfile(ticker);
    const cached = await CacheService.get<EodhdEtfData>(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.request<EodhdEtfData>(`/fundamentals/${ticker}.US`);
      await CacheService.set(cacheKey, data, config.cache.etfProfile);
      return data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Get historical prices
  async getHistoricalPrices(
    ticker: string,
    from: string,
    to: string,
    period: string = 'd'
  ): Promise<EodhdHistoricalPrice[]> {
    const cacheKey = `eodhd:prices:${ticker}:${from}:${to}:${period}`;
    const cached = await CacheService.get<EodhdHistoricalPrice[]>(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.request<EodhdHistoricalPrice[]>(`/eod/${ticker}.US`, {
        from,
        to,
        period,
      });
      await CacheService.set(cacheKey, data, config.cache.prices);
      return data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // Get real-time price
  async getRealTimePrice(ticker: string): Promise<{ close: number; previousClose: number } | null> {
    try {
      const data = await this.request<{
        code: string;
        close: number;
        previousClose: number;
      }>(`/real-time/${ticker}.US`);
      return { close: data.close, previousClose: data.previousClose };
    } catch {
      return null;
    }
  }

  // Load US ETF universe
  async loadUsEtfUniverse(): Promise<EodhdExchangeSymbol[]> {
    const exchanges = ['US'];
    const allEtfs: EodhdExchangeSymbol[] = [];

    for (const exchange of exchanges) {
      try {
        const symbols = await this.getExchangeSymbols(exchange);
        allEtfs.push(...symbols);
      } catch (error) {
        console.error(`Failed to load symbols from ${exchange}:`, error);
      }
    }

    return allEtfs;
  }
}

export const eodhdService = new EodhdService();
