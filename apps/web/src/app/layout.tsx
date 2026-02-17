'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Home, Search, TrendingUp, Newspaper, Sparkles } from 'lucide-react';  // Added Sparkles

const inter = Inter({ subsets: ['latin'] });

function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/etfs', label: 'ETF Screener', icon: Search },
    { href: '/ai-screener', label: 'AI Screener', icon: Sparkles, highlighted: true },  // NEW: AI Screener
    { href: '/compare', label: 'Compare', icon: BarChart3 },
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
              
              // Special styling for AI Screener button
              if (link.highlighted) {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-purple-700 text-white'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              }
              
              // Regular styling for other links
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    <html lang="en">
      <head>
        {/* Block all search engine indexing - EODHD personal use compliance */}
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noodp" />
        <meta name="googlebot" content="noindex, nofollow" />
        <meta name="bingbot" content="noindex, nofollow" />
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
