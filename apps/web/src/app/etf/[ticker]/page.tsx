'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

// Mark this route as dynamic to avoid static generation errors
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import {
  ChevronLeft,
  Download,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Layers,
  Newspaper,
  Info,
  ExternalLink,
  Target,
  DollarSign,
  Building2,
  TrendingUp as Growth,
} from 'lucide-react';
import {
  useEtf,
  useEtfHoldings,
  useEtfPrices,
  useEtfMetrics,
  useEtfThemesExposure,
  useEtfImpact,
} from '@/lib/hooks';
import {
  formatPercent,
  formatNumber,
  formatCurrency,
  formatDate,
  getReturnColor,
  downloadCSV,
  downloadJSON,
} from '@/lib/utils';
import { CardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import {
  PriceChart,
  ReturnsChart,
  SectorChart,
  ThemeExposureChart,
} from '@/components/charts/Charts';

type TabId = 'overview' | 'performance' | 'holdings' | 'themes' | 'news';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
  { id: 'holdings', label: 'Holdings', icon: Layers },
  { id: 'themes', label: 'Themes', icon: PieChart },
  { id: 'news', label: 'News Impact', icon: Newspaper },
];

export default function EtfDetailPage() {
  const params = useParams();
  const ticker = (params.ticker as string).toUpperCase();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [priceRange, setPriceRange] = useState('1y');

  const { data: etf, isLoading: etfLoading, error: etfError } = useEtf(ticker);
  const { data: holdings } = useEtfHoldings(ticker);
  const { data: prices } = useEtfPrices(ticker, priceRange);
  const { data: metrics } = useEtfMetrics(ticker);
  const { data: themes } = useEtfThemesExposure(ticker);
  const { data: impact } = useEtfImpact(ticker);

  if (etfError) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link href="/etfs" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ChevronLeft className="w-4 h-4" /> Back to screener
        </Link>
        <div className="card text-center py-12">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">ETF Not Found</h2>
          <p className="text-gray-500">The ticker "{ticker}" was not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <Link
        href="/etfs"
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Back to screener
      </Link>

      {/* Header */}
      {etfLoading ? (
        <CardSkeleton />
      ) : (
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{ticker}</h1>
                {etf?.assetClass && (
                  <span className="badge badge-blue">{etf.assetClass}</span>
                )}
                {etf?.strategyType && (
                  <span className="badge badge-gray">{etf.strategyType}</span>
                )}
              </div>
              <p className="text-gray-600">{etf?.name}</p>
            </div>
            {metrics?.technicals?.latestPrice && (
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">
                  ${metrics.technicals.latestPrice.toFixed(2)}
                </div>
                {metrics?.trailingReturns?.['1M'] !== null && metrics?.trailingReturns?.['1M'] !== undefined && (
                  <div
                    className={`text-sm font-medium ${getReturnColor(
                      metrics.trailingReturns['1M']
                    )}`}
                  >
                    {metrics.trailingReturns['1M'] >= 0 ? '+' : ''}
                    {formatPercent(metrics.trailingReturns['1M'])} (1M)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id ? 'tab-active' : ''
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab etf={etf} metrics={metrics} holdings={holdings} />
      )}
      {activeTab === 'performance' && (
        <PerformanceTab
          ticker={ticker}
          etf={etf}
          prices={prices}
          metrics={metrics}
          priceRange={priceRange}
          setPriceRange={setPriceRange}
        />
      )}
      {activeTab === 'holdings' && (
        <HoldingsTab ticker={ticker} holdings={holdings} />
      )}
      {activeTab === 'themes' && <ThemesTab ticker={ticker} themes={themes} />}
      {activeTab === 'news' && <NewsTab ticker={ticker} impact={impact} />}
    </div>
  );
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================

function OverviewTab({ etf, metrics, holdings }: any) {
  if (!etf) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      {/* Top Row - Fund Summary */}
      <div className="grid grid-cols-1 gap-6">
        <div className="card">
          <h3 className="card-header">Fund Summary</h3>
          {etf.summary ? (
            <p className="text-gray-700 text-sm leading-relaxed">{etf.summary}</p>
          ) : (
            <p className="text-gray-500 italic">No summary available</p>
          )}

          {etf.llmSummary && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-medium text-gray-800 mb-2">AI Analysis</h4>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>What it owns:</strong> {etf.llmSummary.whatItOwns}
                </p>
                <p>
                  <strong>Risk profile:</strong> {etf.llmSummary.riskProfile}
                </p>
                {etf.llmSummary.keySensitivities?.length > 0 && (
                  <div>
                    <strong>Key sensitivities:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {etf.llmSummary.keySensitivities.map((s: string) => (
                        <span key={s} className="badge badge-gray text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Key Statistics & Investment Strategy Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Statistics */}
        <div className="card">
          <h3 className="card-header">Key Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <StatItem label="AUM" value={formatCurrency(etf.aum)} />
            <StatItem
              label="Inception Date"
              value={etf.inceptionDate ? formatDate(etf.inceptionDate) : 'N/A'}
            />
            <StatItem
              label="Annual Turnover"
              value={etf.turnover ? formatPercent(etf.turnover) : 'N/A'}
            />
            <StatItem
              label="Expense Ratio"
              value={etf.netExpenseRatio ? `${etf.netExpenseRatio.toFixed(2)}%` : 'N/A'}
            />
            <StatItem label="Exchange" value={etf.exchange} />
            <StatItem label="Country" value={etf.country} />
          </div>
        </div>

        {/* Investment Strategy - NEW */}
        {(etf.benchmarkIndex || etf.strategyType) && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-primary-600" />
              <h3 className="text-lg font-semibold">Investment Strategy</h3>
            </div>
            <div className="space-y-3">
              {etf.strategyType && (
                <div className="flex items-start gap-3">
                  <div className="text-sm text-gray-600 w-24 flex-shrink-0">Category:</div>
                  <div className="font-medium text-gray-900">{etf.strategyType}</div>
                </div>
              )}
              {etf.benchmarkIndex && (
                <div className="flex items-start gap-3">
                  <div className="text-sm text-gray-600 w-24 flex-shrink-0">Benchmark:</div>
                  <div className="font-medium text-gray-900">{etf.benchmarkIndex}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Asset Allocation & Market Cap Row - NEW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Allocation - NEW */}
        {(etf.equityAllocation || etf.bondAllocation || etf.cashAllocation || etf.otherAllocation) && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-5 h-5 text-primary-600" />
              <h3 className="text-lg font-semibold">Asset Allocation</h3>
            </div>
            <div className="space-y-4">
              {etf.equityAllocation && etf.equityAllocation > 0 && (
                <AllocationBar
                  label="Equity"
                  percentage={etf.equityAllocation}
                  color="bg-blue-500"
                />
              )}
              {etf.bondAllocation && etf.bondAllocation > 0 && (
                <AllocationBar
                  label="Fixed Income"
                  percentage={etf.bondAllocation}
                  color="bg-green-500"
                />
              )}
              {etf.cashAllocation && etf.cashAllocation > 0 && (
                <AllocationBar
                  label="Cash"
                  percentage={etf.cashAllocation}
                  color="bg-gray-400"
                />
              )}
              {etf.otherAllocation && etf.otherAllocation > 0 && (
                <AllocationBar
                  label="Other"
                  percentage={etf.otherAllocation}
                  color="bg-purple-500"
                />
              )}
            </div>
          </div>
        )}

        {/* Market Cap Exposure - NEW */}
        {(etf.megaCapAllocation || etf.bigCapAllocation || etf.mediumCapAllocation || 
          etf.smallCapAllocation || etf.microCapAllocation) && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-primary-600" />
              <h3 className="text-lg font-semibold">Market Cap Exposure</h3>
            </div>
            <div className="space-y-3">
              {etf.megaCapAllocation && etf.megaCapAllocation > 0 && (
                <MarketCapRow
                  label="Mega Cap"
                  subtitle="> $200B"
                  percentage={etf.megaCapAllocation}
                />
              )}
              {etf.bigCapAllocation && etf.bigCapAllocation > 0 && (
                <MarketCapRow
                  label="Large Cap"
                  subtitle="$10B - $200B"
                  percentage={etf.bigCapAllocation}
                />
              )}
              {etf.mediumCapAllocation && etf.mediumCapAllocation > 0 && (
                <MarketCapRow
                  label="Mid Cap"
                  subtitle="$2B - $10B"
                  percentage={etf.mediumCapAllocation}
                />
              )}
              {etf.smallCapAllocation && etf.smallCapAllocation > 0 && (
                <MarketCapRow
                  label="Small Cap"
                  subtitle="$300M - $2B"
                  percentage={etf.smallCapAllocation}
                />
              )}
              {etf.microCapAllocation && etf.microCapAllocation > 0 && (
                <MarketCapRow
                  label="Micro Cap"
                  subtitle="< $300M"
                  percentage={etf.microCapAllocation}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Valuations & Holdings Concentration Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Valuations - NEW */}
        {(etf.priceToBook || etf.priceToSales || etf.priceToCashFlow || etf.projectedEarningsGrowth) && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-primary-600" />
              <h3 className="text-lg font-semibold">Valuations & Growth</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {etf.priceToBook && (
                <ValuationMetric
                  label="P/B Ratio"
                  value={etf.priceToBook.toFixed(2)}
                />
              )}
              {etf.priceToSales && (
                <ValuationMetric
                  label="P/S Ratio"
                  value={etf.priceToSales.toFixed(2)}
                />
              )}
              {etf.priceToCashFlow && (
                <ValuationMetric
                  label="P/CF Ratio"
                  value={etf.priceToCashFlow.toFixed(2)}
                />
              )}
              {etf.projectedEarningsGrowth && (
                <ValuationMetric
                  label="Earnings Growth"
                  value={`${etf.projectedEarningsGrowth.toFixed(1)}%`}
                  highlight
                />
              )}
            </div>
          </div>
        )}

        {/* Holdings Concentration */}
        {holdings?.concentration && (
          <div className="card">
            <h3 className="card-header">Holdings Concentration</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Top 10 Holdings</span>
                <span className="text-2xl font-bold text-gray-900">
                  {formatPercent(holdings.concentration.top10Weight)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Holdings</span>
                <span className="text-2xl font-bold text-gray-900">
                  {formatNumber(holdings.concentration.totalHoldings)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">HHI Index</span>
                <span className="text-2xl font-bold text-gray-900">
                  {holdings.concentration.hhi.toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Risk Metrics */}
      {metrics?.risk && (
        <div className="card">
          <h3 className="card-header">Risk Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatItem
              label="Volatility"
              value={metrics.risk.volatility ? formatPercent(metrics.risk.volatility) : 'N/A'}
            />
            <StatItem
              label="Sharpe Ratio"
              value={metrics.risk.sharpe ? metrics.risk.sharpe.toFixed(2) : 'N/A'}
            />
            <StatItem
              label="Max Drawdown"
              value={
                metrics.risk.maxDrawdown ? formatPercent(metrics.risk.maxDrawdown) : 'N/A'
              }
            />
            <StatItem
              label="Beta"
              value={metrics.risk.beta ? metrics.risk.beta.toFixed(2) : 'N/A'}
            />
          </div>
        </div>
      )}

      {/* Sector Breakdown */}
      {holdings?.sectorBreakdown && holdings.sectorBreakdown.length > 0 && (
        <div className="card">
          <h3 className="card-header">Sector Breakdown</h3>
          <SectorChart sectors={holdings.sectorBreakdown} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PERFORMANCE TAB
// ============================================================================

function PerformanceTab({ ticker, etf, prices, metrics, priceRange, setPriceRange }: any) {
  if (!metrics) return <CardSkeleton />;

  // trailingReturns may arrive as a JSON string from the API — parse it safely
  const trailingReturns = (() => {
    const raw = metrics.trailingReturns;
    if (!raw) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return raw;
  })();

  const hasReturnData = trailingReturns && Object.values(trailingReturns).some((v) => v !== null);

  const betaColor = (v: number | null) => {
    if (v == null) return 'text-gray-400';
    if (v < 0.8) return 'text-green-600';
    if (v <= 1.2) return 'text-blue-600';
    return 'text-orange-600';
  };

  const betaLabel = (v: number | null) => {
    if (v == null) return null;
    if (v < 0.8) return 'Defensive';
    if (v <= 1.2) return 'Market-like';
    return 'Aggressive';
  };

  return (
    <div className="space-y-6">
      {/* Price Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header mb-0">Price Performance</h3>
          <div className="flex gap-2">
            {['1m', '3m', '6m', '1y', '3y', '5y'].map((range) => (
              <button
                key={range}
                onClick={() => setPriceRange(range)}
                className={`px-3 py-1 text-sm rounded ${
                  priceRange === range
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {prices ? <PriceChart data={prices} range={priceRange} /> : <ChartSkeleton />}
      </div>

      {/* Trailing Returns */}
      {hasReturnData ? (
        <div className="card">
          <h3 className="card-header">Trailing Returns</h3>
          <ReturnsChart returns={trailingReturns} />
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6">
            {Object.entries(trailingReturns).map(([period, value]) => (
              <div key={period}>
                <div className="text-sm text-gray-500">{period}</div>
                <div className={`text-lg font-semibold ${getReturnColor(value as number)}`}>
                  {value !== null && value !== undefined
                    ? formatPercent(value as number)
                    : 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card opacity-60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0 text-gray-400">Trailing Returns</h3>
            <span className="text-xs bg-gray-100 text-gray-400 px-2 py-1 rounded-full font-medium">Coming soon</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['1Y Return', '3Y Return', '5Y Return', 'YTD'].map((label) => (
              <div key={label} className="p-4 bg-gray-50 rounded-lg text-center">
                <div className="text-sm text-gray-400 mb-1">{label}</div>
                <div className="text-2xl font-bold text-gray-300">—</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">Requires EOD price data plan</p>
        </div>
      )}

      {/* Risk-Adjusted Metrics */}
      {(metrics.riskMetrics?.sharpe != null || metrics.riskMetrics?.volatility != null) ? (
        <div className="card">
          <h3 className="card-header">Risk-Adjusted Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Sharpe Ratio</div>
              <div className="text-2xl font-bold text-gray-900">
                {metrics.riskMetrics?.sharpe?.toFixed(2) ?? 'N/A'}
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Volatility</div>
              <div className="text-2xl font-bold text-gray-900">
                {metrics.riskMetrics?.volatility != null
                  ? `${(metrics.riskMetrics.volatility * 100).toFixed(1)}%`
                  : 'N/A'}
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Max Drawdown</div>
              <div className="text-2xl font-bold text-red-500">
                {metrics.riskMetrics?.maxDrawdown != null
                  ? `-${(metrics.riskMetrics.maxDrawdown * 100).toFixed(1)}%`
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card opacity-60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0 text-gray-400">Risk-Adjusted Performance</h3>
            <span className="text-xs bg-gray-100 text-gray-400 px-2 py-1 rounded-full font-medium">Coming soon</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {['Sharpe Ratio', 'Volatility', 'Max Drawdown'].map((label) => (
              <div key={label} className="p-4 bg-gray-50 rounded-lg text-center">
                <div className="text-sm text-gray-400 mb-1">{label}</div>
                <div className="text-2xl font-bold text-gray-300">—</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">Requires EOD price data plan</p>
        </div>
      )}

      {/* Risk & Cost Metrics — uses data from fundamentals sync */}
      {(etf?.betaVsMarket != null || etf?.dividendYield != null || etf?.netExpenseRatio != null) && (
        <div className="card">
          <h3 className="card-header">Risk & Income</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* Beta */}
            {etf?.betaVsMarket != null && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">Beta vs Market</div>
                <div className={`text-2xl font-bold ${betaColor(etf.betaVsMarket)}`}>
                  {etf.betaVsMarket.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 mt-1">{betaLabel(etf.betaVsMarket)}</div>
              </div>
            )}

            {/* Dividend Yield */}
            {etf?.dividendYield != null && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">Dividend Yield</div>
                <div className="text-2xl font-bold text-green-600">
                  {etf.dividendYield.toFixed(2)}%
                </div>
                <div className="text-xs text-gray-400 mt-1">Annual distribution</div>
              </div>
            )}

            {/* Expense Ratio */}
            {etf?.netExpenseRatio != null && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">Expense Ratio</div>
                <div className="text-2xl font-bold text-gray-900">
                  {(etf.netExpenseRatio * 100).toFixed(2)}%
                </div>
                <div className="text-xs text-gray-400 mt-1">Annual cost</div>
              </div>
            )}

            {/* AUM */}
            {etf?.aum != null && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">AUM</div>
                <div className="text-2xl font-bold text-gray-900">
                  {etf.aum >= 1e9
                    ? `$${(etf.aum / 1e9).toFixed(1)}B`
                    : `$${(etf.aum / 1e6).toFixed(0)}M`}
                </div>
                <div className="text-xs text-gray-400 mt-1">Assets under management</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Technical Indicators — only show if snapshot data exists */}
      {metrics.technicals && (metrics.technicals.ma50 != null || metrics.technicals.ma200 != null || metrics.technicals.hi52w != null) && (
        <div className="card">
          <h3 className="card-header">Technical Indicators</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatItem label="RSI (14)" value={metrics.technicals.rsi14?.toFixed(2) || 'N/A'} />
            <StatItem label="MA 20" value={metrics.technicals.ma20 ? `$${metrics.technicals.ma20.toFixed(2)}` : 'N/A'} />
            <StatItem label="MA 50" value={metrics.technicals.ma50 ? `$${metrics.technicals.ma50.toFixed(2)}` : 'N/A'} />
            <StatItem label="MA 200" value={metrics.technicals.ma200 ? `$${metrics.technicals.ma200.toFixed(2)}` : 'N/A'} />
            <StatItem label="52W High" value={metrics.technicals.hi52w ? `$${metrics.technicals.hi52w.toFixed(2)}` : 'N/A'} />
            <StatItem label="52W Low" value={metrics.technicals.lo52w ? `$${metrics.technicals.lo52w.toFixed(2)}` : 'N/A'} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HOLDINGS TAB
// ============================================================================

function HoldingsTab({ ticker, holdings }: any) {
  if (!holdings) return <TableSkeleton />;

  const handleExportCSV = () => {
    if (!holdings.holdings) return;
    const csvData = holdings.holdings.map((h: any) => ({
      Ticker: h.holdingTicker,
      Name: h.holdingName,
      Weight: h.weight,
      Sector: h.sector || '',
      Industry: h.industry || '',
    }));
    downloadCSV(csvData, `${ticker}_holdings.csv`);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="card-header mb-0">Top Holdings</h3>
        <button onClick={handleExportCSV} className="btn btn-outline flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table>
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th>#</th>
              <th>Ticker</th>
              <th>Name</th>
              <th className="text-right">Weight</th>
              <th>Sector</th>
              <th>Industry</th>
            </tr>
          </thead>
          <tbody>
            {holdings.holdings?.map((h: any, i: number) => (
              <tr key={h.holdingTicker}>
                <td className="text-gray-400">{i + 1}</td>
                <td className="font-medium">{h.holdingTicker}</td>
                <td className="max-w-xs truncate" title={h.holdingName}>
                  {h.holdingName}
                </td>
                <td className="text-right font-mono">{formatPercent(h.weight)}</td>
                <td>
                  <span className="badge badge-blue text-xs">{h.sector || 'N/A'}</span>
                </td>
                <td className="text-gray-500 text-sm">{h.industry || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// THEMES TAB
// ============================================================================

function ThemesTab({ ticker, themes }: any) {
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  if (!themes) return <CardSkeleton />;

  const selectedThemeData = themes.exposures?.find(
    (t: any) => t.themeId === selectedTheme
  );

  const handleExportJSON = () => {
    downloadJSON(themes, `${ticker}_themes.json`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Theme Exposures Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header mb-0">Theme Exposures</h3>
          <button onClick={handleExportJSON} className="btn btn-outline flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export JSON
          </button>
        </div>
        {themes.exposures?.length > 0 ? (
          <ThemeExposureChart
            exposures={themes.exposures.map((t: any) => ({
              themeName: t.themeName,
              exposure: t.exposure / 100, // stored as % (e.g. 26.95), chart expects decimal (0.2695)
            }))}
          />
        ) : (
          <p className="text-gray-500 text-center py-8">No theme exposure data</p>
        )}
      </div>

      {/* Theme List */}
      <div className="card">
        <h3 className="card-header">Theme Breakdown</h3>
        {themes.exposures?.length > 0 ? (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {themes.exposures.map((t: any) => (
              <button
                key={t.themeId}
                onClick={() =>
                  setSelectedTheme(selectedTheme === t.themeId ? null : t.themeId)
                }
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedTheme === t.themeId
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">{t.themeName}</span>
                  <span className="badge badge-blue">{t.exposure.toFixed(2)}%</span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {t.holdings?.length || 0} holdings
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No themes identified</p>
        )}
      </div>

      {/* Selected Theme Holdings */}
      {selectedThemeData && (
        <div className="card lg:col-span-2">
          <h3 className="card-header">
            Holdings in "{selectedThemeData.themeName}"
          </h3>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Name</th>
                  <th className="text-right">Weight</th>
                  <th className="text-right">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {selectedThemeData.holdings?.map((h: any) => (
                  <tr key={h.ticker}>
                    <td className="font-medium">{h.ticker}</td>
                    <td>{h.name}</td>
                    <td className="text-right font-mono">{h.weight.toFixed(2)}%</td>
                    <td className="text-right font-mono">
                      {formatPercent(h.confidence)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NEWS TAB
// ============================================================================

function NewsTab({ ticker, impact }: any) {
  if (!impact) return <CardSkeleton />;

  return (
    <div className="card">
      <h3 className="card-header">News Impacting {ticker}</h3>

      {impact.impacts?.length > 0 ? (
        <div className="space-y-4">
          {impact.impacts.map((item: any, i: number) => (
            <div key={i} className="border-b pb-4 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <a
                    href={item.newsItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gray-900 hover:text-primary-600 flex items-center gap-1"
                  >
                    {item.newsItem.title}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    <span>{item.newsItem.source}</span>
                    <span>•</span>
                    <span>{formatDate(item.newsItem.publishedAt)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-primary-600">
                    Impact: {item.impactScore.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Impact Details */}
              <div className="mt-3 bg-gray-50 rounded-lg p-3 text-sm">
                <p className="text-gray-700 mb-2">{item.rationale}</p>
                <div className="flex flex-wrap gap-2">
                  {item.matchedHoldings?.length > 0 && (
                    <div>
                      <span className="text-gray-500">Holdings:</span>
                      {item.matchedHoldings.map((h: string) => (
                        <span key={h} className="badge badge-blue ml-1">
                          {h}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.matchedThemes?.length > 0 && (
                    <div>
                      <span className="text-gray-500">Themes:</span>
                      {item.matchedThemes.map((t: string) => (
                        <span key={t} className="badge badge-gray ml-1">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Topics */}
              {item.newsItem.topics?.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {item.newsItem.topics.map((topic: string) => (
                    <span key={topic} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">
          No news impacts found for this ETF
        </p>
      )}
    </div>
  );
}

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

// Simple stat display
function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900">{value}</div>
    </div>
  );
}

// Allocation bar with percentage
function AllocationBar({
  label,
  percentage,
  color,
}: {
  label: string;
  percentage: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium text-gray-900">{percentage.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

// Market cap row with subtitle
function MarketCapRow({
  label,
  subtitle,
  percentage,
}: {
  label: string;
  subtitle: string;
  percentage: number;
}) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{subtitle}</div>
      </div>
      <div className="text-lg font-semibold text-gray-900">
        {percentage.toFixed(1)}%
      </div>
    </div>
  );
}

// Valuation metric display
function ValuationMetric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-primary-50' : 'bg-gray-50'}`}>
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <div className={`text-xl font-bold ${highlight ? 'text-primary-600' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}
