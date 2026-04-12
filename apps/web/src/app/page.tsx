'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { AlertCircle, Play, Shield } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Gainer {
  ticker:   string;
  name:     string;
  return1M: number;
}

interface Sector {
  strategyType: string;
  etfCount:     number;
  avgReturn1M:  number | null;
}

// ETF Education videos
const ETF_EDUCATION_VIDEOS = [
  {
    id: 1,
    title: 'What Is an ETF?',
    duration: '2:30',
    description: 'Understand the structure, mechanics, and key characteristics of exchange-traded funds',
    youtubeId: 't9PsTk2Weao',
  },
  {
    id: 2,
    title: 'ETFs vs. Single Stocks',
    duration: '3:15',
    description: 'Why ETFs offer better diversification, lower risk, and cost advantages over picking individual stocks',
    youtubeId: 'wMWxMzFt7JU',
  },
  {
    id: 3,
    title: '3 Portfolio Strategies for ETF Investors',
    duration: '4:00',
    description: 'Core-satellite, factor-based, and income strategies — and why a clear strategy improves long-term outcomes',
    youtubeId: 'e9-BUFNSR9s',
  },
];

// Getting Started (app tutorial) videos
const GETTING_STARTED_VIDEOS = [
  {
    id: 4,
    title: 'Getting Started with ETF Research',
    duration: '2:30',
    description: 'Learn how to use AI-powered screening tools',
  },
  {
    id: 5,
    title: 'Comparing ETFs Effectively',
    duration: '3:15',
    description: 'Side-by-side analysis and performance metrics',
  },
  {
    id: 6,
    title: 'Setting Up Price Alerts',
    duration: '1:45',
    description: 'Monitor your favorite ETFs with custom alerts',
  },
];

export default function Dashboard() {
  const [videoTab, setVideoTab] = useState<'education' | 'started'>('education');
  const [gainers, setGainers] = useState<Gainer[]>([]);
  const [gainersLoading, setGainersLoading] = useState(true);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorsLoading, setSectorsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/top-gainers`)
      .then((res) => res.json())
      .then((data) => setGainers(data.gainers ?? []))
      .catch(() => setGainers([]))
      .finally(() => setGainersLoading(false));

    fetch(`${API_URL}/api/top-sectors`)
      .then((res) => res.json())
      .then((data) => setSectors(data.sectors ?? []))
      .catch(() => setSectors([]))
      .finally(() => setSectorsLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">ETF Intelligence Dashboard</h1>
        <p className="text-gray-600">
          Your AI-powered ETF research and comparison platform
        </p>
      </div>

      {/* Video Section — Tabbed */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Play className="w-5 h-5 text-primary-600" />
          Videos
        </h2>
        {/* Tab toggle */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 w-fit">
          <button
            type="button"
            onClick={() => setVideoTab('education')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              videoTab === 'education'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ETF Education
          </button>
          <button
            type="button"
            onClick={() => setVideoTab('started')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              videoTab === 'started'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Getting Started
          </button>
        </div>
        {/* Video grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(videoTab === 'education' ? ETF_EDUCATION_VIDEOS : GETTING_STARTED_VIDEOS).map((video) => (
            <div
              key={video.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="relative aspect-video bg-gray-100 rounded-lg mb-3 overflow-hidden">
                {'youtubeId' in video && video.youtubeId ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${video.youtubeId}`}
                    title={video.title}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <Play className="w-6 h-6 text-primary-600 ml-1" />
                    </div>
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                      {video.duration}
                    </span>
                  </div>
                )}
              </div>
              <h3 className="font-medium text-gray-900 text-sm">{video.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{video.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Gainers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Top Gainers This Month
            </h2>
            <Link href="/research" className="text-primary-600 text-sm hover:underline">
              View all
            </Link>
          </div>

          {gainersLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : gainers.length > 0 ? (
            <div className="space-y-3">
              {gainers.map((etf, index) => (
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
                    <div className={`text-sm font-semibold ${etf.return1M >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {etf.return1M >= 0 ? '+' : ''}{etf.return1M.toFixed(2)}%
                    </div>
                    <div className="text-xs text-gray-500">1M return</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No data available</p>
            </div>
          )}
        </div>

        {/* Top Sectors */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Top Sectors This Month</h2>
            <Link href="/research" className="text-primary-600 text-sm hover:underline">
              View all
            </Link>
          </div>

          {sectorsLoading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : sectors.length > 0 ? (
            <div className="space-y-2">
              {sectors.map((sector, index) => (
                <div
                  key={sector.strategyType}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400">#{index + 1}</span>
                    <span className="font-medium text-gray-800 text-sm">{sector.strategyType}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${
                      sector.avgReturn1M === null ? 'text-gray-400'
                        : sector.avgReturn1M >= 0 ? 'text-emerald-600'
                        : 'text-red-600'
                    }`}>
                      {sector.avgReturn1M === null
                        ? 'N/A'
                        : `${sector.avgReturn1M >= 0 ? '+' : ''}${sector.avgReturn1M.toFixed(2)}%`}
                    </span>
                    <span className="text-xs text-gray-400 hidden sm:inline">{sector.etfCount} ETFs</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No sector data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer - Smaller Font */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center leading-relaxed max-w-4xl mx-auto">
          <Shield className="w-3 h-3 inline-block mr-1" />
          <strong>Disclaimer:</strong> This platform is for informational purposes only and does not constitute financial advice.
          All data is sourced from third-party providers and may not be real-time. Past performance does not guarantee future results.
          Always consult with a qualified financial advisor before making investment decisions.
        </p>
      </div>
    </div>
  );
}
