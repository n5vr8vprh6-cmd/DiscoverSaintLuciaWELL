/* ============================================================================
   seed-demo.js — sample clients for the webinar demo advisor
   ----------------------------------------------------------------------------
   Duncan demos the Hub live in the intro webinars (decided 23 Oct 2026). His
   own Hub holds real people and must never be shown, so the demo runs on an
   account of its own, filled by this script with FICTIONAL sample clients and
   two months of campaign activity. How the account stays harmless is written
   up in api/_lib/demo.js; in short, it is `paused` (so no real consumer can
   ever reach it) and its slug is `demo-<16 hex>` (so everything can tell).

   THIS WRITES TO THE LIVE DATABASE — there is no separate Supabase project.

   The account itself is NOT created here. Create it the ordinary way, from
   /hub/admin/advisors/new, with an address you control (for example
   concierge+demo@discoversaintluciawell.com), and set its password through the
   invite. No password ever passes through this script.

     node tools/seed-demo.js --email <addr> --claim   make that account the demo
                                                       (slug demo-…, status paused)
     node tools/seed-demo.js --email <addr>           (re)seed its sample data
     node tools/seed-demo.js --email <addr> --reset   remove the sample data only
     add --dry to any of them to see what would happen

   GUARDS, each one refusing rather than guessing:
     · --claim refuses an admin, the house account, or any account that already
       holds a Journey that is not sample data;
     · seeding refuses any account whose slug is not demo-<16 hex>;
     · every sample row carries a marker (an @example.invalid address, a
       "demo-" session id, a "(sample)" draw name), and --reset deletes only
       rows that carry it.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DEMO_SLUG } = require('../api/_lib/demo.js');

const ROOT = path.join(__dirname, '..');
const env = {};
fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach((line) => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const i = t.indexOf('=');
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
});
const URL_ = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const has = (k) => process.argv.includes(k);
const EMAIL = (arg('--email') || '').toLowerCase();
const DRY = has('--dry');
if (!EMAIL) { console.error('Usage: node tools/seed-demo.js --email <addr> [--claim | --reset] [--dry]'); process.exit(1); }

async function rest(pathq, opts = {}) {
  const r = await fetch(`${URL_}/rest/v1/${pathq}`, Object.assign({ headers: H }, opts));
  const text = await r.text();
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${pathq} → ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

/* ── The markers ──────────────────────────────────────────────────────────── */
const SAMPLE_DOMAIN = '@example.invalid';
const SAMPLE_CONSENT = 'SAMPLE DATA. A fictional person created for Hub demonstrations; no real traveller shared this.';
const DRAW_NAME = 'Spring wellness giveaway (sample)';
const day = (n, h = 10) => new Date(Date.now() - n * 86400000 - h * 3600000).toISOString();

/* Eight fictional people across Villages, windows and stages, so every part
   of the Hub has something true-to-life to show. Village names are stored
   the way the Finder stores them today (full names). */
const V = {
  longevity: 'Longevity Village', rainforest: 'Nature & Renewal Village', ocean: 'Ocean & Restoration Village',
  heritage: 'Heritage & Nourishment Village', movement: 'Movement & Adventure Village', connection: 'Connection & Romance Village'
};
const PEOPLE = [
  { first: 'Amara', last: 'Whitfield', stage: 'new', age: 0, window: '30d', timing: 'Within the next month',
    answers: { intention: 'reflect', place: 'rainforest', companions: 'partner', orientation: 'balance', pace: 'gentle', recognition: 'yes' },
    villages: [V.rainforest, V.ocean, V.longevity],
    context: 'We both work in hospitals and have not had a proper break since before our wedding. We want quiet, not a schedule.' },
  { first: 'Daniel', last: 'Okafor', stage: 'new', age: 2, window: '31-90d', timing: 'In one to three months',
    answers: { intention: 'move', place: 'adventure', companions: 'friends', orientation: 'vacation', pace: 'active', recognition: 'no' },
    villages: [V.movement, V.ocean, V.rainforest], context: '', draw: true },
  { first: 'Sofia', last: 'Marchetti', stage: 'new', age: 4, window: '3-6mo', timing: 'In three to six months',
    answers: { intention: 'connect', place: 'romance', companions: 'partner', orientation: 'vacation', pace: 'still', recognition: 'no' },
    villages: [V.connection, V.heritage, V.ocean], context: 'Our tenth anniversary. Somewhere beautiful where we can actually talk.' },
  { first: 'Hannah', last: 'Lindgren', stage: 'contacted', age: 6, window: '3-6mo', timing: 'In three to six months',
    answers: { intention: 'restore', place: 'ocean', companions: 'solo', orientation: 'led', pace: 'still', recognition: 'yes' },
    villages: [V.ocean, V.longevity, V.rainforest], context: '', activity: 3 },
  { first: 'Tom', last: 'Hartley', stage: 'contacted', age: 9, window: 'exploring', timing: 'Just exploring for now',
    answers: { intention: 'nourish', place: 'culture', companions: 'partner', orientation: 'vacation', pace: 'gentle', recognition: 'no' },
    villages: [V.heritage, V.connection, V.rainforest], context: '', activity: 5, draw: true },
  { first: 'Marcus', last: 'Bell', stage: 'discovery', age: 12, window: '6-12mo', timing: 'In six to twelve months',
    answers: { intention: 'nourish', place: 'culture', companions: 'family', orientation: 'balance', pace: 'gentle', recognition: 'no' },
    villages: [V.heritage, V.movement, V.connection], context: 'Three generations, two teenagers. Food matters more than anything else to us.', activity: 6 },
  { first: 'Priyanka', last: 'Desai', stage: 'planning', age: 20, window: '31-90d', timing: 'In one to three months',
    answers: { intention: 'restore', place: 'volcanic', companions: 'solo', orientation: 'led', pace: 'still', recognition: 'yes' },
    villages: [V.longevity, V.rainforest, V.ocean], context: '', activity: 4 },
  { first: 'Elena', last: 'Ruiz', stage: 'booked', age: 45, window: '31-90d', timing: 'In one to three months',
    answers: { intention: 'reflect', place: 'ocean', companions: 'friends', orientation: 'balance', pace: 'gentle', recognition: 'no' },
    villages: [V.ocean, V.rainforest, V.connection], context: '', activity: 15 }
];

async function advisorByEmail() {
  const rows = await rest(`advisors?select=id,first_name,last_name,email,slug,status,role,is_house&email=eq.${encodeURIComponent(EMAIL)}`);
  if (!rows || !rows.length) { console.error(`No advisor with email ${EMAIL}. Create it at /hub/admin/advisors/new first.`); process.exit(1); }
  return rows[0];
}

async function realJourneys(id) {
  const rows = await rest(`journey_shares?select=id,consumer_email&advisor_id=eq.${id}`);
  return (rows || []).filter((r) => !String(r.consumer_email || '').toLowerCase().endsWith(SAMPLE_DOMAIN));
}

async function reset(a) {
  const steps = [
    [`journey_shares?advisor_id=eq.${a.id}&consumer_email=like.*${encodeURIComponent(SAMPLE_DOMAIN)}`, 'sample Journeys'],
    [`campaign_visits?advisor_id=eq.${a.id}&session_id=like.demo-*`, 'sample visits'],
    [`finder_completions?advisor_id=eq.${a.id}&session_id=like.demo-*`, 'sample completions'],
    [`sweepstakes?advisor_id=eq.${a.id}&name=eq.${encodeURIComponent(DRAW_NAME)}`, 'sample draw']
  ];
  for (const [q, what] of steps) {
    if (DRY) { console.log('  would delete', what); continue; }
    const gone = await rest(q, { method: 'DELETE', headers: Object.assign({ Prefer: 'return=representation' }, H) });
    console.log(`  deleted ${gone ? gone.length : 0} ${what}`);
  }
}

(async () => {
  const a = await advisorByEmail();
  console.log(`\n  ${a.first_name} ${a.last_name} <${a.email}>  slug ${a.slug}  status ${a.status}`);

  if (has('--claim')) {
    if (a.role === 'admin' || a.is_house) { console.error('  Refused: an admin or the house account cannot be the demo.'); process.exit(1); }
    const real = await realJourneys(a.id);
    if (real.length) { console.error(`  Refused: this account holds ${real.length} real Journey(s).`); process.exit(1); }
    const slug = DEMO_SLUG.test(a.slug || '') ? a.slug : 'demo-' + crypto.randomBytes(8).toString('hex');
    if (DRY) { console.log(`  would set slug ${slug}, status paused`); return; }
    await rest(`advisors?id=eq.${a.id}`, { method: 'PATCH', body: JSON.stringify({ slug, status: 'paused' }) });
    console.log(`  Now the demo account: slug ${slug}, status paused. Run again without --claim to seed it.`);
    return;
  }

  if (!DEMO_SLUG.test(a.slug || '')) { console.error('  Refused: not a demo account. Run with --claim first.'); process.exit(1); }
  if (a.status === 'active') { console.error('  Refused: a demo account must be paused, never active (see api/_lib/demo.js).'); process.exit(1); }

  console.log('\n  Removing earlier sample data');
  await reset(a);
  if (has('--reset')) { console.log('\n  Done.\n'); return; }

  /* The draw first, so two people can have entered it. */
  let drawId = null;
  if (!DRY) {
    const d = await rest('sweepstakes', { method: 'POST', headers: Object.assign({ Prefer: 'return=representation' }, H),
      body: JSON.stringify({ advisor_id: a.id, name: DRAW_NAME, status: 'open', created_at: day(25) }) });
    drawId = d && d[0] && d[0].id;
  }

  const shares = PEOPLE.map((p) => ({
    advisor_id: a.id,
    consumer_first: p.first, consumer_last: p.last,
    consumer_email: `${p.first}.${p.last}`.toLowerCase() + SAMPLE_DOMAIN,
    consumer_phone: null,
    answers: p.answers, villages: p.villages,
    timing: p.timing, travel_window: p.window, context: p.context || null,
    consent_text: SAMPLE_CONSENT, consent_at: day(p.age),
    source: p.draw ? 'social' : 'email',
    session_id: 'demo-' + crypto.randomBytes(6).toString('hex'),
    stage: p.stage,
    sweepstakes_id: p.draw ? drawId : null,
    created_at: day(p.age),
    last_activity_at: p.activity != null ? day(p.activity) : null
  }));

  /* Sixty days of link traffic, busier lately. About one visit in three
     finishes the Finder, which is in the range the live data shows. */
  const visits = [], comps = [];
  for (let d = 60; d >= 0; d--) {
    const n = d < 30 ? 2 + (d % 3) : 1 + (d % 2);
    for (let i = 0; i < n; i++) {
      const sid = 'demo-' + crypto.randomBytes(6).toString('hex');
      const at = day(d, 2 + i * 3);
      visits.push({ advisor_id: a.id, source: ['email', 'social', 'referral', 'direct'][(d + i) % 4], session_id: sid, path: '/', referrer: '(direct)', created_at: at });
      if ((d + i) % 3 === 0) comps.push({ advisor_id: a.id, session_id: sid, created_at: at });
    }
  }

  if (DRY) {
    console.log(`\n  would insert ${shares.length} sample Journeys, ${visits.length} visits, ${comps.length} completions, 1 draw\n`);
    return;
  }
  await rest('journey_shares', { method: 'POST', body: JSON.stringify(shares) });
  await rest('campaign_visits', { method: 'POST', body: JSON.stringify(visits) });
  await rest('finder_completions', { method: 'POST', body: JSON.stringify(comps) });
  console.log(`\n  Seeded ${shares.length} sample Journeys, ${visits.length} visits, ${comps.length} completions and one open draw.\n`);
})().catch((e) => { console.error('\n  ' + e.message + '\n'); process.exit(1); });
