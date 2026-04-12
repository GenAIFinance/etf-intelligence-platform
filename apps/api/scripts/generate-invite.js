/**
 * ETF Intelligence — Invite Token Generator
 *
 * Usage:
 *   set SUPABASE_URL=https://xxx.supabase.co
 *   set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 *   set APP_URL=https://your-vercel-app.vercel.app
 *
 *   node generate-invite.js "Reddit user John"
 *   node generate-invite.js "LinkedIn contact Sarah" --days 7
 *   node generate-invite.js "Compare tester" --dest /compare
 *   node generate-invite.js "Research tester" --dest /research --days 14
 *
 * Options:
 *   --days N    Token expiry in days (default: 30)
 */

'use strict';

const https   = require('https');
const crypto  = require('crypto');

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL      = process.env.APP_URL || 'https://your-app.vercel.app';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables.');
  console.error('   set SUPABASE_URL=https://xxx.supabase.co');
  console.error('   set SUPABASE_SERVICE_ROLE_KEY=your_key');
  process.exit(1);
}

// ── Args ──────────────────────────────────────────────────────────────────────

const args  = process.argv.slice(2);
const label = args.find(a => !a.startsWith('--'));

if (!label) {
  console.error('❌ Usage: node generate-invite.js "Label for this person"');
  console.error('   Example: node generate-invite.js "Reddit user John"');
  process.exit(1);
}

const daysIdx  = args.indexOf('--days');
const days     = daysIdx >= 0 && args[daysIdx + 1] ? parseInt(args[daysIdx + 1], 10) : 30;
const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const destIdx  = args.indexOf('--dest');
const dest     = destIdx >= 0 && args[destIdx + 1] ? args[destIdx + 1] : '/';

// ── Generate token ────────────────────────────────────────────────────────────

const token = crypto.randomBytes(24).toString('hex'); // 48 char hex token

// ── Insert into Supabase ──────────────────────────────────────────────────────

const body = JSON.stringify({ token, label, dest, expires_at: expiresAt });

const url    = new URL(`${SUPABASE_URL}/rest/v1/invite_tokens`);
const options = {
  hostname: url.hostname,
  path:     url.pathname,
  method:   'POST',
  headers: {
    'Content-Type':  'application/json',
    'Content-Length': Buffer.byteLength(body),
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer':        'return=minimal',
  },
};

const req = https.request(options, (res) => {
  if (res.statusCode === 201 || res.statusCode === 200) {
    console.log('\n✅ Invite token created\n');
    console.log(`  Label:   ${label}`);
    console.log(`  Dest:    ${dest}`);
    console.log(`  Expires: ${new Date(expiresAt).toDateString()} (${days} days)`);
    console.log(`  Token:   ${token}`);
    console.log(`\n  🔗 Invite link:`);
    console.log(`  ${APP_URL}/api/auth/invite/${token}\n`);
    console.log('  Copy and send this link. It works once and expires automatically.\n');
  } else {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.error(`❌ Supabase error ${res.statusCode}: ${data}`);
      process.exit(1);
    });
  }
});

req.on('error', (err) => {
  console.error('❌ Network error:', err.message);
  process.exit(1);
});

req.write(body);
req.end();
