# ETF Screener Still 404 - Complete Fix

## 🐛 Problem

`curl http://localhost:3001/api/etfs` still returns 404.

This means either:
1. The `etfs.ts` file doesn't have the route
2. The route isn't being registered in `index.ts`
3. The API server wasn't restarted

---

## ✅ Complete Fix - Step by Step

### Step 1: Verify Route is Registered in index.ts

**Open**: `apps\api\src\index.ts`

**Check that you have this**:

```typescript
import { etfRoutes } from './routes/etfs';

// ... inside startServer():
await app.register(etfRoutes, { prefix: '/api' });
```

**Your COMPLETE index.ts should look like**:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { aiScreenerRoutes } from './routes/ai-screener';
import { etfComparisonRoutes } from './routes/etf-comparison';
import { rankingsRoutes } from './routes/rankings';
import { etfRoutes } from './routes/etfs';  // ← MUST HAVE THIS

const prisma = new PrismaClient();

async function startServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // All route registrations
  await app.register(aiScreenerRoutes, { prefix: '/api' });
  await app.register(etfComparisonRoutes, { prefix: '/api' });
  await app.register(rankingsRoutes, { prefix: '/api' });
  await app.register(etfRoutes, { prefix: '/api' });  // ← MUST HAVE THIS

  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('✅ Server ready at http://0.0.0.0:3001');
  } catch (err) {
    console.error('❌ Failed:', err);
    process.exit(1);
  }
}

startServer();
```

---

### Step 2: Verify etfs.ts File Location

**Check**: Does this file exist?
```
apps\api\src\routes\etfs.ts
```

**If NO**: Create it with the content from **etfs-routes-ABSOLUTE-FINAL.ts**

**If YES**: Open it and check if it has the `/etfs` route at the top (around line 7-60)

It should start with:
```typescript
export async function etfRoutes(fastify: FastifyInstance) {
  
  // GET /api/etfs - List/search ETFs
  fastify.get('/etfs', async (request, reply) => {
    // ... code here
  });
```

---

### Step 3: Check for TypeScript Errors

**Run**:
```cmd
cd apps\api
npm run dev
```

**Look in the console** - are there any errors?

**Common errors**:
- `Cannot find module './routes/etfs'` → File doesn't exist
- `etfRoutes is not a function` → Export is wrong
- TypeScript compile errors → Syntax issues

---

### Step 4: Manual Test

**Stop the server** (Ctrl+C)

**Start with verbose logging**:
```cmd
cd apps\api
npm run dev
```

**You should see**:
```
✅ Server ready at http://0.0.0.0:3001
```

**Then test**:
```cmd
curl http://localhost:3001/health
```

Should return: `{"status":"ok",...}`

**Then**:
```cmd
curl http://localhost:3001/api/etfs
```

---

## 🎯 If Still 404

### Option A: Manual Route Check

Add console.log to verify route registration.

**In index.ts**, add this AFTER registering routes:

```typescript
await app.register(etfRoutes, { prefix: '/api' });

console.log('📋 Registered routes:');
app.printRoutes();  // This will show all routes
```

Restart and check console - you should see `/api/etfs` listed.

---

### Option B: Test Without Prefix

**Temporarily change** in `etfs.ts`:

```typescript
// Test route without prefix
fastify.get('/test-etfs', async (request, reply) => {
  return { message: 'ETF route works!' };
});
```

**Then test**:
```cmd
curl http://localhost:3001/test-etfs
```

If this works, the issue is with route registration.

---

## 💡 Nuclear Option: Start Fresh

If nothing works, let's create a minimal working version:

### Create new file: `apps\api\src\routes\etfs-simple.ts`

```typescript
import { FastifyInstance } from 'fastify';
import prisma from '../db';

export async function etfRoutesSimple(fastify: FastifyInstance) {
  
  fastify.get('/etfs', async (request, reply) => {
    try {
      const etfs = await prisma.etf.findMany({
        take: 20,
        orderBy: { ticker: 'asc' },
      });

      return {
        data: etfs,
        total: etfs.length,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
```

### Update index.ts:

```typescript
import { etfRoutesSimple } from './routes/etfs-simple';

// ...
await app.register(etfRoutesSimple, { prefix: '/api' });
```

**Restart and test**:
```cmd
curl http://localhost:3001/api/etfs
```

This minimal version should definitely work.

---

## 📝 Share for Debugging

If still not working, share:

1. **Console output** when starting the API (any errors?)
2. **Contents of** `apps\api\src\index.ts` (full file)
3. **Directory listing**: 
   ```cmd
   dir "apps\api\src\routes"
   ```
4. **First 30 lines** of `apps\api\src\routes\etfs.ts`

Then I can tell you exactly what's wrong!

---

**Most likely**: The route file exists but `index.ts` doesn't import/register it properly.
