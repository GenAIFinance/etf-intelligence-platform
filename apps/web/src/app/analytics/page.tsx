'use client';
// apps/web/src/app/analytics/page.tsx
// Admin analytics dashboard — user activity, sessions, events, popular pages.

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Users, Clock, Activity, BarChart2, Calendar } from 'lucide-react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ── Types ────────────────────────────────────────────────────────────────────

interface UserStat {
  username:       string;
  total_visits:   number;
  days_active:    number;
  last_seen:      string;
  visits_this_week: number;
}

interface PageStat {
  path:         string;
  hits:         number;
  unique_users: number;
}

interface SessionRow {
  username:     string;
  session_id:   string;
  logged_in_at:  string;
  last_active_at: string;
  duration_sec: number;
}

interface EventRow {
  username:    string;
  event_type:  string;
  event_data:  Record<string, unknown>;
  occurred_at: string;
}

// ── Supabase fetcher ─────────────────────────────────────────────────────────

async function sbFetch(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}`);
  return res.json();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(sec: number): string {
  if (sec < 60)   return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function weekAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactElement }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
      <div className="p-2 bg-blue-50 rounded-lg text-blue-600">{icon}</div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage(): React.ReactElement {
  const [userStats,    setUserStats]    = useState<UserStat[]>([]);
  const [pageStats,    setPageStats]    = useState<PageStat[]>([]);
  const [sessions,     setSessions]     = useState<SessionRow[]>([]);
  const [events,       setEvents]       = useState<EventRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<'users' | 'pages' | 'sessions' | 'events'>('users');
  const [lastRefresh,  setLastRefresh]  = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // User activity summary
      const activity: { username: string; path: string; accessed_at: string }[] =
        await sbFetch('user_activity?select=username,path,accessed_at&order=accessed_at.desc&limit=2000');

      // Aggregate per user
      const userMap = new Map<string, { visits: number; days: Set<string>; last: string; weekVisits: number }>();
      const week = weekAgo();
      for (const row of activity) {
        if (!userMap.has(row.username)) {
          userMap.set(row.username, { visits: 0, days: new Set(), last: row.accessed_at, weekVisits: 0 });
        }
        const u = userMap.get(row.username)!;
        u.visits++;
        u.days.add(row.accessed_at.slice(0, 10));
        if (row.accessed_at > week) u.weekVisits++;
        if (row.accessed_at > u.last) u.last = row.accessed_at;
      }
      setUserStats(Array.from(userMap.entries()).map(([username, u]) => ({
        username,
        total_visits:     u.visits,
        days_active:      u.days.size,
        last_seen:        u.last,
        visits_this_week: u.weekVisits,
      })).sort((a, b) => b.total_visits - a.total_visits));

      // Page stats
      const pathMap = new Map<string, { hits: number; users: Set<string> }>();
      for (const row of activity) {
        if (!pathMap.has(row.path)) pathMap.set(row.path, { hits: 0, users: new Set() });
        const p = pathMap.get(row.path)!;
        p.hits++;
        p.users.add(row.username);
      }
      setPageStats(Array.from(pathMap.entries()).map(([path, p]) => ({
        path, hits: p.hits, unique_users: p.users.size,
      })).sort((a, b) => b.hits - a.hits).slice(0, 20));

      // Sessions
      const sessionData: SessionRow[] = await sbFetch(
        'user_sessions?select=username,session_id,logged_in_at,last_active_at,duration_sec&order=logged_in_at.desc&limit=50'
      );
      setSessions(sessionData);

      // Events
      const eventData: EventRow[] = await sbFetch(
        'user_events?select=username,event_type,event_data,occurred_at&order=occurred_at.desc&limit=100'
      );
      setEvents(eventData);

      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalVisits   = userStats.reduce((s, u) => s + u.total_visits, 0);
  const weekVisits    = userStats.reduce((s, u) => s + u.visits_this_week, 0);
  const avgSession    = sessions.length
    ? Math.round(sessions.reduce((s, r) => s + (r.duration_sec || 0), 0) / sessions.length)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5"/>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
              <p className="text-xs text-gray-400 mt-0.5">Last refreshed {fmtDate(lastRefresh.toISOString())}</p>
            </div>
          </div>
          <button onClick={()=>void load()} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg text-xs transition-colors bg-white disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}/> Refresh
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-16 space-y-6">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total users"       value={userStats.length}    icon={<Users    className="w-4 h-4"/>}/>
          <StatCard label="Total visits"      value={totalVisits}         icon={<Activity className="w-4 h-4"/>}/>
          <StatCard label="Visits this week"  value={weekVisits}          icon={<Calendar className="w-4 h-4"/>}/>
          <StatCard label="Avg session"       value={fmtDuration(avgSession)} icon={<Clock className="w-4 h-4"/>}/>
        </div>

        {/* Tabs */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex border-b border-gray-200">
            {([
              { key: 'users'    as const, label: 'Users' },
              { key: 'pages'    as const, label: 'Top Pages' },
              { key: 'sessions' as const, label: 'Sessions' },
              { key: 'events'   as const, label: 'Events' },
            ]).map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === t.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {loading && (
              <div className="text-center py-8 text-sm text-gray-400">Loading…</div>
            )}

            {/* Users tab */}
            {!loading && activeTab === 'users' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="pb-2 pr-4">User</th>
                      <th className="pb-2 pr-4 text-right">Total visits</th>
                      <th className="pb-2 pr-4 text-right">This week</th>
                      <th className="pb-2 pr-4 text-right">Days active</th>
                      <th className="pb-2 text-right">Last seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {userStats.map(u => (
                      <tr key={u.username} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-medium text-gray-800">{u.username}</td>
                        <td className="py-2.5 pr-4 text-right text-gray-600">{u.total_visits}</td>
                        <td className="py-2.5 pr-4 text-right">
                          <span className={`font-medium ${u.visits_this_week > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                            {u.visits_this_week}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right text-gray-600">{u.days_active}</td>
                        <td className="py-2.5 text-right text-gray-400 text-xs">{fmtDate(u.last_seen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {userStats.length === 0 && <p className="text-center py-6 text-sm text-gray-400">No activity yet</p>}
              </div>
            )}

            {/* Pages tab */}
            {!loading && activeTab === 'pages' && (
              <div className="space-y-2">
                {pageStats.map((p, i) => (
                  <div key={p.path} className="flex items-center gap-3">
                    <span className="w-6 text-xs text-gray-400 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm text-gray-700 truncate">{p.path}</span>
                        <span className="text-xs text-gray-500 shrink-0 ml-2">{p.hits} hits · {p.unique_users} users</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-blue-400"
                          style={{ width: `${Math.round((p.hits / (pageStats[0]?.hits || 1)) * 100)}%` }}/>
                      </div>
                    </div>
                  </div>
                ))}
                {pageStats.length === 0 && <p className="text-center py-6 text-sm text-gray-400">No page data yet</p>}
              </div>
            )}

            {/* Sessions tab */}
            {!loading && activeTab === 'sessions' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="pb-2 pr-4">User</th>
                      <th className="pb-2 pr-4">Started</th>
                      <th className="pb-2 pr-4">Last active</th>
                      <th className="pb-2 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sessions.map(s => (
                      <tr key={s.session_id} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-medium text-gray-800">{s.username}</td>
                        <td className="py-2.5 pr-4 text-gray-500 text-xs">{fmtDate(s.logged_in_at)}</td>
                        <td className="py-2.5 pr-4 text-gray-500 text-xs">{fmtDate(s.last_active_at)}</td>
                        <td className="py-2.5 text-right font-medium text-blue-600">{fmtDuration(s.duration_sec || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sessions.length === 0 && <p className="text-center py-6 text-sm text-gray-400">No sessions yet</p>}
              </div>
            )}

            {/* Events tab */}
            {!loading && activeTab === 'events' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="pb-2 pr-4">User</th>
                      <th className="pb-2 pr-4">Event</th>
                      <th className="pb-2 pr-4">Data</th>
                      <th className="pb-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {events.map((e, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-medium text-gray-800">{e.username}</td>
                        <td className="py-2.5 pr-4">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                            {e.event_type}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-gray-400 max-w-xs truncate">
                          {Object.keys(e.event_data || {}).length > 0
                            ? JSON.stringify(e.event_data)
                            : '—'}
                        </td>
                        <td className="py-2.5 text-right text-xs text-gray-400">{fmtDate(e.occurred_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {events.length === 0 && <p className="text-center py-6 text-sm text-gray-400">No events yet</p>}
              </div>
            )}
          </div>
        </div>

        {/* Raw SQL queries for Supabase */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5"/> Supabase SQL queries
          </p>
          <div className="space-y-2 text-xs font-mono">
            {[
              { label: 'Activity by user', sql: `SELECT username, COUNT(*) AS visits, COUNT(DISTINCT DATE(accessed_at)) AS days_active, MAX(accessed_at) AS last_seen FROM user_activity GROUP BY username ORDER BY visits DESC;` },
              { label: 'Visits this week', sql: `SELECT username, COUNT(*) AS visits FROM user_activity WHERE accessed_at > NOW() - INTERVAL '7 days' GROUP BY username ORDER BY visits DESC;` },
              { label: 'Most visited pages', sql: `SELECT path, COUNT(*) AS hits, COUNT(DISTINCT username) AS unique_users FROM user_activity GROUP BY path ORDER BY hits DESC LIMIT 20;` },
              { label: 'Session durations', sql: `SELECT username, session_id, logged_in_at, last_active_at, duration_sec FROM user_sessions ORDER BY logged_in_at DESC LIMIT 50;` },
              { label: 'Recent events', sql: `SELECT username, event_type, event_data, occurred_at FROM user_events ORDER BY occurred_at DESC LIMIT 100;` },
            ].map(q => (
              <details key={q.label} className="border border-gray-100 rounded-lg">
                <summary className="px-3 py-2 cursor-pointer text-gray-500 hover:text-gray-700 select-none">{q.label}</summary>
                <pre className="px-3 pb-3 text-gray-600 whitespace-pre-wrap break-all leading-relaxed">{q.sql}</pre>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
