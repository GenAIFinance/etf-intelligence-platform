# Fix ETF Detail Page - Step-by-Step Guide

## 🐛 Problem
Clicking an ETF ticker shows "ETF Not Found"

**Root causes**:
1. Route file uses `import { prisma }` but your `db.ts` exports `export default prisma`
2. Missing `/api/etf/:ticker` route (singular) - frontend uses singular, file has plural

---

## ✅ Solution: Replace etfs.ts Route File

### Step 1: Replace the Route File

**File**: `apps\api\src\routes\etfs.ts`

**Replace with**: The **etfs-routes-FIXED.ts** file I provided

**Key changes**:
- Line 2: Changed `import { prisma }` → `import prisma` (default import)
- Line 7: Added `/api/etf/:ticker` route (singular) for frontend compatibility
- All `prisma` calls work now

---

### Step 2: Register the Route in index.ts

**File**: `apps\api\src\index.ts`

Make sure you have:

```typescript
import { etfRoutes } from './routes/etfs';

// ... in startServer function:
await app.register(etfRoutes, { prefix: '/api' });
```

**Complete index.ts should look like**:
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { aiScreenerRoutes } from './routes/ai-screener';
import { etfComparisonRoutes } from './routes/etf-comparison';
import { rankingsRoutes } from './routes/rankings';
import { etfRoutes } from './routes/etfs';  // ← Add this

const prisma = new PrismaClient();

async function startServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await app.register(aiScreenerRoutes, { prefix: '/api' });
  await app.register(etfComparisonRoutes, { prefix: '/api' });
  await app.register(rankingsRoutes, { prefix: '/api' });
  await app.register(etfRoutes, { prefix: '/api' });  // ← Add this

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

### Step 3: Restart API Server

```cmd
cd apps\api
npm run dev
```

---

### Step 4: Test the Endpoint

```cmd
# Test VOO
curl http://localhost:3001/api/etf/VOO

# Test SPY
curl http://localhost:3001/api/etf/SPY
```

**Expected**: JSON with ETF data (not 404 error)

**Example response**:
```json
{
  "id": 123,
  "ticker": "VOO",
  "name": "Vanguard S&P 500 ETF",
  "aum": 850000000000,
  "netExpenseRatio": 0.03,
  "holdingsCount": 505,
  ...
}
```

---

### Step 5: Test in Browser

1. **Go to**: http://localhost:3000 (Dashboard)
2. **Click** any ETF ticker in the rankings (like VOO)
3. **Should**: Navigate to ETF detail page with data
4. **Should NOT**: Show "ETF Not Found" error

---

## 🎯 What Was Fixed

### Before (Broken):
```typescript
import { prisma } from '../db';  // ❌ Named import doesn't match export

// ❌ Only /etfs/:ticker route existed
fastify.get('/etfs/:ticker', ...)  
```

### After (Fixed):
```typescript
import prisma from '../db';  // ✅ Default import matches export

// ✅ Added /etf/:ticker for frontend (singular)
fastify.get('/etf/:ticker', ...)

// ✅ Kept /etfs/:ticker for backwards compatibility  
fastify.get('/etfs/:ticker', ...)
```

---

## 🧪 Complete Test Checklist

- [ ] Replaced `apps\api\src\routes\etfs.ts` with fixed version
- [ ] Confirmed `apps\api\src\index.ts` has `etfRoutes` import and registration
- [ ] Restarted API server
- [ ] Tested `curl http://localhost:3001/api/etf/VOO` (returns JSON)
- [ ] Opened http://localhost:3000 in browser
- [ ] Clicked an ETF ticker from rankings
- [ ] ETF detail page loads with data (not "ETF Not Found")

---

## 🐛 If Still Broken

### Issue: Still shows "ETF Not Found"

**Check 1**: Does the backend return data?
```cmd
curl http://localhost:3001/api/etf/VOO
```

If this returns JSON, it's a frontend issue. If 404, backend issue.

**Check 2**: Is VOO in your database?
```cmd
curl http://localhost:3001/api/etfs?search=VOO
```

Should show VOO in results.

**Check 3**: Browser console (F12)
What's the actual error? Share it and I'll help debug.

---

## 📝 Summary

**Files changed**: 1 file
**Time**: 3 minutes
**Result**: ETF detail pages now work when clicking tickers!

---

**Next**: After this works, let me know if you want to enhance the ETF detail page with more information!
