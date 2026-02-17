'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Search, TrendingUp, DollarSign, BarChart3, Sparkles, PieChart, AlertCircle, Info } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface RankingItem {
  rank: number;
  ticker: string;
  name: string;
  value: number;
  formattedValue: string;
  secondaryValue?: number;
  formattedSecondaryValue?: string;
}

interface RankingsData {
  top10: {
    byAUM: RankingItem[];
    lowestExpenseRatio: RankingItem[];
    lowestAnnualCost: RankingItem[];
    highestSavings: RankingItem[];
    mostDiversified: RankingItem[];
  };
  meta: {
    totalETFs: number;
    lastUpdated: string;
    investmentAmount: number;
  };
}

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [rankings, setRankings] = useState<RankingsData | null>(null);
  const [isLoadingRankings, setIsLoadingRankings] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchRankings();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchETFs(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  async function fetchRankings() {
    setIsLoadingRankings(true);
    try {
      const response = await fetch('http://localhost:3001/api/rankings/top10');
      if (response.ok) {
        const data = await response.json();
        setRankings(data);
      }
    } catch (error) {
      console.error('Rankings error:', error);
    } finally {
      setIsLoadingRankings(false);
    }
  }

  async function searchETFs(query: string) {
    setIsSearching(true);
    try {
      const response = await fetch(`http://localhost:3001/api/etf/search?q=${encodeURIComponent(query)}&limit=5`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.etfs || data.results || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">ETF Intelligence Dashboard</h1>
        <p className="text-gray-600">Discover top-ranked ETFs by cost, size, and diversification</p>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search ETFs by ticker or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />

        {searchQuery && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
            {searchResults.map((etf: any) => (
              <Link
                key={etf.ticker}
                href={`/etf/${etf.ticker}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b last:border-0"
                onClick={() => setSearchQuery('')}
              >
                <div>
                  <span className="font-semibold text-gray-900">{etf.ticker}</span>
                  <span className="text-gray-500 ml-2 text-sm">{etf.name}</span>
                </div>
                {etf.assetClass && (
                  <span className="badge badge-gray text-xs">{etf.assetClass}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {isLoadingRankings ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="h-16 bg-gray-100 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : rankings ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RankingCard
            title="Largest ETFs by AUM"
            description="Top 10 ETFs by assets under management"
            icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
            items={rankings.top10.byAUM}
            viewAllLink="/etfs?sort=aum&order=desc"
            iconBgColor="bg-blue-100"
          />

          <RankingCard
            title="Lowest Expense Ratio"
            description="Top 10 cheapest ETFs by expense ratio"
            icon={<DollarSign className="w-5 h-5 text-green-600" />}
            items={rankings.top10.lowestExpenseRatio}
            viewAllLink="/etfs?sort=netExpenseRatio&order=asc"
            iconBgColor="bg-green-100"
          />

          <RankingCard
            title="Lowest Annual Cost"
            description={`For $${(rankings.meta.investmentAmount / 1000).toFixed(0)}k investment`}
            icon={<Sparkles className="w-5 h-5 text-purple-600" />}
            items={rankings.top10.lowestAnnualCost}
            viewAllLink="/etfs?sort=annualCost&order=asc&investment=10000"
            iconBgColor="bg-purple-100"
            showSecondary
          />

          <RankingCard
            title="Highest Savings vs Category Median"
            description="ETFs with biggest cost advantage"
            icon={<BarChart3 className="w-5 h-5 text-orange-600" />}
            items={rankings.top10.highestSavings}
            viewAllLink="/etfs?sort=savings&order=desc&investment=10000"
            iconBgColor="bg-orange-100"
            showSecondary
            tooltip="Savings calculated by comparing ETF expense ratio to category median"
          />

          <RankingCard
            title="Most Diversified ETFs"
            description="Top 10 by number of holdings"
            icon={<PieChart className="w-5 h-5 text-indigo-600" />}
            items={rankings.top10.mostDiversified}
            viewAllLink="/etfs?sort=holdings&order=desc"
            iconBgColor="bg-indigo-100"
          />

          <div className="card bg-gradient-to-br from-primary-50 to-blue-50 border-2 border-primary-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Statistics</h3>
            <div className="space-y-4">
              <div>
                <div className="text-3xl font-bold text-primary-600">
                  {rankings.meta.totalETFs.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">ETFs in Database</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary-600">5</div>
                <div className="text-sm text-gray-600">Ranking Categories</div>
              </div>
              <div className="pt-4 border-t border-primary-200">
                <div className="text-xs text-gray-500">
                  Last updated: {new Date(rankings.meta.lastUpdated).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-4">Unable to load rankings. Please try again.</p>
          <button
            onClick={fetchRankings}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/etfs" className="card hover:shadow-md transition-shadow flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
            <Search className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">ETF Screener</h3>
            <p className="text-sm text-gray-500">Search and filter ETFs</p>
          </div>
        </Link>

        <Link href="/ai-screener" className="card bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 hover:border-purple-300 hover:shadow-md transition-all flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Screener</h3>
            <p className="text-sm text-gray-600">Natural language search</p>
          </div>
        </Link>

        <Link href="/compare" className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Compare ETFs</h3>
            <p className="text-sm text-gray-600">Side-by-side comparison</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

function RankingCard({
  title,
  description,
  icon,
  items,
  viewAllLink,
  iconBgColor,
  showSecondary = false,
  tooltip,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  items: RankingItem[];
  viewAllLink: string;
  iconBgColor: string;
  showSecondary?: boolean;
  tooltip?: string;
}) {
  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className={`${iconBgColor} p-2 rounded-lg flex-shrink-0`}>
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {title}
              {tooltip && (
                <div className="group relative">
                  <Info className="w-4 h-4 text-gray-400 cursor-help" />
                  <div className="absolute left-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                    {tooltip}
                  </div>
                </div>
              )}
            </h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        <Link href={viewAllLink} className="text-primary-600 text-sm hover:text-primary-700 hover:underline flex-shrink-0">
          View all →
        </Link>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.slice(0, 5).map((item) => (
            <Link
              key={item.ticker}
              href={`/etf/${item.ticker}`}
              className="flex items-center justify-between p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-700 text-xs font-bold rounded flex-shrink-0">
                  {item.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900">{item.ticker}</div>
                  <div className="text-xs text-gray-500 truncate">{item.name}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className="font-medium text-gray-900 text-sm">{item.formattedValue}</div>
                {showSecondary && item.formattedSecondaryValue && (
                  <div className="text-xs text-gray-500">{item.formattedSecondaryValue}</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No data available</p>
        </div>
      )}

      {items.length > 5 && (
        <Link href={viewAllLink} className="block text-center text-sm text-primary-600 hover:text-primary-700 hover:underline mt-4 pt-4 border-t border-gray-100">
          See all {items.length} ETFs →
        </Link>
      )}
    </div>
  );
}
