import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db';

export async function etfRoutes(fastify: FastifyInstance) {
  
  // GET /api/etfs - List/search ETFs (THIS IS THE MISSING ROUTE!)
  fastify.get('/etfs', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const { 
        search, 
        assetClass, 
        strategyType,
        page = 1, 
        pageSize = 20,
        minAum,
        maxAum,
      } = query;

      const where: any = {};

      // Search by ticker or name — case-insensitive
      if (search) {
        where.OR = [
          { ticker: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { strategyType: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Filter by asset class
      if (assetClass && assetClass !== 'All Asset Classes') {
        where.assetClass = assetClass;
      }

      // Filter by strategy type
      if (strategyType) {
        where.strategyType = { contains: strategyType };
      }

      // Filter by AUM range
      if (minAum || maxAum) {
        where.aum = {};
        if (minAum) where.aum.gte = parseFloat(minAum);
        if (maxAum && maxAum !== 'Infinity') where.aum.lte = parseFloat(maxAum);
      }

      const [etfs, total] = await Promise.all([
        prisma.etf.findMany({
          where,
          skip: (Number(page) - 1) * Number(pageSize),
          take: Number(pageSize),
          orderBy: { aum: 'desc' },
          select: {
            ticker: true,
            name: true,
            assetClass: true,
            strategyType: true,
            aum: true,
            netExpenseRatio: true,
            inceptionDate: true,
          },
        }),
        prisma.etf.count({ where }),
      ]);

      return {
        data: etfs,
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      };
    } catch (error: any) {
      console.error('ETF list error:', error);
      reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/etf/:ticker - Get single ETF details (SINGULAR)
  fastify.get('/etf/:ticker', async (request: FastifyRequest, reply: FastifyReply) => {
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
      console.error('ETF detail error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/etfs/:ticker - Get ETF details (PLURAL - backwards compatibility)
  fastify.get('/etfs/:ticker', async (request: FastifyRequest, reply: FastifyReply) => {
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
  fastify.get('/etfs/:ticker/holdings', async (request: FastifyRequest, reply: FastifyReply) => {
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
  fastify.get('/etfs/:ticker/sectors', async (request: FastifyRequest, reply: FastifyReply) => {
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

  // GET /api/etfs/:ticker/themes-exposure - Get theme exposures
  // Uses direct holding keyword matching (HoldingClassification table not required)
  fastify.get('/etfs/:ticker/themes-exposure', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { ticker } = request.params as { ticker: string };

      const etf = await prisma.etf.findUnique({
        where: { ticker: ticker.toUpperCase() }
      });

      if (!etf) {
        return reply.status(404).send({ error: 'ETF not found' });
      }

      // Get latest holdings only (filter by most recent asOfDate)
      const latestDate = await prisma.etfHolding.findFirst({
        where: { etfId: etf.id },
        orderBy: { asOfDate: 'desc' },
        select: { asOfDate: true },
      });

      if (!latestDate) {
        return { ticker, exposures: [], count: 0 };
      }

      const holdings = await prisma.etfHolding.findMany({
        where: { etfId: etf.id, asOfDate: latestDate.asOfDate },
        orderBy: { weight: 'desc' },
      });

      if (holdings.length === 0) {
        return { ticker, exposures: [], count: 0 };
      }

      // Theme definitions: each has a list of company name keywords
      // Match against holdingName (case-insensitive)
      const THEME_DEFINITIONS = [
        {
          id: 'ai', name: 'Artificial Intelligence',
          keywords: ['nvidia', 'microsoft', 'alphabet', 'google', 'meta', 'amazon', 'palantir',
            'c3.ai', 'uipath', 'salesforce', 'servicenow', 'datadog', 'snowflake'],
        },
        {
          id: 'semiconductors', name: 'Semiconductors',
          keywords: ['nvidia', 'amd', 'intel', 'tsmc', 'taiwan semiconductor', 'qualcomm',
            'broadcom', 'asml', 'micron', 'applied materials', 'lam research', 'kla',
            'marvell', 'analog devices', 'texas instruments', 'on semiconductor'],
        },
        {
          id: 'cloud', name: 'Cloud Computing',
          keywords: ['amazon', 'microsoft', 'alphabet', 'google', 'salesforce', 'snowflake',
            'datadog', 'twilio', 'servicenow', 'workday', 'veeva', 'cloudflare', 'fastly'],
        },
        {
          id: 'cybersecurity', name: 'Cybersecurity',
          keywords: ['crowdstrike', 'palo alto', 'fortinet', 'zscaler', 'sentinelone',
            'okta', 'cloudflare', 'rapid7', 'qualys', 'tenable', 'cyberark'],
        },
        {
          id: 'ev', name: 'Electric Vehicles',
          keywords: ['tesla', 'rivian', 'lucid', 'nio', 'byd', 'albemarle', 'chargepoint',
            'li-cycle', 'lithium', 'livent', 'plug power', 'ballard'],
        },
        {
          id: 'fintech', name: 'Financial Technology',
          keywords: ['visa', 'mastercard', 'paypal', 'square', 'block', 'adyen', 'stripe',
            'coinbase', 'robinhood', 'affirm', 'sofi', 'marqeta', 'fiserv', 'flywire'],
        },
        {
          id: 'biotech', name: 'Biotechnology',
          keywords: ['moderna', 'biontech', 'regeneron', 'vertex', 'gilead', 'biogen',
            'amgen', 'illumina', 'crispr', 'beam therapeutics', 'pacific biosciences'],
        },
        {
          id: 'healthcare', name: 'Healthcare Innovation',
          keywords: ['intuitive surgical', 'dexcom', 'teladoc', 'veeva', 'masimo',
            'hologic', 'align technology', 'insulet', 'penumbra', 'invacare'],
        },
        {
          id: 'renewable', name: 'Renewable Energy',
          keywords: ['nextera', 'enphase', 'solaredge', 'first solar', 'vestas', 'orsted',
            'sunrun', 'sunnova', 'brookfield renewable', 'terraform', 'plug power'],
        },
        {
          id: 'ecommerce', name: 'E-Commerce',
          keywords: ['amazon', 'shopify', 'etsy', 'wayfair', 'chewy', 'poshmark',
            'mercadolibre', 'sea limited', 'pinduoduo', 'jd.com', 'alibaba'],
        },
      ];

      const themeMap = new Map<string, {
        themeId: string; themeName: string;
        exposure: number; holdings: any[];
      }>();

      for (const theme of THEME_DEFINITIONS) {
        themeMap.set(theme.id, {
          themeId:   theme.id,
          themeName: theme.name,
          exposure:  0,
          holdings:  [],
        });
      }

      // Match each holding against themes
      for (const holding of holdings) {
        const nameLower = (holding.holdingName || holding.holdingTicker || '').toLowerCase();
        const tickLower = (holding.holdingTicker || '').toLowerCase();

        for (const theme of THEME_DEFINITIONS) {
          const matched = theme.keywords.some(kw =>
            nameLower.includes(kw) || tickLower.includes(kw)
          );
          if (matched) {
            const td = themeMap.get(theme.id)!;
            td.exposure += holding.weight;
            td.holdings.push({
              ticker: holding.holdingTicker,
              name:   holding.holdingName,
              weight: holding.weight,
            });
          }
        }
      }

      const exposures = Array.from(themeMap.values())
        .filter(t => t.exposure > 0)
        .sort((a, b) => b.exposure - a.exposure)
        .map(t => ({
          ...t,
          exposure: Math.round(t.exposure * 100) / 100,
          holdings: t.holdings
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 10),
        }));

      return { ticker, exposures, count: exposures.length };

    } catch (error: any) {
      console.error('Themes error:', error);
      reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/etfs/:ticker/prices - Get price history
  fastify.get('/etfs/:ticker/prices', async (request: FastifyRequest, reply: FastifyReply) => {
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

  // GET /api/etfs/:ticker/metrics - Get metrics snapshot
  fastify.get('/etfs/:ticker/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
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

  // GET /api/impact/etf/:ticker - News impact
  fastify.get('/impact/etf/:ticker', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { ticker } = request.params as { ticker: string };
      
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