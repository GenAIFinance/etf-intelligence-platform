# Fix All Missing Routes - Simple Instructions

## 🐛 Problem

Frontend is calling these URLs that don't exist:
- ❌ `/api/etfs/VOO/themes-exposure` (you have `/themes`)
- ❌ `/api/etfs/VOO/metrics`
- ❌ `/api/etfs/VOO/prices`
- ❌ `/api/impact/etf/VOO`

## ✅ Solution

**Replace** `apps\api\src\routes\etfs.ts` with **etfs-routes-COMPLETE.ts**

This adds all missing routes:
- ✅ `/api/etfs/:ticker/themes-exposure` (what frontend calls)
- ✅ `/api/etfs/:ticker/metrics` (stub - returns empty)
- ✅ `/api/etfs/:ticker/prices` (returns price data if exists)
- ✅ `/api/impact/etf/:ticker` (stub - returns empty)

## 🚀 Steps

1. **Replace** `apps\api\src\routes\etfs.ts` with the complete file
2. **Restart** API:
   ```cmd
   cd apps\api
   npm run dev
   ```
3. **Refresh** browser on ETF detail page
4. **Check** Themes tab - should load now!

## 🧪 Test

```cmd
# Test all endpoints
curl http://localhost:3001/api/etfs/VOO/themes-exposure
curl http://localhost:3001/api/etfs/VOO/metrics
curl http://localhost:3001/api/etfs/VOO/prices?range=1y&interval=1d
curl http://localhost:3001/api/impact/etf/VOO
```

All should return JSON (not 404)!

## ✅ After This Fix

- ✅ Themes tab will load
- ✅ Performance tab will load (even if empty)
- ✅ No more 404 errors in console

---

**Total time**: 2 minutes
**Result**: All tabs on ETF detail page work! 🎉
