'use client';

// ETF AI Screener — DeepSeek NLP powered
// apps/web/src/app/ai-screener/page.tsx
//
// Flow:
//   idle → user types query → POST /api/ai-screener/nlp (DeepSeek extracts params)
//        → confirmation card (interpretation + badges + active constraints)
//        → user hits "Run" or "Adjust" → POST /api/screener/screen → results
//        → refinement bar (chips + free-text) loops back to NLP with previousRequest

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, RefreshCw, ChevronDown, ChevronUp, ExternalLink,
  Send, Sparkles, AlertCircle, CheckCircle2, PenLine, Loader2,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ============================================================================
// TYPES
// ============================================================================

type Objective    = 'growth' | 'income' | 'preservation';
type RiskProfile  = 'low' | 'medium' | 'high';
type EsgPref      = 'no_preference' | 'prefer' | 'exclude';
type Confidence   = 'high' | 'medium' | 'low';
type FeedbackHint = 'too_risky' | 'too_conservative' | 'too_expensive' | 'not_aligned';
type Mode         = 'idle' | 'parsing' | 'confirming' | 'screening' | 'results';

interface Constraints {
  excludeSectors:  string[];
  esgPreference:   EsgPref;
  maxExpenseRatio: number | null;   // decimal e.g. 0.002
  minAUM:          number | null;   // USD     e.g. 1_000_000_000
  minSharpe:       number | null;
  minReturn3Y:     number | null;   // decimal e.g. 0.10
  minReturn5Y:     number | null;
  maxVolatility:   number | null;   // decimal e.g. 0.15
}

interface ScreenerRequest {
  objective:   Objective;
  riskProfile: RiskProfile;
  constraints: Constraints;
  page?:     number;
  pageSize?: number;
  sortBy?:   'totalScore' | 'expenseRatio' | 'sharpeRatio' | 'volatility';
}

interface ParsedParams {
  request:        ScreenerRequest;
  interpretation: string;
  confidence:     Confidence;
}

interface MetricContributor {
  metricName:   string;
  weight:       number;
  rawValue:     number | null;
  contribution: number;
}

interface ScreenerResult {
  ticker:          string;
  name:            string;
  totalScore:      number;
  confidenceBand:  'High' | 'Medium' | 'Low';
  dataCompleteness: number;
  expenseRatio:    number | null;
  volatility:      number | null;
  maxDrawdown:     number | null;
  sharpeRatio:     number | null;
  annualized3Y:    number | null;
  annualized5Y:    number | null;
  dividendYield:   number | null;
  aum:             number | null;
  assetClass:      string | null;
  contributors:    MetricContributor[];
}

interface ScreenerResponse {
  data:             ScreenerResult[];
  pagination:       { page: number; pageSize: number; total: number; totalPages: number };
  diagnosisSummary: string;
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

function fmt(n: number | null, type: 'pct' | 'pct2' | 'num' | 'aum'): string {
  if (n === null || n === undefined) return 'N/A';
  switch (type) {
    case 'pct':  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
    case 'pct2': return `${(n * 100).toFixed(2)}%`;
    case 'num':  return n.toFixed(2);
    case 'aum':
      if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
      if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
      return `$${n.toFixed(0)}`;
  }
}

const BAND_COLOR: Record<string, string> = {
  High:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50  text-amber-700  border-amber-200',
  Low:    'bg-red-50    text-red-600    border-red-200',
};
const returnColor = (v: number | null) =>
  v === null ? 'text-gray-400' : v >= 0 ? 'text-emerald-600' : 'text-red-500';

const OBJ_LABEL:  Record<Objective,   string> = { growth: 'Growth', income: 'Income', preservation: 'Preservation' };
const RISK_LABEL: Record<RiskProfile, string> = { low: 'Conservative', medium: 'Moderate', high: 'Aggressive' };
const OBJ_COLOR:  Record<Objective,   string> = {
  growth:       'bg-blue-100   text-blue-800',
  income:       'bg-emerald-100 text-emerald-800',
  preservation: 'bg-purple-100 text-purple-800',
};
const RISK_COLOR: Record<RiskProfile, string> = {
  low:    'bg-teal-100  text-teal-800',
  medium: 'bg-amber-100 text-amber-800',
  high:   'bg-orange-100 text-orange-800',
};
const CONFIDENCE_BADGE: Record<Confidence, { icon: JSX.Element; label: string; color: string }> = {
  high:   { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'High confidence',   color: 'text-emerald-600' },
  medium: { icon: <AlertCircle  className="w-3.5 h-3.5" />, label: 'Medium confidence', color: 'text-amber-600'   },
  low:    { icon: <AlertCircle  className="w-3.5 h-3.5" />, label: 'Low confidence — please review', color: 'text-red-500' },
};

/** Convert active constraints to human-readable chips */
function chips(c: Constraints): string[] {
  const out: string[] = [];
  if (c.maxExpenseRatio !== null) out.push(`Expense ≤ ${(c.maxExpenseRatio * 100).toFixed(2)}%`);
  if (c.minAUM          !== null) out.push(`AUM ≥ ${c.minAUM >= 1e9 ? `$${(c.minAUM / 1e9).toFixed(1)}B` : `$${(c.minAUM / 1e6).toFixed(0)}M`}`);
  if (c.minSharpe       !== null) out.push(`Sharpe ≥ ${c.minSharpe.toFixed(1)}`);
  if (c.minReturn3Y     !== null) out.push(`3Y Return ≥ ${(c.minReturn3Y * 100).toFixed(0)}%`);
  if (c.minReturn5Y     !== null) out.push(`5Y Return ≥ ${(c.minReturn5Y * 100).toFixed(0)}%`);
  if (c.maxVolatility   !== null) out.push(`Volatility ≤ ${(c.maxVolatility * 100).toFixed(0)}%`);
  if (c.excludeSectors.length > 0) out.push(`Exclude: ${c.excludeSectors.join(', ')}`);
  if (c.esgPreference === 'prefer')  out.push('ESG preferred');
  if (c.esgPreference === 'exclude') out.push('No ESG');
  return out;
}

const DEFAULT_CONSTRAINTS: Constraints = {
  excludeSectors: [], esgPreference: 'no_preference',
  maxExpenseRatio: null, minAUM: null, minSharpe: null,
  minReturn3Y: null, minReturn5Y: null, maxVolatility: null,
};

const EXAMPLE_QUERIES = [
  'Low-cost broad market ETFs with good 3-year returns and low volatility',
  'Conservative income ETFs focused on dividends, large funds only',
  'Aggressive growth ETFs, no ESG, expense ratio under 0.3%',
  'Capital preservation with high Sharpe ratio and minimal drawdown',
];

// ============================================================================
// RESULT CARD
// ============================================================================

function ResultCard({ item, rank, isSelected, onToggle }: {
  item: ScreenerResult; rank: number; isSelected: boolean; onToggle: (t: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all ${isSelected ? 'border-teal-400 ring-1 ring-teal-300' : 'border-gray-200 hover:border-teal-300'}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox" checked={isSelected} onChange={() => onToggle(item.ticker)}
              onClick={e => e.stopPropagation()}
              className="w-4 h-4 rounded border-gray-300 accent-teal-600 cursor-pointer"
              title="Select for comparison"
            />
            <span className="w-7 h-7 flex items-center justify-center bg-teal-50 text-teal-700 text-xs font-bold rounded-lg border border-teal-100">
              {rank}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <Link href={`/etf/${item.ticker}`} className="font-bold text-gray-900 hover:text-teal-600 transition-colors">
                  {item.ticker}
                </Link>
                <ExternalLink className="w-3 h-3 text-gray-400" />
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${BAND_COLOR[item.confidenceBand] ?? 'bg-gray-100 text-gray-600'}`}>
                  {item.confidenceBand}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[220px]">{item.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-teal-600">{item.totalScore}</div>
            <div className="text-xs text-gray-400">score</div>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {([
            { label: '3Y Return', value: fmt(item.annualized3Y, 'pct'), cls: returnColor(item.annualized3Y) },
            { label: 'Sharpe',    value: fmt(item.sharpeRatio,  'num'), cls: 'text-gray-800' },
            { label: 'Expense',   value: fmt(item.expenseRatio, 'pct2'), cls: 'text-gray-800' },
          ] as const).map(m => (
            <div key={m.label} className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-400 mb-0.5">{m.label}</div>
              <div className={`text-sm font-semibold ${m.cls}`}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Score contributors */}
        <div className="space-y-1">
          {item.contributors.slice(0, 5).map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="font-mono text-teal-600 w-8 text-right">[{c.weight.toFixed(0)}%]</span>
              <span className="flex-1">{c.metricName}</span>
              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, c.contribution)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => setExpanded(!expanded)} className="mt-3 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Less' : 'More detail'}
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">5Y Return</span><span className={`font-medium ${returnColor(item.annualized5Y)}`}>{fmt(item.annualized5Y, 'pct')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Max Drawdown</span><span className="font-medium text-red-500">{item.maxDrawdown !== null ? `-${fmt(item.maxDrawdown, 'pct2')}` : 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Volatility</span><span className="font-medium text-gray-700">{fmt(item.volatility, 'pct2')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">AUM</span><span className="font-medium text-gray-700">{fmt(item.aum, 'aum')}</span></div>
            {item.dividendYield !== null && (
              <div className="flex justify-between"><span className="text-gray-500">Div. Yield</span><span className="font-medium text-emerald-600">{fmt(item.dividendYield, 'pct2')}</span></div>
            )}
            {item.assetClass && (
              <div className="flex justify-between col-span-2"><span className="text-gray-500">Asset Class</span><span className="font-medium text-gray-700">{item.assetClass}</span></div>
            )}
            <div className="flex justify-between col-span-2"><span className="text-gray-500">Data completeness</span><span className="font-medium text-gray-700">{item.dataCompleteness.toFixed(0)}%</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CONFIRMATION CARD
// ============================================================================

function ConfirmationCard({ parsed, onConfirm, onEditConfirm }: {
  parsed: ParsedParams;
  onConfirm: () => void;
  onEditConfirm: (r: ScreenerRequest) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft]       = useState<ScreenerRequest>(parsed.request);

  const safeFloat = (s: string): number | null => { const f = parseFloat(s); return isNaN(f) ? null : f; };
  const setC = (k: keyof Constraints, v: any) => setDraft(d => ({ ...d, constraints: { ...d.constraints, [k]: v } }));

  const activeChips = chips(parsed.request.constraints);
  const cb = CONFIDENCE_BADGE[parsed.confidence];

  return (
    <div className="bg-white border border-teal-200 rounded-2xl rounded-tl-sm shadow-sm overflow-hidden">
      {/* Interpretation header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 space-y-2">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-700 italic leading-relaxed">{parsed.interpretation}</p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs ${cb.color}`}>
          {cb.icon}
          <span>{cb.label}</span>
        </div>
      </div>

      {!editMode ? (
        <div className="px-4 py-3 space-y-3">
          {/* Profile badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${OBJ_COLOR[parsed.request.objective]}`}>
              {OBJ_LABEL[parsed.request.objective]}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${RISK_COLOR[parsed.request.riskProfile]}`}>
              {RISK_LABEL[parsed.request.riskProfile]} risk
            </span>
          </div>

          {/* Constraint chips */}
          {activeChips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {activeChips.map(c => (
                <span key={c} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md">{c}</span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No additional constraints — screening all qualifying ETFs</p>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onConfirm}
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors">
              Run Screener →
            </button>
            <button onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-600 hover:border-teal-300 hover:text-teal-700 text-sm rounded-xl transition-colors">
              <PenLine className="w-3.5 h-3.5" /> Adjust
            </button>
          </div>
        </div>
      ) : (
        /* ── Inline edit form ── */
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Objective</label>
              <select value={draft.objective} onChange={e => setDraft(d => ({ ...d, objective: e.target.value as Objective }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400">
                <option value="growth">Growth</option>
                <option value="income">Income</option>
                <option value="preservation">Preservation</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Risk profile</label>
              <select value={draft.riskProfile} onChange={e => setDraft(d => ({ ...d, riskProfile: e.target.value as RiskProfile }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400">
                <option value="low">Conservative</option>
                <option value="medium">Moderate</option>
                <option value="high">Aggressive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Max expense ratio (%)</label>
              <input type="number" placeholder="e.g. 0.50" min="0" max="5" step="0.01"
                value={draft.constraints.maxExpenseRatio !== null ? (draft.constraints.maxExpenseRatio * 100).toFixed(2) : ''}
                onChange={e => setC('maxExpenseRatio', e.target.value ? safeFloat(e.target.value)! / 100 : null)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Min AUM ($B)</label>
              <input type="number" placeholder="e.g. 1" min="0" step="0.1"
                value={draft.constraints.minAUM !== null ? (draft.constraints.minAUM / 1e9).toFixed(1) : ''}
                onChange={e => setC('minAUM', e.target.value ? safeFloat(e.target.value)! * 1e9 : null)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Min Sharpe ratio</label>
              <input type="number" placeholder="e.g. 0.5" step="0.1" min="0"
                value={draft.constraints.minSharpe ?? ''}
                onChange={e => setC('minSharpe', e.target.value ? safeFloat(e.target.value) : null)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Max volatility (%)</label>
              <input type="number" placeholder="e.g. 20" min="0" max="100" step="1"
                value={draft.constraints.maxVolatility !== null ? (draft.constraints.maxVolatility * 100).toFixed(0) : ''}
                onChange={e => setC('maxVolatility', e.target.value ? safeFloat(e.target.value)! / 100 : null)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Min 3Y return (%)</label>
              <input type="number" placeholder="e.g. 10" step="1"
                value={draft.constraints.minReturn3Y !== null ? (draft.constraints.minReturn3Y * 100).toFixed(0) : ''}
                onChange={e => setC('minReturn3Y', e.target.value ? safeFloat(e.target.value)! / 100 : null)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Min 5Y return (%)</label>
              <input type="number" placeholder="e.g. 8" step="1"
                value={draft.constraints.minReturn5Y !== null ? (draft.constraints.minReturn5Y * 100).toFixed(0) : ''}
                onChange={e => setC('minReturn5Y', e.target.value ? safeFloat(e.target.value)! / 100 : null)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">ESG preference</label>
            <select value={draft.constraints.esgPreference}
              onChange={e => setC('esgPreference', e.target.value as EsgPref)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="no_preference">No preference</option>
              <option value="prefer">Prefer ESG funds</option>
              <option value="exclude">Exclude ESG funds</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Exclude sectors (comma-separated)</label>
            <input type="text" placeholder="e.g. oil, tobacco, weapons"
              value={draft.constraints.excludeSectors.join(', ')}
              onChange={e => setC('excludeSectors', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => { onEditConfirm(draft); setEditMode(false); }}
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors">
              Run with these settings →
            </button>
            <button onClick={() => setEditMode(false)}
              className="px-4 py-2.5 border border-gray-200 text-gray-500 hover:text-gray-700 text-sm rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function AiScreenerPage() {
  const [mode, setMode]             = useState<Mode>('idle');
  const [query, setQuery]           = useState('');
  const [refineText, setRefineText] = useState('');
  const [parsed, setParsed]         = useState<ParsedParams | null>(null);
  const [activeReq, setActiveReq]   = useState<ScreenerRequest | null>(null);
  const [results, setResults]       = useState<ScreenerResponse | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [selected, setSelected]     = useState<Set<string>>(new Set());

  const router     = useRouter();
  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mode, parsed, results, error]);

  function toggleTicker(ticker: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) { next.delete(ticker); } else if (next.size < 15) { next.add(ticker); }
      return next;
    });
  }

  // ── Parse via DeepSeek ───────────────────────────────────────────────────

  async function parseQuery(q: string, previous?: ScreenerRequest, hint?: FeedbackHint) {
    setError(null);
    setMode('parsing');

    try {
      const res = await fetch(`${API_URL}/api/ai-screener/nlp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: q, previousRequest: previous, feedbackHint: hint }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }

      const data: ParsedParams = await res.json();
      setParsed(data);
      setMode('confirming');
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong — please try again');
      setMode('idle');
    }
  }

  // ── Run screener ─────────────────────────────────────────────────────────

  async function runScreener(req: ScreenerRequest) {
    setError(null);
    setMode('screening');
    setActiveReq(req);
    setResults(null);
    setSelected(new Set());

    try {
      const res = await fetch(`${API_URL}/api/screener/screen`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...req, page: 1, pageSize: 200 }),
      });

      if (!res.ok) throw new Error(`Screener error ${res.status}`);
      const data: ScreenerResponse = await res.json();
      setResults(data);
      setMode('results');
    } catch (err: any) {
      setError(err.message ?? 'Failed to run screener');
      setMode('confirming');
    }
  }

  function handleSubmit() {
    const q = query.trim();
    if (!q || mode === 'parsing') return;
    parseQuery(q);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }

  async function handleRefine(e: React.FormEvent) {
    e.preventDefault();
    const q = refineText.trim();
    if (!q || !activeReq) return;
    setRefineText('');
    setMode('idle'); // briefly reset so query bubble re-renders
    setQuery(q);
    await parseQuery(q, activeReq);
  }

  async function handleFeedbackChip(hint: FeedbackHint) {
    if (!activeReq) return;
    const msg: Record<FeedbackHint, string> = {
      too_risky:        'Make it less risky — prioritize stability and lower volatility',
      too_conservative: 'Make it more aggressive — I want more upside',
      too_expensive:    'Lower the cost — reduce expense ratio',
      not_aligned:      'These results feel misaligned — re-evaluate my goal',
    };
    setQuery(msg[hint]);
    await parseQuery(msg[hint], activeReq, hint);
  }

  function handleRestart() {
    setMode('idle'); setQuery(''); setRefineText('');
    setParsed(null); setActiveReq(null); setResults(null);
    setError(null);  setSelected(new Set());
    setTimeout(() => textareaRef.current?.focus(), 100);
  }

  // ── Loading dots ─────────────────────────────────────────────────────────

  const LoadingDots = ({ label }: { label: string }) => (
    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {[0, 150, 300].map(d => (
            <span key={d} className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const showQueryBubble = mode !== 'idle' && query;
  const showIdle        = mode === 'idle' || mode === 'parsing';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white py-6 px-4 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">ETF AI Screener</h1>
              <p className="text-sm text-teal-100">Describe what you're looking for in plain English</p>
            </div>
          </div>
          {mode !== 'idle' && (
            <button onClick={handleRestart}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors">
              <RefreshCw className="w-4 h-4" /> Restart
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-28">

        {/* ── Idle: text input + examples ── */}
        {showIdle && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">What are you looking for in an ETF?</p>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Low-cost broad market ETFs with good 3-year returns and low volatility…"
                  rows={3}
                  disabled={mode === 'parsing'}
                  className="w-full px-4 py-3 pr-12 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-60 disabled:bg-gray-50"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!query.trim() || mode === 'parsing'}
                  className="absolute right-3 bottom-3 p-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {mode === 'parsing'
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Enter to search · Shift+Enter for new line</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Try an example</p>
              <div className="space-y-2">
                {EXAMPLE_QUERIES.map(ex => (
                  <button
                    key={ex}
                    onClick={() => { setQuery(ex); setTimeout(() => textareaRef.current?.focus(), 0); }}
                    disabled={mode === 'parsing'}
                    className="w-full text-left px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 transition-colors disabled:opacity-50"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── User query bubble ── */}
        {showQueryBubble && (
          <div className="flex justify-end">
            <div className="max-w-sm bg-teal-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm">
              <p className="text-sm">{query}</p>
            </div>
          </div>
        )}

        {/* ── Parsing loading ── */}
        {mode === 'parsing' && <LoadingDots label="Analysing your query…" />}

        {/* ── Confirmation card ── */}
        {(mode === 'confirming' || mode === 'screening') && parsed && (
          <ConfirmationCard
            parsed={parsed}
            onConfirm={() => runScreener(parsed.request)}
            onEditConfirm={runScreener}
          />
        )}

        {/* ── Screening loading ── */}
        {mode === 'screening' && <LoadingDots label="Scoring ETFs…" />}

        {/* ── Error ── */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* ── Results ── */}
        {mode === 'results' && results && (
          <>
            {/* Summary */}
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <p className="text-sm text-gray-700">{results.diagnosisSummary}</p>
              <p className="text-xs text-gray-400 mt-1.5 italic">Rankings based on historical data. Not financial advice.</p>
            </div>

            {/* Active profile */}
            {activeReq && (
              <div className="flex items-center gap-2 flex-wrap px-1">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${OBJ_COLOR[activeReq.objective]}`}>
                  {OBJ_LABEL[activeReq.objective]}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${RISK_COLOR[activeReq.riskProfile]}`}>
                  {RISK_LABEL[activeReq.riskProfile]} risk
                </span>
                {chips(activeReq.constraints).map(c => (
                  <span key={c} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md">{c}</span>
                ))}
              </div>
            )}

            {/* Compare bar */}
            {selected.size >= 2 && (
              <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5">
                <span className="text-sm text-teal-700 font-medium">{selected.size} ETFs selected</span>
                <button
                  onClick={() => router.push(`/compare?tickers=${Array.from(selected).join(',')}`)}
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Compare ({selected.size}) →
                </button>
              </div>
            )}

            {/* Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-gray-500">{results.pagination.total} ETFs matched</span>
                <span className="text-xs text-gray-400">Sorted by score</span>
              </div>
              {results.data.map((item, i) => (
                <ResultCard key={item.ticker} item={item} rank={i + 1}
                  isSelected={selected.has(item.ticker)} onToggle={toggleTicker} />
              ))}
            </div>

            {/* ── Refinement panel ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 space-y-3 mt-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Refine your results</p>

              {/* Quick chips */}
              <div className="flex flex-wrap gap-2">
                {([
                  { hint: 'too_risky'        as FeedbackHint, label: 'Less risky'      },
                  { hint: 'too_conservative' as FeedbackHint, label: 'More aggressive' },
                  { hint: 'too_expensive'    as FeedbackHint, label: 'Lower cost'      },
                  { hint: 'not_aligned'      as FeedbackHint, label: 'Re-evaluate goal' },
                ]).map(({ hint, label }) => (
                  <button
                    key={hint}
                    onClick={() => handleFeedbackChip(hint)}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-teal-50 text-gray-600 hover:text-teal-700 border border-transparent hover:border-teal-200 rounded-full transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Free-text refinement */}
              <form onSubmit={handleRefine} className="flex gap-2">
                <input
                  type="text"
                  value={refineText}
                  onChange={e => setRefineText(e.target.value)}
                  placeholder="Or describe what you'd change…"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <button
                  type="submit"
                  disabled={!refineText.trim()}
                  className="p-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 py-2 px-4 text-center">
        <p className="text-xs text-gray-400">
          Educational tool only. Not financial advice. Past performance does not guarantee future results.
        </p>
      </div>
    </div>
  );
}
