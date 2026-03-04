// ETF Context Service
// apps/api/src/services/etf-context.ts
//
// Fetches relevant ETFs from the database based on the user's query.
// Used by both ai-screener.ts and ai-chat.ts to inject live ETF data
// into DeepSeek prompts so recommendations reference real tickers.
//
// ⚠️  RELATION NAME: This file uses `metricSnapshots` (from model EtfMetricSnapshot).
//     If your Prisma schema uses a different relation name on the Etf model, update
//     the two `include: { metricSnapshots: ... }` lines and the `e.metricSnapshots[0]`
//     references below. Run `npx prisma studio` and check the Etf table relations to confirm.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Theme keyword map ─────────────────────────────────────────────────────────
// Keys must exactly match the theme strings used in your `themes` column.
// Extend this map as you tag more ETFs in the database.

const THEME_KEYWORDS: Record<string, string[]> = {
  AI:             ['ai', 'artificial intelligence', 'machine learning', 'robot'],
  Defense:        ['defense', 'defence', 'military', 'aerospace', 'aero'],
  Cybersecurity:  ['cyber', 'security', 'hack'],
  Energy:         ['energy', 'oil', 'gas', 'petroleum'],
  Gold:           ['gold', 'precious metal', 'silver'],
  Semiconductors: ['semiconductor', 'chip', 'soxx', 'smh'],
  CleanEnergy:    ['clean energy', 'solar', 'wind', 'renewable'],
  Quantum:        ['quantum'],
  RareEarths:     ['rare earth', 'lithium', 'material'],
  Dividends:      ['dividend', 'income', 'yield'],
  LowVolatility:  ['low volatility', 'low vol', 'stable', 'conservative'],
  BroadMarket:    ['s&p', 'sp500', 'broad market', 'index', 'total market'],
  Bonds:          ['bond', 'fixed income', 'treasury', 'credit'],
  International:  ['international', 'global', 'emerging market', 'foreign'],
  RealEstate:     ['real estate', 'reit', 'property'],
};

function detectThemes(query: string): string[] {
  const q = query.toLowerCase();
  return Object.entries(THEME_KEYWORDS)
    .filter(([, keywords]) => keywords.some(k => q.includes(k)))
    .map(([theme]) => theme);
}

// ── Return type ───────────────────────────────────────────────────────────────

export interface EtfContextRow {
  ticker:       string;
  name:         string;
  themes:       string[];
  return3Y:     number | null;
  volatility:   number | null;
  sharpe:       number | null;
  expenseRatio: number | null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getEtfContext(query: string): Promise<EtfContextRow[]> {
  const themes = detectThemes(query);

  // 1. Theme match — most precise
  if (themes.length > 0) {
    const etfs = await prisma.etf.findMany({
      where: {
        themes: { hasSome: themes },
        aum:    { gt: 100_000_000 },        // pre-filter: AUM > $100M
      },
      take: 20,
      include: {
        metricSnapshots: {                   // ← update if your relation name differs
          orderBy: { asOfDate: 'desc' },
          take: 1,
        },
      },
    });

    if (etfs.length > 0) return formatRows(etfs);
  }

  // 2. Fallback — keyword match on name / assetClass
  const etfs = await prisma.etf.findMany({
    where: {
      OR: [
        { name:       { contains: query, mode: 'insensitive' } },
        { assetClass: { contains: query, mode: 'insensitive' } },
      ],
      aum: { gt: 100_000_000 },
    },
    take: 20,
    include: {
      metricSnapshots: {                     // ← update if your relation name differs
        orderBy: { asOfDate: 'desc' },
        take: 1,
      },
    },
  });

  return formatRows(etfs);
}

// ── Helper ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatRows(etfs: any[]): EtfContextRow[] {
  return etfs.map(e => {
    const snap = e.metricSnapshots?.[0];    // ← update if your relation name differs
    return {
      ticker:       e.ticker,
      name:         e.name,
      themes:       e.themes ?? [],
      return3Y:     snap?.return3Y     ?? null,
      volatility:   snap?.volatility   ?? null,
      sharpe:       snap?.sharpe       ?? null,
      expenseRatio: e.netExpenseRatio  ?? null,
    };
  });
}
