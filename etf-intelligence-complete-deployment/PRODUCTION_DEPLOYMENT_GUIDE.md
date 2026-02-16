# 🚀 ETF Intelligence Platform - Production Deployment Guide

## 📋 DEPLOYMENT PROMPT FOR CLAUDE

Use this prompt when starting a new session to deploy the ETF Intelligence platform to production:

---

### 🎯 DEPLOYMENT PROMPT

```
I need to deploy the ETF Intelligence platform to production so users can browse and use it on a live website.

CURRENT STATE:
- Platform works perfectly on localhost (frontend: 3000, backend: 3001)
- Database: SQLite with 5016 ETFs
- Tech stack: Next.js 14 + Fastify + Prisma
- All features tested and working locally

DEPLOYMENT GOALS:
1. Deploy frontend to Vercel (or similar hosting)
2. Deploy backend API to a cloud service (Railway, Render, Fly.io, or AWS)
3. Migrate SQLite database to PostgreSQL for production
4. Configure environment variables
5. Set up custom domain (optional)
6. Enable HTTPS/SSL
7. Set up CI/CD pipeline

FEATURES TO DEPLOY:
✅ Dashboard with ETF rankings
✅ ETF Screener (search, filter, pagination)
✅ AI Screener (natural language search)
✅ ETF Detail pages (overview, holdings, themes, sectors)
✅ Compare Tool

CONSTRAINTS:
- Budget-friendly (prefer free tiers or low-cost options)
- Easy to maintain and update
- Good performance (fast page loads)
- Scalable for growth

QUESTIONS TO ADDRESS:
1. Best hosting platform for Next.js frontend?
2. Best hosting for Fastify backend API?
3. How to migrate SQLite → PostgreSQL?
4. How to handle environment variables?
5. How to set up CORS for production?
6. How to optimize for production (caching, compression, etc.)?
7. How to monitor and debug production issues?

DELIVERABLES NEEDED:
- Step-by-step deployment guide
- Configuration files (vercel.json, railway.json, etc.)
- Environment variable templates
- Database migration scripts
- Production-ready build commands
- Post-deployment testing checklist
- Monitoring and maintenance guide

Please provide a comprehensive deployment plan with:
- Recommended hosting platforms (with pros/cons)
- Detailed deployment steps for each component
- All necessary configuration files
- Scripts for automation
- Cost estimates
- Performance optimization tips
- Security best practices
```

---

## 🏗️ RECOMMENDED DEPLOYMENT ARCHITECTURE

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    PRODUCTION STACK                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Frontend (Vercel)                                       │
│  ├── Next.js 14 App                                      │
│  ├── Static Assets (Images, CSS)                         │
│  └── Edge Functions                                      │
│                                                          │
│  Backend API (Railway/Render)                            │
│  ├── Fastify Server                                      │
│  ├── API Routes                                          │
│  └── Business Logic                                      │
│                                                          │
│  Database (Railway PostgreSQL / Supabase)                │
│  ├── PostgreSQL 15+                                      │
│  ├── 5016 ETF Records                                    │
│  └── Holdings, Themes, Sectors                           │
│                                                          │
│  CDN (Cloudflare)                                        │
│  └── Static Asset Caching                                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 💰 HOSTING OPTIONS COMPARISON

### Option 1: Budget-Friendly (FREE/$5/month) ⭐ RECOMMENDED

**Frontend**: Vercel (Free)
- ✅ FREE for hobby projects
- ✅ Automatic deployments from GitHub
- ✅ Global CDN
- ✅ HTTPS included
- ✅ Custom domain support
- ❌ 100GB bandwidth/month limit (usually sufficient)

**Backend**: Railway (Free → $5/month)
- ✅ $5 free credits/month
- ✅ PostgreSQL included
- ✅ Auto-deploy from GitHub
- ✅ Easy environment variables
- ⚠️ ~500MB database (enough for ETFs)

**Cost**: FREE for testing, $5/month for production

---

### Option 2: Scalable ($10-20/month)

**Frontend**: Vercel (Pro $20/month)
- Unlimited bandwidth
- Better analytics
- Team features

**Backend**: Render ($7/month)
- 512MB RAM
- PostgreSQL included ($7/month)
- Auto-scaling

**Database**: Supabase (Free → $25/month)
- 500MB free tier
- Built-in auth
- Real-time features

**Cost**: $7-14/month (Render) or $25+/month (full stack)

---

### Option 3: Enterprise-Grade ($50+/month)

**Frontend**: Vercel Pro
**Backend**: AWS ECS/Fargate
**Database**: AWS RDS PostgreSQL
**CDN**: CloudFront

**Cost**: $50-200+/month

---

## 🎯 RECOMMENDED DEPLOYMENT PLAN (Budget Option)

### Phase 1: Pre-Deployment Preparation

**1.1 - Create GitHub Repository**
```bash
# Initialize git (if not already done)
cd "C:\Users\cathe\OneDrive\文档\Risk\Project folder\ETF Intelligence"
git init
git add .
git commit -m "Initial commit - ETF Intelligence Platform"

# Create GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/etf-intelligence.git
git branch -M main
git push -u origin main
```

**1.2 - Update Package.json**
```json
{
  "name": "etf-intelligence",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:web": "cd apps/web && npm run dev",
    "dev:api": "cd apps/api && npm run dev",
    "build:web": "cd apps/web && npm run build",
    "build:api": "cd apps/api && npm run build",
    "start:web": "cd apps/web && npm start",
    "start:api": "cd apps/api && npm start"
  }
}
```

**1.3 - Environment Variables Setup**

Create `.env.example` files:

**apps/web/.env.example**:
```
NEXT_PUBLIC_API_URL=https://your-api.railway.app
NEXT_PUBLIC_SITE_URL=https://etf-intelligence.vercel.app
```

**apps/api/.env.example**:
```
DATABASE_URL=postgresql://user:password@host:5432/dbname
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=https://etf-intelligence.vercel.app
```

---

### Phase 2: Database Migration (SQLite → PostgreSQL)

**2.1 - Update Prisma Schema**

**File**: `apps/api/prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"  // Changed from sqlite
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Keep all your existing models unchanged
model Etf {
  id                Int      @id @default(autoincrement())
  ticker            String   @unique
  name              String
  // ... rest of your schema
}
```

**2.2 - Create Migration Script**

**File**: `apps/api/scripts/migrate-to-postgres.ts`

```typescript
import { PrismaClient as SQLiteClient } from '@prisma/client';
import { PrismaClient as PostgresClient } from '@prisma/client';

const sqlite = new SQLiteClient({
  datasources: {
    db: {
      url: 'file:./dev.db'
    }
  }
});

const postgres = new PostgresClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function migrate() {
  console.log('Starting migration...');
  
  // Migrate ETFs
  const etfs = await sqlite.etf.findMany({
    include: {
      holdings: true,
      sectorWeights: true,
      holdingClassifications: true,
    }
  });
  
  console.log(`Migrating ${etfs.length} ETFs...`);
  
  for (const etf of etfs) {
    const { holdings, sectorWeights, holdingClassifications, ...etfData } = etf;
    
    await postgres.etf.create({
      data: {
        ...etfData,
        holdings: {
          create: holdings
        },
        sectorWeights: {
          create: sectorWeights
        },
        holdingClassifications: {
          create: holdingClassifications
        }
      }
    });
  }
  
  console.log('Migration complete!');
}

migrate()
  .catch(console.error)
  .finally(() => {
    sqlite.$disconnect();
    postgres.$disconnect();
  });
```

**2.3 - Run Migration**

```bash
# Set PostgreSQL URL
export DATABASE_URL="postgresql://user:pass@host:5432/etf_intelligence"

# Generate Prisma client for PostgreSQL
cd apps/api
npx prisma generate

# Run migration script
npm run migrate
```

---

### Phase 3: Deploy Backend API (Railway)

**3.1 - Sign Up for Railway**
1. Go to https://railway.app
2. Sign up with GitHub
3. Create new project

**3.2 - Create PostgreSQL Database**
1. Click "New" → "Database" → "PostgreSQL"
2. Copy the DATABASE_URL

**3.3 - Deploy API Service**
1. Click "New" → "GitHub Repo"
2. Select your repository
3. Set root directory: `apps/api`
4. Add environment variables:
   ```
   DATABASE_URL=(from step 3.2)
   PORT=3001
   NODE_ENV=production
   ALLOWED_ORIGINS=https://etf-intelligence.vercel.app
   ```

**3.4 - Configure Build**

Create `apps/api/railway.json`:
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npx prisma generate && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**3.5 - Add Startup Script**

Update `apps/api/package.json`:
```json
{
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "postinstall": "prisma generate"
  }
}
```

**3.6 - Enable Public URL**
1. Click on API service
2. Settings → Generate Domain
3. Copy the URL (e.g., `etf-api.railway.app`)

---

### Phase 4: Deploy Frontend (Vercel)

**4.1 - Sign Up for Vercel**
1. Go to https://vercel.com
2. Sign up with GitHub

**4.2 - Import Project**
1. Click "New Project"
2. Import your GitHub repository
3. Set framework preset: "Next.js"
4. Set root directory: `apps/web`

**4.3 - Configure Environment Variables**
```
NEXT_PUBLIC_API_URL=https://etf-api.railway.app
NEXT_PUBLIC_SITE_URL=https://etf-intelligence.vercel.app
```

**4.4 - Configure Build**

Create `apps/web/vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=60, stale-while-revalidate"
        }
      ]
    }
  ]
}
```

**4.5 - Update API Calls**

Update all API calls to use environment variable:

```typescript
// Before
const response = await fetch('http://localhost:3001/api/etfs');

// After
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const response = await fetch(`${API_URL}/api/etfs`);
```

**4.6 - Deploy**
1. Click "Deploy"
2. Wait for build to complete
3. Copy the URL (e.g., `etf-intelligence.vercel.app`)

---

### Phase 5: Configure CORS

**File**: `apps/api/src/index.ts`

```typescript
import cors from '@fastify/cors';

async function startServer() {
  const app = Fastify({ logger: true });
  
  // CORS configuration for production
  await app.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'https://etf-intelligence.vercel.app',
      'http://localhost:3000'
    ],
    credentials: true
  });
  
  // ... rest of your server code
}
```

---

### Phase 6: Post-Deployment Testing

**6.1 - Functional Testing**
- [ ] Visit https://etf-intelligence.vercel.app
- [ ] Dashboard loads with rankings
- [ ] Click an ETF → Detail page loads
- [ ] ETF Screener shows pagination (Page 1 of 251)
- [ ] AI Screener works with natural language
- [ ] Compare tool loads

**6.2 - Performance Testing**
- [ ] Page load < 3 seconds
- [ ] API responses < 500ms
- [ ] No 404 errors in console
- [ ] Images load correctly

**6.3 - Mobile Testing**
- [ ] Test on mobile device
- [ ] Responsive design works
- [ ] Touch navigation works

---

## 🔧 PRODUCTION OPTIMIZATIONS

### 1. Frontend Optimizations

**Next.js Config** (`apps/web/next.config.js`):
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Image optimization
  images: {
    domains: ['etf-api.railway.app'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Compression
  compress: true,
  
  // Production-only features
  productionBrowserSourceMaps: false,
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  
  // Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          }
        ],
      },
    ]
  },
}

module.exports = nextConfig;
```

### 2. Backend Optimizations

**Add Compression** (`apps/api/src/index.ts`):
```typescript
import compress from '@fastify/compress';

await app.register(compress);
```

**Add Caching**:
```typescript
import cache from '@fastify/caching';

await app.register(cache, {
  privacy: 'public',
  expiresIn: 300 // 5 minutes
});
```

**Add Rate Limiting**:
```typescript
import rateLimit from '@fastify/rate-limit';

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
});
```

### 3. Database Optimizations

**Add Indexes** (`schema.prisma`):
```prisma
model Etf {
  ticker String @unique
  name   String
  aum    Float?
  
  @@index([ticker])
  @@index([aum])
  @@index([assetClass])
}
```

---

## 📊 MONITORING & ANALYTICS

### 1. Vercel Analytics
- Enable in Vercel dashboard
- Track page views, performance

### 2. Backend Monitoring
- Railway provides built-in metrics
- Set up alerts for downtime

### 3. Error Tracking
**Install Sentry**:
```bash
npm install @sentry/nextjs
npm install @sentry/node
```

---

## 💰 COST ESTIMATE

### Free Tier (Development/Testing)
- Vercel: FREE
- Railway: $5 free credits/month
- **Total**: $0-5/month

### Production (Low Traffic < 10k visitors/month)
- Vercel: FREE
- Railway: $5-10/month
- **Total**: $5-10/month

### Production (Medium Traffic < 100k visitors/month)
- Vercel Pro: $20/month
- Railway: $10-20/month
- **Total**: $30-40/month

---

## 🔐 SECURITY CHECKLIST

- [ ] HTTPS enabled (automatic with Vercel/Railway)
- [ ] Environment variables secured
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] SQL injection prevention (Prisma handles this)
- [ ] Input validation on all endpoints
- [ ] No sensitive data in logs
- [ ] API keys rotated regularly

---

## 📝 MAINTENANCE GUIDE

### Weekly Tasks
- Check error logs
- Monitor performance metrics
- Review usage statistics

### Monthly Tasks
- Update dependencies
- Review database size
- Check for security updates

### As Needed
- Scale resources based on traffic
- Optimize slow queries
- Add new features

---

## 🚨 TROUBLESHOOTING

### Issue: Build Fails on Vercel
**Solution**: Check build logs, ensure all dependencies in package.json

### Issue: API Returns 500 Errors
**Solution**: Check Railway logs, verify DATABASE_URL is correct

### Issue: CORS Errors
**Solution**: Update ALLOWED_ORIGINS in API environment variables

### Issue: Slow Performance
**Solution**: 
- Add database indexes
- Enable caching
- Use CDN for static assets

---

## 📚 ADDITIONAL RESOURCES

### Documentation
- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- Next.js Deployment: https://nextjs.org/docs/deployment
- Prisma Migration: https://www.prisma.io/docs/guides/migrate

### Support
- Vercel Discord: https://vercel.com/discord
- Railway Discord: https://discord.gg/railway

---

## ✅ DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All features tested locally
- [ ] GitHub repository created
- [ ] Environment variables documented
- [ ] Database migration script ready

### Deployment
- [ ] Railway account created
- [ ] PostgreSQL database provisioned
- [ ] Data migrated from SQLite
- [ ] Backend deployed to Railway
- [ ] Vercel account created
- [ ] Frontend deployed to Vercel
- [ ] Environment variables configured
- [ ] CORS configured

### Post-Deployment
- [ ] All features tested on production
- [ ] Performance acceptable
- [ ] Mobile responsive
- [ ] Analytics enabled
- [ ] Monitoring set up
- [ ] Documentation updated

---

**Estimated Total Deployment Time**: 2-4 hours
**Monthly Cost**: $0-10 (free tier) or $30-40 (production tier)
**Difficulty**: Beginner-friendly with this guide

---

🎉 **Ready to deploy your ETF Intelligence platform to production!**
