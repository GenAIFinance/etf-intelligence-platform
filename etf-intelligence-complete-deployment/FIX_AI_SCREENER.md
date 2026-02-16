# Fix: AI Screener - Natural Language Search

## 🐛 Problem 1: Frontend Error

**Error**: `TypeError: Cannot read properties of undefined (reading 'toFixed')`
**Location**: Line 267 in `ai-screener/page.tsx`

**Issue**: Frontend expects `relevanceScore` but backend doesn't return it.

---

## 🐛 Problem 2: Backend Returns Wrong Format

The AI screener backend likely returns:
```json
{
  "etfs": [...],
  "interpretation": "...",
  "searchCriteria": {...}
}
```

But frontend expects:
```json
{
  "results": [
    {
      "ticker": "...",
      "name": "...",
      "relevanceScore": 0.95,
      "explanation": "..."
    }
  ]
}
```

---

## ✅ Fix 1: Update AI Screener Backend

### File: `apps/api/src/routes/ai-screener.ts`

**Replace the route with**:

```typescript
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

      // Search in ticker, name, asset class, strategy
      if (keywords.length > 0) {
        keywords.forEach(keyword => {
          where.OR.push(
            { ticker: { contains: keyword, mode: 'insensitive' } },
            { name: { contains: keyword, mode: 'insensitive' } },
            { assetClass: { contains: keyword, mode: 'insensitive' } },
            { strategyType: { contains: keyword, mode: 'insensitive' } }
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
  
  const etfText = `${etf.ticker} ${etf.name} ${etf.assetClass} ${etf.strategyType}`.toLowerCase();
  
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
```

---

## ✅ Fix 2: Update AI Screener Frontend

### Find and fix line 267 in your AI screener frontend

**Before (causing error)**:
```typescript
{result.relevanceScore.toFixed(1)}  // ❌ relevanceScore might be undefined
```

**After (safe)**:
```typescript
{result.relevanceScore ? (result.relevanceScore * 100).toFixed(0) + '%' : 'N/A'}
```

**Or better, check if the field exists**:
```typescript
{result.relevanceScore !== undefined ? 
  <span className="text-sm text-gray-600">
    {(result.relevanceScore * 100).toFixed(0)}% match
  </span> 
  : null
}
```

---

## 🧪 Test the AI Screener

After updating both files:

### Test 1: Keywords
```
POST http://localhost:3001/api/ai-screener
{
  "query": "technology",
  "limit": 10
}
```

### Test 2: Natural Language
```
POST http://localhost:3001/api/ai-screener
{
  "query": "low cost S&P 500 index funds",
  "limit": 10
}
```

### Test 3: Complex Query
```
POST http://localhost:3001/api/ai-screener
{
  "query": "large cap tech ETFs with low expense ratio",
  "limit": 15
}
```

**Expected**: Each should return results with `relevanceScore` and `explanation`

---

## 📋 Complete Steps

1. **Replace** `apps/api/src/routes/ai-screener.ts` with the code above
2. **Restart API**: `cd apps/api && npm run dev`
3. **Test backend**: 
   ```bash
   curl -X POST http://localhost:3001/api/ai-screener \
     -H "Content-Type: application/json" \
     -d '{"query":"technology","limit":5}'
   ```
4. **Fix frontend**: Find line 267 and add null check for `relevanceScore`
5. **Refresh browser**: Test AI screener at http://localhost:3000/ai-screener

---

## 💡 What the Backend Now Does

1. **Keyword Extraction**: Pulls meaningful words from natural language
2. **Smart Filtering**: Detects "low cost", "large cap", etc. and applies filters
3. **Relevance Scoring**: Ranks results by how well they match the query
4. **Explanations**: Tells user WHY each ETF was matched
5. **Natural Language**: Works with phrases like "cheap S&P 500 funds"

---

**Share your AI screener frontend code (the file with line 267) and I'll give you the exact fix for that file too!**
