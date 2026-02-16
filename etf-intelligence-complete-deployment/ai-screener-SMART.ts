import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db';

export async function aiScreenerRoutes(fastify: FastifyInstance) {
  
  // POST /api/ai-screener - Search ETFs using natural language
  fastify.post('/ai-screener', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { query, limit = 15 } = request.body as { query: string; limit?: number };

      if (!query || query.trim().length === 0) {
        return reply.status(400).send({
          error: 'Query is required',
          message: 'Please provide a search query'
        });
      }

      const lowerQuery = query.toLowerCase();
      
      // Parse query semantically
      const intent = parseIntent(lowerQuery);
      
      fastify.log.info('AI Screener Intent:', intent);
      
      // Build smart where clause
      const where: any = buildWhereClause(intent, lowerQuery);
      
      // Get ETFs
      const etfs = await prisma.etf.findMany({
        where,
        take: Number(limit) * 2, // Get more for better filtering
        orderBy: { aum: 'desc' },
        select: {
          ticker: true,
          name: true,
          assetClass: true,
          strategyType: true,
          aum: true,
          netExpenseRatio: true,
          priceToBook: true,
          _count: {
            select: { holdings: true }
          }
        }
      });

      // Score and filter results
      const scoredResults = etfs
        .map(etf => {
          const score = calculateSmartScore(etf, intent, lowerQuery);
          const explanation = generateSmartExplanation(etf, intent);
          
          return {
            ticker: etf.ticker,
            name: etf.name,
            assetClass: etf.assetClass,
            strategyType: etf.strategyType,
            aum: etf.aum,
            netExpenseRatio: etf.netExpenseRatio,
            priceToBook: etf.priceToBook,
            holdingsCount: etf._count.holdings,
            relevanceScore: score,
            explanation: explanation
          };
        })
        .filter(r => r.relevanceScore >= 0.3) // Filter out low relevance
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, Number(limit));

      return {
        results: scoredResults,
        interpretation: generateSmartInterpretation(query, scoredResults.length, intent),
        searchCriteria: intent
      };

    } catch (error: any) {
      fastify.log.error('AI Screener error:', error);
      return reply.status(500).send({
        error: 'Failed to process screening query',
        message: error.message
      });
    }
  });
}

// Smart intent parser
function parseIntent(query: string): any {
  const intent: any = {
    geography: null,
    assetClass: null,
    sector: null,
    strategy: null,
    size: null,
    cost: null,
    keywords: []
  };

  // Geography detection
  if (query.match(/\b(international|foreign|global|world|ex-us|ex us|non-us|non us|overseas)\b/)) {
    intent.geography = 'international';
  } else if (query.match(/\b(us|usa|america|domestic|s&p|s&p 500|dow|nasdaq)\b/)) {
    intent.geography = 'us';
  } else if (query.match(/\b(emerging|emerging markets?|em)\b/)) {
    intent.geography = 'emerging';
  } else if (query.match(/\b(developed|developed markets?|eafe)\b/)) {
    intent.geography = 'developed';
  } else if (query.match(/\b(europe|european|asia|asian|china|japan|india)\b/)) {
    intent.geography = 'regional';
  }

  // Asset class
  if (query.match(/\b(equity|equities|stock|stocks|shares)\b/) && !query.match(/\b(bond|fixed)\b/)) {
    intent.assetClass = 'Equity';
  } else if (query.match(/\b(bond|bonds|fixed income|debt|treasury|corporate bond)\b/)) {
    intent.assetClass = 'Fixed Income';
  } else if (query.match(/\b(commodity|commodities|gold|silver|oil)\b/)) {
    intent.assetClass = 'Commodity';
  } else if (query.match(/\b(reit|real estate)\b/)) {
    intent.assetClass = 'Real Estate';
  }

  // Sector
  if (query.match(/\b(tech|technology|software|semiconductor)\b/)) {
    intent.sector = 'Technology';
  } else if (query.match(/\b(health|healthcare|biotech|pharma|medical)\b/)) {
    intent.sector = 'Healthcare';
  } else if (query.match(/\b(financ|bank|insurance)\b/)) {
    intent.sector = 'Financial';
  } else if (query.match(/\b(energy|oil|gas)\b/)) {
    intent.sector = 'Energy';
  } else if (query.match(/\b(consumer|retail|discretionary|staples)\b/)) {
    intent.sector = 'Consumer';
  }

  // Strategy
  if (query.match(/\b(value)\b/)) {
    intent.strategy = 'Value';
  } else if (query.match(/\b(growth)\b/)) {
    intent.strategy = 'Growth';
  } else if (query.match(/\b(dividend|income)\b/)) {
    intent.strategy = 'Dividend';
  } else if (query.match(/\b(index|passive)\b/)) {
    intent.strategy = 'Index';
  }

  // Size
  if (query.match(/\b(large cap|large-cap|mega cap)\b/)) {
    intent.size = 'large';
  } else if (query.match(/\b(mid cap|mid-cap|medium)\b/)) {
    intent.size = 'mid';
  } else if (query.match(/\b(small cap|small-cap)\b/)) {
    intent.size = 'small';
  }

  // Cost
  if (query.match(/\b(low cost|cheap|lowest|low fee|low expense)\b/)) {
    intent.cost = 'low';
  }

  return intent;
}

// Build smart WHERE clause
function buildWhereClause(intent: any, query: string): any {
  const where: any = {};
  const orConditions: any[] = [];

  // Geography filter - MOST IMPORTANT
  if (intent.geography === 'international') {
    // International = NOT US domestic
    orConditions.push(
      { name: { contains: 'International' } },
      { name: { contains: 'Global' } },
      { name: { contains: 'World' } },
      { name: { contains: 'Ex-US' } },
      { name: { contains: 'EAFE' } },
      { name: { contains: 'Foreign' } },
      { strategyType: { contains: 'Foreign' } },
      { strategyType: { contains: 'International' } }
    );
  } else if (intent.geography === 'us') {
    // US domestic = S&P 500, Total Market, etc
    orConditions.push(
      { name: { contains: 'S&P 500' } },
      { name: { contains: 'S&P500' } },
      { name: { contains: 'Total Stock' } },
      { name: { contains: 'Total Market' } },
      { name: { contains: 'Russell' } },
      { name: { contains: 'Dow' } },
      { name: { contains: 'Nasdaq' } },
      { ticker: { in: ['SPY', 'VOO', 'IVV', 'VTI', 'QQQ'] } }
    );
  } else if (intent.geography === 'emerging') {
    orConditions.push(
      { name: { contains: 'Emerging' } },
      { strategyType: { contains: 'Emerging' } }
    );
  } else if (intent.geography === 'developed') {
    orConditions.push(
      { name: { contains: 'Developed' } },
      { name: { contains: 'EAFE' } }
    );
  }

  // Asset class
  if (intent.assetClass) {
    where.assetClass = intent.assetClass;
  }

  // Sector
  if (intent.sector) {
    if (!where.OR) where.OR = [];
    where.OR.push(
      { name: { contains: intent.sector } },
      { strategyType: { contains: intent.sector } }
    );
  }

  // Strategy
  if (intent.strategy) {
    if (!orConditions.length) orConditions.push({});
    orConditions.forEach(cond => {
      if (!cond.name) {
        cond.name = { contains: intent.strategy };
      }
    });
  }

  // Cost filter
  if (intent.cost === 'low') {
    where.netExpenseRatio = { lte: 0.2 };
  }

  // Combine OR conditions
  if (orConditions.length > 0) {
    where.OR = orConditions;
  }

  // If no specific filters, do broad search
  if (Object.keys(where).length === 0) {
    where.OR = [
      { ticker: { contains: query } },
      { name: { contains: query } },
      { strategyType: { contains: query } }
    ];
  }

  return where;
}

// Smart scoring based on intent
function calculateSmartScore(etf: any, intent: any, query: string): number {
  let score = 0.0;
  
  const name = (etf.name || '').toLowerCase();
  const strategy = (etf.strategyType || '').toLowerCase();
  const ticker = (etf.ticker || '').toLowerCase();

  // Geography scoring
  if (intent.geography === 'international') {
    if (name.includes('international') || name.includes('foreign') || 
        name.includes('global') || name.includes('world') || 
        name.includes('ex-us') || name.includes('eafe') ||
        strategy.includes('foreign') || strategy.includes('international')) {
      score += 0.5; // HIGH relevance
    }
    // PENALIZE US-only funds
    if (name.includes('s&p 500') || name.includes('total stock') ||
        ticker === 'spy' || ticker === 'voo' || ticker === 'ivv') {
      score -= 0.8; // VERY LOW relevance
    }
  } else if (intent.geography === 'us') {
    if (name.includes('s&p 500') || name.includes('total stock') ||
        name.includes('total market') || ticker === 'spy' || ticker === 'voo') {
      score += 0.5;
    }
    // Penalize international
    if (name.includes('international') || name.includes('foreign')) {
      score -= 0.5;
    }
  }

  // Asset class match
  if (intent.assetClass && etf.assetClass === intent.assetClass) {
    score += 0.2;
  }

  // Sector match
  if (intent.sector) {
    if (name.includes(intent.sector.toLowerCase()) || 
        strategy.includes(intent.sector.toLowerCase())) {
      score += 0.2;
    }
  }

  // Strategy match
  if (intent.strategy) {
    if (name.includes(intent.strategy.toLowerCase()) ||
        strategy.includes(intent.strategy.toLowerCase())) {
      score += 0.15;
    }
  }

  // Low cost bonus
  if (intent.cost === 'low' && etf.netExpenseRatio && etf.netExpenseRatio < 0.1) {
    score += 0.1;
  }

  // Large AUM bonus (more liquid/popular)
  if (etf.aum && etf.aum > 10_000_000_000) {
    score += 0.05;
  }

  return Math.max(0, Math.min(1, score)); // Clamp between 0 and 1
}

// Generate smart explanation
function generateSmartExplanation(etf: any, intent: any): string {
  const reasons = [];
  
  const name = (etf.name || '').toLowerCase();
  
  if (intent.geography === 'international') {
    if (name.includes('international') || name.includes('foreign')) {
      reasons.push('international markets focus');
    }
  } else if (intent.geography === 'us') {
    if (name.includes('s&p 500') || name.includes('total')) {
      reasons.push('US market exposure');
    }
  }

  if (etf.assetClass) {
    reasons.push(`${etf.assetClass} asset class`);
  }

  if (etf.netExpenseRatio && etf.netExpenseRatio < 0.1) {
    reasons.push(`low cost (${etf.netExpenseRatio.toFixed(2)}%)`);
  }

  if (etf.aum && etf.aum > 50_000_000_000) {
    reasons.push('highly liquid');
  }

  return reasons.length > 0 ? reasons.join(', ') : 'Matches search criteria';
}

// Generate interpretation
function generateSmartInterpretation(query: string, resultCount: number, intent: any): string {
  if (resultCount === 0) {
    return `No ETFs found matching "${query}". Try broadening your search or use different keywords.`;
  }
  
  let interp = `Found ${resultCount} ETF${resultCount > 1 ? 's' : ''} for "${query}". `;
  
  if (intent.geography === 'international') {
    interp += 'Showing international/foreign equity funds (excluding US-only funds). ';
  } else if (intent.geography === 'us') {
    interp += 'Showing US domestic equity funds. ';
  }
  
  if (intent.cost === 'low') {
    interp += 'Filtered for low-cost options. ';
  }
  
  return interp;
}
