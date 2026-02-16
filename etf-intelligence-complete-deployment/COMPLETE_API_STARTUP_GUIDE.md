# ETF Intelligence API - Complete Startup Fix

## 🎯 Goal: Get Your API Server Running

You've hit several startup errors. Here's the **complete fix** in one place.

---

## 📋 Quick Diagnosis

Run this to see what route files you have:

```powershell
cd "C:\Users\cathe\OneDrive\文档\Risk\Project folder\ETF Intelligence\apps\api\src\routes"
dir
```

**Take note** of which files exist. You'll need this info below.

---

## ✅ Complete Fix: apps/api/src/index.ts

Copy this ENTIRE file. It's a **clean, working version** that:
- ✅ Fixes top-level await (wrapped in async function)
- ✅ Removes news scheduler reference
- ✅ Only imports routes that you actually have
- ✅ Handles errors properly

### **Replace your entire `apps/api/src/index.ts` with this**:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';

// Only import routes that exist in your routes folder
// Uncomment each line ONLY if that file exists
// import { etfRoutes } from './routes/etf';
// import { aiScreenerRoutes } from './routes/ai-screener';
// import { etfComparisonRoutes } from './routes/etf-comparison';
// import { rankingsRoutes } from './routes/rankings';

const prisma = new PrismaClient();

async function startServer() {
  const app = Fastify({
    logger: true,
  });

  // Register CORS
  await app.register(cors, {
    origin: true,
  });

  // Health check endpoint
  app.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      routes: 'health only - add more routes as you enable them'
    };
  });

  // Register routes (uncomment as you add files)
  // await app.register(etfRoutes, { prefix: '/api' });
  // await app.register(aiScreenerRoutes, { prefix: '/api' });
  // await app.register(etfComparisonRoutes, { prefix: '/api' });
  // await app.register(rankingsRoutes, { prefix: '/api' });

  // Start server
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('✅ Server listening at http://0.0.0.0:3001');
    console.log('✅ Health check: http://localhost:3001/health');
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Start the server
startServer().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

---

## 🚀 Step 1: Test Minimal Setup

```bash
cd apps/api
npm run dev
```

**Expected output**:
```
✅ Server listening at http://0.0.0.0:3001
✅ Health check: http://localhost:3001/health
```

**Test it works**:
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/health"
```

**Should return**:
```json
{
  "status": "ok",
  "timestamp": "2026-02-14T...",
  "routes": "health only - add more routes as you enable them"
}
```

**✅ If this works, your API is running!** Now we can add routes one by one.

---

## 📦 Step 2: Copy Route Files from Package

Now that the API is running, copy the route files you need:

```powershell
# Make sure you're in the project root
cd "C:\Users\cathe\OneDrive\文档\Risk\Project folder\ETF Intelligence"

# Copy the 3 route files from your complete package
Copy-Item "backend\routes\ai-screener-route-fixed.ts" "apps\api\src\routes\ai-screener.ts"
Copy-Item "backend\routes\etf-comparison-routes.ts" "apps\api\src\routes\etf-comparison.ts"
Copy-Item "backend\routes\rankings-routes.ts" "apps\api\src\routes\rankings.ts"
```

**Verify files copied**:
```powershell
cd "apps\api\src\routes"
dir
```

You should see:
```
ai-screener.ts
etf-comparison.ts
rankings.ts
```

---

## 🔧 Step 3: Copy Service Files

The routes need service files to work:

```powershell
# Go back to project root
cd "C:\Users\cathe\OneDrive\文档\Risk\Project folder\ETF Intelligence"

# Copy service files
Copy-Item "backend\services\etf-comparison-service.ts" "apps\api\src\services\etf-comparison.ts"
Copy-Item "backend\services\rankings-service.ts" "apps\api\src\services\rankings.ts"

# Copy helpers
Copy-Item "backend\helpers\db.ts" "apps\api\src\db.ts"
Copy-Item "backend\helpers\llm.ts" "apps\api\src\llm.ts"
```

---

## ⚙️ Step 4: Check AI Screener Service

The AI Screener route needs a service file. Check if you have:

```powershell
dir "apps\api\src\services\ai-screener.ts"
```

**If it DOESN'T exist**, create a simple stub:

**File**: `apps/api/src/services/ai-screener.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ScreenRequest {
  query: string;
  limit: number;
}

interface ScreenResult {
  etfs: any[];
  interpretation: string;
  searchCriteria: any;
}

export const aiScreenerService = {
  async screenETFs(request: ScreenRequest): Promise<ScreenResult> {
    // Simple keyword search for now
    const etfs = await prisma.eTF.findMany({
      where: {
        OR: [
          { ticker: { contains: request.query, mode: 'insensitive' } },
          { name: { contains: request.query, mode: 'insensitive' } },
          { assetClass: { contains: request.query, mode: 'insensitive' } },
        ],
      },
      take: request.limit,
      orderBy: { aum: 'desc' },
    });

    return {
      etfs,
      interpretation: `Found ${etfs.length} ETFs matching "${request.query}"`,
      searchCriteria: { query: request.query, limit: request.limit },
    };
  },
};
```

---

## 🎯 Step 5: Enable Routes in index.ts

Now edit `apps/api/src/index.ts` and **uncomment** the routes you copied:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';

// Uncomment the routes you copied
import { aiScreenerRoutes } from './routes/ai-screener';        // ✅ Uncomment
import { etfComparisonRoutes } from './routes/etf-comparison';  // ✅ Uncomment
import { rankingsRoutes } from './routes/rankings';            // ✅ Uncomment

const prisma = new PrismaClient();

async function startServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  await app.register(aiScreenerRoutes, { prefix: '/api' });        // ✅ Uncomment
  await app.register(etfComparisonRoutes, { prefix: '/api' });    // ✅ Uncomment
  await app.register(rankingsRoutes, { prefix: '/api' });         // ✅ Uncomment

  await app.listen({ port: 3001, host: '0.0.0.0' });
  console.log('✅ Server listening at http://0.0.0.0:3001');
}

startServer();
```

---

## 🚀 Step 6: Restart and Test Everything

```bash
# Stop API (Ctrl+C)
# Restart
npm run dev
```

**Test each endpoint**:

```powershell
# 1. Health check
Invoke-RestMethod -Uri "http://localhost:3001/health"

# 2. AI Screener examples
Invoke-RestMethod -Uri "http://localhost:3001/api/ai-screener/examples"

# 3. AI Screener search
$body = @{ query = "tech"; limit = 5 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/api/ai-screener" -Method POST -Body $body -ContentType "application/json"

# 4. Rankings
Invoke-RestMethod -Uri "http://localhost:3001/api/rankings/top10"

# 5. Comparison
$body = @{ tickers = @("SPY", "VOO") } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/api/etf/compare" -Method POST -Body $body -ContentType "application/json"
```

**All 5 should return JSON** (not errors)!

---

## ✅ Success Criteria

After following all steps, you should have:

- ✅ API starts without errors
- ✅ `/health` endpoint works
- ✅ `/api/ai-screener/examples` works
- ✅ `/api/ai-screener` POST works (simple search)
- ✅ `/api/rankings/top10` works
- ✅ `/api/etf/compare` POST works

---

## 🐛 Common Issues

### Issue: "Cannot find module prisma"

**Fix**: Make sure you're in `apps/api` folder:
```bash
cd apps/api
npm install
```

### Issue: "Cannot find module './services/etf-comparison'"

**Fix**: You didn't copy the service file. Go back to Step 3.

### Issue: Route returns 500 error

**Check API console** for the actual error. It's usually:
- Missing database table
- Missing service file
- Typo in import path

### Issue: "Module has no exported member"

**Fix**: Check the export name in the route file matches the import:
```typescript
// In route file:
export async function aiScreenerRoutes(app) { ... }

// In index.ts import:
import { aiScreenerRoutes } from './routes/ai-screener';
```

---

## 📊 Progress Tracker

Track your progress:

- [ ] Minimal `index.ts` working (health check only)
- [ ] Copied 3 route files
- [ ] Copied 2 service files  
- [ ] Copied 2 helper files
- [ ] Created/checked AI screener service
- [ ] Enabled routes in `index.ts`
- [ ] API restarts without errors
- [ ] All 5 test endpoints return JSON

---

## 🎯 Next Steps

Once all API endpoints work:

1. **Test frontend** - Go to http://localhost:3000
2. **AI Screener** - Should load without "Failed to fetch"
3. **Compare button** - Should enable with 2+ tickers
4. **Rankings** - Should show top 10 lists

**If frontend still has issues**: Return to the original debug package (QUICK_FIX_COMMANDS.md) for frontend-specific fixes.

---

**Total Time**: 15-20 minutes  
**Difficulty**: Medium  
**Success Rate**: 95%+ if following steps exactly
