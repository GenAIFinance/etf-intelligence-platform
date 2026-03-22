// Top Gainers route
// apps/api/src/routes/top-gainers.ts
//
// GET /api/top-gainers
// Returns top 5 ETFs by 1-month return from the most recent EtfMetricSnapshot batch.
// Uses $queryRaw to avoid Prisma relation-name ambiguity and guarantee correct SQL.

import { FastifyInstance } from 'fastify';
import { PrismaClient }    from '@prisma/client';

const prisma = new PrismaClient();

interface GainerRow {
  ticker:   string;
  name:     string;
  return1M: number;
}

export async function topGainersRoutes(fastify: FastifyInstance) {

  fastify.get('/top-gainers', async (_request, reply) => {
    try {
      const rows = await prisma.$queryRaw<GainerRow[]>`
        SELECT
          e.ticker,
          e.name,
          m."return1M"
        FROM "EtfMetricSnapshot" m
        JOIN "Etf" e ON e.id = m."etfId"
        WHERE m."asOfDate" = (SELECT MAX("asOfDate") FROM "EtfMetricSnapshot")
          AND m."return1M" IS NOT NULL
        ORDER BY m."return1M" DESC
        LIMIT 5
      `;

      return reply.send({ gainers: rows });

    } catch (err) {
      fastify.log.error(err, 'top-gainers: query failed');
      return reply.status(500).send({ error: 'Failed to fetch top gainers' });
    }
  });
}
