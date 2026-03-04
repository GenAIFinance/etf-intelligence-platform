'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ============================================================================
// TYPES
// ============================================================================

type Step = 'objective' | 'constraints' | 'riskTest' | 'results' | 'feedback';
type Objective = 'growth' | 'income' | 'preservation';
type RiskProfile = 'low' | 'medium' | 'high';
type EsgPreference = 'no_preference' | 'prefer' | 'exclude';

interface Constraints {
  excludeSectors: string[];
  esgPreference: EsgPreference;
  maxExpenseRatio: number | null;
  minAUM: number | null;
  minSharpe: number | null;
  minReturn3Y: number | null;
  minReturn5Y: number | null;
  maxVolatility: number | null;
}

interface MetricContributor {
  metricName: string;
  weight: number;
  rawValue: number | null;
  contribution: number;
}

interface ScreenerResult {
  ticker: string;
  name: string;
  totalScore: number;
  confidenceBand: 'High' | 'Medium' | 'Low';
  dataCompleteness: number;
  expenseRatio: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  sharpeRatio: number | null;
  annualized3Y: number | null;
  annualized5Y: number | null;
  aum: number | null;
  assetClass: string | null;
  contributors: MetricContributor[];
}

interface ScreenerResponse {
  data: ScreenerResult[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  diagnosisSummary: string;
}

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  step?: Step;
  options?: { value: string; label: string }[];
  results?: ScreenerResponse;
  timestamp: Date;
}

// ============================================================================
// HELPERS
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

function bandColor(band: string) {
  return {
    High:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    Medium: 'bg-amber-50 text-amber-700 border-amber-200',
    Low:    'bg-red-50 text-red-600 border-red-200',
  }[band] ?? 'bg-gray-100 text-gray-600';
}

function returnColor(v: number | null) {
  if (v === null) return 'text-gray-400';
  return v >= 0 ? 'text-emerald-600' : 'text-red-500';
}

// ============================================================================
// RESULT CARD
// ============================================================================

function ResultCard({ item, rank }: { item: ScreenerResult; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-teal-300 hover:shadow-md transition-all">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 flex items-center justify-center bg-teal-50 text-teal-700 text-xs font-bold rounded-lg border border-teal-100">
              {rank}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <Link href={`/etf/${item.ticker}`} className="font-bold text-gray-900 hover:text-teal-600 transition-colors">
                  {item.ticker}
                </Link>
                <ExternalLink className="w-3 h-3 text-gray-400" />
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${bandColor(item.confidenceBand)}`}>
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

        {/* Key metrics row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-400 mb-0.5">3Y Return</div>
            <div className={`text-sm font-semibold ${returnColor(item.annualized3Y)}`}>
              {fmt(item.annualized3Y, 'pct')}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-400 mb-0.5">Sharpe</div>
            <div className="text-sm font-semibold text-gray-800">{fmt(item.sharpeRatio, 'num')}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-400 mb-0.5">Expense</div>
            <div className="text-sm font-semibold text-gray-800">{fmt(item.expenseRatio, 'pct2')}</div>
          </div>
        </div>

        {/* Top 3 score contributors */}
        <div className="space-y-1">
          {item.contributors.slice(0, 5).map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="font-mono text-teal-600 w-8 text-right">[{c.weight.toFixed(0)}%]</span>
              <span className="flex-1">{c.metricName}</span>
              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-teal-500 h-1.5 rounded-full"
                  style={{ width: `${Math.min(100, c.contribution)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Less detail' : 'More detail'}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">5Y Return</span>
              <span className={`font-medium ${returnColor(item.annualized5Y)}`}>{fmt(item.annualized5Y, 'pct')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Max Drawdown</span>
              <span className="font-medium text-red-500">{item.maxDrawdown !== null ? `-${fmt(item.maxDrawdown, 'pct2')}` : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Volatility</span>
              <span className="font-medium text-gray-700">{fmt(item.volatility, 'pct2')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">AUM</span>
              <span className="font-medium text-gray-700">{fmt(item.aum, 'aum')}</span>
            </div>
            {item.assetClass && (
              <div className="flex justify-between col-span-2">
                <span className="text-gray-500">Asset Class</span>
                <span className="font-medium text-gray-700">{item.assetClass}</span>
              </div>
            )}
            <div className="flex justify-between col-span-2">
              <span className="text-gray-500">Data completeness</span>
              <span className="font-medium text-gray-700">{item.dataCompleteness.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RESULTS PANEL
// ============================================================================

function ResultsPanel({
  results,
  isLoading,
  onLoadMore,
  canLoadMore,
}: {
  results: ScreenerResponse;
  isLoading: boolean;
  onLoadMore: () => void;
  canLoadMore: boolean;
}) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{results.pagination.total} ETFs matched</span>
        <span className="text-xs text-gray-400">Page {results.pagination.page} of {results.pagination.totalPages}</span>
      </div>
      {results.data.map((item, i) => (
        <ResultCard
          key={item.ticker}
          item={item}
          rank={(results.pagination.page - 1) * results.pagination.pageSize + i + 1}
        />
      ))}

    </div>
  );
}

// ============================================================================
// CONSTRAINTS FORM
// ============================================================================

function ConstraintsForm({ onSubmit }: { onSubmit: (c: Constraints & { raw: any }) => void }) {
  const [form, setForm] = useState({
    excludeSectors: '',
    esgPreference: 'no_preference' as EsgPreference,
    maxExpenseRatio: '',
    minAUM: '',
    minSharpe: '',
    minReturn3Y: '',
    minReturn5Y: '',
    maxVolatility: '',
  });

  const handleSubmit = () => {
    const safeFloat = (v: string) => v.trim() !== '' && !isNaN(parseFloat(v)) ? parseFloat(v) : null;
    const excludeSectors = form.excludeSectors.split(',').map(s => s.trim()).filter(Boolean);
    onSubmit({
      excludeSectors,
      esgPreference: form.esgPreference,
      maxExpenseRatio: safeFloat(form.maxExpenseRatio) !== null ? safeFloat(form.maxExpenseRatio)! / 100 : null,
      minAUM:          safeFloat(form.minAUM) !== null ? safeFloat(form.minAUM)! * 1e9 : null,
      minSharpe:       safeFloat(form.minSharpe),
      minReturn3Y:     safeFloat(form.minReturn3Y) !== null ? safeFloat(form.minReturn3Y)! / 100 : null,
      minReturn5Y:     safeFloat(form.minReturn5Y) !== null ? safeFloat(form.minReturn5Y)! / 100 : null,
      maxVolatility:   safeFloat(form.maxVolatility) !== null ? safeFloat(form.maxVolatility)! / 100 : null,
      raw: form,
    });
  };

  return (
    <div className="mt-3 space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Sectors to exclude (comma-separated)</label>
        <input
          type="text"
          placeholder="e.g. oil, tobacco, weapons"
          value={form.excludeSectors}
          onChange={e => setForm(f => ({ ...f, excludeSectors: e.target.value }))}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">ESG preference</label>
        <select
          value={form.esgPreference}
          onChange={e => setForm(f => ({ ...f, esgPreference: e.target.value as EsgPreference }))}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          <option value="no_preference">No preference</option>
          <option value="prefer">Prefer ESG funds</option>
          <option value="exclude">Exclude ESG funds</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Max expense ratio (%)</label>
          <input
            type="number"
            placeholder="e.g. 0.50"
            min="0"
            max="5"
            step="0.01"
            value={form.maxExpenseRatio}
            onChange={e => setForm(f => ({ ...f, maxExpenseRatio: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Min AUM ($B)</label>
          <input
            type="number"
            placeholder="e.g. 1"
            min="0"
            step="0.1"
            value={form.minAUM}
            onChange={e => setForm(f => ({ ...f, minAUM: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Min Sharpe ratio</label>
          <input
            type="number"
            placeholder="e.g. 0.5"
            step="0.1"
            min="0"
            value={form.minSharpe}
            onChange={e => setForm(f => ({ ...f, minSharpe: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Max volatility (%)</label>
          <input
            type="number"
            placeholder="e.g. 20"
            min="0"
            max="100"
            step="1"
            value={form.maxVolatility}
            onChange={e => setForm(f => ({ ...f, maxVolatility: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Min 3Y return (%)</label>
          <input
            type="number"
            placeholder="e.g. 5"
            step="1"
            value={form.minReturn3Y}
            onChange={e => setForm(f => ({ ...f, minReturn3Y: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Min 5Y return (%)</label>
          <input
            type="number"
            placeholder="e.g. 8"
            step="1"
            value={form.minReturn5Y}
            onChange={e => setForm(f => ({ ...f, minReturn5Y: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
      </div>
      <button
        onClick={handleSubmit}
        className="w-full py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
      >
        Continue →
      </button>
      <button
        onClick={() => onSubmit({ excludeSectors: [], esgPreference: 'no_preference', maxExpenseRatio: null, minAUM: null, minSharpe: null, minReturn3Y: null, minReturn5Y: null, maxVolatility: null, raw: form })}
        className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        Skip — no constraints
      </button>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function DiagnosticScreener() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<Step>('objective');
  const [profile, setProfile] = useState<{
    objective: Objective | null;
    riskProfile: RiskProfile | null;
    constraints: Constraints;
  }>({
    objective: null,
    riskProfile: null,
    constraints: { excludeSectors: [], esgPreference: 'no_preference', maxExpenseRatio: null, minAUM: null, minSharpe: null, minReturn3Y: null, minReturn5Y: null, maxVolatility: null },
  });
  const [results, setResults] = useState<ScreenerResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initial message
  useEffect(() => {
    addAssistant(
      `**Welcome to the ETF Diagnostic Screener.**\n\nI'll help you find the right ETFs through a few diagnostic questions.\n\n**Which best describes your goal?**`,
      'objective',
      [
        { value: 'growth',       label: 'Growth — Maximize long-term capital appreciation' },
        { value: 'income',       label: 'Income — Generate regular dividends' },
        { value: 'preservation', label: 'Capital Preservation — Protect against losses' },
      ]
    );
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  function addAssistant(content: string, msgStep?: Step, options?: any[], results?: ScreenerResponse) {
    setMessages(m => [...m, {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      step: msgStep,
      options,
      results,
      timestamp: new Date(),
    }]);
  }

  function addUser(content: string) {
    setMessages(m => [...m, {
      id: Date.now().toString() + 'u',
      role: 'user',
      content,
      timestamp: new Date(),
    }]);
  }

  // ── Step handlers ──────────────────────────────────────────────────────────

  function handleObjective(value: Objective, label: string) {
    setProfile(p => ({ ...p, objective: value }));
    addUser(label);
    setStep('constraints');
    setTimeout(() => {
      addAssistant(
        `**Let me understand your constraints.**\n\nSet any filters below — all are optional.`,
        'constraints'
      );
    }, 300);
  }

  function handleConstraints(c: Constraints & { raw: any }) {
    setProfile(p => ({ ...p, constraints: { excludeSectors: c.excludeSectors, esgPreference: c.esgPreference, maxExpenseRatio: c.maxExpenseRatio, minAUM: c.minAUM, minSharpe: c.minSharpe ?? null, minReturn3Y: c.minReturn3Y ?? null, minReturn5Y: c.minReturn5Y ?? null, maxVolatility: c.maxVolatility ?? null } }));
    const summary: string[] = [];
    if (c.excludeSectors.length > 0) summary.push(`Exclude: ${c.excludeSectors.join(', ')}`);
    summary.push(`ESG: ${c.esgPreference.replace('_', ' ')}`);
    if (c.maxExpenseRatio) summary.push(`Max expense: ${(c.maxExpenseRatio * 100).toFixed(2)}%`);
    if (c.minAUM) summary.push(`Min AUM: $${(c.minAUM / 1e9).toFixed(1)}B`);
    addUser(summary.join(' | '));
    setStep('riskTest');
    setTimeout(() => {
      addAssistant(
        `**Risk Stress Test**\n\nThis helps me understand your true risk tolerance.\n\n_If the market dropped 20% tomorrow, would you:_`,
        'riskTest',
        [
          { value: 'low',    label: 'A) Sell to protect capital' },
          { value: 'medium', label: 'B) Hold and wait it out' },
          { value: 'high',   label: 'C) Buy more — this is an opportunity' },
        ]
      );
    }, 300);
  }

  async function handleRisk(value: RiskProfile, label: string) {
    addUser(label);
    setProfile(p => ({ ...p, riskProfile: value }));
    setIsLoading(true);
    setStep('results');

    const res = await runScreen(profile.objective!, value, profile.constraints, 1);
    setResults(res);
    setCurrentPage(1);
    setIsLoading(false);

    if (res) {
      addAssistant(
        `**Diagnosis Summary**\n\n${res.diagnosisSummary}\n\n_Rankings are based on your inputs and historical data — not predictions._`,
        'results',
        undefined,
        res
      );
      setTimeout(() => {
        addAssistant(
          `**Does this feel:**`,
          'feedback',
          [
            { value: 'too_risky',       label: 'A) Too risky' },
            { value: 'too_conservative', label: 'B) Too conservative' },
            { value: 'too_expensive',   label: 'C) Too expensive' },
            { value: 'not_aligned',     label: 'D) Not aligned with my goal' },
            { value: 'about_right',     label: 'E) About right' },
          ]
        );
      }, 1000);
    }
  }

  // ── Feedback adjustment framework ────────────────────────────────────────
  // Principle: feedback ≠ new goal. Objective never changes.
  // Adjustments are one-notch only, explainable, and preserve scoring discipline.

  function getOneNotchUp(current: RiskProfile): RiskProfile | null {
    if (current === 'low')    return 'medium';
    if (current === 'medium') return 'high';
    return null; // already at max
  }

  function getOneNotchDown(current: RiskProfile): RiskProfile | null {
    if (current === 'high')   return 'medium';
    if (current === 'medium') return 'low';
    return null; // already at min
  }

  function riskLabel(r: RiskProfile): string {
    return { low: 'Conservative', medium: 'Moderate', high: 'Aggressive' }[r];
  }

  async function handleFeedback(value: string, label: string) {
    addUser(label);
    const currentRisk = profile.riskProfile!;

    // ── About right — wrap up ─────────────────────────────────────────────
    if (value === 'about_right') {
      addAssistant(
        `**Great — your diagnosis is complete.**\n\n` +
        `Your profile: **${profile.objective} / ${riskLabel(currentRisk)}**\n\n` +
        `- Click any ETF ticker to see full analysis\n` +
        `- Use the **Compare** feature for side-by-side analysis\n` +
        `- Restart anytime with different parameters\n\n` +
        `_These are educational insights based on historical data, not financial advice._`
      );
      return;
    }

    // ── Too conservative — return frustration, not true risk appetite change ─
    if (value === 'too_conservative') {
      const newRisk = getOneNotchUp(currentRisk);
      if (!newRisk) {
        addAssistant(
          `**Already at the most growth-oriented profile.**\n\n` +
          `The model is already prioritizing long-term returns as heavily as the framework allows. ` +
          `If these results still feel muted, consider whether your goal should be revisited — ` +
          `or review individual ETF detail pages for deeper analysis.\n\n` +
          `_Restarting with a different objective is always an option._`
        );
        return;
      }
      addAssistant(
        `**Adjusting for more upside potential.**\n\n` +
        `Shifting from **${riskLabel(currentRisk)} → ${riskLabel(newRisk)}** within your ${profile.objective} goal.\n\n` +
        `What changes in the scoring:\n` +
        `- Long-term return weights increase (5Y first, then 3Y)\n` +
        `- Volatility and drawdown weights decrease slightly\n` +
        `- Sharpe ratio and expense ratio remain\n\n` +
        `_We adjusted the model to allow more upside by placing more weight on long-term returns, while still keeping risk efficiency in view._`
      );
      setIsLoading(true);
      setProfile(p => ({ ...p, riskProfile: newRisk }));
      await new Promise(r => setTimeout(r, 800));
      const res = await runScreen(profile.objective!, newRisk, profile.constraints, 1);
      setResults(res); setCurrentPage(1); setIsLoading(false);
      if (res) {
        addAssistant(`**Updated Results — ${riskLabel(newRisk)} profile**\n\n${res.diagnosisSummary}`, 'results', undefined, res);
        setTimeout(() => addFeedbackPrompt(), 1000);
      }
      return;
    }

    // ── Too aggressive — loss anticipation after seeing drawdown metrics ───
    if (value === 'too_risky') {
      const newRisk = getOneNotchDown(currentRisk);
      if (!newRisk) {
        addAssistant(
          `**Already at the most conservative profile.**\n\n` +
          `The model is already maximizing weight on volatility and drawdown protection. ` +
          `If you feel these results are still too exposed, consider whether your objective ` +
          `should shift from **${profile.objective}** to **preservation**.\n\n` +
          `_You can restart with a different goal at any time._`
        );
        return;
      }
      addAssistant(
        `**Adjusting for smoother, more stable returns.**\n\n` +
        `Shifting from **${riskLabel(currentRisk)} → ${riskLabel(newRisk)}** within your ${profile.objective} goal.\n\n` +
        `What changes in the scoring:\n` +
        `- Volatility and max drawdown weights increase\n` +
        `- Sharpe ratio weight increases (prioritizes risk efficiency)\n` +
        `- Short-term return weights decrease\n` +
        `- Expense ratio and data quality requirements unchanged\n\n` +
        `_We adjusted the model to reduce stress and potential drawdowns, prioritizing smoother return paths._`
      );
      setIsLoading(true);
      setProfile(p => ({ ...p, riskProfile: newRisk }));
      await new Promise(r => setTimeout(r, 800));
      const res = await runScreen(profile.objective!, newRisk, profile.constraints, 1);
      setResults(res); setCurrentPage(1); setIsLoading(false);
      if (res) {
        addAssistant(`**Updated Results — ${riskLabel(newRisk)} profile**\n\n${res.diagnosisSummary}`, 'results', undefined, res);
        setTimeout(() => addFeedbackPrompt(), 1000);
      }
      return;
    }

    // ── Too expensive — tighten expense filter by 50%, never remove it ────
    if (value === 'too_expensive') {
      const currentMax = profile.constraints.maxExpenseRatio ?? 0.0100;
      const newMax = currentMax * 0.5;
      const newConstraints = { ...profile.constraints, maxExpenseRatio: newMax };
      addAssistant(
        `**Tightening cost filter.**\n\n` +
        `Maximum expense ratio reduced from **${(currentMax * 100).toFixed(2)}%** → **${(newMax * 100).toFixed(2)}%**.\n\n` +
        `_Fees compound against you every year, even when markets are flat. ` +
        `This filter ensures only the most cost-efficient ETFs in your profile qualify._`
      );
      setIsLoading(true);
      setProfile(p => ({ ...p, constraints: newConstraints }));
      await new Promise(r => setTimeout(r, 800));
      const res = await runScreen(profile.objective!, currentRisk, newConstraints, 1);
      setResults(res); setCurrentPage(1); setIsLoading(false);
      if (res) {
        addAssistant(`**Updated Results — cost-filtered**\n\n${res.diagnosisSummary}`, 'results', undefined, res);
        setTimeout(() => addFeedbackPrompt(), 1000);
      }
      return;
    }

    // ── Not aligned — explain what drives alignment, offer restart ────────
    if (value === 'not_aligned') {
      addAssistant(
        `**Let\'s diagnose the misalignment.**\n\n` +
        `Your current profile: **${profile.objective} / ${riskLabel(currentRisk)}**\n\n` +
        `The scoring weights for this profile prioritize:\n` +
        `- Risk-adjusted returns (Sharpe ratio)\n` +
        `- Long-term performance (3Y and 5Y returns)\n` +
        `- Cost efficiency (expense ratio)\n` +
        `- Downside protection (volatility, drawdown)\n\n` +
        `If the results feel wrong, it\'s usually because the **objective** doesn\'t match your actual goal. ` +
        `For example, an income investor may be better served restarting with the Income objective ` +
        `rather than adjusting risk within Growth.\n\n` +
        `_Use the Restart button to begin a new diagnosis with a different objective._`
      );
      return;
    }
  }

  function addFeedbackPrompt() {
    addAssistant(
      '**Does this feel better?**',
      'feedback',
      [
        { value: 'too_risky',        label: 'A) Too risky' },
        { value: 'too_conservative', label: 'B) Too conservative' },
        { value: 'too_expensive',    label: 'C) Too expensive' },
        { value: 'not_aligned',      label: 'D) Not aligned with my goal' },
        { value: 'about_right',      label: 'E) About right' },
      ]
    );
  }

  async function handleLoadMore() {
    if (!profile.objective || !profile.riskProfile || !results) return;
    setIsLoading(true);
    const nextPage = currentPage + 1;
    const res = await runScreen(profile.objective, profile.riskProfile, profile.constraints, nextPage);
    if (res) {
      setResults(prev => prev ? {
        ...res,
        data: [...prev.data, ...res.data],
      } : res);
      setCurrentPage(nextPage);
    }
    setIsLoading(false);
  }

  async function runScreen(
    objective: Objective,
    riskProfile: RiskProfile,
    constraints: Constraints,
    page: number
  ): Promise<ScreenerResponse | null> {
    try {
      const response = await fetch(`${API_URL}/api/screener/screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective, riskProfile, constraints, page, pageSize: 200 }),
      });
      if (!response.ok) throw new Error(`API error ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error('Screen error:', err);
      addAssistant('Sorry, something went wrong fetching results. Please try again.');
      return null;
    }
  }

  function handleRestart() {
    setMessages([]);
    setStep('objective');
    setProfile({ objective: null, riskProfile: null, constraints: { excludeSectors: [], esgPreference: 'no_preference', maxExpenseRatio: null, minAUM: null, minSharpe: null, minReturn3Y: null, minReturn5Y: null, maxVolatility: null } });
    setResults(null);
    setCurrentPage(1);
    setTimeout(() => {
      addAssistant(
        `**Welcome to the ETF Diagnostic Screener.**\n\nI'll help you find the right ETFs through a few diagnostic questions.\n\n**Which best describes your goal?**`,
        'objective',
        [
          { value: 'growth',       label: 'Growth — Maximize long-term capital appreciation' },
          { value: 'income',       label: 'Income — Generate regular dividends' },
          { value: 'preservation', label: 'Capital Preservation — Protect against losses' },
        ]
      );
    }, 100);
  }

  // ── Message renderer ───────────────────────────────────────────────────────

  function renderContent(text: string) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-semibold text-gray-900 mb-1">{line.slice(2, -2)}</p>;
      }
      if (line.startsWith('_') && line.endsWith('_')) {
        return <p key={i} className="text-xs text-gray-400 italic mt-1">{line.slice(1, -1)}</p>;
      }
      if (line.startsWith('- ')) {
        return <p key={i} className="text-sm text-gray-600 ml-3">• {line.slice(2)}</p>;
      }
      if (line === '') return <div key={i} className="h-1" />;
      return <p key={i} className="text-sm text-gray-700">{line}</p>;
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
              <h1 className="text-xl font-bold">ETF Diagnostic Screener</h1>
              <p className="text-sm text-teal-100">Data-grounded, rule-based ETF recommendations</p>
            </div>
          </div>
          <button
            onClick={handleRestart}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Restart
          </button>
        </div>
      </div>

      {/* Chat */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-24">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' ? (
              <div className="max-w-full w-full">
                {/* Assistant bubble */}
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  {renderContent(msg.content)}

                  {/* Constraints form */}
                  {msg.step === 'constraints' && step === 'constraints' && (
                    <ConstraintsForm onSubmit={handleConstraints} />
                  )}

                  {/* Option buttons */}
                  {msg.options && msg.step !== 'constraints' && (
                    <div className="mt-3 space-y-2">
                      {msg.options.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            if (msg.step === 'objective') handleObjective(opt.value as Objective, opt.label);
                            else if (msg.step === 'riskTest') handleRisk(opt.value as RiskProfile, opt.label);
                            else if (msg.step === 'feedback') handleFeedback(opt.value, opt.label);
                          }}
                          disabled={step !== msg.step}
                          className="w-full text-left px-4 py-2.5 text-sm bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl text-teal-800 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Results */}
                  {msg.results && (
                    <ResultsPanel
                      results={msg.results.data.length === results?.data.length ? (results ?? msg.results) : msg.results}
                      isLoading={isLoading}
                      onLoadMore={handleLoadMore}
                      canLoadMore={
                        !!results &&
                        results.pagination.page < results.pagination.totalPages &&
                        msg.results === messages.find(m => m.results)?.results
                      }
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-xs bg-teal-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm">
                <p className="text-sm">{msg.content}</p>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Disclaimer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 py-2 px-4 text-center">
        <p className="text-xs text-gray-400">
          Educational tool only. Not financial advice. Past performance does not guarantee future results.
        </p>
      </div>
    </div>
  );
}
