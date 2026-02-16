'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

interface ETF {
  ticker: string;
  name: string;
  assetClass: string | null;
  strategyType: string | null;
  aum: number | null;
  netExpenseRatio: number | null;
  inceptionDate: string | null;
}

export default function ETFScreener() {
  const [etfs, setETFs] = useState<ETF[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetClass, setSelectedAssetClass] = useState('');
  const [selectedSize, setSelectedSize] = useState('');

  useEffect(() => {
    fetchETFs();
  }, [page, searchQuery, selectedAssetClass, selectedSize]);

  async function fetchETFs() {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      
      if (searchQuery) params.append('search', searchQuery);
      if (selectedAssetClass && selectedAssetClass !== 'All Asset Classes') {
        params.append('assetClass', selectedAssetClass);
      }
      if (selectedSize && selectedSize !== 'All Sizes') {
        const sizeRanges: Record<string, { min: number; max: number }> = {
          'Mega (>$200B)': { min: 200000000000, max: Infinity },
          'Large ($50B-$200B)': { min: 50000000000, max: 200000000000 },
          'Medium ($10B-$50B)': { min: 10000000000, max: 50000000000 },
          'Small ($1B-$10B)': { min: 1000000000, max: 10000000000 },
          'Micro (<$1B)': { min: 0, max: 1000000000 },
        };
        
        const range = sizeRanges[selectedSize];
        if (range) {
          params.append('minAum', range.min.toString());
          if (range.max !== Infinity) {
            params.append('maxAum', range.max.toString());
          }
        }
      }

      const response = await fetch(`http://localhost:3001/api/etfs?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch ETFs');
      }

      const data = await response.json();
      
      // CRITICAL FIX: Save all pagination data from backend
      setETFs(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || 1);
      
    } catch (err) {
      console.error('ETF fetch error:', err);
      setError('Failed to load ETFs. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toFixed(0)}`;
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return '—';
    return `${value.toFixed(2)}%`;
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedAssetClass, selectedSize]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">ETF Screener</h1>
        <p className="text-gray-600">Search and filter ETFs traded on U.S. exchanges</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ticker or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Asset Class Filter */}
          <select
            value={selectedAssetClass}
            onChange={(e) => setSelectedAssetClass(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="card text-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchETFs}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      ) : etfs.length === 0 ? (
        <div className="card text-center py-12">
          <Filter className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">No ETFs match your filters. Try adjusting your criteria.</p>
        </div>
      ) : (
        <>
          {/* Results Info */}
          <div className="mb-4 text-sm text-gray-600">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total.toLocaleString()} ETFs
            {(searchQuery || selectedAssetClass || selectedSize) && ` (filtered from 5016 total)`}
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
                    <tr key={etf.ticker} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/etf/${etf.ticker}`}
                          className="font-semibold text-primary-600 hover:text-primary-700 hover:underline"
                        >
                          {etf.ticker}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                        {etf.name}
                      </td>
                      <td className="px-4 py-3">
                        {etf.assetClass && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {etf.assetClass}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {etf.strategyType || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(etf.aum)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {formatPercent(etf.netExpenseRatio)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination - FIXED */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              
              {/* Page numbers */}
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1 rounded ${
                        page === pageNum
                          ? 'bg-primary-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
