// Mock data for static demo

export const MOCK_ETFS = [
  { id: 1, ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE', country: 'US', currency: 'USD', assetClass: 'Equity', strategyType: 'Passive', aum: 450000000000, summary: 'Tracks the S&P 500 index' },
  { id: 2, ticker: 'QQQ', name: 'Invesco QQQ Trust', exchange: 'NASDAQ', country: 'US', currency: 'USD', assetClass: 'Equity', strategyType: 'Passive', aum: 200000000000, summary: 'Tracks the NASDAQ-100 index' },
  { id: 3, ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', exchange: 'NYSE', country: 'US', currency: 'USD', assetClass: 'Equity', strategyType: 'Passive', aum: 350000000000, summary: 'Total US stock market exposure' },
  { id: 4, ticker: 'ARKK', name: 'ARK Innovation ETF', exchange: 'NYSE', country: 'US', currency: 'USD', assetClass: 'Equity', strategyType: 'Active', aum: 8000000000, summary: 'Disruptive innovation companies' },
  { id: 5, ticker: 'XLK', name: 'Technology Select Sector SPDR Fund', exchange: 'NYSE', country: 'US', currency: 'USD', assetClass: 'Equity', strategyType: 'Passive', aum: 55000000000, summary: 'Technology sector exposure' },
  { id: 6, ticker: 'XLF', name: 'Financial Select Sector SPDR Fund', exchange: 'NYSE', country: 'US', currency: 'USD', assetClass: 'Equity', strategyType: 'Passive', aum: 35000000000, summary: 'Financial sector exposure' },
  { id: 7, ticker: 'SOXX', name: 'iShares Semiconductor ETF', exchange: 'NASDAQ', country: 'US', currency: 'USD', assetClass: 'Equity', strategyType: 'Passive', aum: 12000000000, summary: 'Semiconductor industry exposure' },
  { id: 8, ticker: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', exchange: 'NASDAQ', country: 'US', currency: 'USD', assetClass: 'Fixed Income', strategyType: 'Passive', aum: 40000000000, summary: 'Long-term Treasury bonds' },
  { id: 9, ticker: 'GLD', name: 'SPDR Gold Shares', exchange: 'NYSE', country: 'US', currency: 'USD', assetClass: 'Commodity', strategyType: 'Passive', aum: 60000000000, summary: 'Physical gold exposure' },
  { id: 10, ticker: 'VWO', name: 'Vanguard FTSE Emerging Markets ETF', exchange: 'NYSE', country: 'US', currency: 'USD', assetClass: 'Equity', strategyType: 'Passive', aum: 80000000000, summary: 'Emerging markets exposure' },
];

export const MOCK_TOP_IMPACTED = {
  window: '7d',
  topEtfs: [
    { ticker: 'SOXX', name: 'iShares Semiconductor ETF', totalImpactScore: 8.7, newsCount: 12 },
    { ticker: 'ARKK', name: 'ARK Innovation ETF', totalImpactScore: 7.2, newsCount: 9 },
    { ticker: 'XLK', name: 'Technology Select Sector SPDR Fund', totalImpactScore: 6.5, newsCount: 8 },
    { ticker: 'QQQ', name: 'Invesco QQQ Trust', totalImpactScore: 5.8, newsCount: 15 },
    { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', totalImpactScore: 4.2, newsCount: 22 },
  ],
};

export const MOCK_TRENDING_TOPICS = {
  topics: [
    { topic: 'AI Chip Export Controls', count: 24 },
    { topic: 'Interest Rate Decision', count: 18 },
    { topic: 'Earnings Report', count: 15 },
    { topic: 'FDA Regulation', count: 12 },
    { topic: 'Merger & Acquisition', count: 10 },
    { topic: 'Supply Chain Issues', count: 8 },
    { topic: 'Trade Policy', count: 7 },
    { topic: 'Product Launch', count: 6 },
  ],
};

export const MOCK_NEWS = [
  { id: 1, source: 'Reuters', title: 'AI chip demand continues to surge as hyperscalers ramp up infrastructure', url: '#', publishedAt: '2026-02-05T10:00:00Z', snippet: 'Major cloud providers are increasing their AI infrastructure investments...' },
  { id: 2, source: 'Bloomberg', title: 'Fed signals potential rate cuts in second half of 2026', url: '#', publishedAt: '2026-02-04T14:30:00Z', snippet: 'Federal Reserve officials indicated that rate cuts could come if inflation continues to moderate...' },
  { id: 3, source: 'CNBC', title: 'Tech giants report strong Q4 earnings amid AI boom', url: '#', publishedAt: '2026-02-03T09:15:00Z', snippet: 'Major technology companies exceeded expectations with robust AI-driven revenue growth...' },
  { id: 4, source: 'WSJ', title: 'Semiconductor shortage easing as new fabs come online', url: '#', publishedAt: '2026-02-02T11:45:00Z', snippet: 'New manufacturing facilities are helping to address the global chip shortage...' },
  { id: 5, source: 'Financial Times', title: 'Clean energy investments reach record high in 2025', url: '#', publishedAt: '2026-02-01T08:00:00Z', snippet: 'Global investment in renewable energy exceeded $500 billion last year...' },
];

// Generate mock price data
export function generateMockPrices(ticker: string, days: number = 252 * 5) {
  const prices = [];
  let basePrice = ticker === 'SPY' ? 450 : ticker === 'QQQ' ? 380 : ticker === 'SOXX' ? 220 : 100;
  const volatility = ticker === 'ARKK' ? 0.025 : 0.012;
  const drift = 0.0003;

  const endDate = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(endDate);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const randomReturn = (Math.random() - 0.5) * 2 * volatility + drift;
    basePrice = basePrice * (1 + randomReturn);

    prices.push({
      date: date.toISOString().split('T')[0],
      open: basePrice * (1 - Math.random() * 0.005),
      high: basePrice * (1 + Math.random() * 0.01),
      low: basePrice * (1 - Math.random() * 0.01),
      close: basePrice,
      adjustedClose: basePrice,
      volume: Math.floor(Math.random() * 10000000) + 1000000,
    });
  }
  return prices;
}

export const MOCK_SECTORS: Record<string, { sector: string; weight: number }[]> = {
  SPY: [
    { sector: 'Technology', weight: 0.29 },
    { sector: 'Healthcare', weight: 0.13 },
    { sector: 'Financials', weight: 0.12 },
    { sector: 'Consumer Discretionary', weight: 0.10 },
    { sector: 'Communication Services', weight: 0.09 },
    { sector: 'Industrials', weight: 0.08 },
    { sector: 'Consumer Staples', weight: 0.06 },
    { sector: 'Energy', weight: 0.05 },
    { sector: 'Utilities', weight: 0.03 },
    { sector: 'Real Estate', weight: 0.03 },
    { sector: 'Materials', weight: 0.02 },
  ],
  QQQ: [
    { sector: 'Technology', weight: 0.51 },
    { sector: 'Communication Services', weight: 0.16 },
    { sector: 'Consumer Discretionary', weight: 0.14 },
    { sector: 'Healthcare', weight: 0.07 },
    { sector: 'Consumer Staples', weight: 0.05 },
    { sector: 'Industrials', weight: 0.04 },
    { sector: 'Utilities', weight: 0.02 },
    { sector: 'Financials', weight: 0.01 },
  ],
  SOXX: [
    { sector: 'Semiconductors', weight: 1.0 },
  ],
  XLK: [
    { sector: 'Software', weight: 0.35 },
    { sector: 'Hardware', weight: 0.25 },
    { sector: 'Semiconductors', weight: 0.22 },
    { sector: 'IT Services', weight: 0.18 },
  ],
};

export const MOCK_HOLDINGS: Record<string, { holdingTicker: string; holdingName: string; weight: number; sector: string }[]> = {
  SPY: [
    { holdingTicker: 'AAPL', holdingName: 'Apple Inc.', weight: 0.072, sector: 'Technology' },
    { holdingTicker: 'MSFT', holdingName: 'Microsoft Corporation', weight: 0.068, sector: 'Technology' },
    { holdingTicker: 'NVDA', holdingName: 'NVIDIA Corporation', weight: 0.045, sector: 'Technology' },
    { holdingTicker: 'AMZN', holdingName: 'Amazon.com Inc.', weight: 0.038, sector: 'Consumer Discretionary' },
    { holdingTicker: 'GOOGL', holdingName: 'Alphabet Inc. Class A', weight: 0.025, sector: 'Communication Services' },
    { holdingTicker: 'META', holdingName: 'Meta Platforms Inc.', weight: 0.024, sector: 'Communication Services' },
    { holdingTicker: 'BRK.B', holdingName: 'Berkshire Hathaway Inc.', weight: 0.019, sector: 'Financials' },
    { holdingTicker: 'JPM', holdingName: 'JPMorgan Chase & Co.', weight: 0.014, sector: 'Financials' },
    { holdingTicker: 'V', holdingName: 'Visa Inc.', weight: 0.013, sector: 'Financials' },
    { holdingTicker: 'UNH', holdingName: 'UnitedHealth Group Inc.', weight: 0.012, sector: 'Healthcare' },
  ],
  QQQ: [
    { holdingTicker: 'AAPL', holdingName: 'Apple Inc.', weight: 0.12, sector: 'Technology' },
    { holdingTicker: 'MSFT', holdingName: 'Microsoft Corporation', weight: 0.11, sector: 'Technology' },
    { holdingTicker: 'NVDA', holdingName: 'NVIDIA Corporation', weight: 0.08, sector: 'Technology' },
    { holdingTicker: 'AMZN', holdingName: 'Amazon.com Inc.', weight: 0.06, sector: 'Consumer Discretionary' },
    { holdingTicker: 'META', holdingName: 'Meta Platforms Inc.', weight: 0.05, sector: 'Communication Services' },
    { holdingTicker: 'GOOGL', holdingName: 'Alphabet Inc. Class A', weight: 0.04, sector: 'Communication Services' },
    { holdingTicker: 'GOOG', holdingName: 'Alphabet Inc. Class C', weight: 0.04, sector: 'Communication Services' },
    { holdingTicker: 'TSLA', holdingName: 'Tesla Inc.', weight: 0.035, sector: 'Consumer Discretionary' },
    { holdingTicker: 'AVGO', holdingName: 'Broadcom Inc.', weight: 0.03, sector: 'Technology' },
    { holdingTicker: 'COST', holdingName: 'Costco Wholesale Corp.', weight: 0.025, sector: 'Consumer Staples' },
  ],
  SOXX: [
    { holdingTicker: 'NVDA', holdingName: 'NVIDIA Corporation', weight: 0.10, sector: 'Semiconductors' },
    { holdingTicker: 'AVGO', holdingName: 'Broadcom Inc.', weight: 0.09, sector: 'Semiconductors' },
    { holdingTicker: 'AMD', holdingName: 'Advanced Micro Devices', weight: 0.08, sector: 'Semiconductors' },
    { holdingTicker: 'QCOM', holdingName: 'Qualcomm Inc.', weight: 0.07, sector: 'Semiconductors' },
    { holdingTicker: 'TXN', holdingName: 'Texas Instruments Inc.', weight: 0.06, sector: 'Semiconductors' },
    { holdingTicker: 'INTC', holdingName: 'Intel Corporation', weight: 0.05, sector: 'Semiconductors' },
    { holdingTicker: 'MU', holdingName: 'Micron Technology', weight: 0.05, sector: 'Semiconductors' },
    { holdingTicker: 'AMAT', holdingName: 'Applied Materials Inc.', weight: 0.04, sector: 'Semiconductors' },
    { holdingTicker: 'LRCX', holdingName: 'Lam Research Corp.', weight: 0.04, sector: 'Semiconductors' },
    { holdingTicker: 'KLAC', holdingName: 'KLA Corporation', weight: 0.035, sector: 'Semiconductors' },
  ],
};

export const MOCK_THEME_EXPOSURE: Record<string, { themeName: string; exposure: number }[]> = {
  SPY: [
    { themeName: 'Artificial Intelligence & ML', exposure: 0.18 },
    { themeName: 'Cloud Computing & SaaS', exposure: 0.15 },
    { themeName: 'Banking & Financial Services', exposure: 0.12 },
    { themeName: 'Healthcare & Biotechnology', exposure: 0.10 },
    { themeName: 'E-Commerce & Digital Retail', exposure: 0.08 },
  ],
  QQQ: [
    { themeName: 'Artificial Intelligence & ML', exposure: 0.35 },
    { themeName: 'Cloud Computing & SaaS', exposure: 0.28 },
    { themeName: 'Semiconductors', exposure: 0.15 },
    { themeName: 'E-Commerce & Digital Retail', exposure: 0.12 },
    { themeName: 'Gaming & Esports', exposure: 0.05 },
  ],
  SOXX: [
    { themeName: 'Semiconductors', exposure: 1.0 },
    { themeName: 'Artificial Intelligence & ML', exposure: 0.65 },
    { themeName: 'Cloud Computing & SaaS', exposure: 0.20 },
  ],
  ARKK: [
    { themeName: 'Artificial Intelligence & ML', exposure: 0.45 },
    { themeName: 'Healthcare & Biotechnology', exposure: 0.20 },
    { themeName: 'Fintech', exposure: 0.15 },
    { themeName: 'Electric Vehicles & Battery', exposure: 0.10 },
    { themeName: 'Robotics & Automation', exposure: 0.08 },
  ],
};

// Calculate mock metrics
export function getMockMetrics(ticker: string) {
  const baseReturns: Record<string, Record<string, number>> = {
    SPY: { '1M': 0.032, '3M': 0.078, '6M': 0.112, '1Y': 0.185, '3Y': 0.32, '5Y': 0.85, YTD: 0.045 },
    QQQ: { '1M': 0.045, '3M': 0.095, '6M': 0.145, '1Y': 0.28, '3Y': 0.45, '5Y': 1.2, YTD: 0.062 },
    SOXX: { '1M': 0.065, '3M': 0.12, '6M': 0.22, '1Y': 0.45, '3Y': 0.75, '5Y': 2.1, YTD: 0.085 },
    ARKK: { '1M': -0.02, '3M': 0.05, '6M': 0.08, '1Y': 0.15, '3Y': -0.35, '5Y': 0.20, YTD: 0.03 },
    XLK: { '1M': 0.04, '3M': 0.09, '6M': 0.14, '1Y': 0.26, '3Y': 0.42, '5Y': 1.1, YTD: 0.055 },
  };

  const returns = baseReturns[ticker] || baseReturns.SPY;

  return {
    trailingReturns: returns,
    volatility: ticker === 'ARKK' ? 0.38 : ticker === 'SOXX' ? 0.32 : 0.18,
    sharpe: ticker === 'ARKK' ? 0.4 : ticker === 'SOXX' ? 1.2 : 0.95,
    maxDrawdown: ticker === 'ARKK' ? 0.78 : ticker === 'SOXX' ? 0.45 : 0.34,
    beta: ticker === 'QQQ' ? 1.15 : ticker === 'SOXX' ? 1.35 : ticker === 'ARKK' ? 1.8 : 1.0,
    rsi14: 55 + Math.random() * 20,
    ma20: 100,
    ma50: 98,
    ma200: 92,
    hi52w: 110,
    lo52w: 85,
    latestPrice: 105,
  };
}
