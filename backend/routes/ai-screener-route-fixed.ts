// AI Screener API Route - FIXED VERSION
// apps/api/src/routes/ai-screener.ts

import { FastifyInstance } from 'fastify';
import { aiScreenerService } from '../services/ai-screener';

export async function aiScreenerRoutes(app: FastifyInstance) {
  // POST /api/ai-screener
  app.post('/ai-screener', async (request, reply) => {
    const { query, limit } = request.body as { query: string; limit?: number };

    if (!query || typeof query !== 'string') {
      return reply.status(400).send({ error: 'Query is required and must be a string' });
    }

    if (query.length > 500) {
      return reply.status(400).send({ error: 'Query is too long (max 500 characters)' });
    }

    try {
      const result = await aiScreenerService.screenETFs({
        query,
        limit: limit || 20,
      });

      // FIXED: Transform backend response to match frontend expectations
      // Frontend expects "results", backend returns "etfs"
      return reply.send({
        results: result.etfs,  // Changed from "etfs" to "results"
        interpretation: result.interpretation,
        searchCriteria: result.searchCriteria,
      });
    } catch (error: any) {
      app.log.error('AI screener error:', error);
      return reply.status(500).send({
        error: 'Failed to process screening query',
        message: error.message,
      });
    }
  });

  // GET /api/ai-screener/examples
  app.get('/ai-screener/examples', async (request, reply) => {
    return reply.send({
      examples: [
        {
          query: 'Large cap tech ETFs with low P/B ratio',
          description: 'Find technology-focused large-cap ETFs that are undervalued',
        },
        {
          query: 'Small cap growth stocks under $1B AUM',
          description: 'Small ETFs focused on high-growth small companies',
        },
        {
          query: 'AI and cloud computing ETFs',
          description: 'Thematic ETFs exposed to artificial intelligence and cloud',
        },
        {
          query: 'Dividend ETFs with healthcare exposure',
          description: 'Income-focused ETFs in the healthcare sector',
        },
        {
          query: 'ESG bond funds',
          description: 'Sustainable fixed income investments',
        },
        {
          query: 'High momentum large caps, no leverage',
          description: 'Trending large-cap stocks without leveraged exposure',
        },
        {
          query: 'International equity ETFs with low fees',
          description: 'Foreign stock exposure with cost efficiency',
        },
        {
          query: 'Value stocks in financial sector',
          description: 'Undervalued banks and financial companies',
        },
      ],
    });
  });
}
