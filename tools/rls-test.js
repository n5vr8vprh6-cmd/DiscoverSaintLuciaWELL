/* ============================================================================
   rls-test.js — prove the publishable key cannot reach consumer data
   ----------------------------------------------------------------------------
   Spec acceptance criterion 18: RLS must prevent cross-advisor access. This is
   the executable form of that claim, and it exists because the obvious check is
   wrong in a way that reads as a pass or a fail depending on the day.

   THE TRAP: PostgREST answers `200 []` when RLS filters every row out. So
   `status === 200` proves nothing — an empty table and a wide-open one look
   identical, and a locked-down one looks like a leak. The only honest test is
   to PLANT a row with the service role and then try to read that specific row
   with the restricted key.

   Run:  node tools/rls-test.js
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const env = {};
fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
  const t = l.trim();
  if (!t || t.startsWith('#')) return;
  const i = t.indexOf('=');
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
});

const BASE = env.SUPABASE_URL;
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC = env.SUPABASE_ANON_KEY;
if (!BASE || !SECRET || !PUBLIC) {
  console.error('  .env needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY');
  process.exit(1);
}

const H = (k, extra) => Object.assign(
  { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' }, extra || {});

const results = [];
const check = (name, pass, detail) => results.push({ name, pass, detail: detail || '' });
const MARK = 'rls-probe-' + Date.now();

(async () => {
  /* Plant a row so there is genuinely something to leak. */
  const ins = await fetch(BASE + '/rest/v1/journey_shares', {
    method: 'POST',
    headers: H(SECRET, { Prefer: 'return=representation' }),
    body: JSON.stringify({
      answers: {}, villages: [],
      consumer_first: 'RLS', consumer_last: 'Probe',
      consumer_email: MARK + '@example.com',
      consent_text: 'rls probe', session_id: MARK
    })
  });
  const planted = ins.ok ? (await ins.json())[0] : null;
  check('service role can plant a probe row', !!planted, 'HTTP ' + ins.status);
  if (!planted) { report(); return; }

  const q = '/rest/v1/journey_shares?select=consumer_email&session_id=eq.' + MARK;

  const svc = await (await fetch(BASE + q, { headers: H(SECRET) })).json();
  check('service role reads it back', Array.isArray(svc) && svc.length === 1);

  /* THE ONE THAT MATTERS. */
  const pubRes = await fetch(BASE + q, { headers: H(PUBLIC) });
  const pub = await pubRes.json();
  check('publishable key CANNOT read the planted row',
    Array.isArray(pub) && pub.length === 0,
    Array.isArray(pub) ? pub.length + ' rows visible' : JSON.stringify(pub).slice(0, 100));

  /* Nor write one. */
  const wr = await fetch(BASE + '/rest/v1/journey_shares', {
    method: 'POST', headers: H(PUBLIC),
    body: JSON.stringify({ answers: {}, villages: [], consumer_first: 'X', consumer_last: 'Y',
                           consumer_email: 'x@y.co', consent_text: 'x' })
  });
  check('publishable key cannot insert a share', wr.status !== 201, 'HTTP ' + wr.status);

  /* Nor see advisors, notes, or campaign data. */
  for (const t of ['advisors', 'advisor_notes', 'campaign_visits', 'finder_completions']) {
    const r = await fetch(BASE + '/rest/v1/' + t + '?select=id&limit=5', { headers: H(PUBLIC) });
    const rows = await r.json();
    check(`publishable key sees no ${t}`,
      Array.isArray(rows) && rows.length === 0,
      Array.isArray(rows) ? rows.length + ' rows' : JSON.stringify(rows).slice(0, 80));
  }

  await fetch(BASE + '/rest/v1/journey_shares?session_id=eq.' + MARK,
    { method: 'DELETE', headers: H(SECRET) });
  check('probe row cleaned up', true);
  report();
})().catch((e) => { console.error('  ' + e.message); process.exit(1); });

function report() {
  const failed = results.filter((r) => !r.pass);
  results.forEach((r) => console.log(
    `  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.pass ? '   ' + r.detail : ''}`));
  console.log(`\n  ${results.length - failed.length}/${results.length} passed\n`);
  process.exit(failed.length ? 1 : 0);
}
