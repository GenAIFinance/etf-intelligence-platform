# Fix Frontend Errors - Rankings & Comparison

## 🐛 Issues Found

1. **Dashboard**: Rankings API returning wrong format
2. **Compare**: Backend returns different structure than frontend expects
3. **AI Screener**: Likely similar data format issue

---

## ✅ Fix 1: Check API Response Format

First, let's see what the APIs are actually returning:

```cmd
curl http://localhost:3001/api/rankings/top10
```

**Check**: Does it return data in this format?
```json
{
  "rankings": {
    "largestByAUM": [...],
    "lowestExpenseRatio": [...],
    ...
  }
}
```

Or different?

---

## ✅ Fix 2: Update Rankings Service

The rankings service might not be returning data correctly.

**Replace** `apps\api\src\services\rankings.ts`:

```typescript
import prisma from '../db';

export const rankingsService = {
  async getTop10Rankings() {
    try {
      // Get largest by AUM
      const largestByAUM = await prisma.etf.findMany({
        where: { aum: { not: null } },
        orderBy: { aum: 'desc' },
        take: 10,
        select: {
          ticker: true,
          name: true,
          aum: true,
          netExpenseRatio: true,
        },
      });

      // Get lowest expense ratio
      const lowestExpenseRatio = await prisma.etf.findMany({
        where: { netExpenseRatio: { not: null } },
        orderBy: { netExpenseRatio: 'asc' },
        take: 10,
        select: {
          ticker: true,
          name: true,
          aum: true,
          netExpenseRatio: true,
        },
      });

      // Get most diversified (by holdings count)
      const mostDiversified = await prisma.etf.findMany({
        where: { holdingsCount: { not: null } },
        orderBy: { holdingsCount: 'desc' },
        take: 10,
        select: {
          ticker: true,
          name: true,
          holdingsCount: true,
        },
      });

      return {
        largestByAUM,
        lowestExpenseRatio,
        lowestAnnualCost: lowestExpenseRatio, // Same as lowest expense
        highestSavings: lowestExpenseRatio, // Same as lowest expense
        mostDiversified,
      };
    } catch (error) {
      console.error('Rankings service error:', error);
      throw error;
    }
  },
};
```

---

## ✅ Fix 3: Update Comparison Service

**Replace** `apps\api\src\services\etf-comparison.ts`:

```typescript
import prisma from '../db';

export const etfComparisonService = {
  async compareETFs(tickers: string[]) {
    try {
      // Fetch ETFs
      const etfs = await prisma.etf.findMany({
        where: {
          ticker: { in: tickers },
        },
      });

      if (etfs.length === 0) {
        throw new Error('No ETFs found for the provided tickers');
      }

      // Find highlights
      const highlights = {
        lowestExpenseRatio: null as string | null,
        highestAUM: null as string | null,
        mostDiversified: null as string | null,
        bestValue: null as string | null,
      };

      // Calculate highlights
      let lowestER = Infinity;
      let highestAUM = 0;
      let maxHoldings = 0;

      etfs.forEach(etf => {
        if (etf.netExpenseRatio && etf.netExpenseRatio < lowestER) {
          lowestER = etf.netExpenseRatio;
          highlights.lowestExpenseRatio = etf.ticker;
        }
        if (etf.aum && etf.aum > highestAUM) {
          highestAUM = etf.aum;
          highlights.highestAUM = etf.ticker;
        }
        if (etf.holdingsCount && etf.holdingsCount > maxHoldings) {
          maxHoldings = etf.holdingsCount;
          highlights.mostDiversified = etf.ticker;
        }
      });

      // Generate insights
      const insights: string[] = [];
      
      if (lowestER < Infinity) {
        insights.push(`${highlights.lowestExpenseRatio} has the lowest expense ratio at ${lowestER.toFixed(2)}%`);
      }
      
      if (highestAUM > 0) {
        const aumInBillions = (highestAUM / 1e9).toFixed(1);
        insights.push(`${highlights.highestAUM} is the largest with $${aumInBillions}B in assets`);
      }

      return {
        etfs,
        highlights,
        insights,
        asOfDate: new Date().toISOString().split('T')[0],
      };
    } catch (error) {
      console.error('Comparison service error:', error);
      throw error;
    }
  },

  calculateExpenseImpact(
    initialInvestment: number,
    expenseRatio1: number,
    expenseRatio2: number,
    years: number
  ) {
    const annualReturn = 0.10; // 10% assumed return
    
    const fund1 = initialInvestment * Math.pow(1 + annualReturn - expenseRatio1, years);
    const fund2 = initialInvestment * Math.pow(1 + annualReturn - expenseRatio2, years);
    
    return {
      fund1Value: fund1,
      fund2Value: fund2,
      difference: Math.abs(fund1 - fund2),
      betterOption: fund1 > fund2 ? 'fund1' : 'fund2',
    };
  },
};
```

---

## ✅ Fix 4: Test Backend Responses

After updating the services, test each endpoint:

```cmd
# Test rankings
curl http://localhost:3001/api/rankings/top10

# Test comparison
curl -X POST http://localhost:3001/api/etf/compare -H "Content-Type: application/json" -d "{\"tickers\":[\"SPY\",\"VOO\"]}"

# Test AI screener
curl -X POST http://localhost:3001/api/ai-screener -H "Content-Type: application/json" -d "{\"query\":\"tech\",\"limit\":5}"
```

**Each should return valid JSON with data.**

---

## ✅ Fix 5: Check Frontend API URLs

Make sure frontend is calling the right URLs.

**Check** `apps\web\src\app\page.tsx` (Dashboard):

Look for:
```typescript
const response = await fetch('http://localhost:3001/api/rankings/top10');
```

Should be port **3001**, not 3000.

---

## ✅ Fix 6: Add Error Logging

To debug better, add console.log in frontend.

**In** `apps\web\src\app\page.tsx`, find the fetch call and add:

```typescript
try {
  const response = await fetch('http://localhost:3001/api/rankings/top10');
  console.log('Rankings response status:', response.status);
  
  const data = await response.json();
  console.log('Rankings data:', data);
  
  // ... rest of code
} catch (error) {
  console.error('Rankings fetch error:', error);
}
```

---

## 🔍 Diagnostic Steps

### Step 1: Check what backend is actually returning

```cmd
curl http://localhost:3001/api/rankings/top10 > rankings-response.json
notepad rankings-response.json
```

Share the output - is it valid JSON?

### Step 2: Check browser console

1. Open http://localhost:3000 (Dashboard)
2. Press F12 → Console tab
3. Look for error messages
4. Share the **exact error** you see

### Step 3: Check Network tab

1. F12 → Network tab
2. Refresh page
3. Click on the `top10` request
4. Check:
   - Status code (should be 200)
   - Response tab (should show JSON)
   - If 404 or 500, share the error

---

## 💡 Most Likely Issues

1. **Wrong port**: Frontend calling 3000 instead of 3001
2. **Data format mismatch**: Backend returning `{ rankings: {...}}` but frontend expects `{...}` directly
3. **Null values**: Database has null fields that frontend doesn't handle
4. **CORS**: Backend not allowing frontend requests

---

## 🚀 Quick Fix Commands

```cmd
cd apps\api

# Make sure latest code is running
npm run dev

# In browser console (F12), run:
fetch('http://localhost:3001/api/rankings/top10').then(r => r.json()).then(console.log)
```

This will show you **exactly** what the API returns.

**Share that output** and I'll give you the exact fix!

---

**Next**: Run the diagnostic steps above and share:
1. Output of `curl http://localhost:3001/api/rankings/top10`
2. Browser console error messages
3. Network tab status code
