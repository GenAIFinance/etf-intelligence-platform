'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEtfList } from '@/lib/hooks';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/Skeleton';

const ASSET_CLASSES = ['All', 'Equity', 'Fixed Income', 'Commodity', 'Multi-Asset', 'Real Estate'];
const STRATEGY_TYPES = ['All', 'Passive Index', 'Active', 'Sector', 'Factor/Smart Beta', 'Thematic'];
const AUM_RANGES = [
  { label: 'All Sizes', value: 'All', min: 0, max: Infinity },
  { label: 'Mega ($50B+)', value: 'mega', min: 50000000000, max: Infinity },
  { label: 'Large ($10B-$50B)', value: 'large', min: 10000000000, max: 50000000000 },
  { label: 'Medium ($1B-$10B)', value: 'medium', min: 1000000000, max: 10000000000 },
  { label: 'Small ($100M-$1B)', value: 'small', min: 100000000, max: 1000000000 },
  { label: 'Micro (<$100M)', value: 'micro', min: 0, max: 100000000 },
];

export default function EtfsPage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [assetClass, setAssetClass] = useState(searchParams.get('assetClass') || 'All');
  const [strategyType, setStrategyType] = useState('All');
  const [aumFilter, setAumFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'ticker' | 'name' | 'aum'>('ticker');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const { data, isLoading, error } = useEtfList({
    search: search || undefined,
    assetClass: assetClass !== 'All' ? assetClass : undefined,
    strategyType: strategyType !== 'All' ? strategyType : undefined,
    page,
    pageSize: 20,
  });

  const handleSort = (column: 'ticker' | 'name' | 'aum') => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const sortedData = data?.data
  ?.filter((etf: any) => {
    if (aumFilter !== 'All') {
      const range = AUM_RANGES.find(r => r.value === aumFilter);
      if (range) {
        const aum = etf.aum || 0;
        if (aum < range.min || aum > range.max) return false;
      }
    }
    return true;
  })
  ?.sort((a: any, b: any) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    if (sortBy === 'aum') {
      aVal = aVal || 0;
      bVal = bVal || 0;
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">ETF Screener</h1>
        <p className="text-gray-600">
          Search and filter ETFs traded on U.S. exchanges
        </p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ticker or name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input w-full pl-10"
            />
          </div>

          {/* Asset Class */}
          <select
            value={assetClass}
            onChange={(e) => {
              setAssetClass(e.target.value);
              setPage(1);
            }}
            className="input"
          >
            {ASSET_CLASSES.map((ac) => (
              <option key={ac} value={ac}>
                {ac === 'All' ? 'All Asset Classes' : ac}
              </option>
            ))}
          </select>

          {/* Strategy Type */}
          <select
            value={strategyType}
            onChange={(e) => {
              setStrategyType(e.target.value);
              setPage(1);
            }}
            className="input"
          >
            {STRATEGY_TYPES.map((st) => (
              <option key={st} value={st}>
                {st === 'All' ? 'All Strategies' : st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        {isLoading ? (
          <TableSkeleton rows={10} />
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            Failed to load ETFs. Please try again.
          </div>
        ) : !data?.data?.length ? (
          <div className="text-center py-8 text-gray-500">
            No ETFs found matching your criteria.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th
                      onClick={() => handleSort('ticker')}
                      className="cursor-pointer hover:bg-gray-100"
                    >
                      Ticker {sortBy === 'ticker' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      onClick={() => handleSort('name')}
                      className="cursor-pointer hover:bg-gray-100"
                    >
                      Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Asset Class</th>
                    <th>Strategy</th>
                    <th
                      onClick={() => handleSort('aum')}
                      className="cursor-pointer hover:bg-gray-100 text-right"
                    >
                      AUM {sortBy === 'aum' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Top Sectors</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData?.map((etf: any) => (
                    <tr key={etf.ticker}>
                      <td>
                        <Link
                          href={`/etf/${etf.ticker}`}
                          className="font-semibold text-primary-600 hover:underline"
                        >
                          {etf.ticker}
                        </Link>
                      </td>
                      <td className="max-w-xs truncate" title={etf.name}>
                        {etf.name}
                      </td>
                      <td>
                        <span className="badge badge-blue">
                          {etf.assetClass || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-gray text-xs">
                          {etf.strategyType || 'N/A'}
                        </span>
                      </td>
                      <td className="text-right font-mono">
                        {formatCurrency(etf.aum)}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {etf.sectorWeights?.slice(0, 2).map((s: any) => (
                            <span
                              key={s.sector}
                              className="text-xs bg-gray-100 px-2 py-0.5 rounded truncate max-w-[100px]"
                              title={`${s.sector}: ${formatPercent(s.weight)}`}
                            >
                              {s.sector}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">
                Showing {(page - 1) * 20 + 1} - {Math.min(page * 20, data.total)} of{' '}
                {data.total} ETFs
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-outline disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-4 py-2 text-sm">
                  Page {page} of {data.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page >= data.totalPages}
                  className="btn btn-outline disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
