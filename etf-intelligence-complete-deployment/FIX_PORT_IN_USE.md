# Fix: Port 3001 Already In Use

## ✅ Good News

Your code is actually **working**! The error means:
- ✅ No syntax errors
- ✅ No import errors
- ✅ Code is trying to start the server
- ❌ But port 3001 is already occupied

---

## 🔧 Quick Fix: Kill the Process Using Port 3001

### Windows PowerShell (Run as Administrator)

```powershell
# Step 1: Find what's using port 3001
netstat -ano | findstr :3001
```

**You'll see something like**:
```
TCP    0.0.0.0:3001      0.0.0.0:0         LISTENING       12345
```

The number at the end (e.g., `12345`) is the **Process ID (PID)**.

```powershell
# Step 2: Kill that process (replace 12345 with your PID)
taskkill /PID 12345 /F
```

**Expected output**:
```
SUCCESS: The process with PID 12345 has been terminated.
```

```powershell
# Step 3: Verify port is free
netstat -ano | findstr :3001
```

**Should return nothing** (empty).

---

## 🚀 Now Restart Your API

```bash
cd apps/api
npm run dev
```

**Expected output**:
```
✅ Server listening at http://0.0.0.0:3001
✅ Health check: http://localhost:3001/health
```

---

## 🎯 Alternative: Use a Different Port (If Above Doesn't Work)

If you can't kill the process, just use a different port:

### Edit `apps/api/src/index.ts`

**Change this line**:
```typescript
await app.listen({ port: 3001, host: '0.0.0.0' });
```

**To**:
```typescript
await app.listen({ port: 3002, host: '0.0.0.0' });  // Changed to 3002
```

**Then also update your frontend** to point to the new port:

Check these files for `localhost:3001` and change to `localhost:3002`:
- `apps/web/src/app/ai-screener/page.tsx`
- `apps/web/src/app/compare/page.tsx`
- Any `.env` files

---

## 📋 Complete Step-by-Step Fix

### Option A: Kill Process (Recommended)

```powershell
# 1. Find PID
netstat -ano | findstr :3001

# 2. Kill it (replace XXXXX with actual PID from step 1)
taskkill /PID XXXXX /F

# 3. Start API
cd "C:\Users\cathe\OneDrive\文档\Risk\Project folder\ETF Intelligence\apps\api"
npm run dev
```

### Option B: Change Port

```typescript
// In apps/api/src/index.ts, change port to 3002:
await app.listen({ port: 3002, host: '0.0.0.0' });
```

Then restart:
```bash
npm run dev
```

---

## ✅ Verify It Works

After restarting, test:

```powershell
# If using port 3001 (original):
Invoke-RestMethod -Uri "http://localhost:3001/health"

# If using port 3002 (alternative):
Invoke-RestMethod -Uri "http://localhost:3002/health"
```

**Should return**:
```json
{
  "status": "ok",
  "timestamp": "2026-02-14T..."
}
```

---

## 🎉 Success!

Once you see the health check working, your API is running! 

**Next**: Follow the rest of COMPLETE_API_STARTUP_GUIDE.md to:
1. Copy route files
2. Copy service files
3. Enable routes
4. Test all endpoints

---

## 💡 Pro Tip: Always Close Properly

To avoid this in the future:
1. Stop API with **Ctrl+C** (don't just close the terminal)
2. Wait for "Server stopped" message
3. Then close terminal

If you just close the terminal window, the process keeps running in the background!

---

**This is not a code bug - your code is working!** Just need to free up the port.
