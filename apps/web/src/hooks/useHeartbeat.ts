// apps/web/src/hooks/useHeartbeat.ts
//
// Runs in the root layout for every authenticated page.
// On mount:   registers the session with the backend (upsert — safe to call multiple times)
// Every 60s:  pings /api/sessions/ping so duration_sec stays current
// On unmount: clears the interval

import { useEffect } from 'react';

const API_URL       = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PING_INTERVAL = 60_000; // 60 seconds

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export function useHeartbeat(): void {
  useEffect(() => {
    const username  = getCookie('etf_user');
    const sessionId = getCookie('etf_session');

    // Not logged in — nothing to track
    if (!username || !sessionId) return;

    // Register session on mount (ON CONFLICT DO NOTHING — safe to repeat)
    fetch(`${API_URL}/api/sessions/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_id: sessionId, username }),
    }).catch(() => { /* silent — never block the UI */ });

    // Ping every 60s to keep duration_sec and last_active_at current
    const interval = setInterval(() => {
      fetch(`${API_URL}/api/sessions/ping`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_id: sessionId }),
      }).catch(() => { /* silent */ });
    }, PING_INTERVAL);

    return () => clearInterval(interval);
  }, []); // runs once per page load
}
