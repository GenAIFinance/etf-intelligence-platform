// ETF Types
export interface Etf {
  id: number;
  ticker: string;
  name: string;
  exchange: string;
  country: string;
  currency: string;
  assetClass: string | null;
  strategyType: string | null;
  summary: string | null;
  turnover: number | null;
  aum: number | null;
  inceptionDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EtfSectorWeight {
  id: number;
  etfId: number;
  sector: string;
  weight: number;
  asOfDate: Date;
}

export interface EtfHolding {
  id: number;
  etfId: number;
  holdingTicker: string;
  holdingName: string;
  weight: number;
  sector: string | null;
  industry: string | null;
  asOfDate: Date;
}

export interface PriceBar {
  id: number;
  symbol: string;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose: number;
}

export interface EtfMetricSnapshot {
  id: number;
  etfId: number;
  asOfDate: Date;
  trailingReturns: TrailingReturns;
  volatility: number | null;
  sharpe: number | null;
  maxDrawdown: number | null;
  beta: number | null;
  rsi14: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  hi52w: number | null;
  lo52w: number | null;
  latestPrice: number | null;
}

export interface TrailingReturns {
  '1M': number | null;
  '3M': number | null;
  '6M': number | null;
  '1Y': number | null;
  '3Y': number | null;
  '5Y': number | null;
  'YTD': number | null;
}

export interface NewsItem {
  id: number;
  source: string;
  title: string;
  url: string;
  publishedAt: Date;
  snippet: string | null;
  rawJson: object | null;
}

export interface NewsTopic {
  id: number;
  newsItemId: number;
  topicLabel: string;
  keywords: string[];
  embedding: number[] | null;
}

export interface NewsImpact {
  id: number;
  newsItemId: number;
  etfId: number;
  impactScore: number;
  rationale: string;
  matchedHoldings: string[];
  matchedThemes: string[];
}

// Theme Types
export interface Theme {
  id: string;
  name: string;
  keywords: string[];
  sectorHints: string[];
  description: string;
}

export interface ThemeExposure {
  themeId: string;
  themeName: string;
  exposure: number;
  holdings: ThemeHolding[];
}

export interface ThemeHolding {
  ticker: string;
  name: string;
  weight: number;
  confidence: number;
}

export interface HoldingClassification {
  ticker: string;
  name: string;
  themes: { themeId: string; confidence: number }[];
}

// API Response Types
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface EtfDetailResponse extends Etf {
  sectors: EtfSectorWeight[];
}

export interface EtfHoldingsResponse {
  holdings: EtfHolding[];
  concentration: {
    top10Weight: number;
    hhi: number;
    totalHoldings: number;
  };
}

export interface EtfMetricsResponse {
  ticker: string;
  asOfDate: string;
  trailingReturns: TrailingReturns;
  riskMetrics: {
    volatility: number | null;
    sharpe: number | null;
    maxDrawdown: number | null;
    beta: number | null;
  };
  technicals: {
    latestPrice: number | null;
    rsi14: number | null;
    ma20: number | null;
    ma50: number | null;
    ma200: number | null;
    hi52w: number | null;
    lo52w: number | null;
  };
}

export interface NewsImpactResponse {
  newsItem: NewsItem;
  topics: NewsTopic[];
  impacts: {
    etfTicker: string;
    etfName: string;
    impactScore: number;
    rationale: string;
    matchedHoldings: string[];
    matchedThemes: string[];
  }[];
}

export interface TopImpactedEtf {
  ticker: string;
  name: string;
  totalImpactScore: number;
  newsCount: number;
  topNews: { title: string; impactScore: number }[];
}

// LLM Types
export interface LlmSummary {
  whatItOwns: string;
  riskProfile: string;
  keySensitivities: string[];
}

export interface LlmNewsAnalysis {
  summary: string;
  impactRationale: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

// EODHD Types
export interface EodhdEtfGeneral {
  Code: string;
  Type: string;
  Name: string;
  Exchange: string;
  CurrencyCode: string;
  CurrencyName: string;
  CurrencySymbol: string;
  CountryName: string;
  CountryISO: string;
  Description: string;
  Category: string;
  UpdatedAt: string;
}

export interface EodhdEtfData {
  General: EodhdEtfGeneral;
  Technicals: {
    Beta: number | null;
    '52WeekHigh': number | null;
    '52WeekLow': number | null;
    '50DayMA': number | null;
    '200DayMA': number | null;
  };
  ETF_Data: {
    ISIN: string;
    Company_Name: string;
    Company_URL: string;
    ETF_URL: string;
    Yield: number | null;
    Dividend_Paying_Frequency: string;
    Inception_Date: string;
    Max_Annual_Mgmt_Charge: number | null;
    Ongoing_Charge: number | null;
    Date_Ongoing_Charge: string;
    NetExpenseRatio: number | null;
    AnnualHoldingsTurnover: number | null;
    TotalAssets: number | null;
    Average_Mkt_Cap_Mil: number | null;
    Market_Capitalisation: {
      Mega: string;
      Big: string;
      Medium: string;
      Small: string;
      Micro: string;
    };
    Asset_Allocation: {
      Cash: { Long_Percentage: string; Short_Percentage: string; Net_Assets_Percentage: string };
      NotClassified: { Long_Percentage: string; Short_Percentage: string; Net_Assets_Percentage: string };
      Stock: { Long_Percentage: string; Short_Percentage: string; Net_Assets_Percentage: string };
      Bond: { Long_Percentage: string; Short_Percentage: string; Net_Assets_Percentage: string };
    };
    World_Regions: Record<string, { Equity_Percentage: string; Relative_to_Category: string }>;
    Sector_Weights: Record<string, { Equity_Percentage: string; Relative_to_Category: string }>;
    Fixed_Income: Record<string, object>;
    Holdings_Count: number;
    Top_10_Holdings: {
      [key: string]: {
        Code: string;
        Exchange: string;
        Name: string;
        Sector: string;
        Industry: string;
        Country: string;
        Region: string;
        Assets_Percentage: number;
      };
    };
    Holdings: {
      [key: string]: {
        Code: string;
        Exchange: string;
        Name: string;
        Sector: string;
        Industry: string;
        Country: string;
        Region: string;
        Assets_Percentage: number;
      };
    };
    Performance: {
      '1y_Volatility': number | null;
      '3y_Volatility': number | null;
      '3y_ExpReturn': number | null;
      '3y_SharpRatio': number | null;
      Returns_YTD: number | null;
      Returns_1Y: number | null;
      Returns_3Y: number | null;
      Returns_5Y: number | null;
      Returns_10Y: number | null;
    };
  };
}

export interface EodhdHistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
}

export interface EodhdExchangeSymbol {
  Code: string;
  Name: string;
  Country: string;
  Exchange: string;
  Currency: string;
  Type: string;
  Isin: string | null;
}
