// apps/web/src/hooks/useHeartbeat.ts
//
// Runs in the root layout for every page.
// On first visit: generates a UUID and stores it in a 1-year cookie (etf_visitor).
// On mount:       registers the session with the backend.
// Every 60s:      pings /api/sessions/ping so duration_sec stays current.
// On unmount:     clears the interval.

import { useEffect } from 'react';

const API_URL        = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PING_INTERVAL  = 60_000; // 60 seconds
const VISITOR_COOKIE = 'etf_visitor';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreateVisitorId(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp('(^| )' + VISITOR_COOKIE + '=([^;]+)'));
  if (match) return decodeURIComponent(match[2]);
  // No cookie yet — generate UUID and set 1-year cookie
  const id = generateUUID();
  document.cookie = `${VISITOR_COOKIE}=${id}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
  return id;
}

export function useHeartbeat(): void {
  useEffect(() => {
    const visitorId = getOrCreateVisitorId();
    if (!visitorId) return;

    // Register session on mount (ON CONFLICT DO NOTHING — safe to repeat)
    fetch(`${API_URL}/api/sessions/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_id: visitorId, username: visitorId }),
    }).catch(() => { /* silent — never block the UI */ });

    // Ping every 60s to keep duration_sec and last_active_at current
    const interval = setInterval(() => {
      fetch(`${API_URL}/api/sessions/ping`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_id: visitorId }),
      }).catch(() => { /* silent */ });
    }, PING_INTERVAL);

    return () => clearInterval(interval);
  }, []); // runs once per page load
}
