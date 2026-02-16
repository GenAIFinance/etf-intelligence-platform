# Debug: Themes Not Loading

## 🔍 Step 1: Test the Backend Directly

Run this command to see what the backend returns:

```cmd
curl http://localhost:3001/api/etfs/VOO/themes
```

**Possible results**:

### Result A: Returns empty exposures
```json
{
  "ticker": "VOO",
  "exposures": [],
  "count": 0
}
```
**This means**: No classification data in database (expected for most ETFs)

### Result B: Returns 404
```json
{
  "error": "ETF not found"
}
```
**This means**: Route exists but ticker not found

### Result C: Returns error
```json
{
  "error": "Route GET:/api/etfs/VOO/themes not found"
}
```
**This means**: Route not registered properly

### Result D: Returns data
```json
{
  "ticker": "VOO",
  "exposures": [
    {
      "themeId": "ai",
      "themeName": "Artificial Intelligence",
      "exposure": 15.5,
      "holdings": [...]
    }
  ],
  "count": 3
}
```
**This means**: Backend works! Frontend issue.

---

## 🎯 Quick Fix: Mock Themes Data

Since you probably don't have classification data yet, let's create a **fallback** that generates themes from sector data instead.

### Replace the themes route with this version:

```typescript
// GET /api/etfs/:ticker/themes - Get theme exposures (with fallback)
fastify.get('/etfs/:ticker/themes', async (request, reply) => {
  try {
    const { ticker } = request.params as { ticker: string };

    const etf = await prisma.etf.findUnique({ 
      where: { ticker: ticker.toUpperCase() },
      include: {
        sectorWeights: true,
      }
    });
    
    if (!etf) {
      return reply.status(404).send({ error: 'ETF not found' });
    }

    // Try to get classifications first
    const classifications = await prisma.holdingClassification.findMany({
      where: { etfId: etf.id },
    });

    // If we have classifications, use them
    if (classifications.length > 0) {
      // [Original theme calculation code here]
      const latestDate = await prisma.etfHolding.findFirst({
        where: { etfId: etf.id },
        orderBy: { asOfDate: 'desc' },
        select: { asOfDate: true },
      });

      const holdings = latestDate ? await prisma.etfHolding.findMany({
        where: { 
          etfId: etf.id,
          asOfDate: latestDate.asOfDate,
        },
      }) : [];

      const themeMap = new Map();
      const THEMES = [
        { id: 'ai', name: 'Artificial Intelligence' },
        { id: 'cloud', name: 'Cloud Computing' },
        { id: 'ev', name: 'Electric Vehicles' },
        { id: 'fintech', name: 'Financial Technology' },
        { id: 'healthcare', name: 'Healthcare Innovation' },
        { id: 'cybersecurity', name: 'Cybersecurity' },
        { id: 'ecommerce', name: 'E-Commerce' },
        { id: 'renewable', name: 'Renewable Energy' },
        { id: 'semiconductors', name: 'Semiconductors' },
        { id: 'biotech', name: 'Biotechnology' },
      ];

      for (const theme of THEMES) {
        themeMap.set(theme.id, { 
          themeId: theme.id,
          themeName: theme.name,
          exposure: 0, 
          holdings: [] 
        });
      }

      for (const classification of classifications) {
        const themes = JSON.parse(classification.themesJson || '[]');
        const holding = holdings.find(h => h.holdingTicker === classification.holdingTicker);
        const weight = holding?.weight || 0;

        for (const { themeId, confidence } of themes) {
          const themeData = themeMap.get(themeId);
          if (themeData) {
            themeData.exposure += weight * confidence;
            themeData.holdings.push({
              ticker: classification.holdingTicker,
              name: classification.holdingName,
              weight,
              confidence,
            });
          }
        }
      }

      const exposures = Array.from(themeMap.values())
        .filter(theme => theme.exposure > 0)
        .sort((a, b) => b.exposure - a.exposure)
        .map(theme => ({
          ...theme,
          holdings: theme.holdings.sort((a, b) => b.weight - a.weight).slice(0, 10),
        }));

      return { ticker, exposures, count: exposures.length };
    }

    // FALLBACK: Generate themes from sector weights
    console.log(`No classifications for ${ticker}, generating from sectors`);
    
    const sectorToTheme = {
      'Technology': [
        { themeId: 'ai', themeName: 'Artificial Intelligence', factor: 0.4 },
        { themeId: 'cloud', themeName: 'Cloud Computing', factor: 0.3 },
        { themeId: 'semiconductors', themeName: 'Semiconductors', factor: 0.3 },
      ],
      'Communication Services': [
        { themeId: 'ecommerce', themeName: 'E-Commerce', factor: 0.5 },
        { themeId: 'ai', themeName: 'Artificial Intelligence', factor: 0.5 },
      ],
      'Consumer Cyclical': [
        { themeId: 'ecommerce', themeName: 'E-Commerce', factor: 0.6 },
        { themeId: 'ev', themeName: 'Electric Vehicles', factor: 0.4 },
      ],
      'Healthcare': [
        { themeId: 'healthcare', themeName: 'Healthcare Innovation', factor: 0.6 },
        { themeId: 'biotech', themeName: 'Biotechnology', factor: 0.4 },
      ],
      'Financial Services': [
        { themeId: 'fintech', themeName: 'Financial Technology', factor: 1.0 },
      ],
      'Energy': [
        { themeId: 'renewable', themeName: 'Renewable Energy', factor: 0.3 },
      ],
    };

    const themeMap = new Map();
    
    for (const sectorWeight of etf.sectorWeights) {
      const themes = sectorToTheme[sectorWeight.sector] || [];
      
      for (const { themeId, themeName, factor } of themes) {
        if (!themeMap.has(themeId)) {
          themeMap.set(themeId, {
            themeId,
            themeName,
            exposure: 0,
            holdings: [],
            source: 'sector-derived',
          });
        }
        
        const theme = themeMap.get(themeId);
        theme.exposure += sectorWeight.weight * factor;
      }
    }

    const exposures = Array.from(themeMap.values())
      .filter(theme => theme.exposure > 0.5) // Min 0.5% exposure
      .sort((a, b) => b.exposure - a.exposure);

    return { 
      ticker, 
      exposures, 
      count: exposures.length,
      note: 'Themes derived from sector allocations',
    };
  } catch (error: any) {
    fastify.log.error('Themes error:', error);
    reply.status(500).send({ error: error.message });
  }
});
```

---

## 🧪 Test After Update

```cmd
# Restart API
cd apps\api
npm run dev

# Test themes
curl http://localhost:3001/api/etfs/VOO/themes
```

**Should now return** themes derived from sectors (Technology → AI/Cloud/Semiconductors, etc.)

---

## 🌐 Check Frontend

### What URL is the frontend calling?

Open browser DevTools (F12) → Network tab → Click Themes tab

**Look for the request**. It might be calling:
- `/api/etfs/VOO/themes` ✅ Correct
- `/api/etf/VOO/themes` ❌ Wrong (singular)
- `/api/etfs/VOO/themes-exposure` ❌ Wrong endpoint

**If the URL is wrong**, we need to fix the frontend code.

---

## 📝 Share Results

Run the curl command and share what you get:

```cmd
curl http://localhost:3001/api/etfs/VOO/themes
```

Copy the entire output and share it, then I can tell you exactly what's wrong!

---

## 🎯 Most Likely Issues

1. **No classification data** → Use fallback above (generates from sectors)
2. **Frontend calling wrong URL** → Need to fix frontend
3. **Route not registered** → Need to check index.ts
4. **CORS issue** → Check browser console

Share the curl output and I'll give you the exact fix!
