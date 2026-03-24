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
  Send, AlertCircle, Loader2,
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
  page?: number; pageSize?: number; sortBy?: 'totalScore'|'expenseRatio'|'sharpeRatio'|'volatility'|'annualized3Y'|'annualized5Y'|'aum';
}
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

interface AdvisorMetrics { return1M: number|null; return3M: number|null; volatility: number|null; sharpe: number|null; maxDrawdown: number|null; }
interface AdvisorRec { ticker: string; name: string; allocation: number|null; reasoning: string; risks: string; profile: string[]; metrics: AdvisorMetrics; }
interface AdvisorAvoid { ticker: string; name: string; reasoning: string; alternative: string|null; }
interface AdvisorResponse {
  analysis: { macroView: string; keyRisks: string[]; sentiment: Sentiment; };
  recommendations: AdvisorRec[]; avoid: AdvisorAvoid[];
  education: Record<string,string>;
  selectionRationale?: { summary: string; filters: string[]; };
  disclaimer: string;
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

// ── Find ETFs — hardcoded direct-DB buttons (no AI call) ──────────────────

const EMPTY_C: Constraints = {
  excludeSectors: [], esgPreference: 'no_preference',
  maxExpenseRatio: null, minAUM: null, minSharpe: null,
  minReturn3Y: null, minReturn5Y: null, maxVolatility: null,
};

interface FindButton {
  label:   string;
  hint:    string;
  section: string;
  req:     Omit<ScreenerRequest, 'page'|'pageSize'>;
}

const FIND_BUTTONS: FindButton[] = [
  { section:'By Metrics', label:'Lowest expense ratio',       hint:'lower = cheaper to hold long-term',
    req:{ objective:'preservation', riskProfile:'low',    constraints:EMPTY_C, sortBy:'expenseRatio'  } },
  { section:'By Metrics', label:'Highest Sharpe ratio',       hint:'higher = better risk-adjusted return',
    req:{ objective:'growth',       riskProfile:'medium', constraints:EMPTY_C, sortBy:'sharpeRatio'   } },
  { section:'By Metrics', label:'Lowest volatility',          hint:'lower = more stable during downturns',
    req:{ objective:'preservation', riskProfile:'low',    constraints:EMPTY_C, sortBy:'volatility'    } },
  { section:'By Return',  label:'Best 3-year annualized return', hint:'compounded annual growth over 3 years',
    req:{ objective:'growth',       riskProfile:'high',   constraints:EMPTY_C, sortBy:'annualized3Y'  } },
  { section:'By Return',  label:'Best 5-year annualized return', hint:'compounded annual growth over 5 years',
    req:{ objective:'growth',       riskProfile:'high',   constraints:EMPTY_C, sortBy:'annualized5Y'  } },
  { section:'By Size',    label:'Largest ETFs by AUM',         hint:'bigger = more liquid and established',
    req:{ objective:'growth',       riskProfile:'medium', constraints:EMPTY_C, sortBy:'aum'           } },
];
const ASK_EXAMPLES_MACRO = [
  'The Fed just raised rates — which ETFs benefit and which should I avoid?',
  'How should I think about inflation protection in my ETF portfolio?',
  'With geopolitical tensions rising, what defensive ETFs make sense?',
  'How do currencies affect international ETF returns?',
];
const ASK_EXAMPLES_CATEGORY = [
  'What are the best technology ETFs right now?',
  'Which emerging market ETFs have the strongest outlook?',
  'What fixed income ETFs make sense in a high rate environment?',
  'Which commodity ETFs provide the best inflation hedge?',
];
const ASK_EXAMPLES_STRATEGY = [
  'AI stocks are booming — how can I get exposure without chasing a bubble?',
  'Conservative income ETFs focused on dividends, large funds only',
  'Aggressive growth ETFs for a 10-year horizon',
  'Capital preservation strategy for a volatile market',
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
        <div className="grid grid-cols-5 gap-2 mb-3">
          {[
            {label:'1M',     value:fmt(rec.metrics.return1M,'pct'),     cls:returnCls(rec.metrics.return1M)},
            {label:'3M',     value:fmt(rec.metrics.return3M,'pct'),     cls:returnCls(rec.metrics.return3M)},
            {label:'Vol',    value:fmt(rec.metrics.volatility,'pct2'),  cls:'text-gray-600'},
            {label:'SR',     value:fmt(rec.metrics.sharpe,'num'),       cls:'text-gray-600'},
            {label:'MaxDD',  value:fmt(rec.metrics.maxDrawdown,'pct2'), cls:returnCls(rec.metrics.maxDrawdown)},
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
          {/* Selection rationale — explains how AI narrowed from 5,000+ ETFs */}
          {response.selectionRationale && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="font-semibold text-gray-600">How these were selected: </span>
                {response.selectionRationale.summary}
              </p>
              {response.selectionRationale.filters.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {response.selectionRationale.filters.map((f, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-white border border-gray-200 text-gray-500">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
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

  // Find ETFs state
  const [findLimit,  setFindLimit]  = useState<10|50>(10);
  const [screenMode, setScreenMode] = useState<ScreenMode>('idle');
  const [activeReq,  setActiveReq]  = useState<ScreenerRequest|null>(null);
  const [results,    setResults]    = useState<ScreenerResponse|null>(null);
  const [screenErr,  setScreenErr]  = useState<string|null>(null);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Advisor state
  const [askSection, setAskSection] = useState<'macro-rates'|'by-category'|'by-strategy'>('macro-rates');
  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [askInput,   setAskInput]   = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askError,   setAskError]   = useState<string|null>(null);

  const router    = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const askRef    = useRef<HTMLTextAreaElement>(null);

  // Screener: when results land, scroll to anchor so #1 result is at top of viewport
  useEffect(()=>{
    if (screenMode === 'results') {
      const t = setTimeout(()=>{
        document.getElementById('screen-results-anchor')?.scrollIntoView({behavior:'smooth', block:'start'});
      }, 80);
      return ()=>clearTimeout(t);
    }
    // For all other screener state changes (parsing, confirming, error) scroll to bottom
    if (tab !== 'ask') {
      const t = setTimeout(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); }, 80);
      return ()=>clearTimeout(t);
    }
  }, [screenMode, results, screenErr, tab]);

  // On new assistant message: scroll to top of results (just below input)
  useEffect(()=>{
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    const t = setTimeout(()=>{
      document.getElementById('ask-results-anchor')?.scrollIntoView({behavior:'smooth', block:'start'});
    }, 80);
    return ()=>clearTimeout(t);
  }, [messages]);

  // ── Screener ──────────────────────────────────────────────────────────────
  function toggleTicker(ticker:string) {
    setSelected(prev=>{ const n=new Set(prev); n.has(ticker)?n.delete(ticker):n.size<15&&n.add(ticker); return n; });
  }

  const runScreener = useCallback(async (req:ScreenerRequest):Promise<void> => {
    setScreenErr(null); setScreenMode('screening'); setActiveReq(req); setResults(null); setSelected(new Set());
    try {
      const res = await fetch(`${API_URL}/api/screener/screen`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...req,page:1,pageSize:200}),
      });
      if(!res.ok) throw new Error(`Screener error ${res.status}`);
      const data=await res.json() as ScreenerResponse;
      setResults(data); setScreenMode('results'); setCurrentPage(1);
    } catch(err){ setScreenErr(err instanceof Error?err.message:'Failed to run screener'); setScreenMode('confirming'); }
  },[]);

  function handleScreenReset() {
    setScreenMode('idle'); setActiveReq(null); setResults(null);
    setScreenErr(null); setSelected(new Set()); setCurrentPage(1);
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
        body:JSON.stringify({query:trimmedQuery, section:askSection, history}),
      });
      if(!res.ok){const b=await res.json().catch(()=>({})) as {error?:string}; throw new Error(b.error??`Server error ${res.status}`);}
      const data=await res.json() as AdvisorResponse;
      setMessages(prev=>[...prev,{id:(Date.now()+1).toString(),role:'assistant',text:'',response:data}]);
    } catch(err){
      setAskError(err instanceof Error?err.message:'Something went wrong — please try again');
      setMessages(prev=>prev.filter(m=>m.id!==userMsg.id));
    } finally { setAskLoading(false); setTimeout(()=>askRef.current?.focus(),100); }
  },[askLoading,messages]);

  const isScreenBusy = screenMode==='screening';

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
          <button onClick={()=>{ handleScreenReset(); setMessages([]); setAskInput(''); setAskError(null); }}
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
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="p-1 flex gap-1">
            {([
              { key:'screen' as TabMode, label:'Find ETFs', icon:<Zap           className="w-4 h-4"/> },
              { key:'ask'    as TabMode, label:'Ask ETF',   icon:<MessageSquare className="w-4 h-4"/> },
            ]).map(t=>(
              <button key={t.key} onClick={()=>{ setTab(t.key); if(t.key!=='screen') handleScreenReset(); }}
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
          <div className="flex px-1 pb-2.5">
            <span className="flex-1 text-center text-xs text-gray-400">Direct DB search</span>
            <span className="flex-1 text-center text-xs text-gray-400">Chat with AI</span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* FIND ETFs TAB                                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab==='screen' && (
          <>
            {/* Quick-select buttons — idle state only */}
            {screenMode==='idle' && (
              <div className="space-y-4">

                {/* Top 10 / Top 50 toggle */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Select a category to find ETFs directly from the database</p>
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    {([10, 50] as const).map(n=>(
                      <button key={n} type="button" onClick={()=>setFindLimit(n)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          findLimit===n ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}>
                        Top {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Button sections */}
                {(['By Metrics','By Return','By Size'] as const).map(section=>(
                  <div key={section} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{section}</p>
                    <div className="space-y-2">
                      {FIND_BUTTONS.filter(b=>b.section===section).map(btn=>(
                        <button key={btn.label} type="button"
                          onClick={()=>void runScreener({...btn.req, page:1, pageSize:findLimit})}
                          className="w-full text-left px-4 py-2.5 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group">
                          <span className="text-sm text-gray-700 group-hover:text-blue-700 font-medium">{btn.label}</span>
                          <span className="text-xs text-gray-400 ml-2">({btn.hint})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Footnote */}
                <p className="text-xs text-gray-400 text-center">
                  💡 Results use pre-filters: AUM &gt; $100M · Volume &gt; 100K · Major issuers only · min 3 of 5 core metrics available
                </p>
              </div>
            )}

            {/* Screening loading state */}
            {screenMode==='screening' && <LoadingRow label="Finding ETFs from database…"/>}

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
                <div id="screen-results-anchor"/>

                {/* Back button + summary */}
                <div className="flex items-center justify-between">
                  <button type="button" onClick={()=>handleScreenReset()}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors bg-white">
                    ← Back to search
                  </button>
                </div>

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

                {/* Result cards — paginated 20 per page */}
                {(() => {
                  const allData = results.data;
                  const totalPages = Math.ceil(allData.length / PAGE_SIZE);
                  const pageData = allData.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE);
                  return (
                    <>
                      <div className="space-y-3">
                        {pageData.map((item,i)=>(
                          <ResultCard key={item.ticker} item={item} rank={(currentPage-1)*PAGE_SIZE+i+1}
                            isSelected={selected.has(item.ticker)} onToggle={toggleTicker}/>
                        ))}
                      </div>

                      {/* Pagination controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                          <button
                            onClick={()=>{ setCurrentPage(p=>p-1); document.getElementById('screen-results-anchor')?.scrollIntoView({behavior:'smooth',block:'start'}); }}
                            disabled={currentPage===1}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            ← Previous
                          </button>
                          <span className="text-xs text-gray-400">
                            Page {currentPage} of {totalPages} · {allData.length} ETFs
                          </span>
                          <button
                            onClick={()=>{ setCurrentPage(p=>p+1); document.getElementById('screen-results-anchor')?.scrollIntoView({behavior:'smooth',block:'start'}); }}
                            disabled={currentPage===totalPages}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            Next →
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ASK ETF TAB                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab==='ask' && (
          <>
            {/* Ask input — pinned at top so refinement is always reachable */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              {/* Active section pill */}
              <div className="flex gap-1.5 mb-3">
                {([
                  { key: 'macro-rates'  as const, label: 'Macro & Rates'  },
                  { key: 'by-category'  as const, label: 'By Category'    },
                  { key: 'by-strategy'  as const, label: 'By Strategy'    },
                ]).map(s=>(
                  <button key={s.key} type="button" onClick={()=>setAskSection(s.key)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                      askSection===s.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
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

            {/* Scroll anchor — new results appear just below the input */}
            <div id="ask-results-anchor"/>

            {/* Empty state examples — shown until first message */}
            {messages.length===0 && !askLoading && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-5">

                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Macro &amp; Rates</p>
                  <div className="space-y-2">
                    {ASK_EXAMPLES_MACRO.map(q=>(
                      <button key={q} type="button" onClick={()=>{ setAskSection('macro-rates'); void sendAsk(q); }}
                        className="w-full text-left text-sm text-gray-600 px-4 py-2.5 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">By Category</p>
                  <div className="space-y-2">
                    {ASK_EXAMPLES_CATEGORY.map(q=>(
                      <button key={q} type="button" onClick={()=>{ setAskSection('by-category'); void sendAsk(q); }}
                        className="w-full text-left text-sm text-gray-600 px-4 py-2.5 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">By Strategy</p>
                  <div className="space-y-2">
                    {ASK_EXAMPLES_STRATEGY.map(q=>(
                      <button key={q} type="button" onClick={()=>{ setAskSection('by-strategy'); void sendAsk(q); }}
                        className="w-full text-left text-sm text-gray-600 px-4 py-2.5 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {askLoading && <LoadingRow label="Analysing markets…"/>}

            {askError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5"/>
                <p className="text-sm text-red-600">{askError}</p>
              </div>
            )}

            {/* Message thread — results grow downward from anchor */}
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
          </>
        )}

        <div ref={bottomRef}/>
      </div>
    </div>
  );
}
