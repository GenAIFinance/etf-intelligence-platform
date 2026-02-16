# Fix: Top-level await not supported with "cjs" output format

## 🐛 Problem

```
ERROR: Top-level await is currently not supported with the "cjs" output format
```

Your code uses `await` at the top level (outside functions), but the project is configured for CommonJS instead of ES modules.

---

## ✅ Solution: Wrap Everything in an Async Function

Instead of changing the entire project configuration, wrap your code in an async IIFE (Immediately Invoked Function Expression).

### Edit: `apps/api/src/index.ts`

**BEFORE** (broken - top-level await):
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { etfRoutes } from './routes/etf';
import { aiScreenerRoutes } from './routes/ai-screener';
import { etfComparisonRoutes } from './routes/etf-comparison';
import { rankingsRoutes } from './routes/rankings';

const prisma = new PrismaClient();
const app = Fastify({
  logger: true,
});

// Register CORS
await app.register(cors, {  // ← Can't use await here
  origin: true,
});

// Register routes
await app.register(etfRoutes, { prefix: '/api' });  // ← Can't use await here
await app.register(aiScreenerRoutes, { prefix: '/api' });
await app.register(etfComparisonRoutes, { prefix: '/api' });
await app.register(rankingsRoutes, { prefix: '/api' });

// Start server
try {
  await app.listen({ port: 3001, host: '0.0.0.0' });  // ← Can't use await here
  console.log('✓ Server listening at http://0.0.0.0:3001');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

**AFTER** (fixed - wrapped in async function):
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { etfRoutes } from './routes/etf';
import { aiScreenerRoutes } from './routes/ai-screener';
import { etfComparisonRoutes } from './routes/etf-comparison';
import { rankingsRoutes } from './routes/rankings';

const prisma = new PrismaClient();

// Wrap everything in an async function
async function startServer() {
  const app = Fastify({
    logger: true,
  });

  // Register CORS
  await app.register(cors, {
    origin: true,
  });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  await app.register(etfRoutes, { prefix: '/api' });
  await app.register(aiScreenerRoutes, { prefix: '/api' });
  await app.register(etfComparisonRoutes, { prefix: '/api' });
  await app.register(rankingsRoutes, { prefix: '/api' });

  // Start server
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('✓ Server listening at http://0.0.0.0:3001');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Start the server
startServer();
```

---

## 🔑 Key Changes

1. **Added** `async function startServer() {`
2. **Moved** everything inside that function
3. **Added** `startServer();` at the end to call it

Now all the `await` statements are inside an async function, not at top level!

---

## 📋 If You Don't Have AI Screener Route Yet

If you get "Cannot find module './routes/ai-screener'", comment it out temporarily:

```typescript
import { etfRoutes } from './routes/etf';
// import { aiScreenerRoutes } from './routes/ai-screener';  // ← Comment out
import { etfComparisonRoutes } from './routes/etf-comparison';
import { rankingsRoutes } from './routes/rankings';

// ...

// Register routes
await app.register(etfRoutes, { prefix: '/api' });
// await app.register(aiScreenerRoutes, { prefix: '/api' });  // ← Comment out
await app.register(etfComparisonRoutes, { prefix: '/api' });
await app.register(rankingsRoutes, { prefix: '/api' });
```

You'll add it back after copying the route file.

---

## 🚀 Restart API Server

```bash
# Stop with Ctrl+C
# Then restart:
cd apps/api
npm run dev
```

**Expected output**:
```
> tsx watch src/index.ts
✓ Server listening at http://0.0.0.0:3001
```

---

## ✅ Verification

Test the API is working:

```powershell
# Test health endpoint
Invoke-RestMethod -Uri "http://localhost:3001/health"
```

**Expected**: 
```json
{
  "status": "ok",
  "timestamp": "2026-02-14T..."
}
```

---

## 🎯 Alternative Solution: Enable ES Modules (Advanced)

If you want to use top-level await properly, you need to configure the project for ES modules:

### Option 1: Update package.json

**File**: `apps/api/package.json`

**Add**:
```json
{
  "name": "@etf-intelligence/api",
  "version": "1.0.0",
  "type": "module",  // ← Add this line
  // ... rest of your package.json
}
```

### Option 2: Update tsconfig.json

**File**: `apps/api/tsconfig.json`

**Change**:
```json
{
  "compilerOptions": {
    "module": "ES2022",        // ← Change from "commonjs"
    "target": "ES2022",        // ← Update target
    "moduleResolution": "node"
    // ... rest of your config
  }
}
```

**But this might break other things**, so **I recommend the async function wrapper** (simpler, safer).

---

## 📝 Why This Happened

The template I gave you was designed for **ES modules** (modern JavaScript), but your project is configured for **CommonJS** (older format).

In CommonJS, you can't use `await` at the top level of a file - it must be inside an async function.

---

## 🎯 Summary

**Quick Fix** (recommended):
1. Wrap everything in `async function startServer()`
2. Call `startServer()` at the bottom
3. Restart API

**Expected result**: API starts without errors ✅

---

**Fix Time**: 2 minutes  
**Difficulty**: Easy  
**Next Step**: After API starts, add AI Screener route
