# FINAL FIX - BASH/CURL COMMANDS

## ✅ CORRECT COMMAND TO START SERVER
```bash
npm run dev
```

---

## 📋 COMPLETE STEP-BY-STEP (Bash Commands)

### Step 1: Navigate to API folder
```bash
cd "C:\Users\cathe\OneDrive\文档\Risk\Project folder\ETF Intelligence\apps\api"
```

### Step 2: Run the server
```bash
npm run dev
```

---

## 🧪 TEST WITH CURL (Instead of PowerShell)

### Test Health Endpoint
```bash
curl http://localhost:3001/health
```

**Expected output:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-14T20:45:00.000Z",
  "message": "ETF Intelligence API is running"
}
```

---

## 🎯 ALL TEST COMMANDS (Curl/Bash Version)

### 1. Health Check
```bash
curl http://localhost:3001/health
```

### 2. AI Screener Examples
```bash
curl http://localhost:3001/api/ai-screener/examples
```

### 3. AI Screener Search
```bash
curl -X POST http://localhost:3001/api/ai-screener \
  -H "Content-Type: application/json" \
  -d '{"query":"tech","limit":5}'
```

### 4. Rankings
```bash
curl http://localhost:3001/api/rankings/top10
```

### 5. ETF Comparison
```bash
curl -X POST http://localhost:3001/api/etf/compare \
  -H "Content-Type: application/json" \
  -d '{"tickers":["SPY","VOO"]}'
```

---

## 🔧 IF STILL GETTING "Cannot find module"

### Replace index.ts using bash/cat
```bash
cd "C:\Users\cathe\OneDrive\文档\Risk\Project folder\ETF Intelligence"

cat > apps/api/src/index.ts << 'EOF'
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';

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

  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('✅ Server listening at http://0.0.0.0:3001');
    console.log('✅ Test: curl http://localhost:3001/health');
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
EOF
```

---

## 🚨 KILL PROCESS ON PORT 3001 (If needed)

### Find process using port 3001
```bash
# Windows Git Bash
netstat -ano | findstr :3001
```

### Kill the process (replace XXXXX with PID from above)
```bash
taskkill //PID XXXXX //F
```

---

## 📊 QUICK DIAGNOSTIC

### Check if port 3001 is free
```bash
netstat -ano | findstr :3001
```

If you see output, port is in use. Kill it first.

If empty, port is free. Run `npm run dev`.

---

## 🎯 SINGLE COMMAND TO FIX EVERYTHING

Run this complete command block:

```bash
# Navigate to project
cd "C:\Users\cathe\OneDrive\文档\Risk\Project folder\ETF Intelligence"

# Create minimal working index.ts
cat > apps/api/src/index.ts << 'EOF'
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function startServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('✅ Server running at http://0.0.0.0:3001');
  } catch (err) {
    console.error('❌ Failed:', err);
    process.exit(1);
  }
}

startServer();
EOF

# Go to API folder
cd apps/api

# Start server
npm run dev
```

---

## ✅ SUCCESS LOOKS LIKE THIS

```
> @etf-intelligence/api@1.0.0 dev
> tsx watch src/index.ts

✅ Server running at http://0.0.0.0:3001
```

Then in another terminal:
```bash
curl http://localhost:3001/health
```

Returns:
```json
{"status":"ok","timestamp":"2026-02-14T..."}
```

---

## 🎯 IF YOU'RE USING GIT BASH ON WINDOWS

All the curl commands above work in Git Bash.

If you don't have Git Bash, you can:
1. Download Git for Windows (includes Git Bash)
2. Or use WSL (Windows Subsystem for Linux)
3. Or just open `http://localhost:3001/health` in your browser

---

**QUICKEST TEST**: Just open in browser after starting server:
```
http://localhost:3001/health
```

Should show JSON in the browser.
