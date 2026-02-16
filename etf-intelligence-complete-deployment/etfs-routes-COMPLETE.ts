import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db';

export async function etfRoutes(fastify: FastifyInstance) {
  
  // GET /api/etf/:ticker - Get single ETF details
  fastify.get('/etf/:ticker', async (request, reply) => {
    try {
      const { ticker } = request.params as { ticker: string };

      const etf = await prisma.etf.findUnique({
        where: { ticker: ticker.toUpperCase() },
        include: {
          _count: { select: { holdings: true } },
          sectorWeights: { orderBy: { weight: 'desc' }, take: 10 },
        },
      });

      if (!etf) {
        return reply.status(404).send({ 
          error: 'ETF not found',
          message: `The ticker "${ticker}" was not found.`
        });
      }

      return reply.send({ ...etf, holdingsCount: etf._count.holdings });
    } catch (error: any) {
      fastify.log.error('ETF detail error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/etfs/:ticker - Get ETF details (backwards compatibility)
  fastify.get('/etfs/:ticker', async (request, reply) => {
    try {
      const { ticker } = request.params as { ticker: string };

      const etf = await prisma.etf.findUnique({
        where: { ticker: ticker.toUpperCase() },
        include: {
          _count: { select: { holdings: true } },
          sectorWeights: { orderBy: { weight: 'desc' } },
        },
      });

      if (!etf) {
        return reply.status(404).send({ error: 'ETF not found' });
      }

      return reply.send({ ...etf, holdingsCount: etf._count.holdings });
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/etfs/:ticker/holdings - Get ETF holdings (DEDUPED)
  fastify.get('/etfs/:ticker/holdings', async (request, reply) => {
    try {
      const { ticker } = request.params as { ticker: string };

      const etf = await prisma.etf.findUnique({ 
        where: { ticker: ticker.toUpperCase() } 
      });
      
      if (!etf) {
        return reply.status(404).send({ error: 'ETF not found' });
      }

      const latestDate = await prisma.etfHolding.findFirst({
        where: { etfId: etf.id },
        orderBy: { asOfDate: 'desc' },
        select: { asOfDate: true },
      });

      if (!latestDate) {
        return { holdings: [], count: 0 };
      }

      const holdings = await prisma.etfHolding.findMany({
        where: { 
          etfId: etf.id,
          asOfDate: latestDate.asOfDate,
        },
        orderBy: { weight: 'desc' },
      });

      return { holdings, count: holdings.length };
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/etfs/:ticker/sectors - Get ETF sector weights
  fastify.get('/etfs/:ticker/sectors', async (request, reply) => {
    try {
      const { ticker } = request.params as { ticker: string };

      const etf = await prisma.etf.findUnique({ 
        where: { ticker: ticker.toUpperCase() } 
      });
      
      if (!etf) {
        return reply.status(404).send({ error: 'ETF not found' });
      }

      const sectors = await prisma.etfSectorWeight.findMany({
        where: { etfId: etf.id },
        orderBy: { weight: 'desc' },
      });

      return { sectors };
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/etfs/:ticker/themes-exposure - Get theme exposures (FRONTEND EXPECTS THIS URL)
  fastify.get('/etfs/:ticker/themes-exposure', async (request, reply) => {
    try {
      const { ticker } = request.params as { ticker: string };

      const etf = await prisma.etf.findUnique({ 
        where: { ticker: ticker.toUpperCase() } 
      });
      
      if (!etf) {
        return reply.status(404).send({ error: 'ETF not found' });
      }

      const classifications = await prisma.holdingClassification.findMany({
        where: { etfId: etf.id },
      });

      const latestDate = await prisma.etfHolding.findFirst({
        where: { etfId: etf.id },
        orderBy: { asOfDate: 'desc' },
        select: { asOfDate: true },
      });

      const holdings = latestDate ? await prisma.etfHolding.findMany({
        where: { 
          etfId: etf.id,
          asOfDate: latestDate.asOfDate,
        },
      }) : [];

      const themeMap = new Map();
      const THEMES = [
        { id: 'ai', name: 'Artificial Intelligence' },
        { id: 'cloud', name: 'Cloud Computing' },
        { id: 'ev', name: 'Electric Vehicles' },
        { id: 'fintech', name: 'Financial Technology' },
        { id: 'healthcare', name: 'Healthcare Innovation' },
        { id: 'cybersecurity', name: 'Cybersecurity' },
        { id: 'ecommerce', name: 'E-Commerce' },
        { id: 'renewable', name: 'Renewable Energy' },
        { id: 'semiconductors', name: 'Semiconductors' },
        { id: 'biotech', name: 'Biotechnology' },
      ];

      for (const theme of THEMES) {
        themeMap.set(theme.id, { 
          themeId: theme.id,
          themeName: theme.name,
          exposure: 0, 
          holdings: [] 
        });
      }

      for (const classification of classifications) {
        const themes = JSON.parse(classification.themesJson || '[]');
        const holding = holdings.find(h => h.holdingTicker === classification.holdingTicker);
        const weight = holding?.weight || 0;

        for (const { themeId, confidence } of themes) {
          const themeData = themeMap.get(themeId);
          if (themeData) {
            themeData.exposure += weight * confidence;
            themeData.holdings.push({
              ticker: classification.holdingTicker,
              name: classification.holdingName,
              weight,
              confidence,
            });
          }
        }
      }

      const exposures = Array.from(themeMap.values())
        .filter(theme => theme.exposure > 0)
        .sort((a, b) => b.exposure - a.exposure)
        .map(theme => ({
          ...theme,
          holdings: theme.holdings.sort((a, b) => b.weight - a.weight).slice(0, 10),
        }));

      return { ticker, exposures, count: exposures.length };
    } catch (error: any) {
      fastify.log.error('Themes error:', error);
      reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/etfs/:ticker/prices - Get price history (STUB)
  fastify.get('/etfs/:ticker/prices', async (request, reply) => {
    try {
      const { ticker } = request.params as { ticker: string };
      const query = request.query as any;
      const { range = '1y', interval = '1d' } = query;

      const etf = await prisma.etf.findUnique({ 
        where: { ticker: ticker.toUpperCase() } 
      });
      
      if (!etf) {
        return reply.status(404).send({ error: 'ETF not found' });
      }

      // Calculate date range
      const today = new Date();
      const fromDate = new Date();

      switch (range) {
        case '1m': fromDate.setMonth(fromDate.getMonth() - 1); break;
        case '3m': fromDate.setMonth(fromDate.getMonth() - 3); break;
        case '6m': fromDate.setMonth(fromDate.getMonth() - 6); break;
        case '1y': fromDate.setFullYear(fromDate.getFullYear() - 1); break;
        case '3y': fromDate.setFullYear(fromDate.getFullYear() - 3); break;
        case '5y': fromDate.setFullYear(fromDate.getFullYear() - 5); break;
      }

      const prices = await prisma.priceBar.findMany({
        where: {
          symbol: ticker.toUpperCase(),
          date: { gte: fromDate, lte: today },
        },
        orderBy: { date: 'asc' },
      });

      return { prices, range, interval };
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/etfs/:ticker/metrics - Get metrics snapshot (STUB)
  fastify.get('/etfs/:ticker/metrics', async (request, reply) => {
    try {
      const { ticker } = request.params as { ticker: string };

      const etf = await prisma.etf.findUnique({ 
        where: { ticker: ticker.toUpperCase() } 
      });
      
      if (!etf) {
        return reply.status(404).send({ error: 'ETF not found' });
      }

      const metrics = await prisma.etfMetricSnapshot.findFirst({
        where: { etfId: etf.id },
        orderBy: { asOfDate: 'desc' },
      });

      if (!metrics) {
        // Return stub data if no metrics
        return {
          ticker,
          asOfDate: new Date().toISOString(),
          trailingReturns: {},
          riskMetrics: {},
          technicals: {},
        };
      }

      const trailingReturns = JSON.parse(metrics.trailingReturnsJson || '{}');

      return {
        ticker,
        asOfDate: metrics.asOfDate.toISOString(),
        trailingReturns,
        riskMetrics: {
          volatility: metrics.volatility,
          sharpe: metrics.sharpe,
          maxDrawdown: metrics.maxDrawdown,
          beta: metrics.beta,
        },
        technicals: {
          latestPrice: metrics.latestPrice,
          rsi14: metrics.rsi14,
          ma20: metrics.ma20,
          ma50: metrics.ma50,
          ma200: metrics.ma200,
          hi52w: metrics.hi52w,
          lo52w: metrics.lo52w,
        },
      };
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/impact/etf/:ticker - News impact (STUB - returns empty for now)
  fastify.get('/impact/etf/:ticker', async (request, reply) => {
    try {
      const { ticker } = request.params as { ticker: string };
      
      // Return empty news impact for now
      return {
        ticker,
        impacts: [],
        count: 0,
      };
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });
}
