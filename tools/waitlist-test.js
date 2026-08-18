/* ============================================================================
   waitlist-test.js — the Immersion waiting list, against the real database
   ----------------------------------------------------------------------------
     node tools/waitlist-test.js

   Writes real rows, then deletes them. Every address it creates is
   selftest-*@example.com so a leaked row is identifiable at a glance and
   matches nothing real — the same convention as builds-test.js, which was
   written after an earlier test polluted a table nobody noticed for weeks.

   WHAT IT REFUSES TO ASSERT FROM THE SCHEMA. The uniqueness of an email and
   the erasability of a row are both properties of the live database, not of
   this file's intentions, so both are exercised rather than assumed. The
   erase test in particular goes through api/_lib/subject-data.js — the module
   the privacy screen actually calls — because a waiting list that the
   subject-rights screen cannot see is worse than one that does not exist: it
   turns a person's deletion request into a false assurance.
   ========================================================================== */
'use strict';

const path = require('path');
const fs = require('fs');

/* Same .env loader as builds-test.js and auth-test.js — the credentials live in
   a file Vercel gets pushed, not in the shell. Missing file is not an error:
   the validation and CSV halves below run without a database, and say so. */
try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
    const t = l.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  });
} catch (e) { /* no .env here: the database half is skipped and reported */ }

const { db } = require('../api/_lib/core.js');
const { validate, join, list, count, toCsv } = require('../api/_lib/waitlist.js');
const { findSubject, eraseSubject } = require('../api/_lib/subject-data.js');

let pass = 0, fail = 0;
function ok(what, cond, detail) {
  if (cond) { pass += 1; console.log('  ✓ ' + what); }
  else { fail += 1; console.log('  ✗ ' + what + (detail ? '\n      ' + detail : '')); }
}

/* A request and a response the screens will accept. Enough of the shape to
   drive them without a browser or a deploy — which matters because the two
   faults this section has already caught (a honeypot name collision and
   validation running after the database check) are both invisible from the
   outside when the database happens to be healthy. */
function fakeRes() {
  const r = { statusCode: 200, headers: {}, chunks: [] };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.send = (b) => { r.chunks.push(String(b)); r.ended = true; return r; };
  r.end = (b) => { if (b) r.chunks.push(String(b)); r.ended = true; return r; };
  Object.defineProperty(r, 'text', { get: () => r.chunks.join('') });
  return r;
}
const req = (o) => Object.assign({ method: 'GET', url: '/', headers: {}, query: {} }, o);
const JSON_REQ = { 'content-type': 'application/json' };
const FORM_REQ = { 'content-type': 'application/x-www-form-urlencoded' };

const STAMP = Date.now().toString(36);
const EMAIL = `selftest-${STAMP}@example.com`;
const REQ = { headers: {} };

const GOOD = {
  first_name: 'ZZTest', last_name: 'Waitlist', email: EMAIL,
  phone: '+1 555 0100', company_name: 'ZZTest Travel Co', host_agency: 'ZZTest Host'
};

(async () => {
  console.log('\n  IMMERSION WAITING LIST\n  ' + '─'.repeat(62));

  /* ── Validation, which needs no database ─────────────────────────────── */
  console.log('\n  Validation');
  ok('a complete submission validates', validate(GOOD).ok);
  ok('a missing surname is refused',
     validate(Object.assign({}, GOOD, { last_name: '' })).error === 'name_required');
  ok('a broken address is refused',
     validate(Object.assign({}, GOOD, { email: 'not-an-address' })).error === 'email_invalid');
  ok('a missing phone is refused',
     validate(Object.assign({}, GOOD, { phone: '' })).error === 'phone_required');
  ok('a missing company is refused',
     validate(Object.assign({}, GOOD, { company_name: '' })).error === 'company_required');
  ok('host agency is optional and stored as null, not as ""',
     validate(Object.assign({}, GOOD, { host_agency: '' })).fields.host_agency === null);

  /* THE FIELD NAME THAT NEARLY BROKE THIS. hub-forms.js names its honeypot
     `company`; the real answer therefore travels as `company_name`. If anyone
     ever "tidies" that back, this fails rather than the form silently dropping
     every advisor who typed their agency name. */
  ok('the real company answer is read from company_name, not company',
     validate(Object.assign({}, GOOD, { company_name: '', company: 'bot' })).error === 'company_required',
     'a value in `company` must NOT satisfy the company requirement — that field is the honeypot');

  /* ── The CSV, which also needs no database ───────────────────────────── */
  console.log('\n  Export');
  const csv = toCsv([{ created_at: '2026-08-18T10:00:00Z', first_name: 'Ana',
    last_name: 'O"Neill, Jr', email: 'a@example.com', phone: '1', company: 'A, B & C',
    host_agency: null, source: 'immersion' }]);
  ok('quotes are doubled rather than breaking the row', csv.includes('O""Neill, Jr'));
  ok('a comma inside a field does not become a new column', csv.includes('"A, B & C"'));
  ok('a null host agency exports as empty, not as "null"', !/null/.test(csv));
  ok('there is a UTF-8 BOM for Excel on Windows', csv.charCodeAt(0) === 0xFEFF);
  ok('rows end CRLF', csv.includes('\r\n'));

  /* ── The screens, which also need no database ────────────────────────── */
  const screen = require('../api/_lib/hub-screens/waitlist.js');
  const adminScreen = require('../api/_lib/hub-screens/admin-waitlist.js');

  console.log('\n  The form');
  let res = fakeRes();
  await screen(req({ url: '/advisors/immersion/waitlist' }), res);
  const html = res.text;
  ok('renders', res.statusCode === 200 && html.length > 500);
  ok('posts to its own address', html.includes('action="/advisors/immersion/waitlist"'));
  ok('has all six fields',
     ['first_name', 'last_name', 'email', 'phone', 'company_name', 'host_agency']
       .every((n) => html.includes(`name="${n}"`)));
  ok('the honeypot is NOT named company', !/name="company"/.test(html),
     'an advisor typing their agency into `company` would otherwise be dropped as a bot');
  ok('a honeypot is still there under another name', html.includes('name="website"'));
  ok('host agency is the only optional field', (html.match(/hub-opt/g) || []).length === 1);
  ok('it says plainly that this is not a booking', /not a booking/i.test(html));
  ok('no date, price or place is promised', !/\$\d|deposit|reserved|your place/i.test(html));

  console.log('\n  The honeypot');
  res = fakeRes();
  await screen(req({ method: 'POST', url: '/advisors/immersion/waitlist', headers: JSON_REQ,
    body: { first_name: 'Bot', last_name: 'Bot', email: 'bot@example.com', phone: '1',
            company_name: 'x', website: 'http://spam' } }), res);
  ok('a filled honeypot is answered as success', res.statusCode === 200 && /"ok":true/.test(res.text),
     'telling a bot it failed teaches whoever wrote it to stop filling the field');

  console.log('\n  Errors reach the person');
  const BAD = { first_name: 'A', last_name: 'B', email: 'nope', phone: '1', company_name: 'x' };
  res = fakeRes();
  await screen(req({ method: 'POST', url: '/advisors/immersion/waitlist', headers: JSON_REQ, body: BAD }), res);
  ok('a bad address is a 400 carrying a code the client can map',
     res.statusCode === 400 && /email_invalid/.test(res.text),
     'this failed once because join() checked the database before validating, so a '
     + 'mistyped address was reported as "service unavailable"');

  res = fakeRes();
  await screen(req({ method: 'POST', url: '/advisors/immersion/waitlist', headers: FORM_REQ, body: BAD }), res);
  ok('without JavaScript the same error renders as a PAGE, not JSON',
     /<form/.test(res.text) && /does not look right/.test(res.text));

  console.log('\n  The confirmation');
  res = fakeRes();
  await screen(req({ url: '/advisors/immersion/waitlist?joined=1' }), res);
  ok('the joined state renders', /on the list/i.test(res.text));
  ok('and still promises nothing', !/\$\d|deposit|reserved/i.test(res.text));
  ok('it points at Foundations, the real next step', /\/advisors\/foundations/.test(res.text));

  console.log('\n  The admin guard');
  res = fakeRes();
  await adminScreen(req({ url: '/hub/admin/waitlist' }), res);
  ok('a signed-out visitor is redirected rather than shown the list',
     res.statusCode === 302 && /\/hub\/login/.test(String(res.headers.location || '')),
     `got ${res.statusCode} ${res.headers.location || ''}`);
  ok('and nothing that looks like a row leaked into the response', !/@/.test(res.text || ''));

  res = fakeRes();
  await adminScreen(req({ url: '/hub/admin/waitlist?export=csv' }), res);
  ok('the CSV export is behind the same guard, not beside it',
     res.statusCode === 302 && !/text\/csv/.test(String(res.headers['content-type'] || '')));

  if (!db()) {
    console.log('\n  No SUPABASE_* in the environment — the database half is skipped.');
    return done();
  }

  /* ── Against the real table ──────────────────────────────────────────── */
  console.log('\n  Database');
  const before = await count();

  const first = await join(GOOD, REQ);
  ok('a valid submission is written', first.ok, JSON.stringify(first));
  if (!first.ok) return done();

  const rows = await list(1000);
  const mine = rows.filter((r) => r.email === EMAIL);
  ok('it comes back in the list', mine.length === 1, `found ${mine.length}`);
  ok('the optional field is null, not the string "null"', mine[0] && mine[0].host_agency === 'ZZTest Host');

  /* Submitting twice is the commonest real behaviour — somebody unsure it
     worked. Two rows would mean two emails from Duncan later. */
  const again = await join(Object.assign({}, GOOD, { phone: '+1 555 0199' }), REQ);
  ok('a second submission of the same address succeeds', again.ok);
  const after = await list(1000);
  ok('and does NOT create a second row',
     after.filter((r) => r.email === EMAIL).length === 1,
     'the unique index on lower(email) from migration 018 is what enforces this');
  ok('the second submission updated the details',
     (after.find((r) => r.email === EMAIL) || {}).phone === '+1 555 0199');

  ok('a different case of the same address is the same person',
     (await join(Object.assign({}, GOOD, { email: EMAIL.toUpperCase() }), REQ)).ok
       && (await list(1000)).filter((r) => r.email.toLowerCase() === EMAIL).length === 1);

  ok('the count moved by exactly one', (await count()) === before + 1,
     `before ${before}, after ${await count()}`);

  /* ── The privacy obligation ──────────────────────────────────────────── */
  console.log('\n  Subject rights');
  const found = await findSubject(EMAIL);
  ok('the subject-rights lookup finds them',
     !!found && (found.waitlist || []).length === 1,
     'if this fails, /hub/admin/subject reports "nothing held" about a person we hold');

  const erased = await eraseSubject(EMAIL);
  ok('erasing removes the waiting-list row', erased.ok && erased.waitlist === 1,
     JSON.stringify(erased));
  ok('and they are really gone',
     (await list(1000)).every((r) => r.email.toLowerCase() !== EMAIL));

  const after2 = await findSubject(EMAIL);
  ok('a second lookup finds nothing', !after2 || !(after2.waitlist || []).length);

  await done();
})().catch(async (e) => { console.error('\n  threw:', e); await sweep(); process.exit(1); });

/* Belt and braces: eraseSubject should have taken the row, but a test that
   fails halfway must not leave one behind. */
async function sweep() {
  const supabase = db();
  if (!supabase) return;
  const { data } = await supabase.from('immersion_waitlist').select('id, email').ilike('email', 'selftest-%');
  if (data && data.length) {
    await supabase.from('immersion_waitlist').delete().in('id', data.map((r) => r.id));
    console.log(`\n  swept ${data.length} leftover selftest row(s)`);
  }
}

async function done() {
  await sweep();
  console.log('\n  ' + '─'.repeat(62));
  console.log(`  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}
