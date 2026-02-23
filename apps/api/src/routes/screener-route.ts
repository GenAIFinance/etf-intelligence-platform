// ETF Screener Route
// apps/api/src/routes/screener.ts

import { FastifyInstance } from 'fastify';
import { screenerService, METRIC_TOOLTIPS } from '../services/screener';

export async function screenerRoutes(app: FastifyInstance) {

  // POST /api/screener/screen
  app.post('/screener/screen', async (request, reply) => {
    const body = request.body as any;

    const { objective, riskProfile, constraints, page, pageSize, sortBy } = body;

    // Validate required fields
    if (!['growth', 'income', 'preservation'].includes(objective)) {
      return reply.status(400).send({ error: 'Invalid objective. Must be growth, income, or preservation.' });
    }
    if (!['low', 'medium', 'high'].includes(riskProfile)) {
      return reply.status(400).send({ error: 'Invalid riskProfile. Must be low, medium, or high.' });
    }

    // Normalize constraints with safe defaults
    const safeNum = (v: any) => (v != null && v !== '' && !isNaN(parseFloat(v))) ? parseFloat(v) : null;
    const safeConstraints = {
      excludeSectors:  Array.isArray(constraints?.excludeSectors) ? constraints.excludeSectors : [],
      esgPreference:   ['no_preference', 'prefer', 'exclude'].includes(constraints?.esgPreference)
                         ? constraints.esgPreference : 'no_preference',
      maxExpenseRatio: safeNum(constraints?.maxExpenseRatio),
      minAUM:          safeNum(constraints?.minAUM),
      minSharpe:       safeNum(constraints?.minSharpe),
      minReturn3Y:     safeNum(constraints?.minReturn3Y),
      minReturn5Y:     safeNum(constraints?.minReturn5Y),
      maxVolatility:   safeNum(constraints?.maxVolatility),
    };

    try {
      const results = await screenerService.screen({
        objective,
        riskProfile,
        constraints: safeConstraints,
        page:     page ? parseInt(page) : 1,
        pageSize: pageSize ? parseInt(pageSize) : 25,
        sortBy:   sortBy ?? 'totalScore',
      });

      reply.header('Cache-Control', 'no-store'); // results depend on user inputs
      return reply.send(results);
    } catch (error: any) {
      console.error('Screener error:', error);
      return reply.status(500).send({ error: 'Screening failed', message: error.message });
    }
  });

  // GET /api/screener/tooltips — metric explanations for UI
  app.get('/screener/tooltips', async (_request, reply) => {
    return reply.send(METRIC_TOOLTIPS);
  });
}
