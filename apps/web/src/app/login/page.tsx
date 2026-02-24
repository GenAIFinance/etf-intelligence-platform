'use client';

// login/page.tsx → apps/web/src/app/login/page.tsx
//
// Password gate UI — matches platform design system (teal/emerald, Tailwind).
// On success: sets auth cookie via /api/auth/login, redirects to destination.
// On failure: shows inline error, no lockout (private use, 1-2 known users).

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, TrendingUp } from 'lucide-react';

export default function LoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirect     = searchParams.get('redirect') || '/';

  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  // If already authed (e.g. back-button), skip straight through
  useEffect(() => {
    fetch('/api/auth/login', { method: 'GET' }).then(res => {
      if (res.ok) router.replace(redirect);
    }).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.replace(redirect);
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">

        {/* Header strip */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingUp className="w-6 h-6 text-white" />
            <span className="text-white font-bold text-lg">ETF Intelligence</span>
          </div>
          <p className="text-teal-100 text-sm">Private access — enter password to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-8 space-y-5">

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter access password"
                autoFocus
                required
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent
                           placeholder:text-gray-300"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300
                       text-white text-sm font-medium rounded-lg transition-colors
                       disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying…' : 'Access Platform'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-gray-400 text-center max-w-xs">
        Private research tool. Data sourced from EODHD for personal use only.
      </p>
    </div>
  );
}