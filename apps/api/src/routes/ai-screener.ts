// AI Screener Route — 3 query modes:
//   1. STOCK EXPOSURE  — "ETFs holding NVDA", "NVIDIA exposure", "which funds own Apple"
//   2. THEME           — "quantum computing", "clean energy", "AI and robotics"
//   3. GENERAL         — asset class, geography, cost, strategy

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db';

// ─── Theme dictionary ───────────────────────────────────────────────────────
const THEMES: Record<string, {
  label: string;
  triggerWords: string[];
  etfKeywords: string[];
  holdingKeywords: string[];
}> = {
  quantum_computing: {
    label: 'Quantum Computing',
    triggerWords: ['quantum', 'quantum computing'],
    etfKeywords: ['quantum', 'computing', 'technology'],
    holdingKeywords: ['IBM', 'Honeywell', 'IonQ', 'Rigetti', 'D-Wave', 'Google', 'Alphabet', 'Intel', 'Microsoft'],
  },
  artificial_intelligence: {
    label: 'Artificial Intelligence',
    triggerWords: ['artificial intelligence', ' ai ', 'ai etf', 'machine learning', 'deep learning', 'generative ai', 'large language'],
    etfKeywords: ['artificial intelligence', 'machine learning', 'robotics', 'automation', 'BOTZ', 'IRBO', 'ROBO'],
    holdingKeywords: ['NVIDIA', 'Microsoft', 'Alphabet', 'Meta', 'Amazon', 'Palantir', 'C3.ai', 'UiPath'],
  },
  clean_energy: {
    label: 'Clean Energy',
    triggerWords: ['clean energy', 'renewable energy', 'solar', 'wind energy', 'green energy', 'net zero'],
    etfKeywords: ['clean energy', 'renewable', 'solar', 'wind', 'sustainable energy', 'ICLN', 'QCLN'],
    holdingKeywords: ['NextEra', 'Enphase', 'SolarEdge', 'First Solar', 'Vestas', 'Orsted', 'Tesla'],
  },
  cybersecurity: {
    label: 'Cybersecurity',
    triggerWords: ['cybersecurity', 'cyber security', 'network security', 'data security', 'ransomware', 'HACK', 'BUG', 'CIBR'],
    etfKeywords: ['cyber', 'cybersecurity', 'security', 'HACK', 'CIBR', 'BUG'],
    holdingKeywords: ['CrowdStrike', 'Palo Alto', 'Fortinet', 'Zscaler', 'SentinelOne', 'Okta', 'Cloudflare'],
  },
  semiconductors: {
    label: 'Semiconductors',
    triggerWords: ['semiconductor', 'semiconductors', 'chip', 'chips', 'chipmaker', 'SOXX', 'SMH'],
    etfKeywords: ['semiconductor', 'chip', 'SOXX', 'SMH'],
    holdingKeywords: ['NVIDIA', 'AMD', 'Intel', 'TSMC', 'Qualcomm', 'Broadcom', 'ASML', 'Micron', 'Applied Materials'],
  },
  biotech: {
    label: 'Biotechnology',
    triggerWords: ['biotech', 'biotechnology', 'gene therapy', 'genomics', 'crispr', 'mrna', 'drug discovery', 'IBB', 'XBI'],
    etfKeywords: ['biotech', 'biotechnology', 'genomics', 'life sciences', 'IBB', 'XBI'],
    holdingKeywords: ['Moderna', 'BioNTech', 'Regeneron', 'Vertex', 'Gilead', 'Biogen', 'Amgen', 'Illumina'],
  },
  cloud_computing: {
    label: 'Cloud Computing',
    triggerWords: ['cloud', 'cloud computing', 'saas', 'software as a service', 'CLOU', 'SKYY'],
    etfKeywords: ['cloud', 'SaaS', 'software', 'digital', 'CLOU', 'SKYY'],
    holdingKeywords: ['Amazon', 'Microsoft', 'Salesforce', 'Snowflake', 'Datadog', 'Twilio', 'ServiceNow', 'Workday'],
  },
  electric_vehicles: {
    label: 'Electric Vehicles',
    triggerWords: ['electric vehicle', 'electric vehicles', 'ev ', 'evs', 'electric car', 'lithium battery', 'LIT', 'DRIV', 'IDRV'],
    etfKeywords: ['electric vehicle', 'EV', 'clean transport', 'battery', 'DRIV', 'IDRV', 'LIT'],
    holdingKeywords: ['Tesla', 'Rivian', 'Lucid', 'NIO', 'BYD', 'Albemarle', 'ChargePoint'],
  },
  fintech: {
    label: 'Financial Technology',
    triggerWords: ['fintech', 'financial technology', 'digital payment', 'blockchain', 'crypto', 'FINX', 'ARKF'],
    etfKeywords: ['fintech', 'financial technology', 'payment', 'digital finance', 'FINX', 'ARKF'],
    holdingKeywords: ['Visa', 'Mastercard', 'PayPal', 'Square', 'Block', 'Adyen', 'Coinbase', 'Robinhood'],
  },
  robotics: {
    label: 'Robotics & Automation',
    triggerWords: ['robotics', 'automation', 'industrial robot', 'autonomous vehicle', 'ROBO', 'IRBO', 'BOTZ'],
    etfKeywords: ['robotics', 'automation', 'ROBO', 'IRBO', 'autonomous', 'BOTZ'],
    holdingKeywords: ['Intuitive Surgical', 'Fanuc', 'ABB', 'Rockwell', 'Cognex', 'Keyence'],
  },
  space: {
    label: 'Space Exploration',
    triggerWords: ['space', 'space exploration', 'satellite', 'aerospace defense', 'rocket', 'ARKX', 'UFO', 'ROKT'],
    etfKeywords: ['space', 'aerospace', 'ARKX', 'UFO', 'ROKT'],
    holdingKeywords: ['Boeing', 'Lockheed', 'Northrop', 'Raytheon', 'Virgin Galactic', 'Planet Labs'],
  },
  esg: {
    label: 'ESG / Sustainable Investing',
    triggerWords: ['esg', 'sustainable', 'socially responsible', 'sri', 'impact investing', 'green investing'],
    etfKeywords: ['ESG', 'sustainable', 'responsible', 'impact', 'SRI'],
    holdingKeywords: [],
  },
  infrastructure: {
    label: 'Infrastructure',
    triggerWords: ['infrastructure', 'roads bridges', 'water infrastructure', 'utilities infrastructure', 'PAVE', 'IGF', 'IFRA'],
    etfKeywords: ['infrastructure', 'PAVE', 'IGF', 'IFRA'],
    holdingKeywords: ['Caterpillar', 'Deere', 'Vulcan Materials', 'Martin Marietta', 'American Tower'],
  },
  dividend: {
    label: 'Dividend Income',
    triggerWords: ['high yield dividend', 'dividend growth', 'dividend income', 'dividend etf', 'VYM', 'SCHD', 'DVY'],
    etfKeywords: ['dividend', 'income', 'yield', 'VYM', 'SCHD', 'DVY', 'HDV'],
    holdingKeywords: [],
  },
};

// ─── Stock name → ticker aliases ────────────────────────────────────────────
const STOCK_ALIASES: Record<string, string> = {
  'nvidia': 'NVDA', 'apple': 'AAPL', 'microsoft': 'MSFT',
  'google': 'GOOGL', 'alphabet': 'GOOGL', 'amazon': 'AMZN',
  'meta': 'META', 'facebook': 'META', 'tesla': 'TSLA',
  'jpmorgan': 'JPM', 'jp morgan': 'JPM', 'exxon': 'XOM',
  'johnson & johnson': 'JNJ', 'walmart': 'WMT', 'visa': 'V',
  'mastercard': 'MA', 'paypal': 'PYPL', 'netflix': 'NFLX',
  'adobe': 'ADBE', 'salesforce': 'CRM', 'amd': 'AMD',
  'intel': 'INTC', 'qualcomm': 'QCOM', 'broadcom': 'AVGO',
  'tsmc': 'TSM', 'taiwan semiconductor': 'TSM',
  'palantir': 'PLTR', 'coinbase': 'COIN', 'snowflake': 'SNOW',
  'crowdstrike': 'CRWD', 'palo alto': 'PANW', 'cloudflare': 'NET',
  'datadog': 'DDOG', 'servicenow': 'NOW', 'workday': 'WDAY',
  'uber': 'UBER', 'airbnb': 'ABNB', 'shopify': 'SHOP',
  'moderna': 'MRNA', 'pfizer': 'PFE', 'unitedhealth': 'UNH',
  'eli lilly': 'LLY', 'abbvie': 'ABBV', 'berkshire': 'BRK.B',
};

// ─── Query type detector ────────────────────────────────────────────────────
function detectQueryType(query: string): {
  type: 'stock_exposure' | 'theme' | 'general';
  stockTerm?: string;
  themeKey?: string;
} {
  const lower = query.toLowerCase().trim();

  // 1. Stock exposure patterns
  const stockPatterns = [
    /(?:etfs?|funds?)\s+(?:holding|that\s+hold|with|containing|that\s+have|that\s+own)\s+(.+?)(?:\s+stock|\s+shares|$)/i,
    /(?:which|show|find|list)\s+(?:etfs?|funds?)\s+(?:own|hold|have|include|contain)\s+(.+?)(?:\s*$|\?)/i,
    /(.+?)\s+exposure(?:\s+in\s+(?:etfs?|funds?))?$/i,
    /(.+?)\s+in\s+(?:etfs?|funds?)$/i,
    /(?:what|which)\s+(?:etfs?|funds?)\s+(?:hold|own|have|include)\s+(.+)/i,
    /(?:how much|what percentage|what weight)\s+(?:of\s+)?(?:etfs?|funds?)\s+(?:hold|own)\s+(.+)/i,
  ];

  const skipTerms = new Set(['tech', 'technology', 'bond', 'equity', 'dividend',
    'value', 'growth', 'international', 'us', 'large cap', 'small cap', 'emerging', 'developed']);

  for (const pattern of stockPatterns) {
    const match = query.match(pattern);
    if (match) {
      const rawTerm = match[1].trim();
      if (!skipTerms.has(rawTerm.toLowerCase())) {
        const resolved = STOCK_ALIASES[rawTerm.toLowerCase()] || rawTerm.toUpperCase();
        return { type: 'stock_exposure', stockTerm: resolved };
      }
    }
  }

  // Bare ticker: "NVDA" or "NVDA ETFs"
  const tickerMatch = query.trim().match(/^([A-Z]{2,5})(?:\s+etfs?|\s+funds?|\s+exposure)?$/i);
  if (tickerMatch) {
    return { type: 'stock_exposure', stockTerm: tickerMatch[1].toUpperCase() };
  }

  // Known alias in query with ETF/hold context
  for (const [alias, ticker] of Object.entries(STOCK_ALIASES)) {
    if (lower.includes(alias) && (lower.includes('etf') || lower.includes('fund') ||
        lower.includes('hold') || lower.includes('exposure'))) {
      return { type: 'stock_exposure', stockTerm: ticker };
    }
  }

  // 2. Theme detection
  for (const [key, theme] of Object.entries(THEMES)) {
    for (const trigger of theme.triggerWords) {
      if (lower.includes(trigger.trim().toLowerCase())) {
        return { type: 'theme', themeKey: key };
      }
    }
  }

  // 3. General
  return { type: 'general' };
}

// ─── Main route ─────────────────────────────────────────────────────────────
export async function aiScreenerRoutes(fastify: FastifyInstance) {

  fastify.post('/ai-screener', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { query, limit = 20 } = request.body as { query: string; limit?: number };
      if (!query?.trim()) return reply.status(400).send({ error: 'Query is required' });

      const maxResults = Math.min(Number(limit), 100);
      const detected   = detectQueryType(query.trim());

      if (detected.type === 'stock_exposure' && detected.stockTerm)
        return await handleStockExposure(detected.stockTerm, query, maxResults);

      if (detected.type === 'theme' && detected.themeKey)
        return await handleTheme(detected.themeKey, query, maxResults);

      return await handleGeneral(query, maxResults);

    } catch (error: any) {
      fastify.log.error('AI Screener error:', error);
      return reply.status(500).send({ error: 'Failed to process query', message: error.message });
    }
  });
}

// ─── Mode 1: Stock Exposure ─────────────────────────────────────────────────
async function handleStockExposure(stockTerm: string, originalQuery: string, limit: number) {
  const holdings = await prisma.etfHolding.findMany({
    where: {
      OR: [
        { holdingTicker: { contains: stockTerm, mode: 'insensitive' } },
        { holdingName:   { contains: stockTerm, mode: 'insensitive' } },
      ],
    },
    include: {
      etf: {
        select: {
          ticker: true, name: true, assetClass: true,
          strategyType: true, aum: true, netExpenseRatio: true,
        },
      },
    },
    orderBy: { weight: 'desc' },
    take: limit * 3,
  });

  if (holdings.length === 0) {
    return {
      queryType: 'stock_exposure',
      stock: stockTerm,
      results: [],
      totalFound: 0,
      interpretation: `No ETFs found holding "${stockTerm}". Holdings data may not be synced yet — run the full data sync first.`,
    };
  }

  // Dedupe: keep highest-weight entry per ETF
  const seen = new Map<string, typeof holdings[0]>();
  for (const h of holdings) {
    const ex = seen.get(h.etf.ticker);
    if (!ex || h.weight > ex.weight) seen.set(h.etf.ticker, h);
  }

  const unique = Array.from(seen.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);

  const results = unique.map(h => ({
    ticker:          h.etf.ticker,
    name:            h.etf.name,
    assetClass:      h.etf.assetClass,
    strategyType:    h.etf.strategyType,
    aum:             h.etf.aum,
    netExpenseRatio: h.etf.netExpenseRatio,
    holdingTicker:   h.holdingTicker,
    holdingName:     h.holdingName,
    weight:          Math.round(h.weight * 100) / 100,
    asOfDate:        h.asOfDate,
    relevanceScore:  Math.round(Math.min(h.weight / 10, 1) * 10) / 10,
    matchReason:     `${h.holdingName} = ${h.weight.toFixed(2)}% of portfolio`,
  }));

  const avgWeight = results.reduce((s, r) => s + r.weight, 0) / results.length;

  return {
    queryType:  'stock_exposure',
    stock:      stockTerm,
    totalFound: seen.size,
    summary: {
      etfCount:  results.length,
      avgWeight: Math.round(avgWeight * 100) / 100,
      maxWeight: results[0]?.weight ?? 0,
    },
    results,
    interpretation: `Found ${seen.size} ETFs holding ${stockTerm}. Sorted by portfolio weight — highest concentration first.`,
  };
}

// ─── Mode 2: Theme ──────────────────────────────────────────────────────────
async function handleTheme(themeKey: string, originalQuery: string, limit: number) {
  const theme = THEMES[themeKey];
  if (!theme) return handleGeneral(originalQuery, limit);

  // Search ETFs by name/strategy matching theme keywords
  const etfsByName = await prisma.etf.findMany({
    where: {
      OR: theme.etfKeywords.flatMap(kw => [
        { name:         { contains: kw, mode: 'insensitive' as const } },
        { strategyType: { contains: kw, mode: 'insensitive' as const } },
        { summary:      { contains: kw, mode: 'insensitive' as const } },
      ]),
    },
    select: {
      id: true, ticker: true, name: true, assetClass: true,
      strategyType: true, aum: true, netExpenseRatio: true, summary: true,
      _count: { select: { holdings: true } },
    },
    take: 200,
  });

  // Find ETFs holding key companies from this theme
  let etfsByHoldings: typeof etfsByName = [];
  if (theme.holdingKeywords.length > 0) {
    const holdingMatches = await prisma.etfHolding.findMany({
      where: {
        OR: theme.holdingKeywords.map(kw => ({
          holdingName: { contains: kw, mode: 'insensitive' as const }
        })),
      },
      select: { etfId: true },
      distinct: ['etfId'],
    });
    const ids = holdingMatches.map(h => h.etfId);
    if (ids.length > 0) {
      etfsByHoldings = await prisma.etf.findMany({
        where: { id: { in: ids.slice(0, 100) } },
        select: {
          id: true, ticker: true, name: true, assetClass: true,
          strategyType: true, aum: true, netExpenseRatio: true, summary: true,
          _count: { select: { holdings: true } },
        },
      });
    }
  }

  // Merge + dedupe
  const allEtfs = new Map<string, any>();
  for (const etf of [...etfsByName, ...etfsByHoldings]) {
    if (!allEtfs.has(etf.ticker)) allEtfs.set(etf.ticker, etf);
  }

  // Score by theme relevance
  const scored = Array.from(allEtfs.values()).map(etf => {
    let score = 0;
    const name  = (etf.name || '').toLowerCase();
    const strat = (etf.strategyType || '').toLowerCase();
    const summ  = (etf.summary || '').toLowerCase();

    for (const kw of theme.etfKeywords) {
      const k = kw.toLowerCase();
      if (name.includes(k))  score += 3;
      if (strat.includes(k)) score += 2;
      if (summ.includes(k))  score += 1;
    }
    if (etf.aum && etf.aum > 1_000_000_000)  score += 1;
    if (etf.aum && etf.aum > 10_000_000_000) score += 1;

    return {
      ticker:          etf.ticker,
      name:            etf.name,
      assetClass:      etf.assetClass,
      strategyType:    etf.strategyType,
      aum:             etf.aum,
      netExpenseRatio: etf.netExpenseRatio,
      holdingsCount:   etf._count.holdings,
      weight:          null,
      relevanceScore:  Math.round(Math.min(score / 10, 1) * 10) / 10,
      matchReason:     `Matches "${theme.label}" theme`,
    };
  });

  const results = scored
    .filter(r => r.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore || (b.aum ?? 0) - (a.aum ?? 0))
    .slice(0, limit);

  return {
    queryType:    'theme',
    theme:        theme.label,
    themeKey,
    totalFound:   results.length,
    results,
    interpretation: results.length > 0
      ? `Found ${results.length} ETFs matching the "${theme.label}" theme. Sorted by relevance.`
      : `No ETFs found for "${theme.label}". The full data sync will improve theme results.`,
  };
}

// ─── Mode 3: General ────────────────────────────────────────────────────────
async function handleGeneral(query: string, limit: number) {
  const lower  = query.toLowerCase();
  const intent = parseIntent(lower);
  const where  = buildWhereClause(intent, lower);

  const etfs = await prisma.etf.findMany({
    where,
    take: limit * 2,
    orderBy: { aum: 'desc' },
    select: {
      ticker: true, name: true, assetClass: true,
      strategyType: true, aum: true, netExpenseRatio: true, priceToBook: true,
      _count: { select: { holdings: true } },
    },
  });

  const results = etfs.map(etf => ({
    ticker:          etf.ticker,
    name:            etf.name,
    assetClass:      etf.assetClass,
    strategyType:    etf.strategyType,
    aum:             etf.aum,
    netExpenseRatio: etf.netExpenseRatio,
    holdingsCount:   etf._count.holdings,
    weight:          null,
    relevanceScore:  Math.round(calculateScore(etf, intent, lower) * 10) / 10,
    matchReason:     buildExplanation(etf, intent),
  }))
    .filter(r => r.relevanceScore >= 0.3)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);

  return {
    queryType:      'general',
    totalFound:     results.length,
    results,
    searchCriteria: intent,
    interpretation: results.length === 0
      ? `No ETFs found for "${query}". Try different keywords.`
      : `Found ${results.length} ETFs for "${query}".`,
  };
}

// ─── General helpers ────────────────────────────────────────────────────────
function parseIntent(q: string) {
  const i: any = { geography: null, assetClass: null, sector: null, strategy: null, size: null, cost: null };
  if      (q.match(/\b(international|foreign|global|world|ex-us|overseas)\b/)) i.geography = 'international';
  else if (q.match(/\b(us|usa|america|domestic|s&p|nasdaq)\b/))                i.geography = 'us';
  else if (q.match(/\b(emerging|emerging markets?)\b/))                        i.geography = 'emerging';
  else if (q.match(/\b(europe|european|asia|china|japan|india)\b/))            i.geography = 'regional';

  if      (q.match(/\b(equity|stock|shares)\b/) && !q.match(/\b(bond|fixed)\b/)) i.assetClass = 'Equity';
  else if (q.match(/\b(bond|fixed income|treasury)\b/))  i.assetClass = 'Fixed Income';
  else if (q.match(/\b(commodity|gold|silver|oil)\b/))   i.assetClass = 'Commodity';
  else if (q.match(/\b(reit|real estate)\b/))             i.assetClass = 'Real Estate';

  if      (q.match(/\b(tech|technology|software)\b/)) i.sector = 'Technology';
  else if (q.match(/\b(health|healthcare|biotech)\b/)) i.sector = 'Healthcare';
  else if (q.match(/\b(financ|bank|insurance)\b/))     i.sector = 'Financial';
  else if (q.match(/\b(energy|oil|gas)\b/))            i.sector = 'Energy';

  if      (q.match(/\b(value)\b/))                i.strategy = 'Value';
  else if (q.match(/\b(growth)\b/))               i.strategy = 'Growth';
  else if (q.match(/\b(dividend|income)\b/))      i.strategy = 'Dividend';

  if      (q.match(/\b(large cap|large-cap|mega cap)\b/)) i.size = 'large';
  else if (q.match(/\b(small cap|small-cap)\b/))          i.size = 'small';

  if (q.match(/\b(low cost|cheap|low fee|low expense)\b/)) i.cost = 'low';
  return i;
}

function buildWhereClause(intent: any, query: string): any {
  const where: any = {};
  const or: any[]  = [];

  if (intent.geography === 'international') {
    or.push(
      { name: { contains: 'International' } }, { name: { contains: 'Global' } },
      { name: { contains: 'World'         } }, { name: { contains: 'Ex-US'  } },
      { strategyType: { contains: 'Foreign'       } },
      { strategyType: { contains: 'International' } },
    );
  } else if (intent.geography === 'us') {
    or.push(
      { name: { contains: 'S&P 500'      } }, { name: { contains: 'Total Market' } },
      { name: { contains: 'Russell'      } }, { name: { contains: 'Nasdaq'       } },
      { ticker: { in: ['SPY','VOO','IVV','VTI','QQQ'] } },
    );
  } else if (intent.geography === 'emerging') {
    or.push({ name: { contains: 'Emerging' } }, { strategyType: { contains: 'Emerging' } });
  }

  if (intent.assetClass) where.assetClass = intent.assetClass;
  if (intent.cost === 'low') where.netExpenseRatio = { lte: 0.2 };
  if (intent.sector) {
    or.push(
      { name:         { contains: intent.sector } },
      { strategyType: { contains: intent.sector } },
    );
  }
  if (or.length > 0) where.OR = or;
  if (Object.keys(where).length === 0) {
    where.OR = [
      { ticker:       { contains: query, mode: 'insensitive' } },
      { name:         { contains: query, mode: 'insensitive' } },
      { strategyType: { contains: query, mode: 'insensitive' } },
    ];
  }
  return where;
}

function calculateScore(etf: any, intent: any, query: string): number {
  let s = 0;
  const name = (etf.name || '').toLowerCase();
  const tick = (etf.ticker || '').toLowerCase();
  const strat = (etf.strategyType || '').toLowerCase();

  if (intent.geography === 'international') {
    if (name.includes('international') || name.includes('global') || strat.includes('foreign')) s += 0.5;
    if (name.includes('s&p 500') || tick === 'spy' || tick === 'voo') s -= 0.8;
  } else if (intent.geography === 'us') {
    if (name.includes('s&p 500') || tick === 'spy' || tick === 'voo') s += 0.5;
    if (name.includes('international')) s -= 0.5;
  }
  if (intent.assetClass && etf.assetClass === intent.assetClass) s += 0.2;
  if (intent.sector && (name.includes(intent.sector.toLowerCase()) || strat.includes(intent.sector.toLowerCase()))) s += 0.2;
  if (intent.strategy && name.includes(intent.strategy.toLowerCase())) s += 0.15;
  if (intent.cost === 'low' && etf.netExpenseRatio && etf.netExpenseRatio < 0.1) s += 0.1;
  if (etf.aum && etf.aum > 10_000_000_000) s += 0.05;
  return Math.max(0, Math.min(1, s));
}

function buildExplanation(etf: any, intent: any): string {
  const p: string[] = [];
  const name = (etf.name || '').toLowerCase();
  if (intent.geography === 'international' && (name.includes('international') || name.includes('global'))) p.push('international focus');
  if (intent.geography === 'us' && (name.includes('s&p 500') || name.includes('total'))) p.push('US market exposure');
  if (etf.assetClass) p.push(etf.assetClass);
  if (etf.netExpenseRatio && etf.netExpenseRatio < 0.1) p.push(`low cost (${etf.netExpenseRatio.toFixed(2)}%)`);
  if (etf.aum && etf.aum > 50_000_000_000) p.push('highly liquid');
  return p.length > 0 ? p.join(' · ') : 'Matches search criteria';
}
