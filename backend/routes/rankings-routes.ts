// ETF Rankings API Route
// apps/api/src/routes/rankings.ts

import { FastifyInstance } from 'fastify';
import { rankingsService } from '../services/rankings';

export async function rankingsRoutes(app: FastifyInstance) {
  
  // GET /api/rankings/top10 - Get all top 10 rankings for dashboard
  app.get('/rankings/top10', async (request, reply) => {
    const { investment } = request.query as { investment?: string };
    
    const investmentAmount = investment ? parseFloat(investment) : 10000;

    if (investmentAmount <= 0 || investmentAmount > 10000000) {
      return reply.status(400).send({
        error: 'Invalid investment amount',
        message: 'Investment must be between $1 and $10,000,000'
      });
    }

    try {
      const rankings = await rankingsService.getTop10Rankings(investmentAmount);
      
      // Set cache headers (cache for 5 minutes)
      reply.header('Cache-Control', 'public, max-age=300');
      
      return reply.send(rankings);
    } catch (error: any) {
      app.log.error('Rankings error:', error);
      return reply.status(500).send({ 
        error: 'Failed to fetch rankings', 
        message: error.message 
      });
    }
  });
}
