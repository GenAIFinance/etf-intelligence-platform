// ETF Comparison Tool — Redesigned
// apps/web/src/app/compare/page.tsx
//
// Sections:
//   1. Ticker input + popular comparisons (unchanged)
//   2. Performance chart — multi-line % return, period dropdown
//   3. Metrics table — side-by-side, best highlighted
//   4. Holdings — overlap % per pair + top 10 per ETF

'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import {
  X, TrendingUp, BarChart3, AlertCircle,
  Info, CheckCircle2, Layers, ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import WelcomeBanner from '@/components/WelcomeBanner';

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Colour palette — first 4 are maximally distinct ─────────────────────────
const ETF_COLORS = [
  '#2563eb', // blue
  '#f97316', // orange
  '#10b981', // green
  '#ef4444', // red
  '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899',
  '#14b8a6', '#a855f7', '#fb923c', '#f59e0b',
];

// ── Types ────────────────────────────────────────────────────────────────────

interface ComparisonETF {
  ticker: string; name: string; assetClass: string | null;
  strategyType: string | null; netExpenseRatio: number | null;
  aum: number | null; inceptionDate: string | null;
  holdingsCount: number;
}

interface ComparisonResponse {
  etfs: ComparisonETF[];
  highlights: { lowestExpenseRatio: string|null; highestAUM: string|null; mostDiversified: string|null; bestValue: string|null; };
  insights: string[];
  asOfDate: string;
}

interface MetricsData {
  return1M: number|null; return3M: number|null; return6M: number|null;
  return1Y: number|null; return3Y: number|null; return5Y: number|null;
  returnYTD: number|null; volatility: number|null; sharpe: number|null;
  maxDrawdown: number|null; beta: number|null;
  expenseRatio: number|null; aum: number|null;
}

interface HoldingRow { ticker: string; name: string; weight: number; }

type PeriodKey = '1M' | '3M' | '1Y' | '3Y' | '5Y';

const PERIOD_RANGE: Record<PeriodKey, string> = {
  '1M': '1m', '3M': '3m', '1Y': '1y', '3Y': '3y', '5Y': '5y',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(v: number|null, mult = 100): string {
  if (v === null) return '—';
  const n = v * mult;
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function fmtNum(v: number|null, dp = 2): string { return v === null ? '—' : v.toFixed(dp); }
function fmtAum(v: number|null): string {
  if (v === null) return '—';
  if (v >= 1e9) return `$${(v/1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v/1e6).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}
function retCls(v: number|null): string {
  if (v === null) return 'text-gray-400';
  return v >= 0 ? 'text-emerald-600' : 'text-red-500';
}

// ── Normalise price series to % return from first point ──────────────────────
function normalisePrices(prices: { date: string; close: number }[]): { date: string; value: number }[] {
  if (!prices.length) return [];
  const base = prices[0].close;
  return prices.map(p => ({ date: p.date, value: +((p.close / base - 1) * 100).toFixed(3) }));
}

// ── Main inner component ─────────────────────────────────────────────────────
function ComparePageInner() {
  const searchParams = useSearchParams();

  const [tickers,    setTickers]    = useState<string[]>(['', '']);
  const [comparison, setComparison] = useState<ComparisonResponse|null>(null);
  const [metricsMap, setMetricsMap] = useState<Record<string, MetricsData>>({});
  const [holdingsMap, setHoldingsMap] = useState<Record<string, HoldingRow[]>>({});
  const [allHoldingsMap, setAllHoldingsMap] = useState<Record<string, HoldingRow[]>>({});
  const [priceMap,   setPriceMap]   = useState<Record<string, { date: string; close: number }[]>>({});
  const [period,     setPeriod]     = useState<PeriodKey>('1Y');
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState<string|null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  // URL param auto-trigger
  useEffect(() => {
    const param = searchParams.get('tickers');
    if (param) {
      const fromUrl = param.split(',').map(t => t.trim().toUpperCase()).filter(Boolean).slice(0, 15);
      if (fromUrl.length >= 2) { setTickers(fromUrl); setTimeout(() => triggerCompare(fromUrl), 100); }
    }
  }, []);

  // Reload chart when period changes after initial load
  useEffect(() => {
    const validTickers = tickers.filter(t => t.trim().length > 0);
    if (!comparison || validTickers.length < 2) return;
    void loadPrices(validTickers, period);
  }, [period]);

  function addTicker() { if (tickers.length < 15) setTickers([...tickers, '']); }
  function removeTicker(i: number) {
    if (tickers.length > 2) { setTickers(tickers.filter((_, j) => j !== i)); setComparison(null); }
  }
  function updateTicker(i: number, v: string) {
    const n = [...tickers]; n[i] = v.toUpperCase(); setTickers(n);
  }

  async function loadPrices(validTickers: string[], p: PeriodKey) {
    setPeriodLoading(true);
    // Fallback order — if selected period returns no data, try shorter ones
    const FALLBACK: PeriodKey[] = ['5Y','3Y','1Y','3M','1M'];
    const periodFallbacks = FALLBACK.slice(FALLBACK.indexOf(p));
    try {
      const newPrices: Record<string, { date: string; close: number }[]> = {};
      await Promise.all(validTickers.map(async t => {
        for (const tryPeriod of periodFallbacks) {
          try {
            const raw = await fetch(
              `${API_URL}/api/etfs/${t}/prices?range=${PERIOD_RANGE[tryPeriod]}&interval=1d`
            ).then(r => r.ok ? r.json() : null).catch(() => null);
            const arr = Array.isArray(raw) ? raw : raw?.prices ?? [];
            const parsed = arr.map((pt: { date?: string; adjustedClose?: number; close?: number }) => ({
              date: pt.date ?? '',
              close: pt.adjustedClose ?? pt.close ?? 0,
            })).filter((pt: { date: string; close: number }) => pt.date && pt.close > 0);
            if (parsed.length > 0) {
              newPrices[t] = parsed;
              break; // got data — stop trying shorter periods
            }
          } catch { /* try next period */ }
        }
        if (!newPrices[t]) newPrices[t] = []; // no data at any period
      }));
      setPriceMap(newPrices);
    } finally { setPeriodLoading(false); }
  }

  async function triggerCompare(validTickers: string[]) {
    setIsLoading(true); setError(null);
    try {
      const [compRes, ...rest] = await Promise.all([
        fetch(`${API_URL}/api/etf/compare`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers: validTickers }),
        }),
        ...validTickers.map(t => fetch(`${API_URL}/api/etfs/${t}/metrics`)),
        ...validTickers.map(t => fetch(`${API_URL}/api/etfs/${t}/holdings`)),
      ]);

      if (!compRes.ok) throw new Error((await compRes.json()).message || 'Comparison failed');
      const compData: ComparisonResponse = await compRes.json();
      setComparison(compData);

      const metricsResponses = rest.slice(0, validTickers.length);
      const holdingsResponses = rest.slice(validTickers.length);
      const newMetrics: Record<string, MetricsData> = {};
      for (let i = 0; i < validTickers.length; i++) {
        const etfBase = compData.etfs.find(e => e.ticker === validTickers[i]);
        try {
          const m = await metricsResponses[i].json();
          newMetrics[validTickers[i]] = {
            return1M:     m.trailingReturns?.['1M']  ?? null,
            return3M:     m.trailingReturns?.['3M']  ?? null,
            return6M:     m.trailingReturns?.['6M']  ?? null,
            return1Y:     m.trailingReturns?.['1Y']  ?? null,
            return3Y:     m.trailingReturns?.['3Y']  ?? null,
            return5Y:     m.trailingReturns?.['5Y']  ?? null,
            returnYTD:    m.trailingReturns?.['YTD'] ?? null,
            volatility:   m.risk?.volatility    ?? m.riskMetrics?.volatility    ?? null,
            sharpe:       m.risk?.sharpe        ?? m.riskMetrics?.sharpe        ?? null,
            maxDrawdown:  m.risk?.maxDrawdown   ?? m.riskMetrics?.maxDrawdown   ?? null,
            beta:         m.risk?.beta          ?? m.riskMetrics?.beta          ?? null,
            expenseRatio: etfBase?.netExpenseRatio ?? null,
            aum:          etfBase?.aum             ?? null,
          };
        } catch { newMetrics[validTickers[i]] = { return1M:null,return3M:null,return6M:null,return1Y:null,return3Y:null,return5Y:null,returnYTD:null,volatility:null,sharpe:null,maxDrawdown:null,beta:null,expenseRatio: etfBase?.netExpenseRatio ?? null, aum: etfBase?.aum ?? null }; }
      }
      setMetricsMap(newMetrics);

      // Holdings
      const newHoldings: Record<string, HoldingRow[]> = {};
      const newAllHoldings: Record<string, HoldingRow[]> = {};
      for (let i = 0; i < validTickers.length; i++) {
        try {
          const h = await holdingsResponses[i].json();
          const arr = Array.isArray(h) ? h : h?.holdings ?? [];
          const parsed: HoldingRow[] = arr
            .filter((r: any) => (r.holdingTicker || r.ticker) && r.weight)
            .map((r: any) => ({
              ticker: r.holdingTicker ?? r.ticker,
              name:   r.holdingName  ?? r.name ?? '',
              weight: r.weight,
            }))
            .sort((a: HoldingRow, b: HoldingRow) => b.weight - a.weight);
          newAllHoldings[validTickers[i]] = parsed;          // all holdings for overlap
          newHoldings[validTickers[i]]    = parsed.slice(0, 10); // top 10 for display
        } catch {
          newHoldings[validTickers[i]]    = [];
          newAllHoldings[validTickers[i]] = [];
        }
      }
      setHoldingsMap(newHoldings);
      setAllHoldingsMap(newAllHoldings);

      // Prices
      await loadPrices(validTickers, period);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare ETFs');
    } finally { setIsLoading(false); }
  }

  async function handleCompare() {
    const valid = tickers.filter(t => t.trim().length > 0);
    if (valid.length < 2) { setError('Please enter at least 2 ETF tickers'); return; }
    await triggerCompare(valid);
  }

  async function loadPopular(t: string[]) { setTickers(t); setTimeout(() => triggerCompare(t), 100); }

  // ── Chart data — merge all normalised price series by date ─────────────────
  const chartData = useMemo(() => {
    const validTickers = tickers.filter(t => t.trim());
    if (!validTickers.length) return [];
    const dateMap = new Map<string, Record<string, number>>();
    validTickers.forEach(ticker => {
      const norm = normalisePrices(priceMap[ticker] ?? []);
      norm.forEach(pt => {
        if (!dateMap.has(pt.date)) dateMap.set(pt.date, {});
        dateMap.get(pt.date)![ticker] = pt.value;
      });
    });
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date: date.slice(0, 10), ...vals }));
  }, [priceMap, tickers]);

  // ── Holdings overlap ────────────────────────────────────────────────────────
  const overlapMatrix = useMemo(() => {
    const validTickers = tickers.filter(t => t.trim() && allHoldingsMap[t]);
    const pairs: { a: string; b: string; score: number; shared: string[] }[] = [];
    for (let i = 0; i < validTickers.length; i++) {
      for (let j = i + 1; j < validTickers.length; j++) {
        const a = validTickers[i]; const b = validTickers[j];
        const aH = allHoldingsMap[a] ?? []; const bH = allHoldingsMap[b] ?? [];
        const aMap = new Map(aH.map(h => [h.ticker, h.weight]));
        const bMap = new Map(bH.map(h => [h.ticker, h.weight]));
        const shared: string[] = [];
        let overlapWeight = 0;
        Array.from(aMap.entries()).forEach(([ticker, wa]) => {
          const wb = bMap.get(ticker);
          if (wb !== undefined) { shared.push(ticker); overlapWeight += Math.min(wa, wb); }
        });
        pairs.push({ a, b, score: +overlapWeight.toFixed(1), shared });
      }
    }
    return pairs;
  }, [allHoldingsMap, tickers]);

  // ── Best value helper ───────────────────────────────────────────────────────
  function bestTicker(field: keyof MetricsData, higherIsBetter: boolean): string | null {
    const validTickers = tickers.filter(t => t.trim() && metricsMap[t]);
    if (!validTickers.length) return null;
    let best: string | null = null; let bestVal: number | null = null;
    for (const t of validTickers) {
      const v = metricsMap[t]?.[field] as number | null;
      if (v === null) continue;
      if (bestVal === null || (higherIsBetter ? v > bestVal : v < bestVal)) { bestVal = v; best = t; }
    }
    return best;
  }

  const validTickers = tickers.filter(t => t.trim().length > 0);

  // ── Metrics rows config ────────────────────────────────────────────────────
  const METRIC_SECTIONS: {
    label: string;
    rows: { label: string; field: keyof MetricsData; fmt: (v: number|null) => string; higherIsBetter: boolean; desc?: string }[];
  }[] = [
    {
      label: 'Returns',
      rows: [
        { label: '1 Month',  field: 'return1M',  fmt: v => fmtPct(v), higherIsBetter: true },
        { label: '3 Month',  field: 'return3M',  fmt: v => fmtPct(v), higherIsBetter: true },
        { label: '6 Month',  field: 'return6M',  fmt: v => fmtPct(v), higherIsBetter: true },
        { label: '1 Year',   field: 'return1Y',  fmt: v => fmtPct(v), higherIsBetter: true },
        { label: '3 Year',   field: 'return3Y',  fmt: v => fmtPct(v), higherIsBetter: true },
        { label: '5 Year',   field: 'return5Y',  fmt: v => fmtPct(v), higherIsBetter: true },
        { label: 'YTD',      field: 'returnYTD', fmt: v => fmtPct(v), higherIsBetter: true },
      ],
    },
    {
      label: 'Risk-Adjusted',
      rows: [
        { label: 'Sharpe Ratio',  field: 'sharpe',      fmt: v => fmtNum(v), higherIsBetter: true,  desc: 'Higher = better risk-adjusted return' },
        { label: 'Beta (vs S&P)', field: 'beta',        fmt: v => fmtNum(v), higherIsBetter: false, desc: '<1 defensive, >1 aggressive' },
        { label: 'Volatility',    field: 'volatility',  fmt: v => fmtPct(v), higherIsBetter: false, desc: 'Annualised std dev — lower is less risky' },
        { label: 'Max Drawdown',  field: 'maxDrawdown', fmt: v => fmtPct(v), higherIsBetter: false, desc: 'Worst peak-to-trough loss' },
      ],
    },
    {
      label: 'Cost & Scale',
      rows: [
        { label: 'Expense Ratio', field: 'expenseRatio', fmt: v => fmtPct(v), higherIsBetter: false, desc: 'Annual fee — lower saves you money' },
        { label: 'AUM',           field: 'aum',          fmt: v => fmtAum(v), higherIsBetter: true,  desc: 'Larger AUM = more liquid' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div>
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 mb-2 inline-block">← Back to Dashboard</Link>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600"/> ETF Comparison
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Compare up to 15 ETFs across performance, risk, cost, and holdings</p>
        </div>

        {/* Welcome banner — shown once to first-time users */}
        <WelcomeBanner
          pageKey="compare"
          title="ETF Comparison"
          description="Compare up to 4 ETFs side by side — performance, risk, cost, and holdings — all in one view."
          bullets={[
            { text: 'Enter up to 4 tickers in the boxes below (e.g. SPY, QQQ, VTI, IVV) then click Compare' },
            { text: 'Use the quick-select buttons (S&P 500, Growth, Bonds) to load popular comparisons instantly' },
            { text: 'Scroll down to see the performance chart, risk metrics table, and holdings overlap' },
            { text: 'The best value in each metric row is highlighted in green — lower is better for cost and risk, higher is better for returns' },
          ]}
          startLabel="Load a popular comparison"
        />

        {/* Input */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Select ETFs</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            {tickers.map((ticker, i) => (
              <div key={i} className="relative">
                <input
                  type="text" value={ticker}
                  onChange={e => updateTicker(i, e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCompare()}
                  placeholder={`ETF ${i+1}`} maxLength={5}
                  className="w-24 px-3 py-2.5 border border-gray-300 rounded-lg text-center uppercase font-bold text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                />
                {i >= 2 && (
                  <button onClick={() => removeTicker(i)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                    <X className="w-3 h-3"/>
                  </button>
                )}
              </div>
            ))}
            {tickers.length < 15 && (
              <button onClick={addTicker}
                className="w-24 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-500">
                + Add
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'S&P 500', t: ['SPY','VOO','IVV'] },
                { label: 'Growth', t: ['QQQ','VUG','IWF'] },
                { label: 'Total Market', t: ['VTI','ITOT'] },
                { label: 'Bonds', t: ['BND','AGG'] },
              ].map(p => (
                <button key={p.label} onClick={() => loadPopular(p.t)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-blue-50 hover:text-blue-700 transition-colors">
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={handleCompare}
              disabled={isLoading || validTickers.length < 2}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors">
              {isLoading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Comparing…</>
                : 'Compare'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0"/> {error}
            </div>
          )}
        </div>

        {/* Results */}
        {comparison && comparison.etfs.length > 0 && (
          <>
            {/* Key Insights */}
            {comparison.insights.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5"/> Key Insights
                </p>
                <ul className="space-y-1">
                  {comparison.insights.map((ins, i) => (
                    <li key={i} className="text-sm text-blue-800 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0"/> {ins}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── 1. Performance Chart ─────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600"/> Performance
                </h2>
                {/* Period dropdown */}
                <div className="relative">
                  <select
                    value={period}
                    onChange={e => setPeriod(e.target.value as PeriodKey)}
                    className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                  >
                    {(['1M','3M','1Y','3Y','5Y'] as PeriodKey[]).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"/>
                </div>
              </div>

              {periodLoading ? (
                <div className="h-64 flex items-center justify-center text-sm text-gray-400">
                  <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2"/>
                  Loading chart…
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(0,7)}
                      interval={Math.floor(chartData.length / 6)}/>
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}/>
                    <Tooltip
                      formatter={(v: number, name: string) => [`${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, name]}
                      labelFormatter={l => `Date: ${l}`}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }}/>
                    {comparison.etfs.slice(0, 4).map((etf, i) => (
                      <Line key={etf.ticker} type="monotone" dataKey={etf.ticker}
                        stroke={ETF_COLORS[i % ETF_COLORS.length]}
                        dot={false} strokeWidth={2} connectNulls/>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-gray-400">
                  No price data available for this period
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3 text-center">
                % return from start of period · all series indexed to 0
              </p>
              {/* Warn ETFs with less data than selected period */}
              {(() => {
                const limited = comparison.etfs.slice(0, 4).filter(etf => {
                  const bars = priceMap[etf.ticker]?.length ?? 0;
                  const thresholds: Record<PeriodKey, number> = { '1M': 15, '3M': 55, '1Y': 200, '3Y': 600, '5Y': 1000 };
                  return bars > 0 && bars < thresholds[period];
                });
                const missing = comparison.etfs.slice(0, 4).filter(
                  etf => !priceMap[etf.ticker] || priceMap[etf.ticker].length === 0
                );
                return (
                  <>
                    {limited.length > 0 && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2 text-center">
                        Limited history for: {limited.map(e => e.ticker).join(', ')} — showing all available data
                      </p>
                    )}
                    {missing.length > 0 && (
                      <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-2 text-center">
                        No price history for: {missing.map(e => e.ticker).join(', ')}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            {/* ── ETF Name Cards ───────────────────────────────────────── */}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(comparison.etfs.length, 4)}, minmax(0, 1fr))` }}>
              {comparison.etfs.slice(0, 4).map((etf, i) => (
                <div key={etf.ticker} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-start gap-3">
                  <span className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: ETF_COLORS[i % ETF_COLORS.length] }}/>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900">{etf.ticker}</p>
                    <p className="text-xs text-gray-500 leading-snug mt-0.5 line-clamp-2">{etf.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {etf.assetClass && (
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5">{etf.assetClass}</span>
                      )}
                      {etf.strategyType && (
                        <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 rounded px-1.5 py-0.5">{etf.strategyType}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-5">Metrics</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide w-40">Metric</th>
                      {comparison.etfs.map((etf, i) => (
                        <th key={etf.ticker} className="text-center py-2 px-4 font-bold text-gray-900">
                          <span style={{ color: ETF_COLORS[i % ETF_COLORS.length] }}>{etf.ticker}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRIC_SECTIONS.map(section => (
                      <React.Fragment key={section.label}>
                        <tr>
                          <td colSpan={comparison.etfs.length + 1}
                            className="pt-5 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            {section.label}
                          </td>
                        </tr>
                        {section.rows.map(row => {
                          const best = bestTicker(row.field, row.higherIsBetter);
                          return (
                            <tr key={row.field} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2.5 pr-4 text-gray-600">
                                <span>{row.label}</span>
                                {row.desc && (
                                  <span className="block text-xs text-gray-400">{row.desc}</span>
                                )}
                              </td>
                              {comparison.etfs.map(etf => {
                                const v = metricsMap[etf.ticker]?.[row.field] as number | null ?? null;
                                const isBest = etf.ticker === best;
                                const isReturn = row.field.startsWith('return');
                                return (
                                  <td key={etf.ticker}
                                    className={`text-center py-2.5 px-4 font-medium rounded ${
                                      isBest ? 'bg-emerald-50 text-emerald-700 font-bold' :
                                      isReturn ? retCls(v) : 'text-gray-800'
                                    }`}>
                                    {row.fmt(v)}
                                    {isBest && <span className="ml-1 text-emerald-500">✓</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-4">✓ indicates best value in each row</p>
            </div>

            {/* ── 3. Holdings Analysis ──────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                <Layers className="w-5 h-5 text-violet-600"/> Holdings Analysis
              </h2>

              {/* Overlap scores */}
              {overlapMatrix.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Overlap Score (% of portfolio weight in common)</p>
                  <div className="flex flex-wrap gap-3">
                    {overlapMatrix.map(pair => {
                      const score = pair.score;
                      const cls = score >= 50 ? 'bg-red-50 border-red-200 text-red-700'
                        : score >= 25 ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700';
                      return (
                        <div key={`${pair.a}-${pair.b}`}
                          className={`border rounded-xl px-4 py-3 min-w-[160px] ${cls}`}>
                          <p className="font-bold text-lg">{score}%</p>
                          <p className="text-sm font-medium">{pair.a} vs {pair.b}</p>
                          <p className="text-xs mt-0.5 opacity-70">{pair.shared.length} shared holdings</p>
                          {pair.shared.length > 0 && (
                            <p className="text-xs mt-1 opacity-60 truncate">
                              {pair.shared.slice(0, 4).join(', ')}{pair.shared.length > 4 ? '…' : ''}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    🟢 &lt;25% low overlap · 🟡 25–50% moderate · 🔴 &gt;50% high overlap
                  </p>
                </div>
              )}

              {/* Top 10 holdings side by side */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Top 10 Holdings by Weight</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="text-left py-2 pr-3 text-xs text-gray-400 w-8">#</th>
                      {comparison.etfs.map((etf, i) => (
                        <th key={etf.ticker} colSpan={2}
                          className="text-center py-2 px-3 text-sm font-bold border-l border-gray-100"
                          style={{ color: ETF_COLORS[i % ETF_COLORS.length] }}>
                          {etf.ticker}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100">
                      <th className="py-1.5 pr-3"/>
                      {comparison.etfs.map(etf => (
                        <React.Fragment key={etf.ticker}>
                          <th className="py-1.5 px-3 text-left text-xs text-gray-400 border-l border-gray-100">Holding</th>
                          <th className="py-1.5 px-3 text-right text-xs text-gray-400">Weight</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Array.from({ length: 10 }).map((_, rank) => (
                      <tr key={rank} className="hover:bg-gray-50">
                        <td className="py-2 pr-3 text-xs text-gray-400">{rank + 1}</td>
                        {comparison.etfs.map(etf => {
                          const h = holdingsMap[etf.ticker]?.[rank];
                          const isShared = h && overlapMatrix.some(p =>
                            (p.a === etf.ticker || p.b === etf.ticker) && p.shared.includes(h.ticker)
                          );
                          return (
                            <React.Fragment key={etf.ticker}>
                              <td className={`py-2 px-3 border-l border-gray-100 font-medium ${isShared ? 'text-amber-700' : 'text-gray-800'}`}>
                                {h ? h.ticker : <span className="text-gray-300">—</span>}
                              </td>
                              <td className={`py-2 px-3 text-right text-xs ${isShared ? 'text-amber-600' : 'text-gray-500'}`}>
                                {h ? `${h.weight.toFixed(2)}%` : ''}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                <span className="text-amber-600 font-medium">Amber</span> = holding appears in multiple ETFs · Overlap score calculated across all holdings · Top 10 shown by weight
              </p>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-gray-400 pb-4">Data as of {comparison.asOfDate}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Outer shell — Suspense boundary for useSearchParams ──────────────────────
export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
      </div>
    }>
      <ComparePageInner/>
    </Suspense>
  );
}
