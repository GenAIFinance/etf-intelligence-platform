import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.API_PORT || '3001', 10),

  // EODHD API
  eodhd: {
    apiKey: process.env.EODHD_API_KEY || '',
    baseUrl: 'https://eodhd.com/api',
    requestsPerMinute: parseInt(process.env.EODHD_REQUESTS_PER_MINUTE || '300', 10),
  },

  // LLM Configuration
  llm: {
    baseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    enabled: !!process.env.LLM_API_KEY,
  },

  // Risk Metrics
  riskFreeRate: parseFloat(process.env.RISK_FREE_RATE_ANNUAL || '0.03'),
  benchmarkTicker: process.env.BENCHMARK_TICKER || 'SPY',

  // Cache TTLs (in seconds)
  cache: {
    etfProfile: parseInt(process.env.CACHE_TTL_ETF_PROFILE || '604800', 10),
    holdings: parseInt(process.env.CACHE_TTL_HOLDINGS || '604800', 10),
    prices: parseInt(process.env.CACHE_TTL_PRICES || '86400', 10),
    metrics: parseInt(process.env.CACHE_TTL_METRICS || '86400', 10),
    news: parseInt(process.env.CACHE_TTL_NEWS || '3600', 10),
  },
};

// Validate required config
if (!config.eodhd.apiKey) {
  console.warn('⚠️ EODHD_API_KEY is not set. API calls will fail.');
}

if (!config.llm.enabled) {
  console.info('ℹ️ LLM is disabled. Running in fallback mode.');
}
