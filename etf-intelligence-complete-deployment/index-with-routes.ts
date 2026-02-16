import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { aiScreenerRoutes } from './routes/ai-screener';
import { etfComparisonRoutes } from './routes/etf-comparison';
import { rankingsRoutes } from './routes/rankings';

const prisma = new PrismaClient();

async function startServer() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
  });

  app.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'ETF Intelligence API is running'
    };
  });

  // Register routes
  await app.register(aiScreenerRoutes, { prefix: '/api' });
  await app.register(etfComparisonRoutes, { prefix: '/api' });
  await app.register(rankingsRoutes, { prefix: '/api' });

  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('✅ Server listening at http://0.0.0.0:3001');
    console.log('✅ Routes enabled:');
    console.log('   - /api/ai-screener');
    console.log('   - /api/etf/compare');
    console.log('   - /api/rankings/top10');
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
