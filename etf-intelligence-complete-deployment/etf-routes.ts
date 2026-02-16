// ETF Detail Routes
// apps/api/src/routes/etf-detail.ts

import { FastifyInstance } from 'fastify';
import prisma from '../db';

export async function etfRoutes(app: FastifyInstance) {
  
  // GET /api/etf/:ticker - Get single ETF details
  app.get('/etf/:ticker', async (request, reply) => {
    const { ticker } = request.params as { ticker: string };

    try {
      const etf = await prisma.etf.findUnique({
        where: { ticker: ticker.toUpperCase() },
        include: {
          _count: {
            select: { holdings: true }
          }
        }
      });

      if (!etf) {
        return reply.status(404).send({
          error: 'ETF not found',
          message: `The ticker "${ticker}" was not found in the database.`,
        });
      }

      // Transform to include holdingsCount for frontend
      const response = {
        ...etf,
        holdingsCount: etf._count.holdings,
      };

      return reply.send(response);
    } catch (error: any) {
      app.log.error('ETF detail error:', error);
      return reply.status(500).send({
        error: 'Failed to fetch ETF details',
        message: error.message,
      });
    }
  });

  // GET /api/etf - Search/list ETFs
  app.get('/etf', async (request, reply) => {
    const { search, limit = 20 } = request.query as { search?: string; limit?: number };

    try {
      const etfs = await prisma.etf.findMany({
        where: search ? {
          OR: [
            { ticker: { contains: search } },
            { name: { contains: search } },
          ],
        } : undefined,
        take: Number(limit),
        orderBy: { aum: 'desc' },
        select: {
          ticker: true,
          name: true,
          aum: true,
          netExpenseRatio: true,
          assetClass: true,
        },
      });

      return reply.send({ etfs, count: etfs.length });
    } catch (error: any) {
      app.log.error('ETF search error:', error);
      return reply.status(500).send({
        error: 'Failed to search ETFs',
        message: error.message,
      });
    }
  });
}
