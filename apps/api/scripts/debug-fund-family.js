/**
 * debug-fund-family.js
 * 
 * Tests what EODHD actually returns for Fund_Family on a single ETF.
 * Run: node debug-fund-family.js
 * 
 * Place in same folder as sync-metrics.js and run before the full sync.
 */

const https = require('https');

const API_KEY = process.env.EODHD_API_KEY || '6982994b580bc8.97426481';
const TICKER  = process.argv[2] || 'SPY';   // pass any ticker as argument

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error: ${data.substring(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const url = `https://eodhd.com/api/fundamentals/${TICKER}.US?api_token=${API_KEY}&fmt=json`;
  console.log(`\nFetching: ${TICKER}.US\n`);

  const fund = await httpsGet(url);

  // ── Check top-level keys ──────────────────────────────────────────────────
  console.log('Top-level keys:', Object.keys(fund));

  // ── Check ETF_Data ────────────────────────────────────────────────────────
  if (fund.ETF_Data) {
    console.log('\nETF_Data keys:', Object.keys(fund.ETF_Data));
    console.log('Fund_Family:  ', fund.ETF_Data.Fund_Family ?? '⚠️  NOT FOUND');
    console.log('Company_Name: ', fund.ETF_Data.Company_Name ?? 'n/a');
    console.log('Family_Name:  ', fund.ETF_Data.Family_Name  ?? 'n/a');  // alt field name
  } else {
    console.log('\n⚠️  No ETF_Data key in response');
    // Print all keys that contain "family" or "fund" (case insensitive)
    const allKeys = JSON.stringify(fund);
    const matches = [...allKeys.matchAll(/"([^"]*(?:family|fund|issuer)[^"]*)"/gi)]
      .map(m => m[1])
      .filter(k => k.length < 40);
    console.log('Keys containing family/fund/issuer:', [...new Set(matches)]);
  }

  // ── Check Technicals ─────────────────────────────────────────────────────
  if (fund.Technicals) {
    console.log('\nTechnicals:', fund.Technicals);
  } else {
    console.log('\n⚠️  No Technicals key');
  }

  // ── Raw snippet for manual inspection ────────────────────────────────────
  const raw = JSON.stringify(fund, null, 2);
  console.log('\n── First 1000 chars of response ──');
  console.log(raw.substring(0, 1000));
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
