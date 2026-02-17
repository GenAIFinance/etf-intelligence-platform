// ETF Comparison Tool - Complete Page
// apps/web/src/app/compare/page.tsx

'use client';

import { useState } from 'react';
import { Search, X, ArrowRight, TrendingUp, DollarSign, BarChart3, Sparkles, Download, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface ComparisonETF {
  ticker: string;
  name: string;
  assetClass: string | null;
  strategyType: string | null;
  netExpenseRatio: number | null;
  aum: number | null;
  inceptionDate: string | null;
  investmentPhilosophy: string | null;
  benchmarkIndex: string | null;
  equityAllocation: number | null;
  bondAllocation: number | null;
  cashAllocation: number | null;
  otherAllocation: number | null;
  megaCapAllocation: number | null;
  bigCapAllocation: number | null;
  mediumCapAllocation: number | null;
  smallCapAllocation: number | null;
  microCapAllocation: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  priceToCashFlow: number | null;
  projectedEarningsGrowth: number | null;
  holdingsCount: number;
}

interface ComparisonResponse {
  etfs: ComparisonETF[];
  highlights: {
    lowestExpenseRatio: string | null;
    highestAUM: string | null;
    mostDiversified: string | null;
    bestValue: string | null;
  };
  insights: string[];
  asOfDate: string;
}

export default function ComparePage() {
  const [tickers, setTickers] = useState<string[]>(['', '']);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addTicker() {
    if (tickers.length < 4) {
      setTickers([...tickers, '']);
    }
  }

  function removeTicker(index: number) {
    if (tickers.length > 2) {
      setTickers(tickers.filter((_, i) => i !== index));
      setComparison(null);
    }
  }

  function updateTicker(index: number, value: string) {
    const newTickers = [...tickers];
    newTickers[index] = value.toUpperCase();
    setTickers(newTickers);
  }

  async function handleCompare() {
    const validTickers = tickers.filter(t => t.trim().length > 0);
    
    if (validTickers.length < 2) {
      setError('Please enter at least 2 ETF tickers');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/etf/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: validTickers }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Comparison failed');
      }

      const data = await response.json();
      setComparison(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare ETFs');
      console.error('Comparison error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPopularComparison(popularTickers: string[]) {
    const newTickers = [...popularTickers];
    while (newTickers.length < 4) newTickers.push('');
    setTickers(newTickers);
    
    setTimeout(async () => {
      const validTickers = popularTickers.filter(t => t.trim().length > 0);
      if (validTickers.length >= 2) {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch('http://localhost:3001/api/etf/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickers: validTickers }),
          });
          const data = await response.json();
          setComparison(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to compare ETFs');
        } finally {
          setIsLoading(false);
        }
      }
    }, 100);
  }

  function formatCurrency(value: number | null): string {
    if (value === null) return '—';
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toFixed(0)}`;
  }

  function formatPercent(value: number | null): string {
    if (value === null) return '—';
    return `${value.toFixed(2)}%`;
  }

  function formatNumber(value: number | null, decimals = 2): string {
    if (value === null) return '—';
    return value.toFixed(decimals);
  }

  function isHighlight(ticker: string, field: keyof ComparisonResponse['highlights']): boolean {
    return comparison?.highlights[field] === ticker;
  }

  function calculateSavings(expense1: number, expense2: number): string {
    const initial = 10000;
    const years = 30;
    const annualReturn = 0.10;
    
    const fund1 = initial * Math.pow(1 + annualReturn - expense1/100, years);
    const fund2 = initial * Math.pow(1 + annualReturn - expense2/100, years);
    const diff = Math.abs(fund1 - fund2);
    
    return `$${diff.toFixed(0)}`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-sm text-primary-600 hover:text-primary-700 mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary-600" />
            ETF Comparison Tool
          </h1>
          <p className="text-gray-600">
            Compare 2-4 ETFs side-by-side across costs, allocations, valuations, and more
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Select ETFs to Compare</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {tickers.map((ticker, index) => (
              <div key={index} className="relative">
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => updateTicker(index, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
                  placeholder={`ETF ${index + 1}`}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center uppercase font-bold text-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none"
                  maxLength={5}
                />
                {index >= 2 && (
                  <button
                    onClick={() => removeTicker(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {tickers.length < 4 && (
                <button
                  onClick={addTicker}
                  className="px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-primary-500 hover:text-primary-600"
                >
                  + Add ETF
                </button>
              )}
            </div>
            
            <button
              onClick={handleCompare}
              disabled={isLoading || tickers.filter(t => t && t.trim().length > 0).length < 2}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? 'Comparing...' : 'Compare ETFs'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Popular Comparisons */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Popular Comparisons:</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => loadPopularComparison(['SPY', 'VOO', 'IVV'])}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-sm hover:bg-blue-100"
              >
                S&P 500: SPY vs VOO vs IVV
              </button>
              <button
                onClick={() => loadPopularComparison(['QQQ', 'VUG', 'IWF'])}
                className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded text-sm hover:bg-purple-100"
              >
                Large Cap Growth
              </button>
              <button
                onClick={() => loadPopularComparison(['VTI', 'ITOT'])}
                className="px-3 py-1.5 bg-green-50 text-green-700 rounded text-sm hover:bg-green-100"
              >
                Total Market
              </button>
              <button
                onClick={() => loadPopularComparison(['BND', 'AGG'])}
                className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded text-sm hover:bg-orange-100"
              >
                Bond Funds
              </button>
            </div>
          </div>
        </div>

        {/* Comparison Results */}
        {comparison && comparison.etfs.length > 0 && (
          <div className="space-y-6">
            
            {/* Insights */}
            {comparison.insights.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Key Insights
                </h3>
                <ul className="space-y-1">
                  {comparison.insights.map((insight, i) => (
                    <li key={i} className="text-sm text-blue-800 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cost Comparison */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Cost Comparison
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Metric</th>
                      {comparison.etfs.map(etf => (
                        <th key={etf.ticker} className="text-center py-3 px-4 text-sm font-semibold text-gray-900">
                          {etf.ticker}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Net Expense Ratio</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className={`text-center py-3 px-4 text-sm font-medium ${
                          isHighlight(etf.ticker, 'lowestExpenseRatio') 
                            ? 'bg-green-50 text-green-700 font-bold' 
                            : 'text-gray-900'
                        }`}>
                          {formatPercent(etf.netExpenseRatio)}
                          {isHighlight(etf.ticker, 'lowestExpenseRatio') && ' ✓'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">AUM (Liquidity)</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className={`text-center py-3 px-4 text-sm ${
                          isHighlight(etf.ticker, 'highestAUM') 
                            ? 'bg-blue-50 text-blue-700 font-bold' 
                            : 'text-gray-900'
                        }`}>
                          {formatCurrency(etf.aum)}
                          {isHighlight(etf.ticker, 'highestAUM') && ' ✓'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Inception Date</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-600">
                          {etf.inceptionDate || '—'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Expense Impact Calculator */}
              {comparison.etfs.length === 2 && 
               comparison.etfs[0].netExpenseRatio !== null && 
               comparison.etfs[1].netExpenseRatio !== null && (
                <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">💰 30-Year Impact on $10,000 Investment</h3>
                  <p className="text-sm text-gray-700">
                    {comparison.etfs[0].netExpenseRatio < comparison.etfs[1].netExpenseRatio ? (
                      <>
                        <strong>{comparison.etfs[0].ticker}</strong> saves you approximately{' '}
                        <strong className="text-green-700">
                          {calculateSavings(comparison.etfs[0].netExpenseRatio, comparison.etfs[1].netExpenseRatio)}
                        </strong>{' '}
                        vs <strong>{comparison.etfs[1].ticker}</strong> over 30 years
                      </>
                    ) : (
                      <>
                        <strong>{comparison.etfs[1].ticker}</strong> saves you approximately{' '}
                        <strong className="text-green-700">
                          {calculateSavings(comparison.etfs[1].netExpenseRatio, comparison.etfs[0].netExpenseRatio)}
                        </strong>{' '}
                        vs <strong>{comparison.etfs[0].ticker}</strong> over 30 years
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Assumes 10% annual return before fees</p>
                </div>
              )}
            </div>

            {/* Asset Allocation */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Asset Allocation
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Asset Class</th>
                      {comparison.etfs.map(etf => (
                        <th key={etf.ticker} className="text-center py-3 px-4 text-sm font-semibold text-gray-900">
                          {etf.ticker}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Equity</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-900">
                          {formatPercent(etf.equityAllocation)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Bonds</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-900">
                          {formatPercent(etf.bondAllocation)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Cash</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-900">
                          {formatPercent(etf.cashAllocation)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Other</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-900">
                          {formatPercent(etf.otherAllocation)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Market Cap Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Market Cap Exposure
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Market Cap</th>
                      {comparison.etfs.map(etf => (
                        <th key={etf.ticker} className="text-center py-3 px-4 text-sm font-semibold text-gray-900">
                          {etf.ticker}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Mega Cap (&gt;$200B)</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-900">
                          {formatPercent(etf.megaCapAllocation)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Large Cap ($10B-$200B)</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-900">
                          {formatPercent(etf.bigCapAllocation)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Mid Cap ($2B-$10B)</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-900">
                          {formatPercent(etf.mediumCapAllocation)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Small Cap ($300M-$2B)</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-900">
                          {formatPercent(etf.smallCapAllocation)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Micro Cap (&lt;$300M)</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-900">
                          {formatPercent(etf.microCapAllocation)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Valuations */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-600" />
                Valuation Metrics
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Metric</th>
                      {comparison.etfs.map(etf => (
                        <th key={etf.ticker} className="text-center py-3 px-4 text-sm font-semibold text-gray-900">
                          {etf.ticker}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Price/Book</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className={`text-center py-3 px-4 text-sm ${
                          isHighlight(etf.ticker, 'bestValue') 
                            ? 'bg-green-50 text-green-700 font-bold' 
                            : 'text-gray-900'
                        }`}>
                          {formatNumber(etf.priceToBook)}
                          {isHighlight(etf.ticker, 'bestValue') && ' ✓'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Price/Sales</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-900">
                          {formatNumber(etf.priceToSales)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Price/Cash Flow</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-900">
                          {formatNumber(etf.priceToCashFlow)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Proj. Earnings Growth</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-900">
                          {formatPercent(etf.projectedEarningsGrowth)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Holdings & Strategy */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Holdings & Strategy</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Detail</th>
                      {comparison.etfs.map(etf => (
                        <th key={etf.ticker} className="text-center py-3 px-4 text-sm font-semibold text-gray-900">
                          {etf.ticker}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Holdings Count</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className={`text-center py-3 px-4 text-sm ${
                          isHighlight(etf.ticker, 'mostDiversified') 
                            ? 'bg-blue-50 text-blue-700 font-bold' 
                            : 'text-gray-900'
                        }`}>
                          {etf.holdingsCount.toLocaleString()}
                          {isHighlight(etf.ticker, 'mostDiversified') && ' ✓'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Benchmark Index</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-600">
                          {etf.benchmarkIndex || '—'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-700">Strategy Type</td>
                      {comparison.etfs.map(etf => (
                        <td key={etf.ticker} className="text-center py-3 px-4 text-sm text-gray-600">
                          {etf.strategyType || '—'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Note */}
            <div className="text-center text-sm text-gray-500 pt-4">
              Data as of {comparison.asOfDate}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
