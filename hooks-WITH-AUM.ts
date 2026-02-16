import { useQuery } from '@tanstack/react-query';
import {
  MOCK_ETFS,
  MOCK_TOP_IMPACTED,
  MOCK_TRENDING_TOPICS,
  MOCK_NEWS,
  MOCK_SECTORS,
  MOCK_HOLDINGS,
  MOCK_THEME_EXPOSURE,
  generateMockPrices,
  getMockMetrics,
} from './mockData';

// Simulated delay for realistic demo
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ETF Hooks
export function useEtfList(params: {
  search?: string;
  assetClass?: string;
  strategyType?: string;
  page?: number;
  pageSize?: number;
  minAum?: number;
  maxAum?: number;
}) {
  return useQuery({
    queryKey: ['etfs', params],
    queryFn: async () => {
      const response = await etfApi.getList(params);
      return response.data;
    },
  });
}

      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            e.ticker.toLowerCase().includes(q) ||
            e.name.toLowerCase().includes(q)
        );
      }

      if (params.assetClass) {
        filtered = filtered.filter((e) => e.assetClass === params.assetClass);
      }

      if (params.strategyType) {
        filtered = filtered.filter((e) => e.strategyType === params.strategyType);
      }

      const page = params.page || 1;
      const pageSize = params.pageSize || 10;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;

      return {
        data: filtered.slice(start, end),
        pagination: {
          page,
          pageSize,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / pageSize),
        },
      };
    },
  });
}

export function useEtf(ticker: string) {
  return useQuery({
    queryKey: ['etf', ticker],
    queryFn: async () => {
      await delay(200);
      const etf = MOCK_ETFS.find((e) => e.ticker === ticker);
      if (!etf) {
        // Return a generic ETF for any ticker
        return {
          id: 999,
          ticker,
          name: `${ticker} ETF`,
          exchange: 'NYSE',
          country: 'US',
          currency: 'USD',
          assetClass: 'Equity',
          strategyType: 'Passive',
          aum: 10000000000,
          summary: `Exchange-traded fund tracking ${ticker}`,
        };
      }
      return etf;
    },
    enabled: !!ticker,
  });
}

export function useEtfHoldings(ticker: string) {
  return useQuery({
    queryKey: ['etf-holdings', ticker],
    queryFn: async () => {
      await delay(250);
      const holdings = MOCK_HOLDINGS[ticker] || MOCK_HOLDINGS.SPY;
      return { holdings };
    },
    enabled: !!ticker,
  });
}

export function useEtfSectors(ticker: string) {
  return useQuery({
    queryKey: ['etf-sectors', ticker],
    queryFn: async () => {
      await delay(200);
      const sectors = MOCK_SECTORS[ticker] || MOCK_SECTORS.SPY;
      return { sectors };
    },
    enabled: !!ticker,
  });
}

export function useEtfPrices(ticker: string, range: string = '5y', interval: string = '1d') {
  return useQuery({
    queryKey: ['etf-prices', ticker, range, interval],
    queryFn: async () => {
      await delay(400);
      const rangeDays: Record<string, number> = {
        '1m': 21,
        '3m': 63,
        '6m': 126,
        '1y': 252,
        '3y': 756,
        '5y': 1260,
      };
      const days = rangeDays[range] || 1260;
      const prices = generateMockPrices(ticker, days);
      return { prices };
    },
    enabled: !!ticker,
  });
}

export function useEtfMetrics(ticker: string, asOf?: string) {
  return useQuery({
    queryKey: ['etf-metrics', ticker, asOf],
    queryFn: async () => {
      await delay(200);
      return getMockMetrics(ticker);
    },
    enabled: !!ticker,
  });
}

export function useEtfThemesExposure(ticker: string) {
  return useQuery({
    queryKey: ['etf-themes', ticker],
    queryFn: async () => {
      await delay(250);
      const exposures = MOCK_THEME_EXPOSURE[ticker] || MOCK_THEME_EXPOSURE.SPY;
      return { exposures };
    },
    enabled: !!ticker,
  });
}

// Themes Hooks
export function useThemesTaxonomy() {
  return useQuery({
    queryKey: ['themes-taxonomy'],
    queryFn: async () => {
      await delay(200);
      return {
        themes: [
          { id: 'ai-ml', name: 'Artificial Intelligence & ML' },
          { id: 'semiconductors', name: 'Semiconductors' },
          { id: 'cloud-computing', name: 'Cloud Computing & SaaS' },
          { id: 'cybersecurity', name: 'Cybersecurity' },
          { id: 'fintech', name: 'Financial Technology' },
          { id: 'healthcare-biotech', name: 'Healthcare & Biotechnology' },
          { id: 'clean-energy', name: 'Clean Energy & Renewables' },
          { id: 'ev-battery', name: 'Electric Vehicles & Battery' },
        ],
      };
    },
  });
}

// News Hooks
export function useNewsList(params: {
  query?: string;
  ticker?: string;
  theme?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ['news', params],
    queryFn: async () => {
      await delay(300);
      return {
        data: MOCK_NEWS,
        pagination: {
          page: 1,
          pageSize: 10,
          total: MOCK_NEWS.length,
          totalPages: 1,
        },
      };
    },
  });
}

export function useTrendingTopics() {
  return useQuery({
    queryKey: ['trending-topics'],
    queryFn: async () => {
      await delay(200);
      return MOCK_TRENDING_TOPICS;
    },
  });
}

// Impact Hooks
export function useTopImpacted(window: '1d' | '7d' = '7d') {
  return useQuery({
    queryKey: ['top-impacted', window],
    queryFn: async () => {
      await delay(250);
      return MOCK_TOP_IMPACTED;
    },
  });
}

export function useEtfImpact(ticker: string) {
  return useQuery({
    queryKey: ['etf-impact', ticker],
    queryFn: async () => {
      await delay(200);
      return {
        impacts: [
          {
            newsId: 1,
            title: 'AI chip demand continues to surge',
            impactScore: 3.5,
            rationale: 'Positive impact on technology holdings',
          },
          {
            newsId: 2,
            title: 'Fed signals potential rate cuts',
            impactScore: 2.1,
            rationale: 'Generally positive for equity markets',
          },
        ],
      };
    },
    enabled: !!ticker,
  });
}
