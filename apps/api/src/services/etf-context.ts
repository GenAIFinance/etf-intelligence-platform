// ETF Context Service
// apps/api/src/services/etf-context.ts
//
// Uses raw SQL to avoid Prisma type errors caused by:
//   1. `themes` column added via SQL migration but not yet in schema.prisma
//   2. Snapshot relation name uncertainty
//
// TODO (non-urgent): add `themes String[] @default([])` to Etf model in
// schema.prisma, run `npx prisma generate`, then switch back to typed queries.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Theme keyword map ─────────────────────────────────────────────────────────

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

// Raw SQL row shape returned by Postgres
interface RawEtfRow {
  ticker:            string;
  name:              string;
  themes:            string[] | null;
  net_expense_ratio: number | null;
  return_1_y:        number | null;
  volatility:        number | null;
  sharpe:            number | null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getEtfContext(query: string): Promise<EtfContextRow[]> {
  const themes = detectThemes(query);

  // 1. Theme match — join Etf with latest EtfMetricSnapshot via raw SQL
  if (themes.length > 0) {
    const rows = await prisma.$queryRaw<RawEtfRow[]>`
      SELECT
        e.ticker,
        e.name,
        e.themes,
        e."netExpenseRatio"   AS net_expense_ratio,
        s."return3Y"          AS return_1_y,
        s.volatility,
        s.sharpe
      FROM "Etf" e
      LEFT JOIN LATERAL (
        SELECT "return3Y", volatility, sharpe
        FROM   "EtfMetricSnapshot"
        WHERE  "etfId" = e.id
        ORDER  BY "asOfDate" DESC
        LIMIT  1
      ) s ON true
      WHERE e.aum > 100000000
        AND e.themes && ${themes}::text[]
      ORDER BY e.aum DESC
      LIMIT 20
    `;

    if (rows.length > 0) return formatRows(rows);
  }

  // 2. Fallback — name / assetClass keyword match
  const keyword = `%${query}%`;
  const rows = await prisma.$queryRaw<RawEtfRow[]>`
    SELECT
      e.ticker,
      e.name,
      e.themes,
      e."netExpenseRatio"   AS net_expense_ratio,
      s."return3Y"          AS return_1_y,
      s.volatility,
      s.sharpe
    FROM "Etf" e
    LEFT JOIN LATERAL (
      SELECT "return3Y", volatility, sharpe
      FROM   "EtfMetricSnapshot"
      WHERE  "etfId" = e.id
      ORDER  BY "asOfDate" DESC
      LIMIT  1
    ) s ON true
    WHERE e.aum > 100000000
      AND (
        e.name        ILIKE ${keyword}
        OR e."assetClass" ILIKE ${keyword}
      )
    ORDER BY e.aum DESC
    LIMIT 20
  `;

  return formatRows(rows);
}

// ── Helper ────────────────────────────────────────────────────────────────────

function formatRows(rows: RawEtfRow[]): EtfContextRow[] {
  return rows.map(r => ({
    ticker:       r.ticker,
    name:         r.name,
    themes:       r.themes ?? [],
    return3Y:     r.return_1_y        ?? null,
    volatility:   r.volatility        ?? null,
    sharpe:       r.sharpe            ?? null,
    expenseRatio: r.net_expense_ratio ?? null,
  }));
}
