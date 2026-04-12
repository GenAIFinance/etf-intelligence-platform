'use client';

// apps/web/src/app/about/page.tsx

import { Play, Database, Bot, BarChart3, Search } from 'lucide-react';
import Link from 'next/link';

// ── Navigation how-to videos — add youtubeId when recorded ───────────────────
const NAV_VIDEOS = [
  {
    id: 1,
    title: 'How to Find ETFs',
    description: 'Use the Find ETFs screener to instantly rank 6,800+ ETFs by cost, return, Sharpe ratio, or size — directly from the database with no AI needed.',
    duration: null as string | null,
    youtubeId: null as string | null,
  },
  {
    id: 2,
    title: 'How to Use Ask ETF',
    description: 'Ask any question about macro trends, ETF categories, or portfolio strategies. Learn how to use the section pills to get the most relevant AI response.',
    duration: null as string | null,
    youtubeId: null as string | null,
  },
  {
    id: 3,
    title: 'How to Compare ETFs',
    description: 'Enter up to 4 ETF tickers to compare returns, risk metrics, expense ratios, and holdings side by side — with the best values highlighted automatically.',
    duration: null as string | null,
    youtubeId: null as string | null,
  },
];

// ── Page sections ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Search,
    title: 'Find ETFs',
    href: '/research',
    description: 'Rank 6,800+ ETFs by any metric — expense ratio, Sharpe ratio, annualised returns, or AUM. Results come directly from the database, instantly.',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: Bot,
    title: 'Ask ETF',
    href: '/research',
    description: 'Ask any market question in plain English. Get AI-powered analysis on macro trends, sector rotation, category selection, or portfolio strategy — backed by real data.',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    icon: BarChart3,
    title: 'Compare ETFs',
    href: '/compare',
    description: 'Compare up to 4 ETFs side by side across performance, risk, cost, and holdings. Best values are highlighted automatically so you can spot the winner at a glance.',
    color: 'bg-emerald-100 text-emerald-600',
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-14">

      {/* ── Section 1: What is ETF Intelligence ──────────────────────────── */}
      <section>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">About ETF Intelligence</h1>
        <p className="text-gray-600 text-base leading-relaxed max-w-2xl">
          ETF Intelligence is a professional-grade research tool for individual investors who want
          to understand what they own. It brings together data on 6,800+ ETFs, institutional-grade
          analytics, and AI-powered research — in one place, built for serious investors.
        </p>
      </section>

      {/* ── Section 2: Who is it for ──────────────────────────────────────── */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Who is it for?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="font-semibold text-gray-900 mb-1">Individual investors</p>
            <p className="text-sm text-gray-500 leading-relaxed">
              Who want to research ETFs rigorously — not just pick a ticker because someone mentioned it online.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="font-semibold text-gray-900 mb-1">Data-driven decision makers</p>
            <p className="text-sm text-gray-500 leading-relaxed">
              Who want real metrics — Sharpe ratio, max drawdown, annualised returns — not just price charts.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="font-semibold text-gray-900 mb-1">Curious learners</p>
            <p className="text-sm text-gray-500 leading-relaxed">
              Who want to understand how ETFs work and how to build a portfolio — not just be told what to buy.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="font-semibold text-gray-900 mb-1">Experienced investors</p>
            <p className="text-sm text-gray-500 leading-relaxed">
              Who want a fast, structured way to screen and compare ETFs without building their own spreadsheets.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3: What powers it ─────────────────────────────────────── */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">What powers it?</h2>
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">6,800+ ETFs tracked</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Price and fundamental data sourced from EODHD, covering US and Canadian exchanges.
                Updated daily for short-term metrics, monthly for long-term calculations.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { value: '6,800+', label: 'ETFs tracked' },
              { value: 'Daily',  label: 'Price updates' },
              { value: 'US + CA', label: 'Exchanges' },
              { value: 'AI',     label: 'Powered research' },
            ].map(s => (
              <div key={s.label}>
                <div className="text-2xl font-bold text-blue-600">{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: How to navigate ────────────────────────────────────── */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">How to navigate the app</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <Link
                key={f.title}
                href={f.href}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow group"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${f.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                  {f.title}
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">{f.description}</p>
              </Link>
            );
          })}
        </div>

        {/* Navigation videos */}
        <h3 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Play className="w-4 h-4 text-blue-600" />
          Watch how to use each feature
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {NAV_VIDEOS.map(video => (
            <div
              key={video.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
            >
              <div className="relative aspect-video bg-gray-100 rounded-lg mb-3 overflow-hidden">
                {video.youtubeId ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${video.youtubeId}`}
                    title={video.title}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      <Play className="w-6 h-6 text-gray-400 ml-1" />
                    </div>
                    <span className="text-xs text-gray-400">Coming soon</span>
                  </div>
                )}
              </div>
              <h4 className="font-medium text-gray-900 text-sm">{video.title}</h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{video.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Disclaimer ────────────────────────────────────────────────────── */}
      <section className="border-t border-gray-200 pt-6">
        <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
          ETF Intelligence is for informational purposes only and does not constitute financial advice.
          All data is sourced from third-party providers. Past performance does not guarantee future results.
          Always consult a qualified financial advisor before making investment decisions.
        </p>
      </section>

    </div>
  );
}
