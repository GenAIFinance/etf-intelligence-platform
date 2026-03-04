import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { aiScreenerRoutes } from './routes/ai-screener';
import { etfComparisonRoutes } from './routes/etf-comparison';
import { rankingsRoutes } from './routes/rankings';
import { etfRoutes } from './routes/etfs';
import { screenerRoutes } from './routes/screener-route';

const prisma = new PrismaClient();

async function startServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // aiScreenerRoutes registers its own full path (/api/ai-screener/nlp)
  // — no prefix here to avoid /api/api double-prefix
  await app.register(aiScreenerRoutes);
  await app.register(etfComparisonRoutes, { prefix: '/api' });
  await app.register(rankingsRoutes,      { prefix: '/api' });
  await app.register(etfRoutes,           { prefix: '/api' });
  await app.register(screenerRoutes,      { prefix: '/api' });

  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('✅ Server ready at http://0.0.0.0:3001');
  } catch (err) {
    console.error('❌ Failed:', err);
    process.exit(1);
  }
}

startServer();
