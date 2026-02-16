# Fix: ETF Screener "Failed to load ETFs"

## 🐛 Problem

The ETF Screener page at `/screener` is showing "Failed to load ETFs. Please try again."

This is different from the **AI Screener** (which works). This is the traditional **ETF Screener** with filters.

---

## 🔍 Diagnose

Test the backend:

```cmd
curl http://localhost:3001/api/etfs
```

**Expected**: JSON with list of ETFs

**Possible results**:

### A. Returns 404
```json
{"message":"Route GET:/api/etfs not found"}
```
→ Route doesn't exist, need to add it

### B. Returns error
```json
{"error":"..."}
```
→ Route exists but has an error

### C. Returns empty
```json
{"data":[],"total":0}
```
→ Route works but no ETFs in database

### D. Returns data
```json
{"data":[{...}],"total":5000}
```
→ Backend works, frontend issue

---

## ✅ Fix: Ensure ETF List Route Exists

The `/api/etfs` route should already be in your `etfs-routes-COMPLETE.ts` file.

### Check if you have this in `apps\api\src\routes\etfs.ts`:

```typescript
// GET /api/etfs - List/search ETFs
fastify.get('/etfs', async (request, reply) => {
  try {
    const query = request.query as any;
    const { search, assetClass, page = 1, pageSize = 20 } = query;

    const where: any = {};

    if (search) {
      where.OR = [
        { ticker: { contains: search.toUpperCase() } },
        { name: { contains: search } },
      ];
    }

    if (assetClass) {
      where.assetClass = assetClass;
    }

    const [etfs, total] = await Promise.all([
      prisma.etf.findMany({
        where,
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: { ticker: 'asc' },
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
  } catch (error: any) {
    reply.status(400).send({ error: error.message });
  }
});
```

---

## 🚀 If Route is Missing

### Add this route to `apps\api\src\routes\etfs.ts`:

```typescript
// GET /api/etfs - List/search ETFs with filters
fastify.get('/etfs', async (request, reply) => {
  try {
    const query = request.query as any;
    const { 
      search, 
      assetClass, 
      strategyType,
      page = 1, 
      pageSize = 20,
      minAum,
      maxAum,
      minExpenseRatio,
      maxExpenseRatio,
    } = query;

    const where: any = {};

    // Search by ticker or name
    if (search) {
      where.OR = [
        { ticker: { contains: search.toUpperCase() } },
        { name: { contains: search } },
      ];
    }

    // Filter by asset class
    if (assetClass && assetClass !== 'All Asset Classes') {
      where.assetClass = assetClass;
    }

    // Filter by strategy type
    if (strategyType) {
      where.strategyType = { contains: strategyType };
    }

    // Filter by AUM range
    if (minAum || maxAum) {
      where.aum = {};
      if (minAum) where.aum.gte = parseFloat(minAum);
      if (maxAum && maxAum !== 'Infinity') where.aum.lte = parseFloat(maxAum);
    }

    // Filter by expense ratio range
    if (minExpenseRatio || maxExpenseRatio) {
      where.netExpenseRatio = {};
      if (minExpenseRatio) where.netExpenseRatio.gte = parseFloat(minExpenseRatio);
      if (maxExpenseRatio) where.netExpenseRatio.lte = parseFloat(maxExpenseRatio);
    }

    const [etfs, total] = await Promise.all([
      prisma.etf.findMany({
        where,
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: { aum: 'desc' }, // Order by AUM (largest first)
        select: {
          ticker: true,
          name: true,
          assetClass: true,
          strategyType: true,
          aum: true,
          netExpenseRatio: true,
          inceptionDate: true,
        },
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
  } catch (error: any) {
    fastify.log.error('ETF list error:', error);
    reply.status(500).send({ error: error.message });
  }
});
```

---

## 🧪 Test the Route

```cmd
# Test basic list
curl http://localhost:3001/api/etfs

# Test with search
curl "http://localhost:3001/api/etfs?search=VOO"

# Test with filters
curl "http://localhost:3001/api/etfs?assetClass=Equity&page=1&pageSize=10"
```

**Expected**: JSON with ETF data

---

## 📋 Complete Steps

1. **Make sure** the `/api/etfs` route exists in `apps\api\src\routes\etfs.ts`
   - Use the code above if it's missing

2. **Restart** API:
   ```cmd
   cd apps\api
   npm run dev
   ```

3. **Test** backend:
   ```cmd
   curl http://localhost:3001/api/etfs
   ```

4. **Refresh** browser at http://localhost:3000/screener

5. **Should see** ETF list load!

---

## 🐛 If Still Not Working

### Check API console

When you load the screener page, does the API console show the request?

**Should see**:
```
GET /api/etfs?page=1&pageSize=20
```

### Check browser console (F12)

**Look for**:
- Network request to `/api/etfs`
- Status code (should be 200, not 404 or 500)
- Response data

### Common Issues:

**Issue 1**: Route exists but returns 500
→ Check API console for error details
→ Likely database/Prisma issue

**Issue 2**: Route returns empty array
→ Database has no ETFs
→ Need to sync ETF data first

**Issue 3**: Frontend calling wrong URL
→ Check Network tab - what URL does it call?

---

## 💡 Quick Test

In browser console (F12), run:

```javascript
fetch('http://localhost:3001/api/etfs')
  .then(r => r.json())
  .then(console.log)
```

**This will show** if the backend is working or not.

---

**Share the output** of `curl http://localhost:3001/api/etfs` and I'll help you fix it!
