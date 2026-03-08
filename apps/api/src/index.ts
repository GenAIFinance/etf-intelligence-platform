// apps/api/src/index.ts

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { aiScreenerRoutes }    from './routes/ai-screener';
import { aiChatRoutes }        from './routes/ai-chat';
import { etfComparisonRoutes } from './routes/etf-comparison';
import { rankingsRoutes }      from './routes/rankings';
import { etfRoutes }           from './routes/etfs';
import { screenerRoutes }      from './routes/screener-route';
import { sessionRoutes }       from './routes/sessions';

const prisma = new PrismaClient();

// ── Supabase activity logger ─────────────────────────────────────────────────
// Called on every Railway request that has an x-username header.
// Runs after response is sent — never blocks the API call.

const SUPABASE_URL      = process.env.SUPABASE_URL ?? '';
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function logActivity(username: string, path: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const now = new Date().toISOString();
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/user_activity`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ username, path, accessed_at: now }),
    });
  } catch {
    // silent — never affect API response
  }
}

async function startServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Log activity on every request that has x-username header
  app.addHook('onResponse', async (request) => {
    const username = request.headers['x-username'];
    if (username && typeof username === 'string') {
      const path = request.routeOptions?.url ?? request.url;
      logActivity(username, path); // intentionally not awaited — fire after response
    }
  });

  await app.register(aiScreenerRoutes);
  await app.register(aiChatRoutes);
  await app.register(etfComparisonRoutes, { prefix: '/api' });
  await app.register(rankingsRoutes,      { prefix: '/api' });
  await app.register(etfRoutes,           { prefix: '/api' });
  await app.register(screenerRoutes,      { prefix: '/api' });
  await app.register(sessionRoutes);

  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('✅ Server ready at http://0.0.0.0:3001');
  } catch (err) {
    console.error('❌ Failed:', err);
    process.exit(1);
  }
}

startServer();
