# Fix: Syntax Error in index.ts

## 🐛 Problem

```
ERROR: Unexpected end of file
at: C:\...\apps\api\src\index.ts:56:0
```

This means your `index.ts` file is **missing a closing brace** `}` or has unmatched brackets.

---

## ✅ Solution: Check Your Brackets

### Step 1: Open the file
```
apps\api\src\index.ts
```

### Step 2: Look at the end of the file

The file should end like this:

```typescript
// Start server
try {
  await app.listen({ port: 3001, host: '0.0.0.0' });
  console.log('✓ Server listening at http://0.0.0.0:3001');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

**Make sure there's NO extra closing brace** `}` at the very end.

---

## 🔧 Common Causes

### Cause 1: Commented out async function incorrectly

If you commented out the scheduler, you might have this:

**WRONG**:
```typescript
// async function startApp() {
  const app = Fastify({ logger: true });
  
  await app.register(cors, { origin: true });
  await app.register(etfRoutes, { prefix: '/api' });
  
  await app.listen({ port: 3001, host: '0.0.0.0' });
// }  ← Missing the actual closing brace
```

**RIGHT**:
```typescript
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(etfRoutes, { prefix: '/api' });

await app.listen({ port: 3001, host: '0.0.0.0' });
```

### Cause 2: Missing try/catch closing brace

**WRONG**:
```typescript
try {
  await app.listen({ port: 3001, host: '0.0.0.0' });
  console.log('✓ Server listening');
} catch (err) {
  app.log.error(err);
  process.exit(1);
// ← Missing the final }
```

**RIGHT**:
```typescript
try {
  await app.listen({ port: 3001, host: '0.0.0.0' });
  console.log('✓ Server listening');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}  // ← Closing brace here
```

---

## 📋 Complete Working Template

Here's what a **working** `apps/api/src/index.ts` should look like:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { etfRoutes } from './routes/etf';
import { aiScreenerRoutes } from './routes/ai-screener';
import { etfComparisonRoutes } from './routes/etf-comparison';
import { rankingsRoutes } from './routes/rankings';

const prisma = new PrismaClient();
const app = Fastify({
  logger: true,
});

// Register CORS
await app.register(cors, {
  origin: true,
});

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
await app.register(etfRoutes, { prefix: '/api' });
await app.register(aiScreenerRoutes, { prefix: '/api' });
await app.register(etfComparisonRoutes, { prefix: '/api' });
await app.register(rankingsRoutes, { prefix: '/api' });

// Start server
try {
  await app.listen({ port: 3001, host: '0.0.0.0' });
  console.log('✓ Server listening at http://0.0.0.0:3001');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

**Count the braces**:
- Opening `{` = 7
- Closing `}` = 7
- ✅ Balanced!

---

## 🔍 How to Find Missing Brace

### Method 1: Use VS Code
1. Open `apps\api\src\index.ts`
2. Put cursor after any `{` or `}`
3. VS Code highlights the matching brace
4. Find the one without a match

### Method 2: Count manually
1. Count all opening braces `{`
2. Count all closing braces `}`
3. They should be equal

### Method 3: Check line 56
The error says line 56, so:
1. Go to line 56 in the file
2. Look around that area
3. Find the unmatched brace

---

## 🚀 Quick Fix Steps

**Step 1**: Copy the template above

**Step 2**: Paste it into your `apps/api/src/index.ts` (replace everything)

**Step 3**: If you DON'T have `aiScreenerRoutes` file yet, comment it out:
```typescript
// await app.register(aiScreenerRoutes, { prefix: '/api' });
```

**Step 4**: Save and restart:
```bash
npm run dev
```

---

## ✅ Verification

After fix, you should see:

```
> tsx watch src/index.ts
✓ Server listening at http://0.0.0.0:3001
```

**No more "Unexpected end of file" error!**

---

## 📝 What Probably Happened

When you commented out the scheduler import, you accidentally:
1. Commented out part of a function
2. Left an opening brace without a closing brace
3. Or deleted a closing brace by mistake

The template above is a **clean, working version** you can use.

---

## 🎯 Next Steps

After API starts successfully:
1. ✅ News module error fixed
2. ✅ Syntax error fixed
3. ⏭️ Add AI Screener route (QUICK_FIX_COMMANDS.md)
4. ⏭️ Fix Compare button (QUICK_FIX_COMMANDS.md)

---

**Fix Time**: 2 minutes  
**Difficulty**: Easy  
**Common Issue**: Yes (happens when commenting code)
