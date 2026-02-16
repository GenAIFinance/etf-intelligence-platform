// Cache TTLs in seconds
export const CACHE_TTL = {
  ETF_PROFILE: 7 * 24 * 60 * 60, // 7 days
  HOLDINGS: 7 * 24 * 60 * 60, // 7 days
  PRICES: 24 * 60 * 60, // 1 day
  METRICS: 24 * 60 * 60, // 1 day
  NEWS: 60 * 60, // 1 hour
};

// Supported U.S. exchanges for ETFs
export const US_EXCHANGES = ['US', 'NYSE', 'NASDAQ', 'AMEX', 'BATS'];

// International exchanges with ETF support
export const INTERNATIONAL_EXCHANGES = ['LSE', 'XETRA', 'TSE', 'HKEX', 'ASX'];

// Default pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// EODHD API endpoints
export const EODHD_ENDPOINTS = {
  EXCHANGE_SYMBOLS: '/exchange-symbol-list/{EXCHANGE}',
  ETF_FUNDAMENTALS: '/fundamentals/{SYMBOL}',
  HISTORICAL_PRICES: '/eod/{SYMBOL}',
  REAL_TIME_PRICE: '/real-time/{SYMBOL}',
};

// Risk-free rate (can be overridden by env var)
export const DEFAULT_RISK_FREE_RATE = 0.03;

// Default benchmark
export const DEFAULT_BENCHMARK = 'SPY';

// Trading days per year (approximate)
export const TRADING_DAYS_PER_YEAR = 252;

// Asset class mapping from EODHD categories
export const ASSET_CLASS_MAP: Record<string, string> = {
  'Equity': 'Equity',
  'Fixed Income': 'Fixed Income',
  'Bond': 'Fixed Income',
  'Commodity': 'Commodity',
  'Currency': 'Currency',
  'Real Estate': 'Real Estate',
  'Alternative': 'Alternative',
  'Multi-Asset': 'Multi-Asset',
  'Money Market': 'Money Market',
};

// Strategy type mapping
export const STRATEGY_TYPE_MAP: Record<string, string> = {
  'Index': 'Passive Index',
  'Active': 'Active',
  'Factor': 'Factor/Smart Beta',
  'Thematic': 'Thematic',
  'Sector': 'Sector',
  'Dividend': 'Dividend',
  'Growth': 'Growth',
  'Value': 'Value',
  'Blend': 'Blend',
  'Leveraged': 'Leveraged',
  'Inverse': 'Inverse',
};

// News sources
export const NEWS_SOURCES = {
  GOOGLE_NEWS: 'Google News',
  BLOOMBERG: 'Bloomberg',
  FINANCIAL_TIMES: 'Financial Times',
  MANUAL: 'Manual Entry',
};

// Google News RSS base URL
export const GOOGLE_NEWS_RSS_BASE = 'https://news.google.com/rss/search';

// API response messages
export const MESSAGES = {
  ETF_NOT_FOUND: 'ETF not found',
  INVALID_TICKER: 'Invalid ticker symbol',
  DATA_UNAVAILABLE: 'Data unavailable for this ETF',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded, please try again later',
  INTERNAL_ERROR: 'Internal server error',
  LLM_DISABLED: 'LLM analysis is disabled',
};
