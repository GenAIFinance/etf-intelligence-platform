'use client';

import { useState } from 'react';
import { Search, Sparkles, TrendingUp, Loader2, BarChart2, Zap } from 'lucide-react';

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── Types ──────────────────────────────────────────────────────────────────
type QueryType = 'stock_exposure' | 'theme' | 'general';

type ScreenResult = {
  ticker:          string;
  name:            string;
  assetClass:      string | null;
  strategyType:    string | null;
  aum:             number | null;
  netExpenseRatio: number | null;
  holdingsCount?:  number;
  // stock exposure only
  holdingTicker?:  string;
  holdingName?:    string;
  weight?:         number | null;
  // scoring
  relevanceScore:  number;
  matchReason:     string;
};

type ApiResponse = {
  queryType:      QueryType;
  results:        ScreenResult[];
  interpretation: string;
  totalFound?:    number;
  // stock mode
  stock?:         string;
  summary?: {
    etfCount:  number;
    avgWeight: number;
    maxWeight: number;
  };
  // theme mode
  theme?:    string;
  themeKey?: string;
};

// ─── Example queries ─────────────────────────────────────────────────────────
const EXAMPLES = [
  { icon: '🟢', query: 'ETFs holding NVDA',              description: 'Stock exposure — which ETFs own NVIDIA & at what %' },
  { icon: '🍎', query: 'which funds hold Apple',          description: 'Stock exposure by company name' },
  { icon: '⚛️',  query: 'quantum computing ETFs',         description: 'Theme search — emerging tech' },
  { icon: '🤖', query: 'artificial intelligence ETFs',    description: 'Theme search — AI / ML funds' },
  { icon: '🔋', query: 'electric vehicle ETFs',           description: 'Theme search — EV & battery' },
  { icon: '🔒', query: 'cybersecurity ETFs',              description: 'Theme search — cyber funds' },
  { icon: '💰', query: 'low cost international ETFs',     description: 'General screen — geography + cost' },
  { icon: '📈', query: 'small cap growth ETFs',           description: 'General screen — size + strategy' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtAUM(v: number | null): string {
  if (!v) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}
function fmtExp(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v.toFixed(2)}%`;
}
function fmtWeight(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v.toFixed(2)}%`;
}

// Weight bar visual (0–100%)
function WeightBar({ weight }: { weight: number }) {
  const pct = Math.min(weight, 20); // cap bar at 20% for visual scale
  const color = weight >= 10 ? 'bg-purple-500'
    : weight >= 5  ? 'bg-blue-500'
    : weight >= 2  ? 'bg-green-500'
    : 'bg-gray-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${(pct / 20) * 100}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-800">{fmtWeight(weight)}</span>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AIScreenerPage() {
  const [query,         setQuery]         = useState('');
  const [response,      setResponse]      = useState<ApiResponse | null>(null);
  const [isLoading,     setIsLoading]     = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);

  async function handleSearch(q: string) {
    if (!q.trim()) return;
    setIsLoading(true);
    setError(null);
    setSearchedQuery(q);
    setResponse(null);

    try {
      const res = await fetch(`${API_URL}/api/ai-screener`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: q, limit: 30 }),
      });
      if (!res.ok) throw new Error('Search failed');
      const data: ApiResponse = await res.json();
      setResponse(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  }

  function reset() {
    setSearchedQuery(null);
    setQuery('');
    setResponse(null);
    setError(null);
  }

  const results    = response?.results ?? [];
  const queryType  = response?.queryType;

  // Badge for query type
  const modeBadge = queryType === 'stock_exposure'
    ? { label: 'Stock Exposure', color: 'bg-purple-100 text-purple-800', icon: '📊' }
    : queryType === 'theme'
    ? { label: `Theme: ${response?.theme}`, color: 'bg-blue-100 text-blue-800', icon: '🎯' }
    : queryType === 'general'
    ? { label: 'ETF Screener', color: 'bg-green-100 text-green-800', icon: '🔍' }
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Sparkles className="w-9 h-9 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-900">AI ETF Screener</h1>
          </div>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Ask in plain English — stock exposure, themes like quantum computing or clean energy, or any fund criteria.
          </p>
        </div>

        {/* Search bar */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
              placeholder='e.g. "ETFs holding NVDA" or "quantum computing ETFs"'
              className="w-full px-6 py-4 pr-14 text-lg rounded-2xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all shadow-sm"
            />
            <button
              onClick={() => handleSearch(query)}
              disabled={isLoading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Example queries */}
        {!searchedQuery && (
          <div className="max-w-5xl mx-auto mb-10">
            <p className="text-center text-sm font-medium text-gray-400 uppercase tracking-wider mb-5">
              Try these examples
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(ex.query); handleSearch(ex.query); }}
                  className="p-3 bg-white rounded-xl border border-gray-200 hover:border-indigo-400 hover:shadow-md transition-all text-left group"
                >
                  <span className="text-xl block mb-1">{ex.icon}</span>
                  <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600 leading-snug">{ex.query}</p>
                  <p className="text-xs text-gray-400 mt-1">{ex.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="max-w-4xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700">❌ {error}</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-3" />
              <p className="text-gray-500">Searching ETF database…</p>
            </div>
          </div>
        )}

        {/* Results */}
        {searchedQuery && !isLoading && response && (
          <div className="max-w-6xl mx-auto">

            {/* Result header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-white" />
                  <h2 className="text-lg font-semibold text-white">
                    {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{searchedQuery}&quot;
                  </h2>
                </div>
                {modeBadge && (
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${modeBadge.color}`}>
                    {modeBadge.icon} {modeBadge.label}
                  </span>
                )}
              </div>

              {/* Interpretation */}
              <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 text-sm text-indigo-700">
                {response.interpretation}
              </div>

              {/* Stock exposure summary banner */}
              {queryType === 'stock_exposure' && response.summary && results.length > 0 && (
                <div className="px-6 py-3 bg-purple-50 border-b border-purple-100 flex gap-8 text-sm flex-wrap">
                  <div><span className="text-gray-500">ETFs holding {response.stock}: </span><span className="font-bold text-purple-700">{response.summary.etfCount}</span></div>
                  <div><span className="text-gray-500">Avg weight: </span><span className="font-bold text-purple-700">{response.summary.avgWeight}%</span></div>
                  <div><span className="text-gray-500">Highest weight: </span><span className="font-bold text-purple-700">{response.summary.maxWeight}%</span></div>
                </div>
              )}

              {/* Table */}
              {results.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticker</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AUM</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expense</th>

                        {/* Stock mode: show weight column */}
                        {queryType === 'stock_exposure' && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase">
                            Weight in Fund
                          </th>
                        )}

                        {/* Theme / general: show match reason + score */}
                        {queryType !== 'stock_exposure' && (
                          <>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {results.map((r, i) => (
                        <tr key={`${r.ticker}-${i}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-400">{i + 1}</td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <a href={`/etf/${r.ticker}`} className="text-sm font-bold text-indigo-600 hover:text-indigo-800">
                              {r.ticker}
                            </a>
                          </td>

                          <td className="px-4 py-3 max-w-xs">
                            <div className="text-sm text-gray-900 truncate">{r.name}</div>
                            {r.assetClass && <div className="text-xs text-gray-400">{r.assetClass}</div>}
                            {r.strategyType && <div className="text-xs text-gray-400 truncate">{r.strategyType}</div>}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{fmtAUM(r.aum)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{fmtExp(r.netExpenseRatio)}</td>

                          {/* Stock mode weight cell */}
                          {queryType === 'stock_exposure' && (
                            <td className="px-4 py-3 whitespace-nowrap">
                              {r.weight != null ? (
                                <WeightBar weight={r.weight} />
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </td>
                          )}

                          {/* Theme / general cells */}
                          {queryType !== 'stock_exposure' && (
                            <>
                              <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{r.matchReason}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  r.relevanceScore >= 0.7 ? 'bg-green-100 text-green-800'
                                  : r.relevanceScore >= 0.4 ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {r.relevanceScore.toFixed(1)}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-16 text-center text-gray-400">
                  <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No ETFs found. Try a different query, or run the full data sync to populate holdings.</p>
                </div>
              )}
            </div>

            <div className="mt-5 text-center">
              <button onClick={reset} className="text-sm text-indigo-500 hover:text-indigo-700 font-medium">
                ← New Search
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
