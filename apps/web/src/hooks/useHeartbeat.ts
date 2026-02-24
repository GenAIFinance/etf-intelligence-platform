// apps/web/src/hooks/useHeartbeat.ts
//
// Fires a heartbeat POST every 5 minutes while the tab is active.
// Pauses automatically when tab is hidden (document.visibilityState).
// Add to root layout so it runs on every page without per-page wiring.

'use client';

import { useEffect } from 'react';

const INTERVAL_MS    = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_PATH = '/api/auth/heartbeat';

export function useHeartbeat() {
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function ping() {
      // Only ping when tab is visible — avoids wasting DB writes on idle tabs
      if (document.visibilityState !== 'visible') return;
      fetch(HEARTBEAT_PATH, { method: 'POST' }).catch(() => {
        // Silently ignore — heartbeat failure should never affect UX
      });
    }

    function startInterval() {
      if (intervalId) return;
      intervalId = setInterval(ping, INTERVAL_MS);
    }

    function stopInterval() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    // Send one ping immediately on mount (captures page loads / navigation)
    ping();

    // Start the recurring interval
    startInterval();

    // Pause when tab is hidden, resume when visible again
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        ping();           // immediate ping on tab focus
        startInterval();
      } else {
        stopInterval();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
