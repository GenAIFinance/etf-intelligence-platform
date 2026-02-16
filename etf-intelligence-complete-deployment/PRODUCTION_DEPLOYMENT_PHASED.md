# 🚀 ETF Intelligence Platform - PRODUCTION DEPLOYMENT GUIDE
## With Phased EODHD Strategy: Development → Production

---

## 💡 SMART DEPLOYMENT STRATEGY (Save $300+/month!)

### Why This Matters:
- **Development Phase**: $19.99-99.99/month (EODHD Personal plan)
- **Production Phase**: $399/month (EODHD Commercial plan)
- **Your savings**: $300+/month while building!

### The Legal Boundary:
According to EODHD terms and industry standard:
- ✅ **Personal Use OK**: Private site, 1-2 users (you + tester), not public
- ❌ **Commercial Use Required**: Public site, Google-indexed, multiple users, monetization

### Our Phased Approach:

```
PHASE 1: DEVELOPMENT (Current)
├── Cost: $20-100/month (EODHD Personal)
├── Users: 1-2 (you + partner/tester)
├── Access: Password-protected
├── Domain: dev.etf-intelligence.com
├── Duration: 2-6 months (while building)
└── Goal: Build, test, perfect the platform

PHASE 2: SOFT LAUNCH (Optional)
├── Cost: $80-145/month (EODHD All-World)
├── Users: 10-50 (invite only)
├── Access: Beta access with login
├── Domain: beta.etf-intelligence.com
├── Duration: 1-3 months (validation)
└── Goal: Get feedback, validate features

PHASE 3: PUBLIC PRODUCTION
├── Cost: $400-500/month (EODHD Commercial + hosting)
├── Users: Unlimited (public)
├── Access: Open to everyone
├── Domain: etf-intelligence.com
├── Duration: Ongoing
└── Goal: Scale and monetize
```

---

## 📊 COST COMPARISON BY PHASE

### Phase 1 - Development (1-2 users, private)
| Service | Plan | Cost |
|---------|------|------|
| EODHD API | Personal Extended | $99.99/mo |
| Railway | Hobby | $10/mo |
| Vercel | Free | $0 |
| **TOTAL** | | **$110/mo** |

**Savings vs jumping to commercial**: **$290/month** 💰

### Phase 2 - Beta (10-50 users, invite-only)
| Service | Plan | Cost |
|---------|------|------|
| EODHD API | All-World | $79.99/mo |
| Railway | Hobby/Pro | $15-20/mo |
| Vercel | Free/Pro | $0-20/mo |
| Auth Service | Clerk/Auth0 | $0-25/mo |
| **TOTAL** | | **$95-145/mo** |

**Savings vs commercial**: **$255/month** 💰

### Phase 3 - Production (unlimited users, public)
| Service | Plan | Cost |
|---------|------|------|
| EODHD API | Commercial | $399/mo |
| Railway | Pro | $20-50/mo |
| Vercel | Pro | $20/mo |
| Database | Supabase/Railway | $25/mo |
| **TOTAL** | | **$464-494/mo** |

---

## 🎯 PHASE 1: DEVELOPMENT DEPLOYMENT (SAVE $290/MONTH!)

### Development Phase Requirements:
- ✅ 1-2 users only (you + tester)
- ✅ Password-protected site
- ✅ Staging domain (dev.etf-intelligence.com)
- ✅ No public search engine indexing
- ✅ Daily data updates (automated)
- ✅ Full feature testing

---

## 🔐 PHASE 1: STEP-BY-STEP DEPLOYMENT

### STEP 1: EODHD API Setup (Development Plan)

**1.1 - Choose Your Plan**:

Visit https://eodhistoricaldata.com/pricing

**Recommended for Development**: Personal Extended ($99.99/mo)
- ✅ 5000+ US ETFs
- ✅ Fundamentals, holdings, sectors
- ✅ 100,000 API calls/day (enough for daily sync)
- ✅ Historical data
- ⚠️ **RESTRICTION**: Personal/private use only (1-2 users)

**Alternative**: Personal Basic ($19.99/mo)
- ⚠️ Only 1,000 API calls/day (too low for full sync)
- ✅ Good for initial testing

**1.2 - Sign Up & Get API Token**:
1. Create account
2. Subscribe to Personal Extended
3. Copy API token from dashboard
4. Store securely (never commit to Git!)

**1.3 - Test API Access**:
```bash
# Test basic access
curl "https://eodhistoricaldata.com/api/eod/VOO.US?api_token=YOUR_TOKEN&fmt=json"

# Should return price data
```

---

### STEP 2: Implement Access Control (Critical for Personal Plan Compliance)

**2.1 - Add Basic Authentication**

**File**: `apps/web/middleware.ts` (NEW FILE)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Password protection for development
const DEV_USERNAME = process.env.DEV_USERNAME || 'admin';
const DEV_PASSWORD = process.env.DEV_PASSWORD || 'changeme123';

export function middleware(request: NextRequest) {
  // Only protect in development/staging
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_AUTH === 'true') {
    const basicAuth = request.headers.get('authorization');

    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      const [user, pwd] = atob(authValue).split(':');

      if (user === DEV_USERNAME && pwd === DEV_PASSWORD) {
        return NextResponse.next();
      }
    }

    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
```

**2.2 - Add Environment Variables**

**Vercel Environment Variables**:
```bash
NODE_ENV=production
ENABLE_AUTH=true
DEV_USERNAME=your_username
DEV_PASSWORD=your_strong_password
NEXT_PUBLIC_API_URL=https://dev-etf-api.railway.app
```

**2.3 - Add Robots.txt (Prevent Search Engine Indexing)**

**File**: `apps/web/public/robots.txt` (NEW FILE)

```
User-agent: *
Disallow: /

# Development site - do not index
# Will be updated when going to production
```

**2.4 - Add Meta Tags (No-Index)**

**File**: `apps/web/src/app/layout.tsx`

Update the metadata:

```typescript
export const metadata = {
  title: 'ETF Intelligence - Development',
  description: 'ETF Analysis Platform',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};
```

---

### STEP 3: Configure Development Domain

**3.1 - Use Staging Subdomain**

**Option A - Vercel Subdomain** (Free):
- Default URL: `etf-intelligence-dev.vercel.app`
- No custom domain needed

**Option B - Custom Subdomain** (If you have domain):
1. Buy domain: `etf-intelligence.com`
2. Add subdomain in Vercel: `dev.etf-intelligence.com`
3. Point DNS: CNAME `dev` → `cname.vercel-dns.com`

**3.2 - Railway Backend Domain**:
- Use Railway-provided URL: `dev-etf-api.railway.app`
- Or custom: `dev-api.etf-intelligence.com`

---

### STEP 4: Add API Rate Limiting (Stay Within Personal Plan Limits)

**4.1 - Track API Usage**

**File**: `apps/api/src/services/eodhd-sync.ts`

Add usage tracking:

```typescript
import axios from 'axios';
import prisma from '../db';

const EODHD_API_URL = 'https://eodhistoricaldata.com/api';
const API_TOKEN = process.env.EODHD_API_TOKEN;
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';
const DEV_RATE_LIMIT = 5000; // Max API calls per sync in dev

// Track API calls
let apiCallCount = 0;

export class EODHDSyncService {
  private async makeAPICall(url: string): Promise<any> {
    apiCallCount++;
    
    // In development, enforce stricter limits
    if (IS_DEVELOPMENT && apiCallCount > DEV_RATE_LIMIT) {
      throw new Error(`Development rate limit reached: ${DEV_RATE_LIMIT} calls`);
    }
    
    console.log(`API Call #${apiCallCount}: ${url.substring(0, 60)}...`);
    const response = await axios.get(url);
    return response.data;
  }

  async getETFList(): Promise<string[]> {
    console.log('Fetching ETF list from EODHD...');
    const url = `${EODHD_API_URL}/exchange-symbol-list/US?api_token=${API_TOKEN}&type=ETF&fmt=json`;
    const data = await this.makeAPICall(url);
    
    let etfs = data.map((etf: any) => etf.Code);
    
    // DEVELOPMENT: Limit to subset for testing
    if (IS_DEVELOPMENT) {
      console.log(`⚠️ Development mode: Limiting to 100 ETFs (full list: ${etfs.length})`);
      etfs = etfs.slice(0, 100); // Only sync 100 ETFs in dev
    }
    
    console.log(`Will sync ${etfs.length} ETFs`);
    return etfs;
  }

  async getETFData(ticker: string): Promise<any> {
    const url = `${EODHD_API_URL}/fundamentals/${ticker}.US?api_token=${API_TOKEN}&fmt=json`;
    
    try {
      return await this.makeAPICall(url);
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`${ticker}: No data available`);
        return null;
      }
      throw error;
    }
  }

  // ... rest of sync service code (same as before)
  
  async syncAllETFs(): Promise<{ success: number; failed: number; total: number; apiCalls: number }> {
    console.log('🚀 Starting ETF sync...');
    if (IS_DEVELOPMENT) {
      console.log('⚠️ DEVELOPMENT MODE: Limited sync enabled');
    }
    
    apiCallCount = 0; // Reset counter
    const startTime = Date.now();

    const tickers = await this.getETFList();
    let success = 0;
    let failed = 0;

    // Process in batches
    const batchSize = IS_DEVELOPMENT ? 5 : 10; // Smaller batches in dev
    
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (ticker) => {
          const result = await this.syncETF(ticker);
          if (result) success++;
          else failed++;
        })
      );

      // Rate limit: longer delay in dev to be safe
      const delay = IS_DEVELOPMENT ? 2000 : 1000;
      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Progress
      if ((i + batchSize) % 50 === 0) {
        console.log(`Progress: ${i + batchSize}/${tickers.length} | API calls: ${apiCallCount}`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    console.log(`✅ Sync complete!`);
    console.log(`   Success: ${success}, Failed: ${failed}`);
    console.log(`   API Calls: ${apiCallCount}`);
    console.log(`   Duration: ${duration} min`);

    return { success, failed, total: tickers.length, apiCalls: apiCallCount };
  }
}
```

**4.2 - Add API Usage Logging**

**File**: `apps/api/src/scripts/log-api-usage.ts` (NEW FILE)

```typescript
import prisma from '../db';

interface SyncLog {
  date: Date;
  etfssynced: number;
  apiCalls: number;
  duration: number;
}

export async function logSyncResults(results: any) {
  // You can store this in database or just log it
  console.log('=== EODHD API Usage Summary ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`ETFs Synced: ${results.success}/${results.total}`);
  console.log(`API Calls Made: ${results.apiCalls}`);
  console.log(`Daily Limit: 100,000`);
  console.log(`Usage: ${((results.apiCalls / 100000) * 100).toFixed(2)}%`);
  console.log('================================');
  
  // Optional: Store in database for tracking
  // await prisma.syncLog.create({ data: { ... } });
}
```

---

### STEP 5: Deploy Development Environment

**5.1 - Railway Backend Setup**

Environment Variables:
```bash
DATABASE_URL=postgresql://... (from Railway PostgreSQL)
EODHD_API_TOKEN=your_personal_plan_token
NODE_ENV=development
PORT=3001
ALLOWED_ORIGINS=https://etf-intelligence-dev.vercel.app
```

**5.2 - Vercel Frontend Setup**

Environment Variables:
```bash
NODE_ENV=production
ENABLE_AUTH=true
DEV_USERNAME=admin
DEV_PASSWORD=your_secure_password_123
NEXT_PUBLIC_API_URL=https://dev-etf-api.railway.app
```

**5.3 - GitHub Actions (Daily Sync)**

Update `.github/workflows/daily-etf-sync.yml`:

```yaml
name: Daily ETF Data Sync (Development)

on:
  schedule:
    # Runs daily at 6 PM EST (11 PM UTC)
    - cron: '0 23 * * *'
  workflow_dispatch:

jobs:
  sync-etf-data:
    runs-on: ubuntu-latest
    
    env:
      NODE_ENV: development  # Development mode
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd apps/api
          npm ci
      
      - name: Run ETF sync (Development - Limited)
        env:
          DATABASE_URL: ${{ secrets.DEV_DATABASE_URL }}
          EODHD_API_TOKEN: ${{ secrets.EODHD_DEV_TOKEN }}
          NODE_ENV: development
        run: |
          cd apps/api
          npm run sync-etfs
      
      - name: Log API usage
        run: |
          echo "Check logs above for API usage statistics"
```

**GitHub Secrets for Development**:
- `DEV_DATABASE_URL`: Your Railway PostgreSQL URL
- `EODHD_DEV_TOKEN`: Your Personal plan token

---

### STEP 6: Development Phase Checklist

**✅ Before You Start**:
- [ ] EODHD Personal Extended plan subscribed ($99.99/mo)
- [ ] API token saved securely
- [ ] Development strategy documented

**✅ Access Control**:
- [ ] Basic Auth middleware added
- [ ] Username/password set in Vercel
- [ ] robots.txt blocks all crawlers
- [ ] Meta tags set to noindex
- [ ] Using dev subdomain (dev.etf-intelligence.com)

**✅ Rate Limiting**:
- [ ] Development mode limits API calls (5000 max)
- [ ] Syncs only 100 ETFs initially (testing)
- [ ] API usage logging implemented
- [ ] Daily sync runs successfully

**✅ Compliance**:
- [ ] Only 1-2 users have access (you + tester)
- [ ] Site is password-protected
- [ ] Not indexed by Google
- [ ] Using staging subdomain
- [ ] No monetization

---

## 🚀 PHASE 2: BETA LAUNCH (OPTIONAL - WHEN READY)

### When to Move to Beta:
- ✅ Core features working perfectly
- ✅ Ready for 10-50 beta testers
- ✅ Want real user feedback
- ✅ Not fully public yet

### Beta Phase Strategy:

**1. Upgrade EODHD Plan**:
- Plan: All-World ($79.99/mo)
- Allows: More usage, still not commercial
- Users: 10-50 (invite-only)

**2. Add User Authentication** (Replace Basic Auth):

Use Clerk.com or Auth0:
```bash
npm install @clerk/nextjs
```

**File**: `apps/web/src/middleware.ts`

```typescript
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/sign-in", "/sign-up"],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

**3. Invite-Only Access**:
- Use Clerk's invitation system
- Send invites to beta testers
- Collect feedback

**4. Update Domain**:
- Use: `beta.etf-intelligence.com`
- Still not the main domain

**5. Beta Checklist**:
- [ ] Upgraded to EODHD All-World plan
- [ ] User auth implemented (Clerk/Auth0)
- [ ] Invite system working
- [ ] 10-50 beta users invited
- [ ] Feedback collection setup
- [ ] Still noindex for search engines

---

## 🌐 PHASE 3: PUBLIC PRODUCTION (WHEN YOU'RE READY TO SCALE)

### When to Go Public:
- ✅ Beta feedback incorporated
- ✅ All features polished
- ✅ Ready for unlimited users
- ✅ Monetization strategy ready
- ✅ Budget for $400/mo approved

### Production Upgrade:

**1. Upgrade EODHD Plan**:
- Plan: Commercial ($399/mo)
- Allows: Unlimited public users
- Full redistribution rights

**2. Update Access Control**:
- Remove Basic Auth
- Optional: Keep user accounts for premium features
- Make site fully public

**3. Enable Search Engine Indexing**:

**Update** `apps/web/public/robots.txt`:
```
User-agent: *
Allow: /

Sitemap: https://etf-intelligence.com/sitemap.xml
```

**Update** `apps/web/src/app/layout.tsx`:
```typescript
export const metadata = {
  title: 'ETF Intelligence - Research Platform',
  description: 'Search and analyze 5000+ ETFs',
  robots: {
    index: true,  // Changed!
    follow: true,
  },
};
```

**4. Use Main Domain**:
- Switch to: `etf-intelligence.com`
- Redirect dev/beta to main site

**5. Full Data Sync**:
- Remove development limits
- Sync all 5000+ ETFs
- Daily updates for complete dataset

**6. Production Checklist**:
- [ ] EODHD Commercial plan activated
- [ ] Basic Auth removed
- [ ] Search engines can index
- [ ] Main domain configured
- [ ] Full ETF sync (5000+)
- [ ] Monitoring and analytics
- [ ] Monetization strategy deployed

---

## 💰 COST SUMMARY BY PHASE

| Phase | Users | EODHD | Hosting | Auth | Total/mo | Duration |
|-------|-------|-------|---------|------|----------|----------|
| **Development** | 1-2 | $100 | $10 | $0 | **$110** | 2-6 months |
| **Beta** | 10-50 | $80 | $20 | $25 | **$125** | 1-3 months |
| **Production** | Unlimited | $399 | $50 | $25 | **$474** | Ongoing |

**Total Development Savings**: $290-365/month × 3-9 months = **$870-3,285 saved!**

---

## 📋 COMPLETE DEPLOYMENT CHECKLIST

### Phase 1 - Development (Current):
- [ ] Subscribe to EODHD Personal Extended ($100/mo)
- [ ] Implement Basic Authentication
- [ ] Add robots.txt (block crawlers)
- [ ] Use dev subdomain
- [ ] Add rate limiting (5000 API calls max)
- [ ] Sync 100 ETFs initially (testing)
- [ ] Deploy to Railway + Vercel
- [ ] Test with 1-2 users
- [ ] Track API usage daily
- [ ] Perfect features over 2-6 months

### Phase 2 - Beta (Optional):
- [ ] Upgrade to EODHD All-World ($80/mo)
- [ ] Implement user auth (Clerk/Auth0)
- [ ] Switch to beta subdomain
- [ ] Invite 10-50 beta testers
- [ ] Collect feedback
- [ ] Sync more ETFs (500-1000)
- [ ] Refine based on feedback

### Phase 3 - Production (Future):
- [ ] Upgrade to EODHD Commercial ($399/mo)
- [ ] Remove access restrictions
- [ ] Enable search engine indexing
- [ ] Use main domain
- [ ] Sync all 5000+ ETFs
- [ ] Launch marketing
- [ ] Implement monetization

---

## 🔐 EODHD COMPLIANCE SUMMARY

### ✅ YOU'RE SAFE IF:
- Site is password-protected (Basic Auth)
- Only 1-2 users can access
- Using dev/staging subdomain
- robots.txt blocks search engines
- No monetization yet
- Personal use only

### ⚠️ UPGRADE TO COMMERCIAL WHEN:
- Remove password protection
- Open to public (anyone can access)
- Google starts indexing site
- More than 10 users regularly access
- Start charging for access/features
- Advertise or promote publicly

---

## 📞 SUPPORT & RESOURCES

### EODHD Licensing Questions:
- Email: support@eodhistoricaldata.com
- Before making site public, confirm your usage is compliant

### Monitoring Tools:
- Railway Dashboard: Track API requests
- Vercel Analytics: Track visitor count
- GitHub Actions: Monitor sync success

---

## ✅ SUCCESS CRITERIA FOR PHASE 1

After deploying Phase 1 (Development), you should have:

✅ **Live Development Site**:
- URL: `etf-intelligence-dev.vercel.app` (or custom subdomain)
- Password protected (only you + 1 tester)
- Not indexed by Google
- 100-500 ETFs with data

✅ **Automated Daily Updates**:
- GitHub Action runs at 6 PM EST
- Updates ETF data from EODHD
- Tracks API usage (stays under 100k/day)
- Logs sync results

✅ **Cost-Effective**:
- $110/month (vs $464 for production)
- Saving $354/month
- Time to perfect features: 2-6 months
- Total savings: $708-2,124

✅ **Fully Functional**:
- All features working
- Search, filter, compare ETFs
- AI screener
- Holdings, themes, sectors
- Ready for testing and iteration

✅ **Compliant**:
- EODHD Personal plan terms respected
- Access restricted to 1-2 users
- No public distribution
- Ready to upgrade when needed

---

## 🎯 RECOMMENDED TIMELINE

### Months 1-2: Development Phase
- Deploy with Basic Auth
- EODHD Personal Extended ($100/mo)
- Sync 100-500 ETFs
- Perfect all features
- Test with 1 trusted user
- **Cost**: $110/mo

### Month 3-4: Beta Phase (Optional)
- Upgrade to EODHD All-World ($80/mo)
- Add user authentication
- Invite 20-30 beta testers
- Collect feedback
- Refine features
- **Cost**: $125/mo

### Month 5+: Production Launch
- Upgrade to EODHD Commercial ($399/mo)
- Remove restrictions
- Go fully public
- Enable SEO
- Start marketing
- **Cost**: $474/mo

**Total development savings before going public**: $1,000-2,000+ 💰

---

🎉 **You can now deploy and develop your platform for just $110/month instead of $464/month!**

**Start with Phase 1, perfect your platform, then scale up when ready!**
