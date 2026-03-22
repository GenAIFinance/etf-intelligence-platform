'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Search, ExternalLink, AlertCircle, Bot, GitCompare, Eye, Play, Database, Shield } from 'lucide-react';

// Inline mock data
const MOCK_ETFS = [
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', assetClass: 'Equity' },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust', assetClass: 'Equity' },
  { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', assetClass: 'Equity' },
  { ticker: 'ARKK', name: 'ARK Innovation ETF', assetClass: 'Equity' },
  { ticker: 'XLK', name: 'Technology Select Sector SPDR Fund', assetClass: 'Equity' },
  { ticker: 'XLF', name: 'Financial Select Sector SPDR Fund', assetClass: 'Equity' },
  { ticker: 'SOXX', name: 'iShares Semiconductor ETF', assetClass: 'Equity' },
  { ticker: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', assetClass: 'Fixed Income' },
  { ticker: 'GLD', name: 'SPDR Gold Shares', assetClass: 'Commodity' },
  { ticker: 'VWO', name: 'Vanguard FTSE Emerging Markets ETF', assetClass: 'Equity' },
];

const MOCK_TOP_IMPACTED = {
  topEtfs: [
    { ticker: 'SOXX', name: 'iShares Semiconductor ETF', totalImpactScore: 8.7, newsCount: 12 },
    { ticker: 'ARKK', name: 'ARK Innovation ETF', totalImpactScore: 7.2, newsCount: 9 },
    { ticker: 'XLK', name: 'Technology Select Sector SPDR Fund', totalImpactScore: 6.5, newsCount: 8 },
    { ticker: 'QQQ', name: 'Invesco QQQ Trust', totalImpactScore: 5.8, newsCount: 15 },
    { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', totalImpactScore: 4.2, newsCount: 22 },
  ],
};

const MOCK_TRENDING_TOPICS = {
  topics: [
    { topic: 'AI Chip Export Controls', count: 24 },
    { topic: 'Interest Rate Decision', count: 18 },
    { topic: 'Earnings Report', count: 15 },
    { topic: 'FDA Regulation', count: 12 },
    { topic: 'Merger & Acquisition', count: 10 },
    { topic: 'Supply Chain Issues', count: 8 },
    { topic: 'Trade Policy', count: 7 },
    { topic: 'Product Launch', count: 6 },
  ],
};

// Intro video data
const INTRO_VIDEOS = [
  {
    id: 1,
    title: 'Getting Started with ETF Research',
    duration: '2:30',
    description: 'Learn how to use AI-powered screening tools',
  },
  {
    id: 2,
    title: 'Comparing ETFs Effectively',
    duration: '3:15',
    description: 'Side-by-side analysis and performance metrics',
  },
  {
    id: 3,
    title: 'Setting Up Price Alerts',
    duration: '1:45',
    description: 'Monitor your favorite ETFs with custom alerts',
  },
];

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEtfs = searchQuery
    ? MOCK_ETFS.filter(
        (etf) =>
          etf.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
          etf.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">ETF Intelligence Dashboard</h1>
        <p className="text-gray-600">
          Your AI-powered ETF research and comparison platform
        </p>
      </div>

      {/* Intro Videos Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Play className="w-5 h-5 text-primary-600" />
          Getting Started Videos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {INTRO_VIDEOS.map((video) => (
            <div
              key={video.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="relative aspect-video bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <Play className="w-6 h-6 text-primary-600 ml-1" />
                </div>
                <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                  {video.duration}
                </span>
              </div>
              <h3 className="font-medium text-gray-900 text-sm">{video.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{video.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-primary-600" />
          Our Data Sources
        </h2>
        <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl border border-primary-100 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">5,259+</div>
              <div className="text-sm text-gray-600 mt-1">ETFs Tracked</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">50+</div>
              <div className="text-sm text-gray-600 mt-1">Countries Covered</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">Real-time</div>
              <div className="text-sm text-gray-600 mt-1">Price Updates</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">AI</div>
              <div className="text-sm text-gray-600 mt-1">Powered Analysis</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search ETFs by ticker or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />

        {/* Search Results Dropdown */}
        {searchQuery && filteredEtfs.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
            {filteredEtfs.map((etf) => (
              <div
                key={etf.ticker}
                className="flex items-center justify-between px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-gray-50"
                onClick={() => setSearchQuery('')}
              >
                <div>
                  <span className="font-semibold text-gray-900">{etf.ticker}</span>
                  <span className="text-gray-500 ml-2">{etf.name}</span>
                </div>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{etf.assetClass}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Impacted ETFs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Top Impacted ETFs This Week
            </h2>
            <Link href="/research" className="text-primary-600 text-sm hover:underline">
              View all
            </Link>
          </div>

          {MOCK_TOP_IMPACTED.topEtfs.length > 0 ? (
            <div className="space-y-3">
              {MOCK_TOP_IMPACTED.topEtfs.slice(0, 5).map((etf, index) => (
                <div
                  key={etf.ticker}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center bg-primary-100 text-primary-700 text-xs font-bold rounded">
                      {index + 1}
                    </span>
                    <div>
                      <span className="font-semibold text-gray-900">{etf.ticker}</span>
                      <p className="text-sm text-gray-500 truncate max-w-xs">{etf.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      Impact: {etf.totalImpactScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">{etf.newsCount} news items</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No impact data available</p>
            </div>
          )}
        </div>

        {/* Trending Topics */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Trending Topics</h2>
            <Link href="/research" className="text-primary-600 text-sm hover:underline">
              View all
            </Link>
          </div>

          {MOCK_TRENDING_TOPICS.topics.length > 0 ? (
            <div className="space-y-2">
              {MOCK_TRENDING_TOPICS.topics.slice(0, 8).map((topic, index) => (
                <div
                  key={topic.topic}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                    <span className="font-medium text-gray-800">{topic.topic}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{topic.count} mentions</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No trending topics</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          href="/research"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
            <Bot className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Research</h3>
            <p className="text-sm text-gray-500">Screen & ask about ETFs</p>
          </div>
        </Link>

        <Link
          href="/compare"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <GitCompare className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Compare</h3>
            <p className="text-sm text-gray-500">Side-by-side analysis</p>
          </div>
        </Link>

        <Link
          href="/monitor"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <Eye className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Monitor</h3>
            <p className="text-sm text-gray-500">Track & set alerts</p>
          </div>
        </Link>

        <Link
          href="/about"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
            <ExternalLink className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">About</h3>
            <p className="text-sm text-gray-500">Learn more</p>
          </div>
        </Link>
      </div>

      {/* Disclaimer - Smaller Font */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center leading-relaxed max-w-4xl mx-auto">
          <Shield className="w-3 h-3 inline-block mr-1" />
          <strong>Disclaimer:</strong> This platform is for informational purposes only and does not constitute financial advice.
          All data is sourced from third-party providers and may not be real-time. Past performance does not guarantee future results.
          Always consult with a qualified financial advisor before making investment decisions.
          Data provided by EODHD (personal-use license).
        </p>
      </div>
    </div>
  );
}
