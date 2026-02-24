// apps/web/src/app/api/auth/heartbeat/route.ts
//
// POST — reads session cookie, updates last_active_at for that session in Supabase.
// Called automatically every 5 minutes by useHeartbeat hook while user is active.
// Silent — never returns an error that would surface to the user.

import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, COOKIE_NAME } from '../../../../middleware';

export async function POST(request: NextRequest) {
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const session     = parseSessionCookie(cookieValue);

  // No valid session — ignore silently (user may have just logged out)
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const supabaseUrl      = process.env.SUPABASE_URL;
  const supabaseKey      = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Not configured — don't crash, just skip
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    // PATCH the row matching this session_id
    const url = `${supabaseUrl}/rest/v1/user_sessions?session_id=eq.${encodeURIComponent(session.sessionId)}`;
    const res = await fetch(url, {
      method:  'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ last_active_at: new Date().toISOString() }),
    });

    if (!res.ok) {
      console.error('[heartbeat] Supabase PATCH failed:', await res.text());
    }
  } catch (err) {
    // Network/DB error — log but never bubble up to UI
    console.error('[heartbeat] Error:', err);
  }

  return NextResponse.json({ ok: true });
}
