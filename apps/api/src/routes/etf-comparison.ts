// ETF Comparison API Route
// apps/api/src/routes/etf-comparison.ts

import { FastifyInstance } from 'fastify';
import { etfComparisonService } from '../services/etf-comparison';

export async function etfComparisonRoutes(app: FastifyInstance) {
  
  // POST /api/etf/compare - Compare 2-4 ETFs
  app.post('/etf/compare', async (request, reply) => {
    const { tickers } = request.body as { tickers: string[] };

    // Validate input
    if (!tickers || !Array.isArray(tickers)) {
      return reply.status(400).send({ 
        error: 'Invalid request', 
        message: 'Tickers array is required' 
      });
    }

    if (tickers.length < 2 || tickers.length > 4) {
      return reply.status(400).send({ 
        error: 'Invalid ticker count', 
        message: 'Please provide 2-4 ETF tickers for comparison' 
      });
    }

    try {
      const result = await etfComparisonService.compareETFs(tickers);
      return reply.send(result);
    } catch (error: any) {
      console.error('ETF comparison error:', error);
      return reply.status(500).send({ 
        error: 'Comparison failed', 
        message: error.message 
      });
    }
  });

  // POST /api/etf/expense-impact - Calculate expense ratio impact
  app.post('/etf/expense-impact', async (request, reply) => {
    const { 
      initialInvestment, 
      expenseRatio1, 
      expenseRatio2, 
      years 
    } = request.body as {
      initialInvestment: number;
      expenseRatio1: number;
      expenseRatio2: number;
      years: number;
    };

    // Validate input
    if (!initialInvestment || !expenseRatio1 || !expenseRatio2 || !years) {
      return reply.status(400).send({ 
        error: 'Missing parameters',
        message: 'initialInvestment, expenseRatio1, expenseRatio2, and years are required' 
      });
    }

    try {
      const result = etfComparisonService.calculateExpenseImpact(
        initialInvestment,
        expenseRatio1 / 100, // Convert percentage to decimal
        expenseRatio2 / 100,
        years
      );
      
      return reply.send(result);
    } catch (error: any) {
      console.error('Expense impact calculation error:', error);
      return reply.status(500).send({ 
        error: 'Calculation failed', 
        message: error.message 
      });
    }
  });

  // GET /api/etf/compare/popular - Get popular comparison combinations
  app.get('/etf/compare/popular', async (request, reply) => {
    return reply.send({
      comparisons: [
        {
          name: 'S&P 500 Providers',
          description: 'Compare the three major S&P 500 ETFs',
          tickers: ['SPY', 'VOO', 'IVV'],
        },
        {
          name: 'Large Cap Growth',
          description: 'Large cap growth ETFs comparison',
          tickers: ['QQQ', 'VUG', 'IWF'],
        },
        {
          name: 'Total Market',
          description: 'Total US stock market ETFs',
          tickers: ['VTI', 'ITOT', 'SPTM'],
        },
        {
          name: 'International Equity',
          description: 'Developed markets international ETFs',
          tickers: ['VEA', 'IEFA', 'SCHF'],
        },
        {
          name: 'Bond Funds',
          description: 'Aggregate bond market ETFs',
          tickers: ['BND', 'AGG', 'SCHZ'],
        },
      ],
    });
  });
}
