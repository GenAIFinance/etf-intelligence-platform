// Top Sectors route
// apps/api/src/routes/top-sectors.ts
//
// GET /api/top-sectors
// Returns top 8 strategy types by avg 1-month return.
// Groups ETFs by strategyType on the Etf table (clean per-ETF classification).
// Excludes leveraged, inverse, and structured-product strategy types.

import { FastifyInstance } from 'fastify';
import { PrismaClient }    from '@prisma/client';

const prisma = new PrismaClient();

interface SectorRow {
  strategyType:  string;
  etf_count:     bigint;
  avg_return1m:  number | null;
}

export async function topSectorsRoutes(fastify: FastifyInstance) {

  fastify.get('/top-sectors', async (_request, reply) => {
    try {
      const rows = await prisma.$queryRaw<SectorRow[]>`
        SELECT
          e."strategyType",
          COUNT(DISTINCT e.id)                 AS etf_count,
          ROUND(AVG(m."return1M")::numeric, 2) AS avg_return1M
        FROM "Etf" e
        JOIN "EtfMetricSnapshot" m ON m."etfId" = e.id
        WHERE e."strategyType" IS NOT NULL
          AND e."strategyType" NOT ILIKE '%Leveraged%'
          AND e."strategyType" NOT ILIKE '%Inverse%'
          AND e."strategyType" NOT ILIKE '%Defined Outcome%'
          AND e."strategyType" NOT ILIKE '%Derivative%'
          AND e."strategyType" NOT ILIKE '%Target Maturity%'
          AND e."strategyType" NOT ILIKE '%Trading%'
          AND m."asOfDate" = (SELECT MAX("asOfDate") FROM "EtfMetricSnapshot")
          AND m."return1M" IS NOT NULL
        GROUP BY e."strategyType"
        HAVING COUNT(DISTINCT e.id) >= 5
          AND AVG(m."return1M") IS NOT NULL
        ORDER BY avg_return1m DESC
        LIMIT 8
      `;

      // Convert BigInt etf_count to Number for JSON serialisation
      const sectors = rows.map(r => ({
        strategyType: r.strategyType,
        etfCount:     Number(r.etf_count),
        avgReturn1M:  r.avg_return1m !== null ? Number(r.avg_return1m) : null,
      }));

      return reply.send({ sectors });

    } catch (err) {
      fastify.log.error(err, 'top-sectors: query failed');
      return reply.status(500).send({ error: 'Failed to fetch top sectors' });
    }
  });
}
