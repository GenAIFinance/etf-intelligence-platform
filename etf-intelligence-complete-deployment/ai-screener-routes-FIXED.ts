import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db';

export async function aiScreenerRoutes(fastify: FastifyInstance) {
  
  // GET /api/ai-screener/examples - Get example queries
  fastify.get('/ai-screener/examples', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      examples: [
        "Large cap tech ETFs with low P/B ratio",
        "Low cost S&P 500 index funds",
        "High dividend yield equity ETFs",
        "International emerging markets funds",
        "Sector ETFs focused on healthcare",
        "Bond ETFs with short duration",
        "ESG-focused technology funds",
        "Small cap value ETFs under 0.1% expense ratio"
      ]
    };
  });

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

      // Extract keywords for basic search
      const keywords = extractKeywords(query);
      
      // Build search criteria
      const where: any = {
        OR: []
      };

      // Search in ticker, name, asset class, strategy (WITHOUT mode: 'insensitive')
      if (keywords.length > 0) {
        keywords.forEach(keyword => {
          where.OR.push(
            { ticker: { contains: keyword } },
            { name: { contains: keyword } },
            { assetClass: { contains: keyword } },
            { strategyType: { contains: keyword } }
          );
        });
      } else {
        // If no keywords, search broadly
        where.OR.push(
          { ticker: { contains: query } },
          { name: { contains: query } }
        );
      }

      // Detect specific criteria from query
      const criteria = parseQuery(query);
      
      // Apply expense ratio filter
      if (criteria.maxExpenseRatio !== null) {
        where.netExpenseRatio = { lte: criteria.maxExpenseRatio };
      }

      // Apply AUM filter
      if (criteria.minAUM !== null) {
        where.aum = { gte: criteria.minAUM };
      }

      // Get ETFs
      const etfs = await prisma.etf.findMany({
        where,
        take: Number(limit),
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

      // Transform results with relevance scores and explanations
      const results = etfs.map(etf => {
        const score = calculateRelevanceScore(etf, query, keywords, criteria);
        const explanation = generateExplanation(etf, query, criteria);
        
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
      });

      // Sort by relevance score
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);

      return {
        results,
        interpretation: generateInterpretation(query, results.length, criteria),
        searchCriteria: criteria
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

// Helper: Extract keywords from query
function extractKeywords(query: string): string[] {
  const stopWords = ['etf', 'etfs', 'fund', 'funds', 'with', 'and', 'or', 'the', 'a', 'an', 'in', 'on', 'for'];
  const words = query.toLowerCase().split(/\s+/);
  return words.filter(word => word.length > 2 && !stopWords.includes(word));
}

// Helper: Parse query for specific criteria
function parseQuery(query: string): any {
  const lowerQuery = query.toLowerCase();
  
  return {
    // Expense ratio
    maxExpenseRatio: lowerQuery.includes('low cost') || lowerQuery.includes('cheap') ? 0.2 : null,
    
    // AUM size
    minAUM: lowerQuery.includes('large cap') || lowerQuery.includes('big') ? 10_000_000_000 : null,
    
    // Asset class
    assetClass: lowerQuery.includes('bond') ? 'Fixed Income' :
                lowerQuery.includes('equity') || lowerQuery.includes('stock') ? 'Equity' :
                lowerQuery.includes('commodity') ? 'Commodity' :
                null,
    
    // Keywords for matching
    keywords: extractKeywords(query)
  };
}

// Helper: Calculate relevance score
function calculateRelevanceScore(etf: any, query: string, keywords: string[], criteria: any): number {
  let score = 0.5; // Base score
  
  const etfText = `${etf.ticker} ${etf.name} ${etf.assetClass || ''} ${etf.strategyType || ''}`.toLowerCase();
  
  // Keyword matches
  keywords.forEach(keyword => {
    if (etfText.includes(keyword)) {
      score += 0.1;
    }
  });
  
  // Exact ticker match
  if (query.toUpperCase() === etf.ticker) {
    score += 0.3;
  }
  
  // Low expense ratio boost
  if (etf.netExpenseRatio && etf.netExpenseRatio < 0.1) {
    score += 0.05;
  }
  
  // Large AUM boost
  if (etf.aum && etf.aum > 10_000_000_000) {
    score += 0.05;
  }
  
  return Math.min(score, 1.0); // Cap at 1.0
}

// Helper: Generate explanation
function generateExplanation(etf: any, query: string, criteria: any): string {
  const reasons = [];
  
  if (etf.netExpenseRatio && etf.netExpenseRatio < 0.1) {
    reasons.push(`low expense ratio (${etf.netExpenseRatio.toFixed(2)}%)`);
  }
  
  if (etf.aum && etf.aum > 50_000_000_000) {
    reasons.push('large fund size');
  }
  
  if (etf.assetClass) {
    reasons.push(`${etf.assetClass} asset class`);
  }
  
  if (etf._count.holdings > 500) {
    reasons.push('highly diversified');
  }
  
  return reasons.length > 0 
    ? `Matches: ${reasons.join(', ')}`
    : 'Relevant to your search';
}

// Helper: Generate interpretation
function generateInterpretation(query: string, resultCount: number, criteria: any): string {
  if (resultCount === 0) {
    return `No ETFs found matching "${query}". Try broadening your search criteria.`;
  }
  
  let interpretation = `Found ${resultCount} ETFs matching "${query}".`;
  
  if (criteria.maxExpenseRatio) {
    interpretation += ` Filtered for low-cost options (expense ratio ≤ ${criteria.maxExpenseRatio}%).`;
  }
  
  if (criteria.minAUM) {
    interpretation += ` Showing large-cap funds (AUM ≥ $${(criteria.minAUM / 1e9).toFixed(0)}B).`;
  }
  
  return interpretation;
}
