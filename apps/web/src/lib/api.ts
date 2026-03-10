// apps/web/src/lib/api.ts

import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api` : 'http://localhost:3001/api',
  timeout: 30000,
});

// Attach username + session ID to every Railway request for activity tracking
api.interceptors.request.use((config) => {
  if (typeof document !== 'undefined') {
    const userMatch    = document.cookie.match(/(?:^|;\s*)etf_user=([^;]+)/);
    const sessionMatch = document.cookie.match(/(?:^|;\s*)etf_session=([^;]+)/);
    if (userMatch)    config.headers['x-username']   = decodeURIComponent(userMatch[1]);
    if (sessionMatch) config.headers['x-session-id'] = decodeURIComponent(sessionMatch[1]);
  }
  return config;
});

// ── Event tracker ─────────────────────────────────────────────────────────
// Call this from anywhere in the frontend to log a user interaction.
// eventType examples: 'etf_view', 'screener_run', 'ask_etf', 'compare', 'tab_switch'

export function trackEvent(eventType: string, eventData: Record<string, unknown> = {}): void {
  if (typeof document === 'undefined') return;
  const userMatch    = document.cookie.match(/(?:^|;\s*)etf_user=([^;]+)/);
  const sessionMatch = document.cookie.match(/(?:^|;\s*)etf_session=([^;]+)/);
  if (!userMatch || !sessionMatch) return;

  const username  = decodeURIComponent(userMatch[1]);
  const sessionId = decodeURIComponent(sessionMatch[1]);

  // Fire-and-forget — never blocks UI
  fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/events`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'x-username':    username,
      'x-session-id':  sessionId,
    },
    body: JSON.stringify({ eventType, eventData }),
  }).catch(() => { /* silent */ });
}

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
