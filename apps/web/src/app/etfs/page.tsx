'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, Filter, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { useEtfList } from '@/lib/hooks';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/Skeleton';

// Force dynamic rendering - prevents static generation at build time
export const dynamic = 'force-dynamic';

const ASSET_CLASSES = ['All', 'Equity', 'Fixed Income', 'Commodity', 'Multi-Asset', 'Real Estate'];
const STRATEGY_TYPES = ['All', 'Passive Index', 'Active', 'Sector', 'Factor/Smart Beta', 'Thematic'];
const AUM_RANGES = [
  { label: 'All Sizes', value: 'All', min: 0, max: Infinity },
  { label: 'Mega ($50B+)', value: 'mega', min: 50_000_000_000, max: Infinity },
  { label: 'Large ($10B-$50B)', value: 'large', min: 10_000_000_000, max: 50_000_000_000 },
  { label: 'Medium ($1B-$10B)', value: 'medium', min: 1_000_000_000, max: 10_000_000_000 },
  { label: 'Small ($100M-$1B)', value: 'small', min: 100_000_000, max: 1_000_000_000 },
  { label: 'Micro (<$100M)', value: 'micro', min: 0, max: 100_000_000 },
];

// Main content component that uses useSearchParams
function ETFsPageContent() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [assetClass, setAssetClass] = useState(searchParams.get('assetClass') || 'All');
  const [strategyType, setStrategyType] = useState('All');
  const [aumFilter, setAumFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'ticker' | 'name' | 'aum'>('ticker');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Debounced search to prevent excessive API calls
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error } = useEtfList({
    search: debouncedSearch || undefined,
    assetClass: assetClass !== 'All' ? assetClass : undefined,
    strategyType: strategyType !== 'All' ? strategyType : undefined,
    page,
    pageSize: 20,
    minAum: aumFilter !== 'All' ? AUM_RANGES.find(r => r.value === aumFilter)?.min : undefined,
    maxAum: aumFilter !== 'All' ? AUM_RANGES.find(r => r.value === aumFilter)?.max : undefined,
  });

  const handleSort = useCallback((column: 'ticker' | 'name' | 'aum') => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  }, [sortBy, sortDir]);

  const sortedData = useMemo(() => {
    if (!data?.data) return [];

    return data.data
      .filter((etf: any) => {
        // Filter by strategy keyword search (client-side for flexibility)
        if (strategyType !== 'All') {
          const strategy = (etf.strategyType || '').toLowerCase();
          const searchTerm = strategyType.toLowerCase();
          if (!strategy.includes(searchTerm)) return false;
        }
        return true;
      })
      .sort((a: any, b: any) => {
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
  }, [data?.data, strategyType, sortBy, sortDir]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, assetClass, strategyType, aumFilter]);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= (data?.totalPages || 1) && newPage !== page) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page, data?.totalPages]);

  // Calculate page numbers to display
  const pageNumbers = useMemo(() => {
    const totalPages = data?.totalPages || 1;
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    if (page <= 3) {
      return [1, 2, 3, 4, 5];
    }
    
    if (page >= totalPages - 2) {
      return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    
    return [page - 2, page - 1, page, page + 1, page + 2];
  }, [page, data?.totalPages]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch) count++;
    if (assetClass !== 'All') count++;
    if (strategyType !== 'All') count++;
    if (aumFilter !== 'All') count++;
    return count;
  }, [debouncedSearch, assetClass, strategyType, aumFilter]);

  const clearFilters = useCallback(() => {
    setSearch('');
    setAssetClass('All');
    setStrategyType('All');
    setAumFilter('All');
  }, []);

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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
            >
              Clear all ({activeFiltersCount})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search - Full width on mobile, 2 cols on md+ */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by ticker or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full pl-10"
              aria-label="Search ETFs"
            />
          </div>

          {/* Asset Class */}
          <select
            value={assetClass}
            onChange={(e) => setAssetClass(e.target.value)}
            className="input"
            aria-label="Filter by asset class"
          >
            {ASSET_CLASSES.map((ac) => (
              <option key={ac} value={ac}>
                {ac === 'All' ? 'All Asset Classes' : ac}
              </option>
            ))}
          </select>

          {/* Strategy Type - Keyword Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Filter by strategy (e.g., equity, bond)..."
              value={strategyType === 'All' ? '' : strategyType}
              onChange={(e) => setStrategyType(e.target.value || 'All')}
              className="input w-full"
              aria-label="Filter by strategy"
            />
          </div>

          {/* AUM Size Filter - Full width row */}
          <div className="md:col-span-2">
            <select
              value={aumFilter}
              onChange={(e) => setAumFilter(e.target.value)}
              className="input w-full"
              aria-label="Filter by fund size"
            >
              {AUM_RANGES.map((range) => (
                <option key={range.value} value={range.value}>{range.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        {isLoading ? (
          <TableSkeleton rows={10} />
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p className="text-red-600 mb-4">Failed to load ETFs. Please try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : !sortedData?.length ? (
          <div className="text-center py-12">
            <Filter className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 mb-2">No ETFs found matching your criteria.</p>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-primary-600 hover:text-primary-700 hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Results count */}
            <div className="mb-4 flex items-center justify-between text-sm text-gray-600">
              <span>
                Showing {((page - 1) * 20 + 1).toLocaleString()} - {Math.min(page * 20, data?.total || 0).toLocaleString()} of {(data?.total || 0).toLocaleString()} ETFs
              </span>
              {activeFiltersCount > 0 && (
                <span className="text-xs text-gray-500">
                  {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th
                      onClick={() => handleSort('ticker')}
                      className="cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      Ticker {sortBy === 'ticker' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      onClick={() => handleSort('name')}
                      className="cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Asset Class</th>
                    <th>Strategy</th>
                    <th
                      onClick={() => handleSort('aum')}
                      className="cursor-pointer hover:bg-gray-100 text-right transition-colors"
                    >
                      AUM {sortBy === 'aum' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Top Sectors</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((etf: any) => (
                    <tr key={etf.ticker} className="hover:bg-gray-50 transition-colors">
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
            {(data?.totalPages || 1) > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t gap-4">
                <div className="text-sm text-gray-500">
                  Page {page} of {data?.totalPages || 1}
                </div>
                
                <nav className="flex items-center gap-2" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>
                  
                  {/* Page numbers */}
                  <div className="hidden sm:flex items-center gap-1">
                    {pageNumbers.map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`min-w-[2.5rem] px-3 py-1 rounded transition-colors ${
                          page === pageNum
                            ? 'bg-primary-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                        aria-label={`Page ${pageNum}`}
                        aria-current={page === pageNum ? 'page' : undefined}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>

                  {/* Mobile page indicator */}
                  <div className="sm:hidden px-3 py-1 text-sm text-gray-600">
                    {page} / {data?.totalPages || 1}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= (data?.totalPages || 1)}
                    className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    aria-label="Next page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </nav>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Main export with Suspense boundary
export default function ETFsPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
        </div>
        <div className="card mb-6">
          <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
        </div>
        <div className="card">
          <div className="h-96 bg-gray-100 rounded animate-pulse"></div>
        </div>
      </div>
    }>
      <ETFsPageContent />
    </Suspense>
  );
}