import axios from 'axios';

const api = axios.create({
   baseURL: 'http://localhost:3001/api',
  timeout: 30000,
});

// ETF API
export const etfApi = {
  getList: (params: {
    search?: string;
    assetClass?: string;
    strategyType?: string;
    page?: number;
    pageSize?: number;
  }) => api.get('/etfs', { params }),

  getByTicker: (ticker: string) => api.get(`/etfs/${ticker}`),

  getHoldings: (ticker: string) => api.get(`/etfs/${ticker}/holdings`),

  getSectors: (ticker: string) => api.get(`/etfs/${ticker}/sectors`),

  getPrices: (ticker: string, range: string = '5y', interval: string = '1d') =>
    api.get(`/etfs/${ticker}/prices`, { params: { range, interval } }),

  getMetrics: (ticker: string, asOf?: string) =>
    api.get(`/etfs/${ticker}/metrics`, { params: { asOf } }),

  getThemesExposure: (ticker: string) => api.get(`/etfs/${ticker}/themes-exposure`),
};

// Themes API
export const themesApi = {
  getTaxonomy: () => api.get('/themes/taxonomy'),

  getById: (themeId: string) => api.get(`/themes/${themeId}`),

  search: (query: string) => api.get('/themes/search', { params: { q: query } }),
};

// News API
export const newsApi = {
  getList: (params: {
    query?: string;
    ticker?: string;
    theme?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) => api.get('/news', { params }),

  addManual: (data: {
    url: string;
    title: string;
    source: string;
    publishedAt?: string;
    snippet?: string;
  }) => api.post('/news/manual', data),

  getTrending: () => api.get('/news/trending'),
};

// Impact API
export const impactApi = {
  getTop: (window: '1d' | '7d' = '7d') =>
    api.get('/impact/top', { params: { window } }),

  getByEtf: (ticker: string) => api.get(`/impact/etf/${ticker}`),
};

export default api;
