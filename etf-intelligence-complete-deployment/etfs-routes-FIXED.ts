import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db';  // FIXED: Changed from { prisma } to default import

export async function etfRoutes(fastify: FastifyInstance) {
  
  // GET /api/etf/:ticker - Get single ETF details (SINGULAR for frontend compatibility)
  fastify.get('/etf/:ticker', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { ticker } = request.params as { ticker: string };

      const etf = await prisma.etf.findUnique({
        where: { ticker: ticker.toUpperCase() },
        include: {
          _count: {
            select: { holdings: true }
          },
          sectorWeights: { 
            orderBy: { weight: 'desc' },
            take: 10 
          },
        },
      });

      if (!etf) {
        return reply.status(404).send({ 
          error: 'ETF not found',
          message: `The ticker "${ticker}" was not found in the database.`
        });
      }

      // Transform to include holdingsCount for frontend
      const response = {
        ...etf,
        holdingsCount: etf._count.holdings,
      };

      return reply.send(response);
    } catch (error: any) {
      fastify.log.error('ETF detail error:', error);
      return reply.status(500).send({ 
        error: 'Failed to fetch ETF details',
        message: error.message 
      });
    }
  });

  // GET /api/etfs - List/search ETFs
  fastify.get('/etfs', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const { search, assetClass, strategyType, page = 1, pageSize = 20 } = query;
      
      const minAum = query.minAum ? parseFloat(query.minAum) : undefined;
      const maxAum = query.maxAum ? parseFloat(query.maxAum) : undefined;

      const where: any = {};

      if (search) {
        where.OR = [
          { ticker: { contains: search.toUpperCase() } },
          { name: { contains: search } },
        ];
      }

      if (assetClass) {
        where.assetClass = assetClass;
      }

      if (strategyType) {
        where.strategyType = { contains: strategyType };
      }
      
      if (minAum !== undefined || maxAum !== undefined) {
        where.aum = {};
        if (minAum !== undefined) where.aum.gte = minAum;
        if (maxAum !== undefined && !isNaN(maxAum) && isFinite(maxAum)) {
          where.aum.lte = maxAum;
        }
      }

      const [etfs, total] = await Promise.all([
        prisma.etf.findMany({
          where,
          skip: (Number(page) - 1) * Number(pageSize),
          take: Number(pageSize),
          orderBy: { ticker: 'asc' },
          include: {
            sectorWeights: {
              orderBy: { weight: 'desc' },
              take: 5,
            },
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
      reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/etfs/:ticker - Get ETF details (PLURAL - kept for backwards compatibility)
  fastify.get('/etfs/:ticker', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { ticker } = request.params as { ticker: string };

      const etf = await prisma.etf.findUnique({
        where: { ticker: ticker.toUpperCase() },
        include: {
          _count: {
            select: { holdings: true }
          },
          sectorWeights: { orderBy: { weight: 'desc' } },
        },
      });

      if (!etf) {
        return reply.status(404).send({ error: 'ETF not found' });
      }

      const response = {
        ...etf,
        holdingsCount: etf._count.holdings,
      };

      return reply.send(response);
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/etfs/:ticker/holdings - Get ETF holdings
  fastify.get('/etfs/:ticker/holdings', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { ticker } = request.params as { ticker: string };

      const etf = await prisma.etf.findUnique({ where: { ticker: ticker.toUpperCase() } });
      if (!etf) {
        return reply.status(404).send({ error: 'ETF not found' });
      }

      const holdings = await prisma.etfHolding.findMany({
        where: { etfId: etf.id },
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

      const etf = await prisma.etf.findUnique({ where: { ticker: ticker.toUpperCase() } });
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
}
