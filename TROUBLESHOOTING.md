# ETF Intelligence - Troubleshooting Guide

## 🔍 Common Issues & Solutions

---

## Installation Issues

### ❌ "npm install" fails

**Symptoms:**
```
npm ERR! code ENOENT
npm ERR! syscall open
```

**Solutions:**

1. **Check Node.js version:**
   ```bash
   node --version  # Should be 18.0.0 or higher
   npm --version   # Should be 9.0.0 or higher
   ```
   If outdated, download from https://nodejs.org/

2. **Clear npm cache:**
   ```bash
   npm cache clean --force
   rmdir /s /q node_modules
   del package-lock.json
   npm install
   ```

3. **Check disk space:**
   - Node modules require ~500MB
   - Ensure sufficient free space

4. **Run as Administrator (Windows):**
   - Right-click Command Prompt
   - Select "Run as administrator"
   - Retry `npm install`

---

### ❌ Workspace errors during install

**Symptoms:**
```
npm ERR! Could not resolve dependency
npm ERR! peer @etf-intelligence/shared@"*"
```

**Solution:**
```bash
# Install from root directory (not inside apps/ or packages/)
cd C:\Projects\etf-intelligence
npm install
```

---

## Database Issues

### ❌ "Prisma Client not generated"

**Symptoms:**
```
Error: @prisma/client did not initialize yet
```

**Solution:**
```bash
npm run db:generate -w apps/api
```

---

### ❌ Database migration fails

**Symptoms:**
```
Migration failed
Error: P1003: Database does not exist
```

**Solutions:**

1. **Ensure DATABASE_URL is correct in `.env`:**
   ```env
   DATABASE_URL="file:./dev.db"
   ```

2. **Check .env file location:**
   - Must exist in: `apps/api/.env`
   - Should match root `.env`

3. **Delete and recreate database:**
   ```bash
   del apps\api\dev.db
   npm run db:migrate -w apps/api
   npm run db:seed -w apps/api
   ```

---

### ❌ "Database is locked"

**Symptoms:**
```
Error: SQLITE_BUSY: database is locked
```

**Solutions:**

1. **Close Prisma Studio:**
   - Close browser tab at http://localhost:5555
   - Press Ctrl+C in terminal running db:studio

2. **Close all API instances:**
   ```bash
   # Find and kill Node processes
   tasklist | findstr node
   taskkill /F /IM node.exe
   ```

3. **Delete lock file:**
   ```bash
   del apps\api\dev.db-journal
   ```

4. **Restart database:**
   ```bash
   npm run dev:api
   ```

---

### ❌ Seed data not loading

**Symptoms:**
- Web app shows "No ETFs found"
- Empty database

**Solution:**
```bash
# Re-run seed
npm run db:seed -w apps/api

# Verify with Prisma Studio
npm run db:studio -w apps/api
```

Check in Prisma Studio:
- Navigate to http://localhost:5555
- Open "ETF" table
- Should see ~50 ETFs (SPY, QQQ, VOO, etc.)

---

## Server Startup Issues

### ❌ Port already in use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solutions:**

1. **Change ports in `.env`:**
   ```env
   API_PORT=3002
   WEB_PORT=3005
   ```

2. **Kill process on port:**
   ```bash
   # Find process
   netstat -ano | findstr :3001
   
   # Kill process (replace PID)
   taskkill /F /PID <PID>
   ```

3. **Use different ports temporarily:**
   ```bash
   # Set environment variable
   set API_PORT=3002
   npm run dev:api
   ```

---

### ❌ API server won't start

**Symptoms:**
```
Error: Cannot find module '@etf-intelligence/shared'
```

**Solutions:**

1. **Build shared package first:**
   ```bash
   npm run build -w packages/shared
   ```

2. **Clean install:**
   ```bash
   rmdir /s /q node_modules
   del package-lock.json
   npm install
   npm run db:generate -w apps/api
   ```

---

### ❌ Web app won't connect to API

**Symptoms:**
- Web app loads but shows no data
- Network errors in browser console

**Solutions:**

1. **Verify API is running:**
   ```bash
   curl http://localhost:3001/api/etfs
   ```
   Or open http://localhost:3001/api/etfs in browser

2. **Check API URL in web app:**
   Create `apps/web/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

3. **Check CORS settings:**
   API should allow `localhost:3000` by default
   Verify in `apps/api/src/index.ts`

---

## API Key & Authentication Issues

### ❌ EODHD API errors

**Symptoms:**
```
Error: 401 Unauthorized
Error: Invalid API key
```

**Solutions:**

1. **Verify API key in `.env`:**
   ```env
   EODHD_API_KEY=your_actual_key_here
   ```

2. **Check key validity:**
   ```bash
   curl "https://eodhd.com/api/exchange-symbol-list/US?api_token=YOUR_KEY&fmt=json"
   ```

3. **Ensure .env is in correct location:**
   - Root directory: `.env`
   - API directory: `apps/api/.env`
   - Both should have same EODHD_API_KEY

4. **Restart API after changing .env:**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev:api
   ```

---

### ❌ Rate limit exceeded

**Symptoms:**
```
Error: 429 Too Many Requests
Error: API rate limit exceeded
```

**Solutions:**

1. **Free tier limits:**
   - 20 API calls per day
   - Cache helps minimize calls

2. **Check cache status:**
   ```bash
   # Open Prisma Studio
   npm run db:studio -w apps/api
   
   # Check cache_entries table
   # Look for recent entries
   ```

3. **Increase cache TTL in `.env`:**
   ```env
   CACHE_TTL_ETF_PROFILE=2592000  # 30 days
   CACHE_TTL_HOLDINGS=2592000     # 30 days
   CACHE_TTL_PRICES=604800        # 7 days
   ```

4. **Upgrade EODHD plan:**
   - https://eodhd.com/pricing
   - Higher tiers: 1000-100,000 calls/day

---

### ❌ LLM API not working

**Symptoms:**
- No AI-generated summaries
- "LLM unavailable" messages

**Solutions:**

1. **LLM is optional - check if enabled:**
   ```env
   LLM_API_KEY=sk-...  # Should be set
   ```

2. **Verify API key:**
   ```bash
   # For OpenAI
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_KEY"
   ```

3. **Check model name:**
   ```env
   # OpenAI
   LLM_MODEL=gpt-4o-mini
   
   # Anthropic
   LLM_MODEL=claude-3-5-sonnet-20241022
   
   # Groq
   LLM_MODEL=llama-3.1-70b-versatile
   ```

4. **Verify base URL:**
   ```env
   # OpenAI
   LLM_BASE_URL=https://api.openai.com/v1
   
   # Anthropic
   LLM_BASE_URL=https://api.anthropic.com/v1
   ```

5. **Test without LLM:**
   Remove or comment out LLM_API_KEY:
   ```env
   # LLM_API_KEY=
   ```
   App will use deterministic fallback summaries

---

## Frontend Issues

### ❌ Next.js build errors

**Symptoms:**
```
Error: Failed to compile
Module not found
```

**Solutions:**

1. **Clear Next.js cache:**
   ```bash
   cd apps\web
   rmdir /s /q .next
   npm run dev
   ```

2. **Reinstall dependencies:**
   ```bash
   cd apps\web
   rmdir /s /q node_modules
   npm install
   ```

---

### ❌ Styles not loading

**Symptoms:**
- No CSS styling
- Plain HTML layout

**Solutions:**

1. **Verify Tailwind config:**
   Check `apps/web/tailwind.config.js` exists

2. **Rebuild:**
   ```bash
   cd apps\web
   npm run build
   npm run dev
   ```

---

### ❌ Charts not rendering

**Symptoms:**
- Empty chart areas
- "No data available"

**Solutions:**

1. **Check API data:**
   ```bash
   curl http://localhost:3001/api/etfs/SPY/prices
   ```

2. **Verify date format:**
   - Charts expect YYYY-MM-DD format
   - Check browser console for errors

3. **Check Recharts library:**
   ```bash
   cd apps\web
   npm list recharts
   # Should show recharts installed
   ```

---

## Data & Cache Issues

### ❌ Stale data showing

**Symptoms:**
- Old prices displayed
- Outdated holdings

**Solutions:**

1. **Clear cache:**
   ```bash
   # Open Prisma Studio
   npm run db:studio -w apps/api
   
   # Delete all records in cache_entries table
   ```

2. **Reduce cache TTL in `.env`:**
   ```env
   CACHE_TTL_PRICES=3600  # 1 hour instead of 1 day
   ```

3. **Force refresh:**
   - Restart API server
   - Cache is in-memory, clears on restart

---

### ❌ Missing ETF data

**Symptoms:**
- "ETF not found" errors
- Incomplete profiles

**Solutions:**

1. **Check if ETF exists in seed:**
   ```bash
   npm run db:studio -w apps/api
   # Look for ticker in ETF table
   ```

2. **Verify EODHD data availability:**
   ```bash
   curl "https://eodhd.com/api/fundamentals/SPY.US?api_token=YOUR_KEY"
   ```

3. **Add ETF manually (if needed):**
   - Use Prisma Studio
   - Or trigger background job to sync

---

## Performance Issues

### ❌ Slow page loads

**Solutions:**

1. **Enable caching:**
   Verify cache TTLs in `.env` are set properly

2. **Reduce data fetching:**
   - Limit historical data range
   - Implement pagination

3. **Check API response times:**
   ```bash
   curl -w "@-" -o NUL -s "http://localhost:3001/api/etfs"
   # Look at total time
   ```

4. **Database optimization:**
   - Run `VACUUM` on SQLite
   - Add indexes if needed

---

### ❌ High memory usage

**Solutions:**

1. **Reduce cache size:**
   In `apps/api/src/services/cache.service.ts`:
   ```typescript
   max: 500  // Reduce from default
   ```

2. **Switch to PostgreSQL:**
   - Better for large datasets
   - Update DATABASE_URL in `.env`

---

## Background Jobs Issues

### ❌ Scheduled jobs not running

**Symptoms:**
- News not updating
- Prices not refreshing

**Solutions:**

1. **Verify jobs are enabled:**
   Check `apps/api/src/jobs/` directory

2. **Check cron schedule:**
   ```typescript
   // In jobs/*.job.ts
   schedule: '0 18 * * *'  // 6 PM daily
   ```

3. **Run manually:**
   ```typescript
   // Add to API route for testing
   await refreshPricesJob.execute();
   ```

4. **Check logs:**
   Jobs log to console when running
   Look for error messages

---

## Windows-Specific Issues

### ❌ Path too long errors

**Symptoms:**
```
Error: ENAMETOOLONG: name too long
```

**Solution:**
- Move project to shorter path
- Example: `C:\etf` instead of `C:\Users\YourName\Documents\Projects\etf-intelligence`

---

### ❌ Permission errors

**Symptoms:**
```
Error: EPERM: operation not permitted
```

**Solutions:**

1. **Run as Administrator:**
   - Right-click Command Prompt
   - Select "Run as administrator"

2. **Check antivirus:**
   - May block Node.js operations
   - Add exception for project folder

---

## Still Having Issues?

### Diagnostic Checklist

Run through this checklist:

```bash
# 1. Node.js version
node --version  # Should be 18+

# 2. Check .env files exist
dir .env
dir apps\api\.env

# 3. Check database exists
dir apps\api\dev.db

# 4. Test API key
curl "https://eodhd.com/api/exchange-symbol-list/US?api_token=YOUR_KEY&fmt=json"

# 5. Verify dependencies installed
dir node_modules

# 6. Check ports available
netstat -ano | findstr :3001
netstat -ano | findstr :3000

# 7. Test API endpoint
curl http://localhost:3001/api/etfs
```

---

### Complete Reset

When all else fails:

```bash
# 1. Stop all servers (Ctrl+C)

# 2. Delete everything
rmdir /s /q node_modules
rmdir /s /q apps\api\node_modules
rmdir /s /q apps\web\node_modules
rmdir /s /q packages\shared\node_modules
del package-lock.json
del apps\api\dev.db
rmdir /s /q apps\web\.next

# 3. Fresh install
npm install

# 4. Rebuild database
npm run db:generate -w apps/api
npm run db:migrate -w apps/api
npm run db:seed -w apps/api

# 5. Start fresh
npm run dev
```

---

### Get Help

1. **Check logs:**
   - Console output from API/web servers
   - Browser console (F12)

2. **Review documentation:**
   - `LOCAL_DEPLOYMENT_GUIDE.md`
   - `QUICK_REFERENCE.md`

3. **Check EODHD status:**
   - https://eodhd.com/status

4. **Prisma documentation:**
   - https://www.prisma.io/docs

---

### Debug Mode

Enable verbose logging:

1. **API debug mode:**
   ```env
   # Add to .env
   NODE_ENV=development
   LOG_LEVEL=debug
   ```

2. **Check browser console:**
   - Press F12
   - Go to Console tab
   - Look for error messages

3. **Network inspection:**
   - Press F12
   - Go to Network tab
   - Monitor API calls
   - Check status codes

---

**Remember:** The app is designed to work without LLM integration. If you're having LLM issues, simply remove the LLM_API_KEY and the app will use deterministic summaries instead.
