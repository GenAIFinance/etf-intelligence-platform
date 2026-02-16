# Debug Prisma Issue

## 🔍 Let's check your Prisma schema

### Step 1: Find the correct table name

Open this file:
```
apps\api\prisma\schema.prisma
```

Look for a model that looks like this:
```prisma
model ETF {
  id          String   @id @default(cuid())
  ticker      String   @unique
  name        String?
  // ... more fields
}
```

**The model name matters!** Could be:
- `ETF` 
- `Etf`
- `eTF`
- Something else

---

## 🔧 Fix Based on Model Name

### If your model is named `ETF`:

Update `apps\api\src\services\ai-screener.ts`:

```typescript
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
      console.log('AI Screener - Query:', request.query);
      console.log('Prisma client:', prisma);
      console.log('ETF model:', prisma.eTF ? 'eTF exists' : 'eTF NOT FOUND');
      
      // Try different possible names
      const etfs = await prisma.eTF.findMany({  // Change this line based on your model name
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

      console.log('Found ETFs:', etfs.length);

      return {
        etfs,
        interpretation: `Found ${etfs.length} ETFs matching "${request.query}"`,
        searchCriteria: { query: request.query, limit: request.limit },
      };
    } catch (error) {
      console.error('AI Screener detailed error:', error);
      throw error;
    }
  },
};
```

---

## 🧪 Test: Check What's Available

Create a test file: `apps\api\src\test-prisma.ts`

```typescript
import prisma from './db';

async function test() {
  console.log('Prisma client keys:', Object.keys(prisma));
  
  // Try to find any table
  try {
    // @ts-ignore
    if (prisma.eTF) {
      console.log('✓ eTF model exists');
      const count = await prisma.eTF.count();
      console.log('ETF count:', count);
    }
  } catch (e) {
    console.log('✗ eTF model failed');
  }
  
  try {
    // @ts-ignore
    if (prisma.ETF) {
      console.log('✓ ETF model exists');
      const count = await prisma.ETF.count();
      console.log('ETF count:', count);
    }
  } catch (e) {
    console.log('✗ ETF model failed');
  }
  
  try {
    // @ts-ignore  
    if (prisma.etf) {
      console.log('✓ etf model exists');
      const count = await prisma.etf.count();
      console.log('ETF count:', count);
    }
  } catch (e) {
    console.log('✗ etf model failed');
  }
}

test().then(() => process.exit(0));
```

Run it:
```cmd
cd apps\api
npx tsx src\test-prisma.ts
```

**This will tell you**:
- What models are available
- The correct name to use
- How many ETFs are in the database

---

## 📋 Alternative: Check if db.ts is correct

Make sure `apps\api\src\db.ts` looks EXACTLY like this:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
```

---

## 🔍 Check API Server Console

When you run the curl command, look at your API server terminal. You should see console.log output showing:
- What the query is
- Whether prisma is defined
- Whether the model exists

Share that output if you still get errors.

---

## 💡 Most Likely Issues

1. **Model name is different** → Check schema.prisma
2. **db.ts export is wrong** → Should be `export default prisma`
3. **Prisma not generated** → Run `npx prisma generate`
4. **Database not connected** → Check DATABASE_URL in .env

---

## 🚀 Quick Fix Commands

```cmd
cd apps\api

# Regenerate Prisma client
npx prisma generate

# Check if database is accessible
npx prisma db pull

# Restart API
npm run dev
```

---

Share the output of the test script and we'll fix it!
