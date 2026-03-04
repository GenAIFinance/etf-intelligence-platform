'use client';

// ETF AI Screener — DeepSeek NLP powered
// Deploy to: apps/web/src/app/ai-screener/page.tsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, RefreshCw, ChevronDown, ChevronUp, ExternalLink,
  Send, Sparkles, AlertCircle, CheckCircle2, PenLine, Loader2,
  SlidersHorizontal, Zap,
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
type InputMode    = 'ai' | 'manual';

interface Constraints {
  excludeSectors:  string[];
  esgPreference:   EsgPref;
  maxExpenseRatio: number | null;
  minAUM:          number | null;
  minSharpe:       number | null;
  minReturn3Y:     number | null;
  minReturn5Y:     number | null;
  maxVolatility:   number | null;
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
  ticker:           string;
  name:             string;
  totalScore:       number;
  confidenceBand:   'High' | 'Medium' | 'Low';
  dataCompleteness: number;
  expenseRatio:     number | null;
  volatility:       number | null;
  maxDrawdown:      number | null;
  sharpeRatio:      number | null;
  annualized3Y:     number | null;
  annualized5Y:     number | null;
  dividendYield:    number | null;
  aum:              number | null;
  assetClass:       string | null;
  contributors:     MetricContributor[];
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
    default: return String(n);
  }
}

const BAND_STYLE: Record<string, string> = {
  High:   'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  Medium: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
  Low:    'bg-red-400/10 text-red-400 border-red-400/30',
};

const returnColor = (v: number | null): string =>
  v === null ? 'text-slate-500' : v >= 0 ? 'text-emerald-400' : 'text-red-400';

const OBJ_LABEL: Record<Objective, string> = {
  growth: 'Growth', income: 'Income', preservation: 'Preservation',
};
const RISK_LABEL: Record<RiskProfile, string> = {
  low: 'Conservative', medium: 'Moderate', high: 'Aggressive',
};
const OBJ_STYLE: Record<Objective, string> = {
  growth:       'bg-sky-400/10 text-sky-400 border border-sky-400/30',
  income:       'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30',
  preservation: 'bg-violet-400/10 text-violet-400 border border-violet-400/30',
};
const RISK_STYLE: Record<RiskProfile, string> = {
  low:    'bg-teal-400/10 text-teal-400 border border-teal-400/30',
  medium: 'bg-amber-400/10 text-amber-400 border border-amber-400/30',
  high:   'bg-orange-400/10 text-orange-400 border border-orange-400/30',
};

function ConfidenceBadge({ confidence }: { confidence: Confidence }): React.ReactElement {
  if (confidence === 'high') return (
    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
      <CheckCircle2 className="w-3 h-3" /><span>High confidence</span>
    </div>
  );
  if (confidence === 'medium') return (
    <div className="flex items-center gap-1.5 text-xs text-amber-400">
      <AlertCircle className="w-3 h-3" /><span>Medium — some parameters inferred</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 text-xs text-red-400">
      <AlertCircle className="w-3 h-3" /><span>Low confidence — please review settings</span>
    </div>
  );
}

function constraintChips(c: Constraints): string[] {
  const out: string[] = [];
  if (c.maxExpenseRatio !== null) out.push(`ER ≤ ${(c.maxExpenseRatio * 100).toFixed(2)}%`);
  if (c.minAUM !== null) {
    const label = c.minAUM >= 1e9 ? `$${(c.minAUM / 1e9).toFixed(1)}B` : `$${(c.minAUM / 1e6).toFixed(0)}M`;
    out.push(`AUM ≥ ${label}`);
  }
  if (c.minSharpe     !== null) out.push(`Sharpe ≥ ${c.minSharpe.toFixed(1)}`);
  if (c.minReturn3Y   !== null) out.push(`3Y ≥ ${(c.minReturn3Y * 100).toFixed(0)}%`);
  if (c.minReturn5Y   !== null) out.push(`5Y ≥ ${(c.minReturn5Y * 100).toFixed(0)}%`);
  if (c.maxVolatility !== null) out.push(`Vol ≤ ${(c.maxVolatility * 100).toFixed(0)}%`);
  if (c.excludeSectors.length > 0) out.push(`−${c.excludeSectors.join(', ')}`);
  if (c.esgPreference === 'prefer')  out.push('ESG+');
  if (c.esgPreference === 'exclude') out.push('no ESG');
  return out;
}

const EXAMPLE_QUERIES: string[] = [
  'Low-cost broad market ETFs with good 3-year returns and low volatility',
  'Conservative income ETFs focused on dividends, large funds only',
  'Aggressive growth ETFs, no ESG, expense ratio under 0.3%',
  'Capital preservation with high Sharpe ratio and minimal drawdown',
];

const EMPTY_CONSTRAINTS: Constraints = {
  excludeSectors: [], esgPreference: 'no_preference',
  maxExpenseRatio: null, minAUM: null, minSharpe: null,
  minReturn3Y: null, minReturn5Y: null, maxVolatility: null,
};

// ============================================================================
// RESULT CARD
// ============================================================================

function ResultCard({ item, rank, isSelected, onToggle }: {
  item: ScreenerResult; rank: number; isSelected: boolean; onToggle: (t: string) => void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`card-surface rounded-xl overflow-hidden transition-all duration-200 ${
      isSelected ? 'ring-1 ring-teal-400/60 border-teal-400/40' : 'hover:border-slate-600/60'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox" checked={isSelected}
              onChange={() => onToggle(item.ticker)}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="w-4 h-4 rounded accent-teal-400 cursor-pointer"
              title="Select for comparison"
            />
            <span className="rank-badge w-6 h-6 flex items-center justify-center text-xs font-bold rounded-md font-mono">
              {rank}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <Link href={`/etf/${item.ticker}`} className="font-bold text-slate-100 hover:text-teal-400 transition-colors font-mono text-sm tracking-wide">
                  {item.ticker}
                </Link>
                <ExternalLink className="w-3 h-3 text-slate-600" />
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${BAND_STYLE[item.confidenceBand] ?? 'bg-slate-700 text-slate-400'}`}>
                  {item.confidenceBand}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{item.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="score-glow text-2xl font-bold font-mono">{item.totalScore}</div>
            <div className="text-xs text-slate-600">score</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: '3Y Return', value: fmt(item.annualized3Y, 'pct'), color: returnColor(item.annualized3Y) },
            { label: 'Sharpe',   value: fmt(item.sharpeRatio, 'num'), color: 'text-slate-200' },
            { label: 'Expense',  value: fmt(item.expenseRatio, 'pct2'), color: 'text-slate-200' },
          ].map(({ label, value, color }) => (
            <div key={label} className="metric-cell rounded-lg p-2 text-center">
              <div className="text-xs text-slate-500 mb-0.5">{label}</div>
              <div className={`text-sm font-semibold font-mono ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          {item.contributors.slice(0, 5).map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
              <span className="text-teal-500/80 font-mono w-8 text-right shrink-0">{c.weight.toFixed(0)}%</span>
              <span className="flex-1 truncate">{c.metricName}</span>
              <div className="w-14 bg-slate-800 rounded-full h-1">
                <div className="bar-fill h-1 rounded-full" style={{ width: `${Math.min(100, c.contribution)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-xs text-slate-600 hover:text-teal-400 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Collapse' : 'More detail'}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-800/80 px-4 py-3 bg-slate-900/40">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {[
              { label: '5Y Return',  value: fmt(item.annualized5Y, 'pct'),  cls: returnColor(item.annualized5Y) },
              { label: 'Max DD',     value: item.maxDrawdown !== null ? `-${fmt(item.maxDrawdown, 'pct2')}` : 'N/A', cls: 'text-red-400' },
              { label: 'Volatility', value: fmt(item.volatility, 'pct2'),  cls: 'text-slate-300' },
              { label: 'AUM',        value: fmt(item.aum, 'aum'),          cls: 'text-slate-300' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="flex justify-between">
                <span className="text-slate-600">{label}</span>
                <span className={`font-medium font-mono ${cls}`}>{value}</span>
              </div>
            ))}
            {item.dividendYield !== null && (
              <div className="flex justify-between">
                <span className="text-slate-600">Div. Yield</span>
                <span className="font-medium font-mono text-emerald-400">{fmt(item.dividendYield, 'pct2')}</span>
              </div>
            )}
            {item.assetClass && (
              <div className="flex justify-between col-span-2">
                <span className="text-slate-600">Asset Class</span>
                <span className="font-medium text-slate-300">{item.assetClass}</span>
              </div>
            )}
            <div className="flex justify-between col-span-2">
              <span className="text-slate-600">Data completeness</span>
              <span className="font-medium font-mono text-slate-300">{item.dataCompleteness.toFixed(0)}%</span>
            </div>
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
}): React.ReactElement {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft]       = useState<ScreenerRequest>(parsed.request);

  const safeFloat = (s: string): number | null => { const f = parseFloat(s); return isNaN(f) ? null : f; };
  const setC = (k: keyof Constraints, v: Constraints[keyof Constraints]): void =>
    setDraft(d => ({ ...d, constraints: { ...d.constraints, [k]: v } }));

  const chips = constraintChips(parsed.request.constraints);

  const inputCls = "w-full px-3 py-2 text-sm bg-slate-800/60 border border-slate-700/60 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500/60 placeholder:text-slate-600 font-mono";
  const selectCls = "w-full px-3 py-2 text-sm bg-slate-800/60 border border-slate-700/60 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500/60";

  return (
    <div className="confirm-card rounded-2xl rounded-tl-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-slate-800/80 space-y-2">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-300 italic leading-relaxed">{parsed.interpretation}</p>
        </div>
        <ConfidenceBadge confidence={parsed.confidence} />
      </div>

      {!editMode ? (
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${OBJ_STYLE[parsed.request.objective]}`}>
              {OBJ_LABEL[parsed.request.objective]}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${RISK_STYLE[parsed.request.riskProfile]}`}>
              {RISK_LABEL[parsed.request.riskProfile]} Risk
            </span>
          </div>
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {chips.map(c => (
                <span key={c} className="px-2 py-0.5 bg-slate-800/70 text-slate-400 text-xs rounded-md border border-slate-700/50 font-mono">
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600">No constraints — screening all qualifying ETFs</p>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onConfirm} className="run-btn flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all">
              Run Screener →
            </button>
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-700/60 text-slate-400 hover:border-teal-500/40 hover:text-teal-400 text-sm rounded-xl transition-colors"
            >
              <PenLine className="w-3.5 h-3.5" /> Adjust
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Objective</label>
              <select value={draft.objective}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDraft(d => ({ ...d, objective: e.target.value as Objective }))}
                className={selectCls}>
                <option value="growth">Growth</option>
                <option value="income">Income</option>
                <option value="preservation">Preservation</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Risk Profile</label>
              <select value={draft.riskProfile}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDraft(d => ({ ...d, riskProfile: e.target.value as RiskProfile }))}
                className={selectCls}>
                <option value="low">Conservative</option>
                <option value="medium">Moderate</option>
                <option value="high">Aggressive</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Max Expense (%)</label>
              <input type="number" placeholder="e.g. 0.50" min="0" max="5" step="0.01"
                value={draft.constraints.maxExpenseRatio !== null ? (draft.constraints.maxExpenseRatio * 100).toFixed(2) : ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setC('maxExpenseRatio', e.target.value ? safeFloat(e.target.value)! / 100 : null)}
                className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Min AUM ($B)</label>
              <input type="number" placeholder="e.g. 1" min="0" step="0.1"
                value={draft.constraints.minAUM !== null ? (draft.constraints.minAUM / 1e9).toFixed(1) : ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setC('minAUM', e.target.value ? safeFloat(e.target.value)! * 1e9 : null)}
                className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Min Sharpe</label>
              <input type="number" placeholder="e.g. 0.5" step="0.1" min="0"
                value={draft.constraints.minSharpe ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setC('minSharpe', e.target.value ? safeFloat(e.target.value) : null)}
                className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Max Volatility (%)</label>
              <input type="number" placeholder="e.g. 20" min="0" max="100" step="1"
                value={draft.constraints.maxVolatility !== null ? (draft.constraints.maxVolatility * 100).toFixed(0) : ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setC('maxVolatility', e.target.value ? safeFloat(e.target.value)! / 100 : null)}
                className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Min 3Y Return (%)</label>
              <input type="number" placeholder="e.g. 10" step="1"
                value={draft.constraints.minReturn3Y !== null ? (draft.constraints.minReturn3Y * 100).toFixed(0) : ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setC('minReturn3Y', e.target.value ? safeFloat(e.target.value)! / 100 : null)}
                className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Min 5Y Return (%)</label>
              <input type="number" placeholder="e.g. 8" step="1"
                value={draft.constraints.minReturn5Y !== null ? (draft.constraints.minReturn5Y * 100).toFixed(0) : ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setC('minReturn5Y', e.target.value ? safeFloat(e.target.value)! / 100 : null)}
                className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">ESG Preference</label>
            <select value={draft.constraints.esgPreference}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setC('esgPreference', e.target.value as EsgPref)}
              className={selectCls}>
              <option value="no_preference">No preference</option>
              <option value="prefer">Prefer ESG</option>
              <option value="exclude">Exclude ESG</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Exclude Sectors (comma-separated)</label>
            <input type="text" placeholder="e.g. oil, tobacco, weapons"
              value={draft.constraints.excludeSectors.join(', ')}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setC('excludeSectors', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))
              }
              className={inputCls} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { onEditConfirm(draft); setEditMode(false); }} className="run-btn flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all">
              Run with these settings →
            </button>
            <button onClick={() => setEditMode(false)}
              className="px-4 py-2.5 border border-slate-700/60 text-slate-500 hover:text-slate-300 text-sm rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MANUAL SCREENER (step fallback)
// ============================================================================

function ManualScreener({ onRun }: { onRun: (r: ScreenerRequest) => void }): React.ReactElement {
  const [objective,   setObjective]   = useState<Objective>('growth');
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('medium');
  const [constraints, setConstraints] = useState<Constraints>(EMPTY_CONSTRAINTS);

  const safeFloat = (s: string): number | null => { const f = parseFloat(s); return isNaN(f) ? null : f; };
  const setC = (k: keyof Constraints, v: Constraints[keyof Constraints]): void =>
    setConstraints(prev => ({ ...prev, [k]: v }));

  const inputCls = "w-full px-3 py-2 text-sm bg-slate-800/60 border border-slate-700/60 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500/60 placeholder:text-slate-600 font-mono";
  const selectCls = "w-full px-3 py-2 text-sm bg-slate-800/60 border border-slate-700/60 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500/60";

  return (
    <div className="card-surface rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <SlidersHorizontal className="w-4 h-4 text-teal-400" />
        <span className="text-sm font-semibold text-slate-300">Manual Configuration</span>
      </div>

      {/* Step 1 */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-2">01 — Objective</p>
        <div className="grid grid-cols-3 gap-2">
          {(['growth', 'income', 'preservation'] as Objective[]).map(obj => (
            <button key={obj} onClick={() => setObjective(obj)}
              className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                objective === obj
                  ? `${OBJ_STYLE[obj]} ring-1 ring-current/40`
                  : 'border-slate-700/60 text-slate-500 hover:border-slate-600'
              }`}>
              {OBJ_LABEL[obj]}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-2">02 — Risk Profile</p>
        <div className="grid grid-cols-3 gap-2">
          {(['low', 'medium', 'high'] as RiskProfile[]).map(r => (
            <button key={r} onClick={() => setRiskProfile(r)}
              className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                riskProfile === r
                  ? `${RISK_STYLE[r]} ring-1 ring-current/40`
                  : 'border-slate-700/60 text-slate-500 hover:border-slate-600'
              }`}>
              {RISK_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: constraints */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-2">03 — Constraints <span className="normal-case text-slate-700">(optional)</span></p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-600 block mb-1">Max Expense (%)</label>
            <input type="number" placeholder="e.g. 0.50" min="0" max="5" step="0.01"
              value={constraints.maxExpenseRatio !== null ? (constraints.maxExpenseRatio * 100).toFixed(2) : ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setC('maxExpenseRatio', e.target.value ? safeFloat(e.target.value)! / 100 : null)}
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-1">Max Volatility (%)</label>
            <input type="number" placeholder="e.g. 20" min="0" max="100" step="1"
              value={constraints.maxVolatility !== null ? (constraints.maxVolatility * 100).toFixed(0) : ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setC('maxVolatility', e.target.value ? safeFloat(e.target.value)! / 100 : null)}
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-1">Min 3Y Return (%)</label>
            <input type="number" placeholder="e.g. 10" step="1"
              value={constraints.minReturn3Y !== null ? (constraints.minReturn3Y * 100).toFixed(0) : ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setC('minReturn3Y', e.target.value ? safeFloat(e.target.value)! / 100 : null)}
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-1">Min Sharpe</label>
            <input type="number" placeholder="e.g. 0.5" step="0.1" min="0"
              value={constraints.minSharpe ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setC('minSharpe', e.target.value ? safeFloat(e.target.value) : null)}
              className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-600 block mb-1">ESG</label>
            <select value={constraints.esgPreference}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setC('esgPreference', e.target.value as EsgPref)}
              className={selectCls}>
              <option value="no_preference">No preference</option>
              <option value="prefer">Prefer ESG</option>
              <option value="exclude">Exclude ESG</option>
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={() => onRun({ objective, riskProfile, constraints, page: 1, pageSize: 200, sortBy: 'totalScore' })}
        className="run-btn w-full py-2.5 text-sm font-semibold rounded-xl transition-all"
      >
        Run Screener →
      </button>
    </div>
  );
}

// ============================================================================
// LOADING INDICATOR
// ============================================================================

function LoadingDots({ label }: { label: string }): React.ReactElement {
  return (
    <div className="card-surface rounded-2xl rounded-tl-sm px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {[0, 150, 300].map(delay => (
            <span key={delay} className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms` }} />
          ))}
        </div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function AiScreenerPage(): React.ReactElement {
  const [mode,       setMode]       = useState<Mode>('idle');
  const [inputMode,  setInputMode]  = useState<InputMode>('ai');
  const [query,      setQuery]      = useState('');
  const [refineText, setRefineText] = useState('');
  const [parsed,     setParsed]     = useState<ParsedParams | null>(null);
  const [activeReq,  setActiveReq]  = useState<ScreenerRequest | null>(null);
  const [results,    setResults]    = useState<ScreenerResponse | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());

  const router      = useRouter();
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mode, parsed, results, error]);

  function toggleTicker(ticker: string): void {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) { next.delete(ticker); } else if (next.size < 15) { next.add(ticker); }
      return next;
    });
  }

  const parseQuery = useCallback(async (q: string, previous?: ScreenerRequest, hint?: FeedbackHint): Promise<void> => {
    setError(null);
    setMode('parsing');
    try {
      const res = await fetch(`${API_URL}/api/ai-screener/nlp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, previousRequest: previous, feedbackHint: hint }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      const data = await res.json() as ParsedParams;
      setParsed(data);
      setMode('confirming');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again');
      setMode('idle');
    }
  }, []);

  const runScreener = useCallback(async (req: ScreenerRequest): Promise<void> => {
    setError(null);
    setMode('screening');
    setActiveReq(req);
    setResults(null);
    setSelected(new Set());
    try {
      const res = await fetch(`${API_URL}/api/screener/screen`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req, page: 1, pageSize: 200 }),
      });
      if (!res.ok) throw new Error(`Screener error ${res.status}`);
      const data = await res.json() as ScreenerResponse;
      setResults(data);
      setMode('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run screener');
      setMode('confirming');
    }
  }, []);

  function handleSubmit(): void {
    const q = query.trim();
    if (!q || mode === 'parsing') return;
    void parseQuery(q);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }

  async function handleRefine(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const q = refineText.trim();
    if (!q || !activeReq) return;
    setRefineText('');
    setQuery(q);
    await parseQuery(q, activeReq);
  }

  async function handleFeedbackChip(hint: FeedbackHint): Promise<void> {
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

  function handleRestart(): void {
    setMode('idle'); setQuery(''); setRefineText('');
    setParsed(null); setActiveReq(null); setResults(null);
    setError(null); setSelected(new Set());
    setTimeout(() => textareaRef.current?.focus(), 100);
  }

  const isInProgress = mode === 'parsing' || mode === 'screening';
  const showInputPanel = inputMode === 'ai' && (mode === 'idle' || mode === 'parsing');

  return (
    <>
      <style>{`
        /* Fonts loaded via <link rel="preconnect"> in layout.tsx — see deployment notes */

        :root {
          --bg:        #060b14;
          --surface:   #0b1220;
          --border:    rgba(30, 50, 75, 0.7);
          --teal:      #2dd4bf;
          --teal-dim:  rgba(45, 212, 191, 0.15);
          --teal-glow: rgba(45, 212, 191, 0.08);
        }

        .ai-screener-root {
          font-family: 'DM Sans', sans-serif;
          background: var(--bg);
          min-height: 100vh;
        }

        .font-display { font-family: 'Oxanium', sans-serif; }
        .font-mono    { font-family: 'JetBrains Mono', monospace !important; }

        /* Dot grid background */
        .dot-grid {
          background-image: radial-gradient(rgba(45,212,191,0.06) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        .card-surface {
          background: var(--surface);
          border: 1px solid var(--border);
        }

        .confirm-card {
          background: var(--surface);
          border: 1px solid rgba(45,212,191,0.25);
          box-shadow: 0 0 0 1px rgba(45,212,191,0.05), inset 0 1px 0 rgba(45,212,191,0.07);
        }

        .metric-cell {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
        }

        .rank-badge {
          background: var(--teal-dim);
          color: var(--teal);
          border: 1px solid rgba(45,212,191,0.2);
        }

        .score-glow { color: var(--teal); text-shadow: 0 0 20px rgba(45,212,191,0.4); }

        .bar-fill {
          background: linear-gradient(90deg, rgba(45,212,191,0.6), var(--teal));
          box-shadow: 0 0 4px rgba(45,212,191,0.4);
        }

        .run-btn {
          background: linear-gradient(135deg, #14b8a6, #0d9488);
          color: white;
          border: 1px solid rgba(45,212,191,0.3);
          box-shadow: 0 2px 12px rgba(20,184,166,0.25);
        }
        .run-btn:hover {
          background: linear-gradient(135deg, #2dd4bf, #14b8a6);
          box-shadow: 0 4px 20px rgba(20,184,166,0.4);
          transform: translateY(-1px);
        }

        .send-btn {
          background: var(--teal-dim);
          border: 1px solid rgba(45,212,191,0.25);
          color: var(--teal);
          transition: all 0.15s;
        }
        .send-btn:hover:not(:disabled) {
          background: rgba(45,212,191,0.25);
          box-shadow: 0 0 12px rgba(45,212,191,0.2);
        }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .chat-input {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          color: #e2e8f0;
          resize: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .chat-input:focus {
          outline: none;
          border-color: rgba(45,212,191,0.4);
          box-shadow: 0 0 0 3px rgba(45,212,191,0.05);
        }
        .chat-input::placeholder { color: #334155; }

        .example-btn {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          color: #64748b;
          transition: all 0.15s;
        }
        .example-btn:hover:not(:disabled) {
          border-color: rgba(45,212,191,0.3);
          color: var(--teal);
          background: var(--teal-glow);
        }

        .mode-tab {
          transition: all 0.15s;
          color: #475569;
        }
        .mode-tab.active {
          color: var(--teal);
          border-bottom: 2px solid var(--teal);
        }
        .mode-tab:not(.active):hover { color: #94a3b8; }

        .chip-btn {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: #64748b;
          transition: all 0.15s;
        }
        .chip-btn:hover {
          border-color: rgba(45,212,191,0.3);
          color: var(--teal);
          background: var(--teal-glow);
        }

        .compare-bar {
          background: rgba(20,184,166,0.08);
          border: 1px solid rgba(45,212,191,0.2);
        }

        .refine-input {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          color: #e2e8f0;
        }
        .refine-input:focus {
          outline: none;
          border-color: rgba(45,212,191,0.35);
        }
        .refine-input::placeholder { color: #334155; }

        .header-bar {
          background: rgba(6,11,20,0.92);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(30,50,75,0.8);
        }

        .user-bubble {
          background: linear-gradient(135deg, rgba(45,212,191,0.2), rgba(45,212,191,0.1));
          border: 1px solid rgba(45,212,191,0.25);
          color: #e2e8f0;
        }

        .footer-bar {
          background: rgba(6,11,20,0.95);
          border-top: 1px solid rgba(30,50,75,0.6);
          backdrop-filter: blur(12px);
        }

        .diag-card {
          background: rgba(45,212,191,0.04);
          border: 1px solid rgba(45,212,191,0.12);
        }

        @keyframes pulse-teal {
          0%, 100% { box-shadow: 0 0 0 0 rgba(45,212,191,0.3); }
          50% { box-shadow: 0 0 0 6px rgba(45,212,191,0); }
        }

        .scan-dot { animation: pulse-teal 1.5s ease-in-out infinite; }
      `}</style>

      <div className="ai-screener-root">
        {/* Header */}
        <div className="header-bar sticky top-0 z-10 py-4 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-1.5 text-slate-500 hover:text-teal-400 transition-colors rounded-lg hover:bg-white/5">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="font-display text-lg font-semibold text-slate-100 tracking-wide">
                  ETF Intelligence
                  <span className="ml-2 text-xs font-mono text-teal-400/70 font-normal">AI Screener</span>
                </h1>
                <p className="text-xs text-slate-600">Describe what you&apos;re looking for in plain English</p>
              </div>
            </div>
            {mode !== 'idle' && (
              <button onClick={handleRestart}
                className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-teal-400 border border-slate-800 hover:border-teal-500/30 rounded-lg text-xs transition-all">
                <RefreshCw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="dot-grid min-h-screen">
          <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4">

            {/* Mode tabs — only show on idle */}
            {mode === 'idle' && (
              <div className="flex gap-6 border-b border-slate-800/60 pb-0 mb-2">
                <button
                  onClick={() => setInputMode('ai')}
                  className={`mode-tab pb-2.5 text-sm font-medium flex items-center gap-1.5 ${inputMode === 'ai' ? 'active' : ''}`}
                >
                  <Zap className="w-3.5 h-3.5" /> AI Query
                </button>
                <button
                  onClick={() => setInputMode('manual')}
                  className={`mode-tab pb-2.5 text-sm font-medium flex items-center gap-1.5 ${inputMode === 'manual' ? 'active' : ''}`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Manual
                </button>
              </div>
            )}

            {/* AI input panel */}
            {showInputPanel && (
              <div className="space-y-3 animate-fadeIn">
                <div className="card-surface rounded-2xl p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-3">What are you looking for?</p>
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={query}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="e.g. Low-cost broad market ETFs with good 3-year returns and low volatility…"
                      rows={3}
                      disabled={mode === 'parsing'}
                      className="chat-input w-full px-4 py-3 pr-12 text-sm rounded-xl disabled:opacity-50"
                    />
                    <button onClick={handleSubmit} disabled={!query.trim() || mode === 'parsing'}
                      className="send-btn absolute right-3 bottom-3 p-1.5 rounded-lg">
                      {mode === 'parsing'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-700 mt-2">↵ Enter to search · Shift+Enter for new line</p>
                </div>

                <div>
                  <p className="text-xs text-slate-700 uppercase tracking-widest mb-2 px-1">Examples</p>
                  <div className="space-y-1.5">
                    {EXAMPLE_QUERIES.map(ex => (
                      <button key={ex} onClick={() => { setQuery(ex); setTimeout(() => textareaRef.current?.focus(), 0); }}
                        disabled={mode === 'parsing'}
                        className="example-btn w-full text-left px-4 py-2.5 text-sm rounded-xl">
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Manual screener */}
            {mode === 'idle' && inputMode === 'manual' && (
              <ManualScreener onRun={(r) => void runScreener(r)} />
            )}

            {/* User query bubble */}
            {mode !== 'idle' && query && (
              <div className="flex justify-end">
                <div className="user-bubble max-w-sm px-4 py-2.5 rounded-2xl rounded-tr-sm">
                  <p className="text-sm">{query}</p>
                </div>
              </div>
            )}

            {mode === 'parsing' && <LoadingDots label="Analysing your query…" />}

            {(mode === 'confirming' || mode === 'screening') && parsed && (
              <ConfirmationCard
                parsed={parsed}
                onConfirm={() => void runScreener(parsed.request)}
                onEditConfirm={(r: ScreenerRequest) => void runScreener(r)}
              />
            )}

            {mode === 'screening' && <LoadingDots label="Scoring ETFs…" />}

            {error && (
              <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {mode === 'results' && results && (
              <>
                {/* Diagnosis summary */}
                <div className="diag-card rounded-2xl rounded-tl-sm px-4 py-3 space-y-1">
                  <p className="text-sm text-slate-300">{results.diagnosisSummary}</p>
                  <p className="text-xs text-slate-600 italic">Rankings based on historical data. Not financial advice.</p>
                </div>

                {/* Active request chips */}
                {activeReq && (
                  <div className="flex items-center gap-2 flex-wrap px-1">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${OBJ_STYLE[activeReq.objective]}`}>
                      {OBJ_LABEL[activeReq.objective]}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${RISK_STYLE[activeReq.riskProfile]}`}>
                      {RISK_LABEL[activeReq.riskProfile]} Risk
                    </span>
                    {constraintChips(activeReq.constraints).map(c => (
                      <span key={c} className="px-2 py-0.5 bg-slate-800/70 text-slate-400 text-xs rounded-md border border-slate-700/50 font-mono">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {/* Compare bar */}
                {selected.size >= 2 && (
                  <div className="compare-bar flex items-center justify-between rounded-xl px-4 py-2.5">
                    <span className="text-sm text-teal-300 font-medium font-mono">{selected.size} selected</span>
                    <button onClick={() => router.push(`/compare?tickers=${Array.from(selected).join(',')}`)}
                      className="run-btn px-4 py-1.5 text-sm font-semibold rounded-lg transition-all">
                      Compare ({selected.size}) →
                    </button>
                  </div>
                )}

                {/* Results list */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs text-slate-600 font-mono">{results.pagination.total} ETFs matched</span>
                    <span className="text-xs text-slate-700">Sorted by score</span>
                  </div>
                  {results.data.map((item, i) => (
                    <ResultCard key={item.ticker} item={item} rank={i + 1}
                      isSelected={selected.has(item.ticker)} onToggle={toggleTicker} />
                  ))}
                </div>

                {/* Refinement panel */}
                <div className="card-surface rounded-2xl p-4 space-y-3 mt-2">
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-widest">Refine Results</p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { hint: 'too_risky'        as FeedbackHint, label: 'Less risky'       },
                      { hint: 'too_conservative' as FeedbackHint, label: 'More aggressive'  },
                      { hint: 'too_expensive'    as FeedbackHint, label: 'Lower cost'       },
                      { hint: 'not_aligned'      as FeedbackHint, label: 'Re-evaluate goal' },
                    ]).map(({ hint, label }) => (
                      <button key={hint} onClick={() => void handleFeedbackChip(hint)}
                        className="chip-btn px-3 py-1.5 text-xs font-medium rounded-full">
                        {label}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => void handleRefine(e)} className="flex gap-2">
                    <input type="text" value={refineText}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRefineText(e.target.value)}
                      placeholder="Or describe what you'd change…"
                      className="refine-input flex-1 px-3 py-2 text-sm rounded-xl focus:outline-none" />
                    <button type="submit" disabled={!refineText.trim()}
                      className="send-btn p-2 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed">
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Footer */}
        <div className="footer-bar fixed bottom-0 left-0 right-0 py-2 px-4 text-center">
          <p className="text-xs text-slate-700">
            Educational tool only · Not financial advice · Past performance does not guarantee future results
          </p>
        </div>
      </div>
    </>
  );
}
