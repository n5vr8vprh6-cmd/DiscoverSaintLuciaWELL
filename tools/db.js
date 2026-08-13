/* ============================================================================
   db.js — look at what is actually in the database, and tidy up test rows
   ----------------------------------------------------------------------------
   Reads the service-role key from the gitignored .env and never prints it.
   Consumer contact details are masked in output for the same reason: a
   verification run should not turn a terminal, a log or a chat transcript into
   a second copy of the personal data we just promised to look after.

   Run:  node tools/db.js                 counts and a masked recent sample
         node tools/db.js --purge-test    delete rows created by testing
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const env = {};
fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach((line) => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const i = t.indexOf('=');
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
});

const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env');
  process.exit(1);
}

const PURGE = process.argv.includes('--purge-test');
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

/* Anything a test created. Deliberately narrow so a real consumer share can
   never match: seeded session ids, obviously synthetic addresses, and the two
   names used by the verification run. */
const TEST_EMAILS = ['rate1@example.com', 'rate2@example.com', 'rate3@example.com',
                     'rate4@example.com', 'rate5@example.com', 'rate6@example.com'];
const TEST_SESSIONS = ['verify-001', 'regress', 'baseline'];

function mask(s) {
  if (!s) return '';
  const [u, d] = String(s).split('@');
  return d ? u.slice(0, 2) + '***@' + d : String(s).slice(0, 2) + '***';
}

async function api(pathname, init) {
  const res = await fetch(URL + '/rest/v1/' + pathname, Object.assign({ headers: H }, init));
  if (!res.ok) throw new Error(pathname + ' -> ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

(async () => {
  if (PURGE) {
    console.log('  Deleting test rows only — real shares are not matched by these filters.\n');
    /* Two filters, both narrow: the synthetic addresses used by the rate-limit
       test, and the seeded session id used by the verification run. A real
       consumer share can match neither. */
    let removed = 0;
    for (const q of ['consumer_email=in.(' + TEST_EMAILS.join(',') + ')',
                     'session_id=in.(' + TEST_SESSIONS.join(',') + ')']) {
      const gone = await api('journey_shares?' + q, {
        method: 'DELETE', headers: Object.assign({ Prefer: 'return=representation' }, H)
      });
      removed += gone.length;
    }
    console.log(`  journey_shares      removed ${removed}`);
    for (const t of ['campaign_visits', 'finder_completions']) {
      const g = await api(`${t}?session_id=in.(${TEST_SESSIONS.join(',')})`, {
        method: 'DELETE', headers: Object.assign({ Prefer: 'return=representation' }, H)
      });
      console.log(`  ${t.padEnd(19)} removed ${g.length}`);
    }
    console.log('');
  }

  for (const t of ['advisors', 'campaign_visits', 'finder_completions', 'journey_shares']) {
    const res = await fetch(`${URL}/rest/v1/${t}?select=id`, {
      headers: Object.assign({ Prefer: 'count=exact', Range: '0-0' }, H)
    });
    const range = res.headers.get('content-range') || '';
    console.log(`  ${t.padEnd(19)} ${(range.split('/')[1] || '?')} rows`);
  }

  const shares = await api('journey_shares?select=consumer_first,consumer_email,timing,villages,notified_at,advisor_id&order=created_at.desc&limit=5');
  if (shares.length) {
    console.log('\n  most recent shares (contact details masked):');
    shares.forEach((s) => {
      console.log(`    ${(s.consumer_first || '').padEnd(14)} ${mask(s.consumer_email).padEnd(24)}` +
        ` notified=${s.notified_at ? 'yes' : 'NO '} advisor=${s.advisor_id ? 'linked' : 'none'}` +
        ` villages=${(s.villages || []).length}`);
    });
  }
})().catch((e) => { console.error('  ' + e.message); process.exit(1); });
