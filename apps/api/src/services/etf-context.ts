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
  Defense:        ['defense', 'defence', 'military', 'aerospace', 'aero', 'geopolitical', 'geopolitics', 'war', 'conflict', 'nato', 'tension'],
  Cybersecurity:  ['cyber', 'security', 'hack'],
  Energy:         ['energy', 'oil', 'gas', 'petroleum'],
  Gold:           ['gold', 'precious metal', 'silver'],
  Semiconductors: ['semiconductor', 'chip', 'soxx', 'smh'],
  CleanEnergy:    ['clean energy', 'solar', 'wind', 'renewable'],
  Quantum:        ['quantum'],
  RareEarths:     ['rare earth', 'lithium', 'material'],
  Dividends:      ['dividend', 'income', 'yield'],
  LowVolatility:  ['low volatility', 'low vol', 'stable', 'conservative', 'defensive', 'preservation'],
  BroadMarket:    ['s&p', 'sp500', 'broad market', 'index', 'total market', 'recommend', 'suggest', 'best etf'],
  Bonds:          ['bond', 'fixed income', 'treasury', 'credit', 'rate', 'fed', 'inflation', 'tips'],
  International:  ['international', 'global', 'emerging market', 'foreign', 'china', 'europe', 'japan'],
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
  ticker:      string;
  name:        string;
  themes:      string[];
  return1M:    number | null;
  return3M:    number | null;
  volatility:  number | null;
  sharpe:      number | null;
  maxDrawdown: number | null;
}

// Raw SQL row shape returned by Postgres
interface RawEtfRow {
  ticker:      string;
  name:        string;
  themes:      string[] | null;
  return_1m:   number | null;
  return_3m:   number | null;
  volatility:  number | null;
  sharpe:      number | null;
  max_drawdown: number | null;
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
        s."return1M"     AS return_1m,
        s."return3M"     AS return_3m,
        s.volatility,
        s.sharpe,
        s."maxDrawdown"  AS max_drawdown
      FROM "Etf" e
      LEFT JOIN LATERAL (
        SELECT "return1M", "return3M", volatility, sharpe, "maxDrawdown"
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
      s."return1M"     AS return_1m,
      s."return3M"     AS return_3m,
      s.volatility,
      s.sharpe,
      s."maxDrawdown"  AS max_drawdown
    FROM "Etf" e
    LEFT JOIN LATERAL (
      SELECT "return1M", "return3M", volatility, sharpe, "maxDrawdown"
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

  // 3. Final fallback — return top diversified ETFs by AUM so AI always has real metrics
  const fallbackRows = await prisma.$queryRaw<RawEtfRow[]>`
    SELECT
      e.ticker,
      e.name,
      e.themes,
      s."return1M"     AS return_1m,
      s."return3M"     AS return_3m,
      s.volatility,
      s.sharpe,
      s."maxDrawdown"  AS max_drawdown
    FROM "Etf" e
    LEFT JOIN LATERAL (
      SELECT "return1M", "return3M", volatility, sharpe, "maxDrawdown"
      FROM   "EtfMetricSnapshot"
      WHERE  "etfId" = e.id
      ORDER  BY "asOfDate" DESC
      LIMIT  1
    ) s ON true
    WHERE e.aum > 1000000000
    ORDER BY e.aum DESC
    LIMIT 20
  `;

  return formatRows(fallbackRows);
}

// ── Fetch real metrics for specific tickers ───────────────────────────────────
// Called after AI recommends tickers — overwrites AI metrics with real DB values

export interface EtfRealMetrics {
  ticker:      string;
  return1M:    number | null;
  return3M:    number | null;
  volatility:  number | null;
  sharpe:      number | null;
  maxDrawdown: number | null;
}

interface RawMetricsRow {
  ticker:       string;
  return_1m:    number | null;
  return_3m:    number | null;
  volatility:   number | null;
  sharpe:       number | null;
  max_drawdown: number | null;
}

export async function getEtfMetricsByTickers(tickers: string[]): Promise<Map<string, EtfRealMetrics>> {
  if (!tickers.length) return new Map();
  const rows = await prisma.$queryRaw<RawMetricsRow[]>`
    SELECT
      e.ticker,
      s."return1M"    AS return_1m,
      s."return3M"    AS return_3m,
      s.volatility,
      s.sharpe,
      s."maxDrawdown" AS max_drawdown
    FROM "Etf" e
    LEFT JOIN LATERAL (
      SELECT "return1M", "return3M", volatility, sharpe, "maxDrawdown"
      FROM   "EtfMetricSnapshot"
      WHERE  "etfId" = e.id
      ORDER  BY "asOfDate" DESC
      LIMIT  1
    ) s ON true
    WHERE e.ticker = ANY(${tickers}::text[])
  `;
  const map = new Map<string, EtfRealMetrics>();
  for (const r of rows) {
    map.set(r.ticker, {
      ticker:      r.ticker,
      return1M:    r.return_1m    ?? null,
      return3M:    r.return_3m    ?? null,
      volatility:  r.volatility   ?? null,
      sharpe:      r.sharpe       ?? null,
      maxDrawdown: r.max_drawdown ?? null,
    });
  }
  return map;
}

function formatRows(rows: RawEtfRow[]): EtfContextRow[] {
  return rows.map(r => ({
    ticker:      r.ticker,
    name:        r.name,
    themes:      r.themes      ?? [],
    return1M:    r.return_1m   ?? null,
    return3M:    r.return_3m   ?? null,
    volatility:  r.volatility  ?? null,
    sharpe:      r.sharpe      ?? null,
    maxDrawdown: r.max_drawdown ?? null,
  }));
}
