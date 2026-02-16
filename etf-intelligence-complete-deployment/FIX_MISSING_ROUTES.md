# Fix: Cannot find module './routes/etf'

## 🐛 Problem

Your `index.ts` is trying to import route files that don't exist yet.

```
Error: Cannot find module './routes/etf'
```

---

## 🔍 Step 1: Check What Route Files You Have

Open a PowerShell window and run:

```powershell
# Navigate to your API routes folder
cd "C:\Users\cathe\OneDrive\文档\Risk\Project folder\ETF Intelligence\apps\api\src\routes"

# List all files
dir
```

**Look for**:
- `etf.ts` or `etf-routes.ts`
- `ai-screener.ts`
- `etf-comparison.ts`
- `rankings.ts`

---

## ✅ Solution: Import Only Existing Routes

Based on what files you have, update `apps/api/src/index.ts`:

### Option A: You Have All Route Files

If `dir` shows all these files exist:
```
etf.ts
ai-screener.ts
etf-comparison.ts
rankings.ts
```

Then your imports should work as-is:
```typescript
import { etfRoutes } from './routes/etf';
import { aiScreenerRoutes } from './routes/ai-screener';
import { etfComparisonRoutes } from './routes/etf-comparison';
import { rankingsRoutes } from './routes/rankings';
```

### Option B: You're Missing Some Files (Most Likely)

**Comment out missing routes** until we copy them from your package:

```typescript
// Only import routes that exist
// import { etfRoutes } from './routes/etf';  // ← Comment out if missing
import { aiScreenerRoutes } from './routes/ai-screener';  // You're about to add this
import { etfComparisonRoutes } from './routes/etf-comparison';
import { rankingsRoutes } from './routes/rankings';

async function startServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Only register routes that exist
  // await app.register(etfRoutes, { prefix: '/api' });  // ← Comment out
  await app.register(aiScreenerRoutes, { prefix: '/api' });
  await app.register(etfComparisonRoutes, { prefix: '/api' });
  await app.register(rankingsRoutes, { prefix: '/api' });

  await app.listen({ port: 3001, host: '0.0.0.0' });
  console.log('✓ Server listening at http://0.0.0.0:3001');
}

startServer();
```

### Option C: Start with MINIMAL Setup

If you're not sure what exists, start with the absolute minimum:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function startServer() {
  const app = Fastify({
    logger: true,
  });

  // Register CORS
  await app.register(cors, {
    origin: true,
  });

  // Health check only
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Start server
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('✓ Server listening at http://0.0.0.0:3001');
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
```

This will at least get your API running. Then we can add routes one by one.

---

## 🚀 Test Minimal Setup

After using Option C (minimal setup):

```bash
cd apps/api
npm run dev
```

**Expected**:
```
✓ Server listening at http://0.0.0.0:3001
```

**Test**:
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/health"
```

**Should return**:
```json
{ "status": "ok", "timestamp": "..." }
```

---

## 📋 Next Steps After API Starts

Once you have a running API (even with just `/health`), then:

### Step 1: Copy Route Files from Your Package

```powershell
# Navigate to where you extracted the complete package
cd "C:\Users\cathe\OneDrive\文档\Risk\Project folder\ETF Intelligence"

# Copy AI Screener route
Copy-Item "backend\routes\ai-screener-route-fixed.ts" "apps\api\src\routes\ai-screener.ts"

# Copy Comparison route
Copy-Item "backend\routes\etf-comparison-routes.ts" "apps\api\src\routes\etf-comparison.ts"

# Copy Rankings route
Copy-Item "backend\routes\rankings-routes.ts" "apps\api\src\routes\rankings.ts"
```

### Step 2: Check What Route File Names They Export

Open each copied file and check the export name:

**In `ai-screener.ts`**, look for:
```typescript
export async function aiScreenerRoutes(app: FastifyInstance) {
  // ...
}
```

**In `etf-comparison.ts`**, look for:
```typescript
export async function etfComparisonRoutes(app: FastifyInstance) {
  // ...
}
```

**In `rankings.ts`**, look for:
```typescript
export async function rankingsRoutes(app: FastifyInstance) {
  // ...
}
```

### Step 3: Add Imports Back

After copying the files, add the imports to `index.ts`:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { aiScreenerRoutes } from './routes/ai-screener';
import { etfComparisonRoutes } from './routes/etf-comparison';
import { rankingsRoutes } from './routes/rankings';

const prisma = new PrismaClient();

async function startServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register your routes
  await app.register(aiScreenerRoutes, { prefix: '/api' });
  await app.register(etfComparisonRoutes, { prefix: '/api' });
  await app.register(rankingsRoutes, { prefix: '/api' });

  await app.listen({ port: 3001, host: '0.0.0.0' });
  console.log('✓ Server listening at http://0.0.0.0:3001');
}

startServer();
```

### Step 4: Restart and Test

```bash
npm run dev
```

Then test each endpoint:

```powershell
# Health
Invoke-RestMethod -Uri "http://localhost:3001/health"

# Rankings
Invoke-RestMethod -Uri "http://localhost:3001/api/rankings/top10"

# Comparison
$body = @{ tickers = @("SPY", "VOO") } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/api/etf/compare" -Method POST -Body $body -ContentType "application/json"

# AI Screener
Invoke-RestMethod -Uri "http://localhost:3001/api/ai-screener/examples"
```

---

## 🎯 About the Missing 'etf' Route

The error mentions `./routes/etf` which is probably your main ETF data route (get ETF details, search ETFs, etc).

**Two possibilities**:

1. **It exists with a different name**: Check for `etf-routes.ts` or `etfs.ts`
2. **It doesn't exist yet**: You might need to create it or it wasn't in the package

**For now**: Skip it and focus on the 3 routes you DO have:
- AI Screener
- Comparison
- Rankings

These are the ones you're trying to fix anyway!

---

## 📝 Quick Checklist

**To get API running**:
- [ ] Use minimal `index.ts` (Option C above)
- [ ] Restart API - should start successfully
- [ ] Test `/health` endpoint

**To add features**:
- [ ] Copy 3 route files from package
- [ ] Add imports to `index.ts`
- [ ] Register routes in `startServer()`
- [ ] Restart API
- [ ] Test each endpoint

---

## 💡 Pro Tip

Start with the **minimal setup** (just health check). Once that works, add routes **one at a time**:

1. Add AI Screener → Test → Works? Great!
2. Add Comparison → Test → Works? Great!
3. Add Rankings → Test → Works? Great!

This way, if something breaks, you know exactly which route caused it.

---

**Fix Time**: 5 minutes  
**Difficulty**: Easy  
**Status**: Getting close! Just need to get the route files in place.
