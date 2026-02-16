# Fix: Pagination Shows "Page 1 of 1" Despite 5016 ETFs

## 🐛 Problem

ETF Screener shows:
- "Showing 1 - 20 of 20 ETFs (filtered from 5016 total)"
- "Page 1 of 1"

**Should show**: "Page 1 of 251" (5016 ÷ 20 = 250.8 pages)

---

## 🔍 Diagnose Backend Response

Test what the backend actually returns:

```cmd
curl http://localhost:3001/api/etfs
```

**Check the response** - it should have:
```json
{
  "data": [...20 ETFs...],
  "page": 1,
  "pageSize": 20,
  "total": 5016,
  "totalPages": 251
}
```

**If `totalPages` is wrong or missing**, the backend needs fixing.

**If `totalPages` is correct**, it's a frontend issue.

---

## ✅ Fix 1: Backend - Ensure Correct totalPages

### Update the `/api/etfs` route in `apps\api\src\routes\etfs.ts`:

**Find this section**:
```typescript
const [etfs, total] = await Promise.all([
  prisma.etf.findMany({
    where,
    skip: (Number(page) - 1) * Number(pageSize),
    take: Number(pageSize),
    orderBy: { aum: 'desc' },
  }),
  prisma.etf.count({ where }),
]);

return {
  data: etfs,
  page: Number(page),
  pageSize: Number(pageSize),
  total,
  totalPages: Math.ceil(total / Number(pageSize)),
};
```

**Make sure**:
- `total` comes from `prisma.etf.count({ where })`
- `totalPages` is calculated as `Math.ceil(total / Number(pageSize))`

This should already be correct in the file I provided.

---

## ✅ Fix 2: Frontend - Check Pagination Component

The frontend might be using the wrong field for total count.

### Common Frontend Issues:

**Issue A**: Frontend reads `data.length` instead of `total`
```typescript
// WRONG
const totalPages = Math.ceil(data.data.length / pageSize);  // Always 20 / 20 = 1

// CORRECT
const totalPages = data.totalPages;  // From backend
// OR
const totalPages = Math.ceil(data.total / pageSize);  // Calculate from total
```

**Issue B**: Frontend doesn't handle filtered count correctly
```typescript
// The backend returns both:
// - total: 20 (filtered results matching current filters)
// - But we need the TOTAL count without filters!
```

---

## 🎯 Likely Issue: Backend Only Counting Filtered Results

Looking at your message: "Showing 1 - 20 of 20 ETFs (filtered from 5016 total)"

This suggests the backend is returning:
```json
{
  "total": 20,  // Wrong - this is filtered count
  "totalPages": 1
}
```

But it should return:
```json
{
  "total": 5016,  // Total matching the filters
  "totalPages": 251
}
```

---

## ✅ Fix: Update Backend to Count All Matching Results

### The issue is in the `where` clause

**In `apps\api\src\routes\etfs.ts`**, the route does:

```typescript
const [etfs, total] = await Promise.all([
  prisma.etf.findMany({
    where,  // ← This applies filters
    skip: ...,
    take: 20,  // ← Only gets 20 records
  }),
  prisma.etf.count({ where }),  // ← This counts ALL matching the filters
]);
```

**The `count` should be correct.** So the issue is likely that:
- No filters are applied initially
- So it counts all 5016 ETFs
- But only returns 20

Let me check the exact response:

---

## 🧪 Test Backend Response

```cmd
curl "http://localhost:3001/api/etfs?page=1&pageSize=20"
```

**Look for these fields**:
```json
{
  "data": [...],  // Should have 20 items
  "page": 1,
  "pageSize": 20,
  "total": ???,  // What does this say?
  "totalPages": ???  // What does this say?
}
```

**Share this output** and I'll tell you the exact issue!

---

## 💡 Most Likely Fix

The route is probably returning `total: etfs.length` instead of `total` from the count.

**Check your route has**:
```typescript
const [etfs, total] = await Promise.all([
  prisma.etf.findMany({ ... }),
  prisma.etf.count({ where }),  // ← Make sure this line exists
]);

return {
  data: etfs,
  total,  // ← Not etfs.length
  totalPages: Math.ceil(total / Number(pageSize)),
};
```

---

## 🎯 Quick Fix: Verify Route Code

**Open**: `apps\api\src\routes\etfs.ts`

**Find the `/etfs` route** (should be around line 7-70)

**Make sure it looks EXACTLY like this**:

```typescript
fastify.get('/etfs', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as any;
    const { 
      search, 
      assetClass, 
      page = 1, 
      pageSize = 20,
    } = query;

    const where: any = {};

    if (search) {
      where.OR = [
        { ticker: { contains: search.toUpperCase() } },
        { name: { contains: search } },
      ];
    }

    if (assetClass && assetClass !== 'All Asset Classes') {
      where.assetClass = assetClass;
    }

    // Count ALL matching results (not just the 20 returned)
    const [etfs, total] = await Promise.all([
      prisma.etf.findMany({
        where,
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: { aum: 'desc' },
        select: {
          ticker: true,
          name: true,
          assetClass: true,
          strategyType: true,
          aum: true,
          netExpenseRatio: true,
        },
      }),
      prisma.etf.count({ where }),  // ← CRITICAL: This counts ALL
    ]);

    console.log(`Returning ${etfs.length} ETFs out of ${total} total`);

    return {
      data: etfs,
      page: Number(page),
      pageSize: Number(pageSize),
      total,  // ← This should be 5016
      totalPages: Math.ceil(total / Number(pageSize)),  // ← This should be 251
    };
  } catch (error: any) {
    fastify.log.error('ETF list error:', error);
    reply.status(500).send({ error: error.message });
  }
});
```

**The key lines**:
- Line with `prisma.etf.count({ where })` - Makes sure it counts ALL matching ETFs
- `total` in the return - Uses the count, not `etfs.length`
- `totalPages: Math.ceil(total / Number(pageSize))` - Calculates pages from total count

---

## 📝 After Fixing

1. **Restart API**:
   ```cmd
   cd apps\api
   npm run dev
   ```

2. **Test**:
   ```cmd
   curl "http://localhost:3001/api/etfs?page=1&pageSize=20"
   ```
   
   Should show:
   ```json
   {
     "total": 5016,
     "totalPages": 251
   }
   ```

3. **Refresh browser** - should show "Page 1 of 251"

---

**Run the curl command and share the output** - I'll tell you exactly what to fix!
