'use client';
// NOTE: 'use client' is intentional here — this layout uses usePathname, useState,
// and useHeartbeat, all of which require the client runtime. Trade-off: the full
// layout tree is client-rendered (no RSC shell). Acceptable for an auth-gated
// personal tool. To optimise later: extract <Navigation> and <ClientProviders>
// into separate client components and make RootLayout a Server Component.

import './globals.css';
import { Inter, Oxanium, DM_Sans, JetBrains_Mono } from 'next/font/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Home, Search, Sparkles } from 'lucide-react';
import { useHeartbeat } from '../hooks/useHeartbeat';

// ============================================================================
// FONTS
// ============================================================================

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Used by the AI Screener page (display headings)
const oxanium = Oxanium({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-oxanium',
  display: 'swap',
});

// Used by the AI Screener page (body)
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
});

// Used by the AI Screener page (monospace — tickers, numbers)
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

// ============================================================================
// NAVIGATION
// ============================================================================

function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/',            label: 'Dashboard',   icon: Home    },
    { href: '/etfs',        label: 'ETF Screener', icon: Search  },
    { href: '/compare',  label: 'Compare',     icon: BarChart3 },
    { href: '/research', label: 'AI Research',  icon: Sparkles, highlighted: true },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-primary-600" />
              <span className="font-bold text-xl text-gray-900">ETF Intelligence</span>
            </Link>
          </div>

          <div className="flex items-center gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              if (link.highlighted) {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-teal-700 text-white'
                        : 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700 shadow-md hover:shadow-lg'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              }

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

// ============================================================================
// FOOTER
// ============================================================================

function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} ETF Intelligence. All rights reserved.
          </p>
          <p className="text-xs text-gray-400">
            Disclaimer: Not investment advice. Data provided for informational purposes only.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// ROOT LAYOUT
// ============================================================================

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useHeartbeat();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <html lang="en" className={`${inter.variable} ${oxanium.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Block all search engine indexing — EODHD personal-use compliance */}
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noodp" />
        <meta name="googlebot" content="noindex, nofollow" />
        <meta name="bingbot" content="noindex, nofollow" />

        {/* Viewport — required for responsive layout */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <title>ETF Intelligence</title>
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <QueryClientProvider client={queryClient}>
          <Navigation />
          <main className="flex-1">{children}</main>
          <Footer />
        </QueryClientProvider>
      </body>
    </html>
  );
}
