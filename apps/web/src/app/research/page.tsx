'use client';

// ETF AI Research — Consolidated page
// Deploy to: apps/web/src/app/research/page.tsx
//
// Two tabs:
//   "Screen ETFs" — plain English → NLP param extraction → ranked screener results
//   "Ask ETF"     — market question → OpenAI expert analysis + ETF recommendations

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, RefreshCw, ChevronDown, ChevronUp, ExternalLink,
  Send, Sparkles, AlertCircle, CheckCircle2, PenLine, Loader2,
  Zap, MessageSquare, TrendingUp, TrendingDown, Minus, ShieldAlert,
  BarChart2, XCircle, Lightbulb, Info, AlertTriangle,
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
type ScreenMode   = 'idle' | 'parsing' | 'confirming' | 'screening' | 'results';
type TabMode      = 'screen' | 'ask';
type Sentiment    = 'bullish' | 'bearish' | 'neutral' | 'mixed';

interface Constraints {
  excludeSectors: string[]; esgPreference: EsgPref;
  maxExpenseRatio: number|null; minAUM: number|null; minSharpe: number|null;
  minReturn3Y: number|null; minReturn5Y: number|null; maxVolatility: number|null;
}
interface ScreenerRequest {
  objective: Objective; riskProfile: RiskProfile; constraints: Constraints;
  page?: number; pageSize?: number; sortBy?: 'totalScore'|'expenseRatio'|'sharpeRatio'|'volatility';
}
interface ParsedParams { request: ScreenerRequest; interpretation: string; confidence: Confidence; }
interface MetricContributor { metricName: string; weight: number; rawValue: number|null; contribution: number; }
interface ScreenerResult {
  ticker: string; name: string; totalScore: number; confidenceBand: 'High'|'Medium'|'Low';
  dataCompleteness: number; expenseRatio: number|null; volatility: number|null;
  maxDrawdown: number|null; sharpeRatio: number|null; annualized3Y: number|null;
  annualized5Y: number|null; dividendYield: number|null; aum: number|null;
  assetClass: string|null; contributors: MetricContributor[];
}
interface ScreenerResponse {
  data: ScreenerResult[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  diagnosisSummary: string;
}

interface AdvisorMetrics { return3Y: number|null; volatility: number|null; sharpe: number|null; expenseRatio: number|null; dividendYield: number|null; }
interface AdvisorRec { ticker: string; name: string; allocation: number|null; reasoning: string; risks: string; profile: string[]; metrics: AdvisorMetrics; }
interface AdvisorAvoid { ticker: string; name: string; reasoning: string; alternative: string|null; }
interface AdvisorResponse {
  analysis: { macroView: string; keyRisks: string[]; sentiment: Sentiment; };
  recommendations: AdvisorRec[]; avoid: AdvisorAvoid[];
  education: Record<string,string>; disclaimer: string;
}
interface ChatMessage { id: string; role: 'user'|'assistant'; text: string; response?: AdvisorResponse; }
interface HistoryMsg  { role: 'user'|'assistant'; content: string; }

// ============================================================================
// HELPERS
// ============================================================================

function fmt(n: number|null, type: 'pct'|'pct2'|'num'|'aum'): string {
  if (n === null || n === undefined) return 'N/A';
  switch (type) {
    case 'pct':  return `${n >= 0 ? '+' : ''}${(n*100).toFixed(1)}%`;
    case 'pct2': return `${(n*100).toFixed(2)}%`;
    case 'num':  return n.toFixed(2);
    case 'aum':
      if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`;
      if (n >= 1e6) return `$${(n/1e6).toFixed(0)}M`;
      return `$${n.toFixed(0)}`;
    default: return String(n);
  }
}

const returnCls = (v: number|null) =>
  v === null ? 'text-gray-400' : v >= 0 ? 'text-emerald-600' : 'text-red-600';

const CONFIDENCE_BAND_CLS: Record<string, string> = {
  High:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50  text-amber-700  border-amber-200',
  Low:    'bg-red-50    text-red-700    border-red-200',
};
const OBJ_LABEL:  Record<Objective,  string> = { growth:'Growth', income:'Income', preservation:'Preservation' };
const RISK_LABEL: Record<RiskProfile,string> = { low:'Conservative', medium:'Moderate', high:'Aggressive' };
const OBJ_CLS: Record<Objective, string> = {
  growth:       'bg-blue-50  text-blue-700  border border-blue-200',
  income:       'bg-emerald-50 text-emerald-700 border border-emerald-200',
  preservation: 'bg-violet-50 text-violet-700 border border-violet-200',
};
const RISK_CLS: Record<RiskProfile, string> = {
  low:    'bg-teal-50   text-teal-700   border border-teal-200',
  medium: 'bg-amber-50  text-amber-700  border border-amber-200',
  high:   'bg-orange-50 text-orange-700 border border-orange-200',
};

const SENTIMENT_META: Record<Sentiment, { label:string; cls:string; icon:React.ReactElement }> = {
  bullish: { label:'Bullish',  cls:'bg-emerald-50 text-emerald-700 border-emerald-200', icon:<TrendingUp  className="w-3.5 h-3.5"/> },
  bearish: { label:'Bearish',  cls:'bg-red-50    text-red-700    border-red-200',       icon:<TrendingDown className="w-3.5 h-3.5"/> },
  neutral: { label:'Neutral',  cls:'bg-gray-100  text-gray-600   border-gray-200',     icon:<Minus       className="w-3.5 h-3.5"/> },
  mixed:   { label:'Mixed',    cls:'bg-amber-50  text-amber-700  border-amber-200',    icon:<BarChart2   className="w-3.5 h-3.5"/> },
};

function constraintChips(c: Constraints): string[] {
  const out: string[] = [];
  if (c.maxExpenseRatio !== null) out.push(`ER ≤ ${(c.maxExpenseRatio*100).toFixed(2)}%`);
  if (c.minAUM !== null) {
    const l = c.minAUM >= 1e9 ? `$${(c.minAUM/1e9).toFixed(1)}B` : `$${(c.minAUM/1e6).toFixed(0)}M`;
    out.push(`AUM ≥ ${l}`);
  }
  if (c.minSharpe   !== null) out.push(`Sharpe ≥ ${c.minSharpe.toFixed(1)}`);
  if (c.minReturn3Y !== null) out.push(`3Y ≥ ${(c.minReturn3Y*100).toFixed(0)}%`);
  if (c.minReturn5Y !== null) out.push(`5Y ≥ ${(c.minReturn5Y*100).toFixed(0)}%`);
  if (c.maxVolatility !== null) out.push(`Vol ≤ ${(c.maxVolatility*100).toFixed(0)}%`);
  if (c.excludeSectors.length > 0) out.push(`Excl: ${c.excludeSectors.join(', ')}`);
  if (c.esgPreference === 'prefer')  out.push('ESG preferred');
  if (c.esgPreference === 'exclude') out.push('No ESG');
  return out;
}

const SCREEN_EXAMPLES = [
  'Low-cost broad market ETFs with good 3-year returns and low volatility',
  'Conservative income ETFs focused on dividends, large funds only',
  'Aggressive growth ETFs, expense ratio under 0.3%',
  'Capital preservation with high Sharpe ratio and minimal drawdown',
];
const ASK_EXAMPLES = [
  'The Fed just raised rates — which ETFs benefit and which should I avoid?',
  'AI stocks are booming — how can I get exposure without chasing a bubble?',
  'With geopolitical tensions rising, what defensive ETFs make sense?',
  'How should I think about inflation protection in my ETF portfolio?',
];

// ============================================================================
// SCREENER — RESULT CARD (light theme)
// ============================================================================

function ResultCard({ item, rank, isSelected, onToggle }: {
  item: ScreenerResult; rank: number; isSelected: boolean; onToggle: (t:string)=>void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all ${
      isSelected ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
    }`}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={isSelected} onChange={()=>onToggle(item.ticker)}
              onClick={(e:React.MouseEvent)=>e.stopPropagation()}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"/>
            <span className="w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg bg-gray-100 text-gray-500">
              {rank}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <Link href={`/etf/${item.ticker}`}
                  className="font-bold text-blue-600 hover:text-blue-700 hover:underline text-sm">
                  {item.ticker}
                </Link>
                <ExternalLink className="w-3 h-3 text-gray-300"/>
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${CONFIDENCE_BAND_CLS[item.confidenceBand] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {item.confidenceBand}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{item.name}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-800">{item.totalScore}</div>
            <div className="text-xs text-gray-400">score</div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label:'3Y Return', value:fmt(item.annualized3Y,'pct'), cls:returnCls(item.annualized3Y) },
            { label:'Sharpe',   value:fmt(item.sharpeRatio,'num'),   cls:'text-gray-700' },
            { label:'Expense',  value:fmt(item.expenseRatio,'pct2'), cls:'text-gray-700' },
          ].map(({label,value,cls})=>(
            <div key={label} className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-400 mb-0.5">{label}</div>
              <div className={`text-sm font-semibold ${cls}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Score contributors */}
        <div className="space-y-1.5 mb-3">
          {item.contributors.slice(0,4).map((c,i)=>(
            <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
              <span className="text-blue-500 font-medium w-8 text-right shrink-0">{c.weight.toFixed(0)}%</span>
              <span className="flex-1 truncate text-gray-500">{c.metricName}</span>
              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-blue-400" style={{width:`${Math.min(100,c.contribution)}%`}}/>
              </div>
            </div>
          ))}
        </div>

        <button onClick={()=>setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
          {expanded ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
          {expanded ? 'Collapse' : 'More details'}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {[
              {label:'5Y Return',  value:fmt(item.annualized5Y,'pct'),  cls:returnCls(item.annualized5Y)},
              {label:'Max DD',     value:item.maxDrawdown!==null?`-${fmt(item.maxDrawdown,'pct2')}`:'N/A', cls:'text-red-600'},
              {label:'Volatility', value:fmt(item.volatility,'pct2'),   cls:'text-gray-700'},
              {label:'AUM',        value:fmt(item.aum,'aum'),           cls:'text-gray-700'},
            ].map(({label,value,cls})=>(
              <div key={label} className="flex justify-between">
                <span className="text-gray-400">{label}</span>
                <span className={`font-medium ${cls}`}>{value}</span>
              </div>
            ))}
            {item.dividendYield!==null&&(
              <div className="flex justify-between">
                <span className="text-gray-400">Div. Yield</span>
                <span className="font-medium text-emerald-600">{fmt(item.dividendYield,'pct2')}</span>
              </div>
            )}
            {item.assetClass&&(
              <div className="flex justify-between col-span-2">
                <span className="text-gray-400">Asset Class</span>
                <span className="font-medium text-gray-600">{item.assetClass}</span>
              </div>
            )}
            <div className="flex justify-between col-span-2">
              <span className="text-gray-400">Data completeness</span>
              <span className="font-medium text-gray-600">{item.dataCompleteness.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SCREENER — CONFIRMATION CARD
// ============================================================================

function ConfirmationCard({ parsed, onConfirm, onEditConfirm }: {
  parsed: ParsedParams; onConfirm:()=>void; onEditConfirm:(r:ScreenerRequest)=>void;
}): React.ReactElement {
  const [editMode, setEditMode] = useState(false);
  const [draft,    setDraft]    = useState<ScreenerRequest>(parsed.request);

  // Reset draft whenever parsed changes (e.g. after refinement)
  useEffect(() => { setDraft(parsed.request); setEditMode(false); }, [parsed]);
  const safeFloat = (s:string):number|null => { const f=parseFloat(s); return isNaN(f)?null:f; };
  const setC = (k:keyof Constraints, v:Constraints[keyof Constraints]) =>
    setDraft(d=>({...d,constraints:{...d.constraints,[k]:v}}));
  const chips = constraintChips(parsed.request.constraints);

  const inputCls  = "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent placeholder:text-gray-300";
  const selectCls = "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent bg-white";

  return (
    <div className="bg-white border border-blue-200 rounded-xl shadow-sm overflow-hidden">
      {/* Interpretation header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 space-y-2 bg-blue-50/40">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-blue-500 mt-0.5 shrink-0"/>
          <p className="text-sm text-gray-700 leading-relaxed italic">{parsed.interpretation}</p>
        </div>
        {parsed.confidence==='high' ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 className="w-3 h-3"/><span>High confidence</span></div>
        ) : parsed.confidence==='medium' ? (
          <div className="flex items-center gap-1.5 text-xs text-amber-600"><AlertCircle className="w-3 h-3"/><span>Medium confidence — some parameters inferred</span></div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle className="w-3 h-3"/><span>Low confidence — please review settings</span></div>
        )}
      </div>

      {!editMode ? (
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${OBJ_CLS[parsed.request.objective]}`}>
              {OBJ_LABEL[parsed.request.objective]}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${RISK_CLS[parsed.request.riskProfile]}`}>
              {RISK_LABEL[parsed.request.riskProfile]} Risk
            </span>
          </div>
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {chips.map(c=>(
                <span key={c} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200">
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No additional constraints — screening all qualifying ETFs</p>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onConfirm}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm">
              Run Screener →
            </button>
            <button onClick={()=>setEditMode(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 text-sm rounded-xl transition-colors">
              <PenLine className="w-3.5 h-3.5"/> Adjust
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Objective</label>
              <select value={draft.objective} onChange={(e)=>setDraft(d=>({...d,objective:e.target.value as Objective}))} className={selectCls}>
                <option value="growth">Growth</option><option value="income">Income</option><option value="preservation">Preservation</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Risk Profile</label>
              <select value={draft.riskProfile} onChange={(e)=>setDraft(d=>({...d,riskProfile:e.target.value as RiskProfile}))} className={selectCls}>
                <option value="low">Conservative</option><option value="medium">Moderate</option><option value="high">Aggressive</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Max Expense Ratio (%)</label>
              <input type="number" placeholder="e.g. 0.50" min="0" max="5" step="0.01"
                value={draft.constraints.maxExpenseRatio!==null?(draft.constraints.maxExpenseRatio*100).toFixed(2):''}
                onChange={(e)=>{ const v=safeFloat(e.target.value); setC('maxExpenseRatio',v!==null?v/100:null); }} className={inputCls}/>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Min AUM ($B)</label>
              <input type="number" placeholder="e.g. 1" min="0" step="0.1"
                value={draft.constraints.minAUM!==null?(draft.constraints.minAUM/1e9).toFixed(1):''}
                onChange={(e)=>{ const v=safeFloat(e.target.value); setC('minAUM',v!==null?v*1e9:null); }} className={inputCls}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Min Sharpe Ratio</label>
              <input type="number" placeholder="e.g. 0.5" step="0.1" min="0"
                value={draft.constraints.minSharpe??''}
                onChange={(e)=>setC('minSharpe',e.target.value?safeFloat(e.target.value):null)} className={inputCls}/>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Max Volatility (%)</label>
              <input type="number" placeholder="e.g. 20" min="0" max="100" step="1"
                value={draft.constraints.maxVolatility!==null?(draft.constraints.maxVolatility*100).toFixed(0):''}
                onChange={(e)=>{ const v=safeFloat(e.target.value); setC('maxVolatility',v!==null?v/100:null); }} className={inputCls}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Min 3Y Return (%)</label>
              <input type="number" placeholder="e.g. 10" step="1"
                value={draft.constraints.minReturn3Y!==null?(draft.constraints.minReturn3Y*100).toFixed(0):''}
                onChange={(e)=>{ const v=safeFloat(e.target.value); setC('minReturn3Y',v!==null?v/100:null); }} className={inputCls}/>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Min 5Y Return (%)</label>
              <input type="number" placeholder="e.g. 8" step="1"
                value={draft.constraints.minReturn5Y!==null?(draft.constraints.minReturn5Y*100).toFixed(0):''}
                onChange={(e)=>{ const v=safeFloat(e.target.value); setC('minReturn5Y',v!==null?v/100:null); }} className={inputCls}/>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">ESG Preference</label>
            <select value={draft.constraints.esgPreference} onChange={(e)=>setC('esgPreference',e.target.value as EsgPref)} className={selectCls}>
              <option value="no_preference">No preference</option><option value="prefer">Prefer ESG</option><option value="exclude">Exclude ESG</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={()=>{onEditConfirm(draft);setEditMode(false);}}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors">
              Run with these settings →
            </button>
            <button onClick={()=>setEditMode(false)}
              className="px-4 py-2.5 border border-gray-200 text-gray-500 text-sm rounded-xl hover:text-gray-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ADVISOR — REC CARD
// ============================================================================

function AdvisorRecCard({ rec }: { rec: AdvisorRec }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
      <div className="p-4">
        <div className="flex items-start gap-2 flex-wrap mb-2">
          <Link href={`/etf/${rec.ticker}`}
            className="font-bold text-blue-600 hover:text-blue-700 hover:underline text-sm">
            {rec.ticker}
          </Link>
          {rec.allocation!==null && (
            <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-medium">
              ~{rec.allocation}%
            </span>
          )}
          {rec.profile.map(p=>(
            <span key={p} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full border border-gray-200">
              {p}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-2 truncate">{rec.name}</p>
        <p className="text-sm text-gray-700 leading-relaxed mb-3">{rec.reasoning}</p>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            {label:'3Y',  value:fmt(rec.metrics.return3Y,'pct'),    cls:returnCls(rec.metrics.return3Y)},
            {label:'Vol', value:fmt(rec.metrics.volatility,'pct2'), cls:'text-gray-600'},
            {label:'SR',  value:fmt(rec.metrics.sharpe,'num'),      cls:'text-gray-600'},
            {label:'ER',  value:fmt(rec.metrics.expenseRatio,'pct2'),cls:'text-gray-600'},
          ].map(m=>(
            <div key={m.label} className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-400 mb-0.5">{m.label}</div>
              <div className={`text-sm font-semibold ${m.cls}`}>{m.value}</div>
            </div>
          ))}
        </div>
        <button onClick={()=>setOpen(!open)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-amber-600 transition-colors">
          <ShieldAlert className="w-3 h-3"/>
          {open?'Hide risks':'View risks'}
          {open?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>}
        </button>
        {open && (
          <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700 leading-relaxed">
            {rec.risks}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ADVISOR — AVOID CARD
// ============================================================================

function AdvisorAvoidCard({ item }: { item: AdvisorAvoid }): React.ReactElement {
  return (
    <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-1">
      <div className="flex items-center gap-2">
        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0"/>
        <span className="font-bold text-sm text-red-700">{item.ticker}</span>
        <span className="text-xs text-gray-400 truncate">{item.name}</span>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">{item.reasoning}</p>
      {item.alternative && (
        <p className="text-xs text-blue-600">→ Consider instead: <span className="font-medium">{item.alternative}</span></p>
      )}
    </div>
  );
}

// ============================================================================
// ADVISOR — RESPONSE BLOCK
// ============================================================================

function AdvisorResponseBlock({ response }: { response: AdvisorResponse }): React.ReactElement {
  const [eduOpen, setEduOpen] = useState(false);
  const s = SENTIMENT_META[response.analysis?.sentiment ?? 'neutral'];
  const hasRecs  = (response.recommendations??[]).length > 0;
  const hasAvoid = (response.avoid??[]).length > 0;
  const hasEdu   = Object.keys(response.education??{}).length > 0;

  return (
    <div className="space-y-3">
      {/* Macro card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.cls}`}>
            {s.icon}{s.label}
          </span>
          <span className="text-xs text-gray-400">Market outlook</span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{response.analysis?.macroView}</p>
        {(response.analysis?.keyRisks??[]).length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Key risks</p>
            {response.analysis.keyRisks.map((r,i)=>(
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0"/>
                <span className="text-sm text-gray-600">{r}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {hasRecs && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ETFs to consider</p>
          {response.recommendations.map(rec=><AdvisorRecCard key={rec.ticker} rec={rec}/>)}
        </div>
      )}

      {hasAvoid && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Exercise caution with</p>
          {response.avoid.map(item=><AdvisorAvoidCard key={item.ticker} item={item}/>)}
        </div>
      )}

      {hasEdu && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <button onClick={()=>setEduOpen(!eduOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors">
            <span className="flex items-center gap-2 font-medium text-gray-600">
              <Lightbulb className="w-4 h-4 text-amber-500"/>Learn the concepts
            </span>
            {eduOpen?<ChevronUp className="w-4 h-4 text-gray-400"/>:<ChevronDown className="w-4 h-4 text-gray-400"/>}
          </button>
          {eduOpen && (
            <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
              {Object.entries(response.education).map(([concept,explanation])=>(
                <div key={concept}>
                  <p className="text-sm font-semibold text-gray-700 mb-0.5">{concept}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{explanation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5"/>
        <p className="text-xs text-gray-400 leading-relaxed">{response.disclaimer}</p>
      </div>
    </div>
  );
}

// ============================================================================
// LOADING
// ============================================================================

function LoadingRow({ label }: { label:string }): React.ReactElement {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-blue-500 animate-spin"/>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ResearchPage(): React.ReactElement {
  const [tab, setTab] = useState<TabMode>('screen');

  // Screener state
  const [screenMode, setScreenMode] = useState<ScreenMode>('idle');
  const [query,      setQuery]      = useState('');
  const [refineText, setRefineText] = useState('');
  const [parsed,     setParsed]     = useState<ParsedParams|null>(null);
  const [activeReq,  setActiveReq]  = useState<ScreenerRequest|null>(null);
  const [results,    setResults]    = useState<ScreenerResponse|null>(null);
  const [screenErr,  setScreenErr]  = useState<string|null>(null);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());

  // Advisor state
  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [askInput,   setAskInput]   = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askError,   setAskError]   = useState<string|null>(null);

  const router    = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLTextAreaElement>(null);
  const askRef    = useRef<HTMLTextAreaElement>(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },
    [screenMode, parsed, results, screenErr, messages, askLoading]);

  // ── Screener ──────────────────────────────────────────────────────────────
  function toggleTicker(ticker:string) {
    setSelected(prev=>{ const n=new Set(prev); n.has(ticker)?n.delete(ticker):n.size<15&&n.add(ticker); return n; });
  }

  const parseQuery = useCallback(async (q:string, previous?:ScreenerRequest, hint?:FeedbackHint):Promise<void> => {
    setScreenErr(null); setScreenMode('parsing');
    try {
      const res = await fetch(`${API_URL}/api/ai-screener/nlp`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({query:q, previousRequest:previous, feedbackHint:hint}),
      });
      if(!res.ok){const b=await res.json().catch(()=>({})) as {error?:string}; throw new Error(b.error??`Error ${res.status}`);}
      const data=await res.json() as ParsedParams;
      setParsed(data); setScreenMode('confirming');
    } catch(err){ setScreenErr(err instanceof Error?err.message:'Something went wrong'); setScreenMode('idle'); }
  },[]);

  const runScreener = useCallback(async (req:ScreenerRequest):Promise<void> => {
    setScreenErr(null); setScreenMode('screening'); setActiveReq(req); setResults(null); setSelected(new Set());
    try {
      const res = await fetch(`${API_URL}/api/screener/screen`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...req,page:1,pageSize:200}),
      });
      if(!res.ok) throw new Error(`Screener error ${res.status}`);
      const data=await res.json() as ScreenerResponse;
      setResults(data); setScreenMode('results');
    } catch(err){ setScreenErr(err instanceof Error?err.message:'Failed to run screener'); setScreenMode('confirming'); }
  },[]);

  function handleScreenReset(skipFocus = false) {
    setScreenMode('idle'); setQuery(''); setRefineText('');
    setParsed(null); setActiveReq(null); setResults(null); setScreenErr(null); setSelected(new Set());
    if (!skipFocus) setTimeout(()=>screenRef.current?.focus(), 100);
  }

  // ── Advisor ───────────────────────────────────────────────────────────────
  const sendAsk = useCallback(async (q:string):Promise<void> => {
    const trimmedQuery=q.trim(); if(!trimmedQuery||askLoading) return;
    const userMsg:ChatMessage={id:Date.now().toString(),role:'user',text:trimmedQuery};
    setMessages(prev=>[...prev, userMsg]);
    setAskInput(''); setAskLoading(true); setAskError(null);
    try {
      const history:HistoryMsg[] = messages.slice(-8).reduce<HistoryMsg[]>((acc, m)=>{
        if(m.role==='user') acc.push({role:'user', content:m.text});
        else if(m.response) acc.push({role:'assistant', content:JSON.stringify(m.response)});
        return acc;
      },[]);
      const res = await fetch(`${API_URL}/api/ai-chat/query`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({query:trimmedQuery,history}),
      });
      if(!res.ok){const b=await res.json().catch(()=>({})) as {error?:string}; throw new Error(b.error??`Server error ${res.status}`);}
      const data=await res.json() as AdvisorResponse;
      setMessages(prev=>[...prev,{id:(Date.now()+1).toString(),role:'assistant',text:'',response:data}]);
    } catch(err){
      setAskError(err instanceof Error?err.message:'Something went wrong — please try again');
      setMessages(prev=>prev.filter(m=>m.id!==userMsg.id));
    } finally { setAskLoading(false); setTimeout(()=>askRef.current?.focus(),100); }
  },[askLoading,messages]);

  const isScreenBusy = screenMode==='parsing'||screenMode==='screening';

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5"/>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">AI Research</h1>
              <p className="text-sm text-gray-500 mt-0.5">Screen ETFs or ask any market question</p>
            </div>
          </div>
          <button onClick={()=>{ handleScreenReset(true); setMessages([]); setAskInput(''); setAskError(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg text-xs transition-colors bg-white">
            <RefreshCw className="w-3.5 h-3.5"/> Reset
          </button>
        </div>
      </div>

      {/* ── Not-advice bar ───────────────────────────────────────────────── */}
      <div className="bg-amber-50 border-b border-amber-100 py-1.5 px-4 text-center">
        <p className="text-xs text-amber-600">
          <ShieldAlert className="inline w-3 h-3 mr-1 mb-0.5"/>
          Educational purposes only · Not investment advice · Consult a financial advisor before making decisions
        </p>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16 space-y-5">

        {/* ── Two-tab toggle ───────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-1 flex gap-1 shadow-sm">
          {([
            { key:'screen' as TabMode, label:'Screen ETFs', icon:<Zap           className="w-4 h-4"/> },
            { key:'ask'    as TabMode, label:'Ask ETF',     icon:<MessageSquare className="w-4 h-4"/> },
          ]).map(t=>(
            <button key={t.key} onClick={()=>{ setTab(t.key); if(t.key!=='screen') handleScreenReset(true); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab===t.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab subtitle */}
        <p className="text-sm text-gray-500 px-1">
          {tab==='screen'
            ? 'Type what you\'re looking for in plain English. AI will extract your parameters and rank ETFs by score.'
            : 'Ask about macro events, rate decisions, sector themes, or any ETF question. Get expert analysis with ETF context.'}
        </p>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SCREEN ETFs TAB                                                   */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab==='screen' && (
          <>
            {/* Input box — only show when idle */}
            {screenMode==='idle' && (
              <div className="space-y-3">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                    What are you looking for?
                  </label>
                  <div className="relative">
                    <textarea ref={screenRef} value={query}
                      onChange={(e:React.ChangeEvent<HTMLTextAreaElement>)=>setQuery(e.target.value)}
                      onKeyDown={(e:React.KeyboardEvent<HTMLTextAreaElement>)=>{
                        if(e.key==='Enter'&&!e.shiftKey){e.preventDefault(); if(query.trim()) void parseQuery(query.trim());}
                      }}
                      placeholder="e.g. Low-cost broad market ETFs with good 3-year returns and low volatility…"
                      rows={3} disabled={isScreenBusy}
                      className="w-full px-4 py-3 pr-14 text-sm border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 placeholder:text-gray-300"/>
                    <button onClick={()=>{ if(query.trim()) void parseQuery(query.trim()); }}
                      disabled={!query.trim()||isScreenBusy}
                      className="absolute right-3 bottom-3 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors">
                      <Send className="w-4 h-4"/>
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">↵ Enter to search · Shift+Enter for new line</p>
                </div>

                {/* Examples */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Example searches</p>
                  <div className="space-y-2">
                    {SCREEN_EXAMPLES.map(ex=>(
                      <button key={ex} onClick={()=>{setQuery(ex);setTimeout(()=>screenRef.current?.focus(),0);}}
                        className="w-full text-left text-sm text-gray-600 px-4 py-2.5 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* User query bubble */}
            {screenMode!=='idle' && query && (
              <div className="flex justify-end">
                <div className="max-w-lg bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm">
                  <p className="text-sm">{query}</p>
                </div>
              </div>
            )}

            {/* Loading states */}
            {screenMode==='parsing' && <LoadingRow label="Extracting your parameters…"/>}
            {screenMode==='screening' && <LoadingRow label="Scoring ETFs against your criteria…"/>}

            {/* Confirmation card */}
            {(screenMode==='confirming'||screenMode==='screening') && parsed && (
              <ConfirmationCard parsed={parsed}
                onConfirm={()=>void runScreener(parsed.request)}
                onEditConfirm={(r)=>void runScreener(r)}/>
            )}

            {/* Error */}
            {screenErr && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5"/>
                <p className="text-sm text-red-600">{screenErr}</p>
              </div>
            )}

            {/* Results */}
            {screenMode==='results' && results && (
              <>
                {/* Summary */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <p className="text-sm text-gray-700">{results.diagnosisSummary}</p>
                  <p className="text-xs text-gray-400 mt-1 italic">Rankings based on historical data. Not financial advice.</p>
                </div>

                {/* Active filter chips */}
                {activeReq && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${OBJ_CLS[activeReq.objective]}`}>
                      {OBJ_LABEL[activeReq.objective]}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${RISK_CLS[activeReq.riskProfile]}`}>
                      {RISK_LABEL[activeReq.riskProfile]} Risk
                    </span>
                    {constraintChips(activeReq.constraints).map(c=>(
                      <span key={c} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200">{c}</span>
                    ))}
                    <button onClick={()=>handleScreenReset(false)}
                      className="ml-auto text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-1 rounded-lg transition-colors">
                      New search
                    </button>
                  </div>
                )}

                {/* Compare bar */}
                {selected.size>=2 && (
                  <div className="bg-blue-50 border border-blue-200 flex items-center justify-between rounded-xl px-4 py-2.5">
                    <span className="text-sm text-blue-700 font-medium">{selected.size} ETFs selected</span>
                    <button onClick={()=>router.push(`/compare?tickers=${Array.from(selected).join(',')}`)}
                      className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                      Compare ({selected.size}) →
                    </button>
                  </div>
                )}

                {/* Count */}
                <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                  <span>{results.pagination.total} ETFs matched</span>
                  <span>Sorted by score · Select up to 15 to compare</span>
                </div>

                {/* Result cards */}
                <div className="space-y-3">
                  {results.data.map((item,i)=>(
                    <ResultCard key={item.ticker} item={item} rank={i+1}
                      isSelected={selected.has(item.ticker)} onToggle={toggleTicker}/>
                  ))}
                </div>

                {/* Refinement */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Refine results</p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      {hint:'too_risky' as FeedbackHint,        label:'Less risky'},
                      {hint:'too_conservative' as FeedbackHint, label:'More aggressive'},
                      {hint:'too_expensive' as FeedbackHint,    label:'Lower cost'},
                      {hint:'not_aligned' as FeedbackHint,      label:'Re-evaluate goal'},
                    ]).map(({hint,label})=>(
                      <button key={hint} onClick={()=>{
                        const msg:Record<FeedbackHint,string>={
                          too_risky:'Make it less risky — prioritize stability and lower volatility',
                          too_conservative:'Make it more aggressive — I want more upside',
                          too_expensive:'Lower the cost — reduce expense ratio',
                          not_aligned:'These results feel misaligned — re-evaluate my goal',
                        };
                        setQuery(msg[hint]); void parseQuery(msg[hint],activeReq??undefined,hint);
                      }} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-full text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors bg-white">
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={refineText}
                      onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setRefineText(e.target.value)}
                      onKeyDown={(e:React.KeyboardEvent<HTMLInputElement>)=>{
                        if(e.key==='Enter'&&refineText.trim()&&activeReq){
                          const q=refineText.trim(); setRefineText(''); setQuery(q); void parseQuery(q,activeReq);
                        }
                      }}
                      placeholder="Or describe what you'd change…"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent placeholder:text-gray-300"/>
                    <button onClick={()=>{
                      const q=refineText.trim(); if(!q||!activeReq) return;
                      setRefineText(''); setQuery(q); void parseQuery(q,activeReq);
                    }} disabled={!refineText.trim()}
                      className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors">
                      <Send className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ASK ETF TAB                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab==='ask' && (
          <>
            {/* Empty state examples */}
            {messages.length===0 && !askLoading && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Example questions</p>
                <div className="space-y-2">
                  {ASK_EXAMPLES.map(q=>(
                    <button key={q} onClick={()=>void sendAsk(q)}
                      className="w-full text-left text-sm text-gray-600 px-4 py-2.5 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message thread */}
            {messages.map(msg=>(
              <div key={msg.id}>
                {msg.role==='user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-lg bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm">
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ) : msg.response ? (
                  <AdvisorResponseBlock response={msg.response}/>
                ) : null}
              </div>
            ))}

            {askLoading && <LoadingRow label="Analysing markets…"/>}

            {askError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5"/>
                <p className="text-sm text-red-600">{askError}</p>
              </div>
            )}

            {/* Ask input */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="relative">
                <textarea ref={askRef} value={askInput}
                  onChange={(e:React.ChangeEvent<HTMLTextAreaElement>)=>setAskInput(e.target.value)}
                  onKeyDown={(e:React.KeyboardEvent<HTMLTextAreaElement>)=>{
                    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault(); void sendAsk(askInput);}
                  }}
                  placeholder="Ask about macro trends, rate decisions, sector rotations, or specific ETFs…"
                  rows={2} disabled={askLoading}
                  className="w-full px-4 py-3 pr-14 text-sm border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 placeholder:text-gray-300"/>
                <button onClick={()=>void sendAsk(askInput)}
                  disabled={!askInput.trim()||askLoading}
                  className="absolute right-3 bottom-3 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors">
                  {askLoading?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">↵ Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        )}

        <div ref={bottomRef}/>
      </div>
    </div>
  );
}
