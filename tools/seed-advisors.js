/* ============================================================================
   seed-advisors.js — a fixture set of test advisors, and a way to remove it
   ----------------------------------------------------------------------------
   The admin console (Release B) needs an approval queue with something in it, a
   dashboard with something to count, and a list view that can show all three
   status badges. One real advisor and an empty journey_shares table cannot
   exercise any of that.

   THIS WRITES TO THE LIVE DATABASE. There is no separate Supabase project, so
   every safeguard below matters.

   WHY THAT IS ACCEPTABLE, verified rather than assumed: no endpoint lists all
   advisors. api/_lib/advisors.js resolves one only by an explicit public_code
   or slug that the visitor arrived with. A seeded advisor is therefore
   invisible to every real consumer unless somebody uses its specific link.

   ── STATUS IS NEVER LEFT TO THE DEFAULT ──────────────────────────────────
   advisors.status defaults to 'active' (db/schema.sql), and activeAdvisor()
   routes real consumer contact details to any active advisor. A fixture that
   simply omits status becomes a live delivery target with an undeliverable
   address. db/schema.sql records the previous seeded advisor being removed for
   exactly this: "an `active` advisor is not an inert fixture: it is an address
   that real consumer contact details get routed to."

   Every fixture below states its status, and insertion refuses a row without
   one.

   ── THREE MARKERS, ALL REQUIRED TO DELETE ────────────────────────────────
     email        seed-…@example.com   RFC 2606 reserved; undeliverable
     slug         seed-<16 hex>        opaque, unique
     public_code  SEED####             VISIBLE IN THE WELL LINK ITSELF

   The code is the useful one: /well/SEEDK3M9 is recognisable at a glance, in a
   browser bar or a log. The 003 trigger honours an explicitly supplied code,
   and SEED is legal in the Crockford alphabet the codes use, so it still
   satisfies the format every other tool asserts.

   Run:
     node tools/seed-advisors.js              create the fixture set
     node tools/seed-advisors.js --list       show what is seeded
     node tools/seed-advisors.js --purge      remove all of it
     node tools/seed-advisors.js --password=… set the shared password
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* Same .env parser as tools/db.js and tools/auth-test.js. */
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
if (!URL_ || !KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const HR = Object.assign({ Prefer: 'return=representation' }, H);

/* ── Markers ──────────────────────────────────────────────────────────────
   Kept together so the seed side and the purge side can never drift apart. */
const EMAIL_RE = /^seed-[a-z0-9-]+@example\.com$/;
const SLUG_RE = /^seed-[0-9a-f]{16}$/;
const CODE_RE = /^SEED[0-9A-HJKMNP-TV-Z]{4}$/;
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   /* mirrors 002's gen_public_code */

const isSeedAdvisor = (a) =>
  EMAIL_RE.test(a.email || '') && SLUG_RE.test(a.slug || '') && CODE_RE.test(a.public_code || '');

/* ── Fixtures ─────────────────────────────────────────────────────────────
   Ten identical rows would prove nothing. Each of these is a state the admin
   console has to render correctly, and `why` says which. */
const FIXTURES = [
  {
    key: 'workshop', status: 'pending',
    first_name: 'Marisol', last_name: 'Vega', business: 'Vega Travel Co.',
    host_agency: 'Gifted Travel Network',
    registration_note: 'We met at the Toronto workshop in June — I run the wellness desk.',
    why: 'workshop fast-path: approve in one click'
  },
  {
    key: 'complete', status: 'pending',
    first_name: 'Aaron', last_name: 'Mbeki', business: 'Northlight Journeys',
    host_agency: 'Travel Edge', website: 'https://example.com/northlight',
    market: 'Vancouver and the Pacific Northwest',
    why: 'the ordinary approval: everything filled in'
  },
  {
    key: 'minimal', status: 'pending',
    first_name: 'Jo', last_name: 'Park',
    why: 'minimal profile — the queue must not look broken'
  },
  {
    key: 'longname', status: 'pending',
    first_name: 'Beatrice', last_name: 'Adeyemi-Okonjo',
    business: 'The Adeyemi-Okonjo Bespoke Travel & Wellbeing Advisory Group International',
    host_agency: 'Virtuoso',
    why: 'layout stress: a business name that will not fit'
  },
  {
    key: 'accents', status: 'pending',
    first_name: 'Zoë', last_name: 'Ngô', business: 'Maison Ngô',
    market: 'Montréal',
    why: 'encoding, and initials in the avatar'
  },
  {
    key: 'apostrophe', status: 'pending',
    first_name: 'Niamh', last_name: "O'Rourke", business: "O'Rourke & Daughters",
    why: 'HTML escaping and the mailto: link'
  },
  {
    key: 'healthy', status: 'active',
    first_name: 'Priya', last_name: 'Raman', business: 'Raman Wellness Travel',
    host_agency: 'Fora', market: 'London',
    why: 'the healthy advisor: Journeys across the pipeline',
    journeys: [
      { first: 'Elena', last: 'Sokolov', stage: 'contacted', win: '31-90d', age: 6,
        answers: { intention: 'restore', companions: 'partner', pace: 'still', recognition: 'no' },
        villages: ['Longevity', 'Ocean'] },
      { first: 'Tomas', last: 'Berg', stage: 'discovery', win: '3-6mo', age: 14,
        answers: { intention: 'move', companions: 'friends', pace: 'active', recognition: 'no' },
        villages: ['Movement', 'Ocean'] },
      { first: 'Amara', last: 'Diallo', stage: 'booked', win: '30d', age: 40,
        answers: { intention: 'nourish', companions: 'family', pace: 'gentle', recognition: 'no' },
        villages: ['Heritage', 'Connection'] },
      { first: 'Ines', last: 'Ferreira', stage: 'new', win: '6-12mo', age: 1,
        answers: { intention: 'connect', companions: 'partner', pace: 'gentle', recognition: 'no' },
        villages: ['Connection', 'Heritage'] }
    ]
  },
  {
    key: 'neglected', status: 'active',
    first_name: 'Callum', last_name: 'Fraser', business: 'Fraser & Co. Travel',
    market: 'Edinburgh',
    why: 'the neglected advisor: Journeys stuck at new, past 48 hours',
    journeys: [
      /* The one the dashboard exists to surface: old, unanswered, travelling
         soon, and carrying both the Eclipse recognition and a written note so
         the briefing renders its quote and its Eclipse block. */
      { first: 'Harriet', last: 'Blythe', stage: 'new', win: '30d', age: 11,
        answers: { intention: 'reflect', companions: 'solo', pace: 'still', recognition: 'yes' },
        villages: ['Rainforest', 'Ocean', 'Longevity'],
        context: 'I have not taken more than four consecutive days off in three years '
               + 'and I would like to come back able to think again.' },
      { first: 'Daniel', last: 'Osei', stage: 'new', win: '31-90d', age: 7,
        answers: { intention: 'restore', companions: 'solo', pace: 'still', recognition: 'yes' },
        villages: ['Longevity', 'Rainforest'] },
      { first: 'Sofia', last: 'Marchetti', stage: 'new', win: 'exploring', age: 4,
        answers: { intention: 'nourish', companions: 'friends', pace: 'gentle', recognition: 'no' },
        villages: ['Heritage'] },
      { first: 'Ravi', last: 'Chandra', stage: 'contacted', win: '12mo+', age: 21,
        answers: { intention: 'move', companions: 'family', pace: 'active', recognition: 'no' },
        villages: ['Movement', 'Ocean'] }
    ]
  },
  {
    key: 'funneldrop', status: 'active',
    first_name: 'Hana', last_name: 'Kowalski', business: 'Kowalski Travel Studio',
    market: 'Chicago',
    why: 'the funnel drop: traffic and completions, no shares',
    visits: 34, completions: 6
  },
  {
    key: 'paused', status: 'paused',
    first_name: 'Gregor', last_name: 'Lindqvist', business: 'Lindqvist Resor',
    why: 'the third badge: keeps their Hub, is not offered to consumers'
  }
];

/* ── Small helpers ───────────────────────────────────────────────────────── */
async function rest(pathname, init) {
  const res = await fetch(URL_ + '/rest/v1/' + pathname, Object.assign({ headers: H }, init));
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathname} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}

const randHex = () => crypto.randomBytes(8).toString('hex');
const randCode = () => 'SEED' + Array.from({ length: 4 },
  () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const mask = (e) => { const [u, d] = String(e).split('@'); return u.slice(0, 6) + '***@' + d; };

/* ── Read ────────────────────────────────────────────────────────────────── */
async function seeded() {
  const rows = await rest('advisors?select=id,first_name,last_name,email,slug,public_code,status,auth_user_id&order=created_at');
  return rows.filter(isSeedAdvisor);
}

/* ── Purge ───────────────────────────────────────────────────────────────
   Children first. campaign_visits, finder_completions and journey_shares all
   declare `advisor_id … on delete set null`, so deleting the advisor would
   ORPHAN them — leaving synthetic Journeys in the table with no owner. */
async function purge() {
  const rows = await seeded();
  if (!rows.length) { console.log('  nothing seeded — nothing to remove\n'); return; }

  /* The query already filtered, but a delete against the live database gets a
     second, independent check on every single row. If any row reaching this
     point is not unmistakably a fixture, nothing is deleted at all. */
  const wrong = rows.filter((r) => !isSeedAdvisor(r));
  if (wrong.length) {
    console.error('  ABORT: a row reached the delete step without all three markers.');
    process.exit(1);
  }

  console.log(`  removing ${rows.length} seeded advisors and everything attached\n`);
  let shares = 0, visits = 0, comps = 0;

  for (const a of rows) {
    const s = await rest(`journey_shares?advisor_id=eq.${a.id}`, { method: 'DELETE', headers: HR });
    const v = await rest(`campaign_visits?advisor_id=eq.${a.id}`, { method: 'DELETE', headers: HR });
    const c = await rest(`finder_completions?advisor_id=eq.${a.id}`, { method: 'DELETE', headers: HR });
    shares += s.length; visits += v.length; comps += c.length;

    await rest(`advisors?id=eq.${a.id}`, { method: 'DELETE', headers: H });
    if (a.auth_user_id) {
      await fetch(`${URL_}/auth/v1/admin/users/${a.auth_user_id}`, { method: 'DELETE', headers: H });
    }
    console.log(`  removed  ${(a.first_name + ' ' + a.last_name).padEnd(24)} ${a.public_code}`);
  }

  console.log(`\n  journey_shares      ${shares}`);
  console.log(`  campaign_visits     ${visits}`);
  console.log(`  finder_completions  ${comps}`);
  console.log(`  advisors            ${rows.length}  (+ their auth users)\n`);
}

/* ── Seed ────────────────────────────────────────────────────────────────── */
async function seed(password, hasNote) {
  const existing = await seeded();
  if (existing.length) {
    console.error(`  ${existing.length} seeded advisors already exist. Run --purge first.\n`);
    process.exit(1);
  }

  for (const f of FIXTURES) {
    /* The guard the whole file exists for. */
    if (!f.status) throw new Error(`fixture "${f.key}" has no status — refusing to insert`);

    const email = `seed-${f.key}@example.com`;

    const authRes = await fetch(`${URL_}/auth/v1/admin/users`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    const authBody = await authRes.json();
    if (!authRes.ok) throw new Error(`auth create ${email} -> ${authRes.status} ${JSON.stringify(authBody).slice(0, 200)}`);

    const row = {
      auth_user_id: authBody.id,
      slug: 'seed-' + randHex(),
      public_code: randCode(),
      first_name: f.first_name,
      last_name: f.last_name,
      email,
      status: f.status,
      onboarding_state: 'profile',
      business: f.business || null,
      host_agency: f.host_agency || null,
      website: f.website || null,
      market: f.market || null
    };
    if (hasNote && f.registration_note) row.registration_note = f.registration_note;

    const [advisor] = await rest('advisors', { method: 'POST', headers: HR, body: JSON.stringify(row) });

    /* Attribution rows, so the funnel on Home is not three zeros. */
    const visits = f.visits || (f.journeys ? f.journeys.length * 9 : 0);
    const comps = f.completions || (f.journeys ? f.journeys.length * 2 : 0);
    for (let i = 0; i < visits; i++) {
      await rest('campaign_visits', { method: 'POST', headers: H, body: JSON.stringify({
        advisor_id: advisor.id, source: 'email', session_id: 'seed-' + f.key + '-' + i,
        path: '/', referrer: '(direct)', created_at: daysAgo(1 + (i % 30))
      }) });
    }
    for (let i = 0; i < comps; i++) {
      await rest('finder_completions', { method: 'POST', headers: H, body: JSON.stringify({
        advisor_id: advisor.id, session_id: 'seed-' + f.key + '-c' + i, created_at: daysAgo(1 + (i % 20))
      }) });
    }

    for (const j of (f.journeys || [])) {
      await rest('journey_shares', { method: 'POST', headers: H, body: JSON.stringify({
        advisor_id: advisor.id,
        consumer_first: j.first, consumer_last: j.last,
        consumer_email: `seed-${j.first.toLowerCase()}-${j.last.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
        consumer_phone: null,
        timing: null,
        travel_window: j.win,
        context: j.context || null,
        answers: j.answers,
        villages: j.villages,
        stage: j.stage,
        /* consent_text is CONSENT EVIDENCE. A fixture must never carry wording
           that could later be mistaken for a real person's agreement, so it
           says exactly what it is. */
        consent_text: 'SEEDED TEST DATA — not a real consent, and not a real person. '
                    + 'Created by tools/seed-advisors.js.',
        source: 'email',
        session_id: 'seed-' + f.key,
        created_at: daysAgo(j.age),
        last_activity_at: j.stage === 'new' ? null : daysAgo(Math.max(0, j.age - 2))
      }) });
    }

    console.log(`  ${f.status.padEnd(8)} ${(f.first_name + ' ' + f.last_name).padEnd(24)} ` +
      `${advisor.public_code}  ${String((f.journeys || []).length).padStart(2)} journeys   ${f.why}`);
  }
}

/* ── Report ──────────────────────────────────────────────────────────────── */
async function list() {
  const rows = await seeded();
  if (!rows.length) { console.log('  nothing seeded\n'); return; }
  console.log(`  ${rows.length} seeded advisors\n`);
  for (const a of rows) {
    const n = await rest(`journey_shares?select=id&advisor_id=eq.${a.id}`);
    console.log(`  ${a.status.padEnd(8)} ${(a.first_name + ' ' + a.last_name).padEnd(24)} ` +
      `${a.public_code}  ${String(n.length).padStart(2)} journeys  ${mask(a.email)}`);
  }
  console.log('');
}

/* ── Main ────────────────────────────────────────────────────────────────── */
(async () => {
  const args = process.argv.slice(2);
  const pwArg = (args.find((a) => a.startsWith('--password=')) || '').split('=')[1];

  console.log('');
  if (args.includes('--list')) { await list(); return; }
  if (args.includes('--purge')) { await purge(); await list(); return; }

  /* registration_note arrives with migration 004. Probe once so this tool is
     useful before it lands and richer afterwards, rather than failing. */
  let hasNote = true;
  try { await rest('advisors?select=registration_note&limit=1'); }
  catch (e) { hasNote = false; }
  if (!hasNote) {
    console.log('  note: advisors.registration_note does not exist yet (migration 004),');
    console.log('        so the workshop fixture is seeded without its note.\n');
  }

  const password = pwArg || ('seed-' + crypto.randomBytes(9).toString('base64url'));
  await seed(password, hasNote);

  console.log('\n  ── Sign in as any of them ─────────────────────────────────');
  console.log('     email     seed-<key>@example.com   e.g. seed-healthy@example.com');
  console.log(`     password  ${password}`);
  console.log('     Printed once, not stored anywhere. Re-run --purge then seed to reset.\n');
  console.log('  Remove all of it:  node tools/seed-advisors.js --purge\n');
})().catch((e) => { console.error('\n  ' + e.message + '\n'); process.exit(1); });
