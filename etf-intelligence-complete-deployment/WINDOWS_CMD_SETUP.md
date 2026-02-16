# Windows CMD Commands - Add Routes to API

## 📋 Step 1: Copy Route Files

```cmd
cd "C:\Users\cathe\OneDrive\文档\Risk\Project folder\ETF Intelligence"

copy backend\routes\ai-screener-route-fixed.ts apps\api\src\routes\ai-screener.ts
copy backend\routes\etf-comparison-routes.ts apps\api\src\routes\etf-comparison.ts
copy backend\routes\rankings-routes.ts apps\api\src\routes\rankings.ts
```

---

## 📋 Step 2: Copy Service Files

```cmd
copy backend\services\etf-comparison-service.ts apps\api\src\services\etf-comparison.ts
copy backend\services\rankings-service.ts apps\api\src\services\rankings.ts
copy backend\helpers\db.ts apps\api\src\db.ts
copy backend\helpers\llm.ts apps\api\src\llm.ts
```

---

## 📋 Step 3: Create AI Screener Service

**Manually create this file**: `apps\api\src\services\ai-screener.ts`

Open Notepad and paste this code, then save as `apps\api\src\services\ai-screener.ts`:

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
    // Simple keyword search
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

**Or use this CMD command**:

```cmd
(
echo import { PrismaClient } from '@prisma/client';
echo.
echo const prisma = new PrismaClient^(^);
echo.
echo interface ScreenRequest {
echo   query: string;
echo   limit: number;
echo }
echo.
echo interface ScreenResult {
echo   etfs: any[];
echo   interpretation: string;
echo   searchCriteria: any;
echo }
echo.
echo export const aiScreenerService = {
echo   async screenETFs^(request: ScreenRequest^): Promise^<ScreenResult^> {
echo     const etfs = await prisma.eTF.findMany^({
echo       where: {
echo         OR: [
echo           { ticker: { contains: request.query, mode: 'insensitive' } },
echo           { name: { contains: request.query, mode: 'insensitive' } },
echo           { assetClass: { contains: request.query, mode: 'insensitive' } },
echo         ],
echo       },
echo       take: request.limit,
echo       orderBy: { aum: 'desc' },
echo     }^);
echo.
echo     return {
echo       etfs,
echo       interpretation: `Found ${etfs.length} ETFs matching "${request.query}"`,
echo       searchCriteria: { query: request.query, limit: request.limit },
echo     };
echo   },
echo };
) > apps\api\src\services\ai-screener.ts
```

---

## 📋 Step 4: Update index.ts

**Replace** `apps\api\src\index.ts` with this:

Open the file in Notepad and replace ALL content with:

```typescript
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
```

**Or use CMD** (complex, better to use Notepad):

```cmd
(
echo import Fastify from 'fastify';
echo import cors from '@fastify/cors';
echo import { PrismaClient } from '@prisma/client';
echo import { aiScreenerRoutes } from './routes/ai-screener';
echo import { etfComparisonRoutes } from './routes/etf-comparison';
echo import { rankingsRoutes } from './routes/rankings';
echo.
echo const prisma = new PrismaClient^(^);
echo.
echo async function startServer^(^) {
echo   const app = Fastify^({ logger: true }^);
echo   await app.register^(cors, { origin: true }^);
echo.
echo   app.get^('/health', async ^(^) =^> {
echo     return { status: 'ok', timestamp: new Date^(^).toISOString^(^) };
echo   }^);
echo.
echo   await app.register^(aiScreenerRoutes, { prefix: '/api' }^);
echo   await app.register^(etfComparisonRoutes, { prefix: '/api' }^);
echo   await app.register^(rankingsRoutes, { prefix: '/api' }^);
echo.
echo   try {
echo     await app.listen^({ port: 3001, host: '0.0.0.0' }^);
echo     console.log^('✅ Server ready'^);
echo   } catch ^(err^) {
echo     console.error^(err^);
echo     process.exit^(1^);
echo   }
echo }
echo.
echo startServer^(^);
) > apps\api\src\index.ts
```

---

## 📋 Step 5: Restart API

```cmd
cd apps\api
npm run dev
```

---

## 🧪 Step 6: Test All Endpoints

```cmd
curl http://localhost:3001/health
curl http://localhost:3001/api/ai-screener/examples
curl -X POST http://localhost:3001/api/ai-screener -H "Content-Type: application/json" -d "{\"query\":\"tech\",\"limit\":5}"
curl http://localhost:3001/api/rankings/top10
curl -X POST http://localhost:3001/api/etf/compare -H "Content-Type: application/json" -d "{\"tickers\":[\"SPY\",\"VOO\"]}"
```

---

## ✅ Checklist

- [ ] Step 1: Copy 3 route files ✓
- [ ] Step 2: Copy 4 service/helper files ✓
- [ ] Step 3: Create ai-screener.ts service ✓
- [ ] Step 4: Update index.ts ✓
- [ ] Step 5: Restart API ✓
- [ ] Step 6: Test all 5 endpoints ✓

---

## 💡 Recommended: Use Notepad for Steps 3 & 4

The CMD echo commands can be tricky with special characters. **Easier method**:

### For Step 3:
1. Open Notepad
2. Copy the TypeScript code from "Step 3" above
3. Save as: `apps\api\src\services\ai-screener.ts`

### For Step 4:
1. Open Notepad
2. Copy the TypeScript code from "Step 4" above
3. Save as: `apps\api\src\index.ts` (overwrite existing)

Then continue with Step 5 (restart).

---

**After all steps, all 5 curl commands should return JSON!**
