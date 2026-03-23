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
import { topGainersRoutes }    from './routes/top-gainers';
import { topSectorsRoutes }    from './routes/top-sectors';

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// ── Activity logger ──────────────────────────────────────────────────────────
// Logs every page/API visit to user_activity. Fire-and-forget.

async function logActivity(username: string, path: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/user_activity`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ username, path, accessed_at: new Date().toISOString() }),
    });
  } catch { /* silent */ }
}

// ── Session tracker ──────────────────────────────────────────────────────────
// Upserts a session row — creates on first ping, updates last_active + duration
// on every subsequent request. Duration = seconds since session started.

async function logSession(username: string, sessionId: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const now = new Date().toISOString();
  try {
    // Try insert first (new session)
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/user_sessions`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer':        'resolution=ignore-duplicates',
      },
      body: JSON.stringify({
        username,
        session_id:  sessionId,
        logged_in_at:  now,
        last_active_at: now,
        duration_sec: 0,
      }),
    });

    if (insertRes.status === 409 || insertRes.status === 200 || insertRes.status === 201) {
      // Update last_active and recalculate duration
      await fetch(
        `${SUPABASE_URL}/rest/v1/user_sessions?session_id=eq.${encodeURIComponent(sessionId)}`,
        {
          method:  'PATCH',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({ last_active_at: now }),
        }
      );
    }
  } catch { /* silent */ }
}

// ── Event logger ─────────────────────────────────────────────────────────────
// Stores a single user interaction event (click, search, tab switch etc.)

async function logEvent(
  username: string,
  sessionId: string,
  eventType: string,
  eventData: Record<string, unknown>
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/user_events`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        username,
        session_id:  sessionId,
        event_type:  eventType,
        event_data:  eventData,
        occurred_at: new Date().toISOString(),
      }),
    });
  } catch { /* silent */ }
}

async function startServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // ── Log activity + session on every request with x-username ─────────────
  app.addHook('onResponse', async (request) => {
    const username  = request.headers['x-username'];
    const sessionId = request.headers['x-session-id'];
    if (username && typeof username === 'string') {
      const path = request.routeOptions?.url ?? request.url;
      logActivity(username, path);
      if (sessionId && typeof sessionId === 'string') {
        logSession(username, sessionId);
      }
    }
  });

  // ── Event ingestion endpoint ─────────────────────────────────────────────
  // Frontend calls POST /api/events to log clicks and interactions.
  app.post<{
    Body: { eventType: string; eventData?: Record<string, unknown> }
  }>('/api/events', async (request, reply) => {
    const username  = request.headers['x-username'];
    const sessionId = request.headers['x-session-id'];
    if (!username || typeof username !== 'string') {
      return reply.status(401).send({ error: 'x-username header required' });
    }
    if (!sessionId || typeof sessionId !== 'string') {
      return reply.status(400).send({ error: 'x-session-id header required' });
    }
    const { eventType, eventData = {} } = request.body ?? {};
    if (!eventType) {
      return reply.status(400).send({ error: 'eventType is required' });
    }
    logEvent(username, sessionId, eventType, eventData); // fire-and-forget
    return reply.status(204).send();
  });

  await app.register(aiScreenerRoutes);
  await app.register(aiChatRoutes);
  await app.register(etfComparisonRoutes, { prefix: '/api' });
  await app.register(rankingsRoutes,      { prefix: '/api' });
  await app.register(etfRoutes,           { prefix: '/api' });
  await app.register(screenerRoutes,      { prefix: '/api' });
  await app.register(sessionRoutes);
  await app.register(topGainersRoutes,    { prefix: '/api' });
  await app.register(topSectorsRoutes,    { prefix: '/api' });

  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('✅ Server ready at http://0.0.0.0:3001');
  } catch (err) {
    console.error('❌ Failed:', err);
    process.exit(1);
  }
}

startServer();
