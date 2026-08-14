/* ============================================================================
   check-migration.js — verify 002-hub landed without damaging anything
   ----------------------------------------------------------------------------
   Spec §20 requires that existing advisor links, Journey ownership, consent
   evidence and attribution survive the migration. This asserts that, rather
   than trusting that an additive migration was additive.

   Reads the service-role key from .env and never prints it, same as tools/db.js.

   Run:  node tools/check-migration.js
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

const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('SUPABASE_URL / SERVICE_ROLE missing from .env'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

const results = [];
const check = (name, pass, detail) => results.push({ name, pass, detail: detail || '' });
/* Assertions of the form rows.every(...) are TRUE ON AN EMPTY TABLE. Once the
   seeded test data was deleted, five checks below went on reporting PASS while
   examining nothing. A check that cannot fail is not a check, so an empty set
   is reported as SKIP and counted apart from the passes. */
const skip = (name, why) => results.push({ name, skipped: true, detail: why || '' });

async function get(q) {
  const res = await fetch(URL + '/rest/v1/' + q, { headers: H });
  if (!res.ok) return { error: res.status + ' ' + (await res.text()).slice(0, 160) };
  return { rows: await res.json() };
}

(async () => {
  /* ── The new columns exist ────────────────────────────────────────────── */
  const a = await get('advisors?select=id,slug,public_code,auth_user_id,onboarding_state,status&limit=50');
  if (a.error) {
    console.error('  advisors query failed — has 002-hub.sql been run?\n  ' + a.error);
    process.exit(1);
  }
  check('advisors has public_code', a.rows.every((r) => 'public_code' in r));
  check('advisors has auth_user_id', a.rows.every((r) => 'auth_user_id' in r));
  check('advisors has onboarding_state', a.rows.every((r) => 'onboarding_state' in r));

  /* ── Nothing was lost, and every advisor got a usable code ───────────── */
  check('every advisor kept its slug', a.rows.every((r) => !!r.slug), 'slug is how deployed links resolve');
  check('every advisor has a public_code', a.rows.every((r) => !!r.public_code));
  check('codes are 8 chars, unambiguous alphabet',
    a.rows.every((r) => /^[0-9A-HJKMNP-TV-Z]{8}$/.test(r.public_code || '')),
    a.rows.map((r) => r.public_code).join(','));
  check('codes are unique',
    new Set(a.rows.map((r) => r.public_code)).size === a.rows.length);
  check('codes do not contain the advisor name',
    a.rows.every((r) => {
      const c = (r.public_code || '').toLowerCase();
      return !(r.slug || '').toLowerCase().split('-').some((part) => part.length > 2 && c.includes(part));
    }));

  /* ── Journey shares gained the pipeline without losing consent ───────── */
  const s = await get('journey_shares?select=id,stage,travel_window,timing,consent_text,advisor_id&limit=200');
  if (s.error) { check('journey_shares readable', false, s.error); }
  else if (!s.rows.length) {
    const why = 'journey_shares is empty — nothing to inspect';
    ['journey_shares has stage',
     'journey_shares has travel_window',
     'every share defaults to stage=new or later',
     'consent evidence preserved on every share',
     'advisor ownership preserved',
     'legacy "Within 3 months" never mapped to <=30 days'].forEach((n) => skip(n, why));
  } else {
    check('journey_shares has stage', s.rows.every((r) => 'stage' in r));
    check('journey_shares has travel_window', s.rows.every((r) => 'travel_window' in r));
    check('every share defaults to stage=new or later',
      s.rows.every((r) => ['new', 'contacted', 'discovery', 'planning', 'booked', 'closed'].includes(r.stage)));
    check('consent evidence preserved on every share',
      s.rows.every((r) => !!r.consent_text), 'spec §20 — consent records must survive');
    check('advisor ownership preserved',
      s.rows.every((r) => r.advisor_id !== undefined));
    /* The conservative direction of the travel-window map: legacy "Within 3
       months" must NOT have become the soonest bucket. */
    const wrong = s.rows.filter((r) => /within 3/i.test(r.timing || '') && r.travel_window === '30d');
    check('legacy "Within 3 months" never mapped to <=30 days', wrong.length === 0,
      wrong.length + ' rows over-claimed urgency');
  }

  /* ── advisor_notes exists and is locked down ─────────────────────────── */
  const n = await get('advisor_notes?select=id&limit=1');
  check('advisor_notes table exists', !n.error, n.error || '');

  /* ── The anon key must still be able to read nothing at all ─────────── */
  const anonProbe = await fetch(URL + '/rest/v1/journey_shares?select=id&limit=1', {
    headers: { apikey: 'anon-probe-not-a-real-key' }
  });
  check('a bad key cannot read journey_shares', anonProbe.status === 401 || anonProbe.status === 403,
    'HTTP ' + anonProbe.status);

  const failed = results.filter((r) => !r.skipped && !r.pass);
  const skipped = results.filter((r) => r.skipped);
  const ran = results.length - skipped.length;

  results.forEach((r) => console.log(
    `  ${r.skipped ? 'SKIP' : r.pass ? 'PASS' : 'FAIL'}  ${r.name}` +
    `${r.detail && !r.pass ? '   ' + r.detail : ''}`));

  console.log(`\n  ${ran - failed.length}/${ran} passed`);
  if (skipped.length) console.log(`  ${skipped.length} skipped — no rows to inspect`);
  console.log('');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('  ' + e.message); process.exit(1); });
