import { useQuery } from '@tanstack/react-query';
import { etfApi, themesApi, newsApi, impactApi } from './api';

// ETF Hooks - NOW USING REAL API

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

export function useEtf(ticker: string) {
  return useQuery({
    queryKey: ['etf', ticker],
    queryFn: async () => {
      const response = await etfApi.getByTicker(ticker);
      return response.data;
    },
    enabled: !!ticker,
  });
}

export function useEtfHoldings(ticker: string) {
  return useQuery({
    queryKey: ['etf-holdings', ticker],
    queryFn: async () => {
      const response = await etfApi.getHoldings(ticker);
      return response.data;
    },
    enabled: !!ticker,
  });
}

export function useEtfSectors(ticker: string) {
  return useQuery({
    queryKey: ['etf-sectors', ticker],
    queryFn: async () => {
      const response = await etfApi.getSectors(ticker);
      return response.data;
    },
    enabled: !!ticker,
  });
}

export function useEtfPrices(ticker: string, range: string = '5y', interval: string = '1d') {
  return useQuery({
    queryKey: ['etf-prices', ticker, range, interval],
    queryFn: async () => {
      const response = await etfApi.getPrices(ticker, range, interval);
      return response.data;
    },
    enabled: !!ticker,
  });
}

export function useEtfMetrics(ticker: string, asOf?: string) {
  return useQuery({
    queryKey: ['etf-metrics', ticker, asOf],
    queryFn: async () => {
      const response = await etfApi.getMetrics(ticker, asOf);
      return response.data;
    },
    enabled: !!ticker,
  });
}

export function useEtfThemesExposure(ticker: string) {
  return useQuery({
    queryKey: ['etf-themes-exposure', ticker],
    queryFn: async () => {
      const response = await etfApi.getThemesExposure(ticker);
      return response.data;
    },
    enabled: !!ticker,
  });
}

// Themes Hooks
export function useThemeTaxonomy() {
  return useQuery({
    queryKey: ['themes-taxonomy'],
    queryFn: async () => {
      const response = await themesApi.getTaxonomy();
      return response.data;
    },
  });
}

export function useTheme(themeId: string) {
  return useQuery({
    queryKey: ['theme', themeId],
    queryFn: async () => {
      const response = await themesApi.getById(themeId);
      return response.data;
    },
    enabled: !!themeId,
  });
}

export function useThemeSearch(query: string) {
  return useQuery({
    queryKey: ['theme-search', query],
    queryFn: async () => {
      const response = await themesApi.search(query);
      return response.data;
    },
    enabled: !!query && query.length > 0,
  });
}

// News Hooks
export function useNews(params: {
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
      const response = await newsApi.getList(params);
      return response.data;
    },
  });
}

export function useTrendingTopics() {
  return useQuery({
    queryKey: ['trending-topics'],
    queryFn: async () => {
      const response = await newsApi.getTrending();
      return response.data;
    },
  });
}

// Impact Hooks
export function useTopImpacted(window: '1d' | '7d' = '7d') {
  return useQuery({
    queryKey: ['top-impacted', window],
    queryFn: async () => {
      const response = await impactApi.getTop(window);
      return response.data;
    },
  });
}

export function useEtfImpact(ticker: string) {
  return useQuery({
    queryKey: ['etf-impact', ticker],
    queryFn: async () => {
      const response = await impactApi.getByEtf(ticker);
      return response.data;
    },
    enabled: !!ticker,
  });
}