'use client';

// apps/web/src/components/WelcomeBanner.tsx
//
// Dismissible welcome banner shown once to first-time invite users.
// Stores dismissal in localStorage per page key — never shows again after dismissed.
// Only renders when user arrived via invite (isNewUser cookie set by invite route).

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface BulletPoint {
  text: string;
}

interface WelcomeBannerProps {
  pageKey:     string;          // unique key per page e.g. 'compare', 'research'
  title:       string;          // page name
  description: string;          // one sentence on what the page does
  bullets:     BulletPoint[];   // 2-3 specific things the user can do
  startLabel?: string;          // optional CTA button label
  startHref?:  string;          // optional CTA button href (if external anchor needed)
  onStart?:    () => void;      // optional CTA button action
}

const STORAGE_PREFIX = 'etf_banner_dismissed_';

export default function WelcomeBanner({
  pageKey, title, description, bullets, startLabel, onStart,
}: WelcomeBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if not already dismissed for this page
    const dismissed = localStorage.getItem(`${STORAGE_PREFIX}${pageKey}`);
    if (!dismissed) setVisible(true);
  }, [pageKey]);

  function dismiss() {
    localStorage.setItem(`${STORAGE_PREFIX}${pageKey}`, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 relative">
      {/* Dismiss button */}
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 text-blue-400 hover:text-blue-600 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Header */}
      <div className="pr-6">
        <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">
          Welcome to
        </p>
        <h2 className="text-lg font-bold text-blue-900 mb-1">{title}</h2>
        <p className="text-sm text-blue-700 mb-3">{description}</p>
      </div>

      {/* Bullets */}
      <ul className="space-y-1.5 mb-4">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-blue-200 text-blue-700 text-xs flex items-center justify-center shrink-0 font-bold">
              {i + 1}
            </span>
            <span>{b.text}</span>
          </li>
        ))}
      </ul>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {startLabel && (
          <button
            type="button"
            onClick={() => { onStart?.(); dismiss(); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {startLabel} →
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="text-sm text-blue-500 hover:text-blue-700 transition-colors"
        >
          Got it, let's go
        </button>
      </div>
    </div>
  );
}
