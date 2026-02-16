import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db';
import { topImpactQuerySchema, TopImpactQuery, TopImpactedEtf } from '@etf-intelligence/shared';

export async function impactRoutes(fastify: FastifyInstance) {
  // GET /api/impact/top - Get top impacted ETFs
  fastify.get('/impact/top', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { window } = topImpactQuerySchema.parse(request.query);

      const since = new Date();
      if (window === '1d') {
        since.setDate(since.getDate() - 1);
      } else {
        since.setDate(since.getDate() - 7);
      }

      // Get all impacts since the window
      const impacts = await prisma.newsImpact.findMany({
        where: {
          newsItem: {
            publishedAt: { gte: since },
          },
        },
        include: {
          etf: { select: { ticker: true, name: true } },
          newsItem: { select: { title: true } },
        },
        orderBy: { impactScore: 'desc' },
      });

      // Aggregate by ETF
      const etfMap: Map<string, {
        ticker: string;
        name: string;
        totalScore: number;
        newsCount: number;
        topNews: { title: string; impactScore: number }[];
      }> = new Map();

      for (const impact of impacts) {
        const key = impact.etf.ticker;
        if (!etfMap.has(key)) {
          etfMap.set(key, {
            ticker: impact.etf.ticker,
            name: impact.etf.name,
            totalScore: 0,
            newsCount: 0,
            topNews: [],
          });
        }

        const data = etfMap.get(key)!;
        data.totalScore += impact.impactScore;
        data.newsCount += 1;
        if (data.topNews.length < 3) {
          data.topNews.push({
            title: impact.newsItem.title,
            impactScore: impact.impactScore,
          });
        }
      }

      // Convert to array and sort
      const topEtfs: TopImpactedEtf[] = Array.from(etfMap.values())
        .map((e) => ({
          ticker: e.ticker,
          name: e.name,
          totalImpactScore: e.totalScore,
          newsCount: e.newsCount,
          topNews: e.topNews,
        }))
        .sort((a, b) => b.totalImpactScore - a.totalImpactScore)
        .slice(0, 10);

      return {
        window,
        since: since.toISOString(),
        topEtfs,
      };
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/impact/etf/:ticker - Get news impacts for a specific ETF
  fastify.get('/impact/etf/:ticker', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { ticker } = request.params as { ticker: string };

      const etf = await prisma.etf.findUnique({ where: { ticker: ticker.toUpperCase() } });
      if (!etf) {
        return reply.status(404).send({ error: 'ETF not found' });
      }

      const impacts = await prisma.newsImpact.findMany({
        where: { etfId: etf.id },
        include: {
          newsItem: {
            include: { topics: true },
          },
        },
        orderBy: { impactScore: 'desc' },
        take: 20,
      });

      return {
        ticker,
        name: etf.name,
        impacts: impacts.map((i) => ({
          newsItem: {
            id: i.newsItem.id,
            title: i.newsItem.title,
            source: i.newsItem.source,
            publishedAt: i.newsItem.publishedAt,
            url: i.newsItem.url,
            topics: i.newsItem.topics.map((t) => t.topicLabel),
          },
          impactScore: i.impactScore,
          rationale: i.rationale,
          matchedHoldings: JSON.parse(i.matchedHoldingsJson),
          matchedThemes: JSON.parse(i.matchedThemesJson),
        })),
      };
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });
}
