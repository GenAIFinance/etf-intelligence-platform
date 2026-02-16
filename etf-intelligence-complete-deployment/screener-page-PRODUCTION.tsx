'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface ETF {
  ticker: string;
  name: string;
  assetClass: string | null;
  strategyType: string | null;
  aum: number | null;
  netExpenseRatio: number | null;
  inceptionDate: string | null;
}

interface FetchETFsResponse {
  data: ETF[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function ETFScreener() {
  const [etfs, setETFs] = useState<ETF[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 20; // Constant, no need for state
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetClass, setSelectedAssetClass] = useState('');
  const [selectedSize, setSelectedSize] = useState('');

  // Debounced search to prevent excessive API calls
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [debouncedSearch, selectedAssetClass, selectedSize]);

  const fetchETFs = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (selectedAssetClass && selectedAssetClass !== 'All Asset Classes') {
        params.append('assetClass', selectedAssetClass);
      }
      if (selectedSize && selectedSize !== 'All Sizes') {
        const sizeRanges: Record<string, { min: number; max: number }> = {
          'Mega (>$200B)': { min: 200_000_000_000, max: Infinity },
          'Large ($50B-$200B)': { min: 50_000_000_000, max: 200_000_000_000 },
          'Medium ($10B-$50B)': { min: 10_000_000_000, max: 50_000_000_000 },
          'Small ($1B-$10B)': { min: 1_000_000_000, max: 10_000_000_000 },
          'Micro (<$1B)': { min: 0, max: 1_000_000_000 },
        };
        
        const range = sizeRanges[selectedSize];
        if (range) {
          params.append('minAum', range.min.toString());
          if (range.max !== Infinity) {
            params.append('maxAum', range.max.toString());
          }
        }
      }

      // Use environment variable or fallback to localhost
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/etfs?${params}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch ETFs`);
      }

      const data: FetchETFsResponse = await response.json();
      
      // Validate response data
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }

      // Set state with validated data
      setETFs(Array.isArray(data.data) ? data.data : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
      setTotalPages(typeof data.totalPages === 'number' ? data.totalPages : 1);
      
      // Ensure page is within bounds
      const responsePage = typeof data.page === 'number' ? data.page : 1;
      if (responsePage !== page && responsePage >= 1 && responsePage <= data.totalPages) {
        setPage(responsePage);
      }
      
    } catch (err) {
      console.error('ETF fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load ETFs. Please try again.';
      setError(errorMessage);
      // Reset to empty state on error
      setETFs([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, selectedAssetClass, selectedSize]);

  useEffect(() => {
    fetchETFs();
  }, [fetchETFs]);

  const formatCurrency = useCallback((value: number | null): string => {
    if (value === null || value === undefined) return '—';
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  }, []);

  const formatPercent = useCallback((value: number | null): string => {
    if (value === null || value === undefined) return '—';
    return `${value.toFixed(2)}%`;
  }, []);

  // Calculate page numbers to display
  const pageNumbers = useMemo(() => {
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
  }, [page, totalPages]);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      setPage(newPage);
      // Scroll to top of results
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page, totalPages]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch) count++;
    if (selectedAssetClass) count++;
    if (selectedSize) count++;
    return count;
  }, [debouncedSearch, selectedAssetClass, selectedSize]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedAssetClass('');
    setSelectedSize('');
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">ETF Screener</h1>
        <p className="text-gray-600">Search and filter ETFs traded on U.S. exchanges</p>
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
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by ticker or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              aria-label="Search ETFs"
            />
          </div>

          {/* Asset Class Filter */}
          <select
            value={selectedAssetClass}
            onChange={(e) => setSelectedAssetClass(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            aria-label="Filter by asset class"
          >
            <option value="">All Asset Classes</option>
            <option value="Equity">Equity</option>
            <option value="Fixed Income">Fixed Income</option>
            <option value="Commodity">Commodity</option>
            <option value="Real Estate">Real Estate</option>
            <option value="Alternative">Alternative</option>
            <option value="Mixed Allocation">Mixed Allocation</option>
          </select>

          {/* Size Filter */}
          <select
            value={selectedSize}
            onChange={(e) => setSelectedSize(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            aria-label="Filter by fund size"
          >
            <option value="">All Sizes</option>
            <option value="Mega (>$200B)">Mega (&gt;$200B)</option>
            <option value="Large ($50B-$200B)">Large ($50B-$200B)</option>
            <option value="Medium ($10B-$50B)">Medium ($10B-$50B)</option>
            <option value="Small ($1B-$10B)">Small ($1B-$10B)</option>
            <option value="Micro (<$1B)">Micro (&lt;$1B)</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="card">
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchETFs}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : etfs.length === 0 ? (
        <div className="card text-center py-12">
          <Filter className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-2">No ETFs match your filters.</p>
          <p className="text-sm text-gray-500 mb-4">Try adjusting your search criteria.</p>
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
          {/* Results Info */}
          <div className="mb-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {((page - 1) * pageSize + 1).toLocaleString()} - {Math.min(page * pageSize, total).toLocaleString()} of {total.toLocaleString()} ETFs
            </span>
            {activeFiltersCount > 0 && (
              <span className="text-xs text-gray-500">
                {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active
              </span>
            )}
          </div>

          {/* ETF Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Ticker
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Asset Class
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Strategy
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      AUM
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Expense Ratio
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {etfs.map((etf) => (
                    <tr key={etf.ticker} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/etf/${etf.ticker}`}
                          className="font-semibold text-primary-600 hover:text-primary-700 hover:underline"
                        >
                          {etf.ticker}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="max-w-xs truncate" title={etf.name}>
                          {etf.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {etf.assetClass ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {etf.assetClass}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="max-w-xs truncate" title={etf.strategyType || undefined}>
                          {etf.strategyType || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium whitespace-nowrap">
                        {formatCurrency(etf.aum)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium whitespace-nowrap">
                        {formatPercent(etf.netExpenseRatio)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </div>
              
              <nav className="flex items-center gap-2" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white flex items-center gap-2 transition-colors"
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
                  {page} / {totalPages}
                </div>
                
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white flex items-center gap-2 transition-colors"
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
  );
}
