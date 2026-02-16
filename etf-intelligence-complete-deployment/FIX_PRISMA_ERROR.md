# Quick Fix: AI Screener Prisma Error

## 🐛 Problem
```
{"error":"Failed to process screening query","message":"Cannot read properties of undefined (reading 'findMany')"}
```

Prisma client isn't imported correctly.

---

## ✅ Fix: Replace 2 Files

### File 1: apps\api\src\db.ts

Replace with this:

```typescript
// Database client
// apps/api/src/db.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
```

### File 2: apps\api\src\services\ai-screener.ts

Replace with this:

```typescript
import { PrismaClient } from '@prisma/client';
import prisma from '../db';

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
    try {
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
    } catch (error) {
      console.error('AI Screener error:', error);
      throw error;
    }
  },
};
```

---

## 🚀 Restart API

```cmd
cd apps\api
npm run dev
```

---

## 🧪 Test Again

```cmd
curl -X POST http://localhost:3001/api/ai-screener -H "Content-Type: application/json" -d "{\"query\":\"tech\",\"limit\":5}"
```

**Should return**: JSON with ETF results (not error)

---

## 📝 What Changed

**Before (broken)**:
```typescript
const prisma = new PrismaClient();  // Created new instance
```

**After (fixed)**:
```typescript
import prisma from '../db';  // Use shared instance from db.ts
```

This ensures the same Prisma instance is used across all services.

---

**Fix time**: 2 minutes  
**Files to replace**: 2  
**Then**: Restart API and test
