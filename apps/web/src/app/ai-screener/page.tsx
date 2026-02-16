'use client';

import { useState } from 'react';
import { Search, Sparkles, TrendingUp, Loader2 } from 'lucide-react';

type ScreenResult = {
  ticker: string;
  name: string;
  assetClass: string | null;
  aum: number | null;
  netExpenseRatio: number | null;
  matchReason: string;
  relevanceScore: number;
};

const EXAMPLE_QUERIES = [
  {
    id: 'tech-low-pb',
    query: 'Large cap tech ETFs with low P/B ratio',
    icon: '💻',
    description: 'Technology ETFs with attractive valuations',
  },
  {
    id: 'small-growth',
    query: 'Small cap growth stocks under $1B AUM',
    icon: '🚀',
    description: 'Emerging small cap opportunities',
  },
  {
    id: 'ai-cloud',
    query: 'AI and cloud computing ETFs',
    icon: '🤖',
    description: 'AI and cloud infrastructure exposure',
  },
  {
    id: 'dividend-healthcare',
    query: 'Dividend ETFs with healthcare exposure',
    icon: '💰',
    description: 'Income with healthcare allocation',
  },
  {
    id: 'esg-bonds',
    query: 'ESG bond funds',
    icon: '🌱',
    description: 'Sustainable fixed income',
  },
  {
    id: 'momentum-large',
    query: 'High momentum large caps, no leverage',
    icon: '📈',
    description: 'Strong performers, unleveraged',
  },
];

function formatCurrency(value: number | null): string {
  if (!value) return 'N/A';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
}

export default function AIScreenerPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScreenResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);

  async function handleSearch(searchQuery: string) {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setSearchedQuery(searchQuery);

    try {
      const response = await fetch('http://localhost:3001/api/ai-screener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 20 }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search ETFs';
      setError(errorMessage);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleExampleClick(exampleQuery: string) {
    setQuery(exampleQuery);
    handleSearch(exampleQuery);
  }

  function handleKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleSearch(query);
    }
  }

  function resetSearch() {
    setSearchedQuery(null);
    setQuery('');
    setResults([]);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-10 h-10 text-primary-600" />
            <h1 className="text-4xl font-bold text-gray-900">
              AI-Powered ETF Screener
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Search for ETFs using natural language. Ask anything about asset class, valuations, themes, or costs.
          </p>
        </div>

        <div className="max-w-3xl mx-auto mb-12">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., Low cost bond funds with high credit quality..."
              className="w-full px-6 py-4 pr-14 text-lg rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
            />
            <button
              onClick={() => handleSearch(query)}
              disabled={isLoading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {!searchedQuery && (
          <div className="max-w-4xl mx-auto mb-12">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
              Try these examples:
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {EXAMPLE_QUERIES.map((example) => (
                <button
                  key={example.id}
                  onClick={() => handleExampleClick(example.query)}
                  className="p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-primary-500 hover:shadow-lg transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{example.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 group-hover:text-primary-600 transition-colors mb-1">
                        {example.query}
                      </p>
                      <p className="text-sm text-gray-500">
                        {example.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-4xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}

        {searchedQuery && !isLoading && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  {results.length} results for &quot;{searchedQuery}&quot;
                </h2>
              </div>

              {results.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rank
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ticker
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          AUM
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Expense
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Match Reason
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Score
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {results.map((result, index) => (
                        <tr
                          key={result.ticker}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <a
                              href={`/etf/${result.ticker}`}
                              className="text-sm font-medium text-primary-600 hover:text-primary-800"
                            >
                              {result.ticker}
                            </a>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs truncate">
                              {result.name}
                            </div>
                            {result.assetClass && (
                              <div className="text-xs text-gray-500">
                                {result.assetClass}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {formatCurrency(result.aum)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {result.netExpenseRatio
                              ? `${result.netExpenseRatio.toFixed(2)}%`
                              : 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {result.matchReason}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                              {result.relevanceScore.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-12 text-center text-gray-500">
                  No ETFs found matching your query. Try a different search.
                </div>
              )}
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={resetSearch}
                className="px-6 py-2 text-primary-600 hover:text-primary-700 font-medium"
              >
                ← New Search
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
