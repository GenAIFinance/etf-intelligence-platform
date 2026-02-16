# Fix: Cannot find module '../services/news'

## 🐛 Problem

Your API server won't start because `scheduler.ts` is trying to import a news service that was deleted during Phase 1 redesign.

**Error**:
```
Error: Cannot find module '../services/news'
Require stack:
- apps\api\src\jobs\scheduler.ts
- apps\api\src\index.ts
```

---

## ✅ Solution: Remove News Job from Scheduler

**File to Edit**: `apps\api\src\jobs\scheduler.ts`

### Step 1: Open the file

```bash
# File path:
apps\api\src\jobs\scheduler.ts
```

### Step 2: Find and remove the news import

**Remove this line** (probably near the top):
```typescript
import { newsService } from '../services/news';  // ← DELETE THIS LINE
```

Or it might look like:
```typescript
import { updateNews } from '../services/news';  // ← DELETE THIS LINE
```

### Step 3: Find and remove the news job

**Look for** something like this:
```typescript
// Update news every hour
cron.schedule('0 * * * *', async () => {
  await newsService.updateNews();  // or updateNews()
});
```

Or:
```typescript
schedule.scheduleJob('0 * * * *', async () => {
  await newsService.updateNews();
});
```

**Delete the entire block** that mentions news.

---

## 🔧 Complete Fixed Example

If your `scheduler.ts` looks like this:

**BEFORE** (broken):
```typescript
import cron from 'node-cron';
import { newsService } from '../services/news';  // ← PROBLEM
import { etfService } from '../services/etf';

export function startScheduler() {
  // Update news every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Updating news...');
    await newsService.updateNews();  // ← PROBLEM
  });

  // Update ETF data daily
  cron.schedule('0 0 * * *', async () => {
    console.log('Syncing ETF data...');
    await etfService.syncAll();
  });
}
```

**AFTER** (fixed):
```typescript
import cron from 'node-cron';
import { etfService } from '../services/etf';

export function startScheduler() {
  // Update ETF data daily
  cron.schedule('0 0 * * *', async () => {
    console.log('Syncing ETF data...');
    await etfService.syncAll();
  });
}
```

---

## 🚀 Restart API Server

After making changes:

```bash
# Stop the API server (Ctrl+C)
# Then restart:
cd apps/api
npm run dev
```

**Expected output**:
```
✓ Server listening at http://0.0.0.0:3001
```

No more "Cannot find module" error!

---

## 📋 Alternative: Disable Scheduler Completely (Temporary)

If you can't find where to remove the news import, you can temporarily disable the scheduler:

**File**: `apps\api\src\index.ts`

**Find**:
```typescript
import { startScheduler } from './jobs/scheduler';
```

**Comment it out**:
```typescript
// import { startScheduler } from './jobs/scheduler';  // Disabled temporarily
```

**Find**:
```typescript
startScheduler();
```

**Comment it out**:
```typescript
// startScheduler();  // Disabled temporarily
```

Save and restart. The API will run without scheduled jobs.

---

## 🔍 How to Find the Problem Lines

### Method 1: Search for "news"
1. Open `apps\api\src\jobs\scheduler.ts`
2. Press Ctrl+F (Find)
3. Search for: `news`
4. Delete any lines that mention news

### Method 2: Look at the imports
At the top of `scheduler.ts`, you'll see imports like:
```typescript
import { something } from '../services/news';
```
Delete the entire line.

### Method 3: Check the full file
If the file is small, just look at it and remove:
- Any `import` mentioning `news`
- Any `cron.schedule()` or `schedule.scheduleJob()` block that calls news functions

---

## ✅ Verification

After fix, test:

1. **API starts without error**:
```bash
cd apps/api
npm run dev
```
Should see: `✓ Server listening at http://0.0.0.0:3001`

2. **No MODULE_NOT_FOUND error**

3. **API responds**:
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/health"
```
Should return: `{ status: 'ok', timestamp: '...' }`

---

## 💡 Why This Happened

During **Phase 1 redesign**, you:
- ✅ Removed news from frontend (dashboard)
- ✅ Removed news service files
- ❌ **Forgot to remove news from scheduler**

The scheduler still tries to run news updates even though the service is gone.

---

## 🎯 Next Steps After This Fix

Once API starts successfully:
1. Continue with **AI Screener fix** (QUICK_FIX_COMMANDS.md)
2. Then **Compare button fix**
3. Test all features

---

**Fix Time**: 2 minutes  
**Difficulty**: Easy  
**Impact**: Unblocks API server startup
