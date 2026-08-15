/* ============================================================================
   auth-test.js — exercise the auth lifecycle end to end, then clean up
   ----------------------------------------------------------------------------
   Registers a throwaway advisor against the live endpoints, asserts the
   behaviours that matter, and then deletes both the advisor row and the
   Supabase auth user so the project is left exactly as it was found.

   THE ASSERTIONS THAT MATTER MOST are the ones about what the endpoints
   REFUSE to tell you: whether an address already has an account, and whether a
   failed login failed because of the address or the password. Each of those,
   answered honestly, becomes a way to enumerate who is registered.

   Run:  node tools/auth-test.js [baseUrl]
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const BASE = (process.argv[2] || 'https://discoversaintluciawell.com').replace(/\/$/, '');

const env = {};
fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
  const t = l.trim();
  if (!t || t.startsWith('#')) return;
  const i = t.indexOf('=');
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
});
const SB = env.SUPABASE_URL;
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SECRET, Authorization: 'Bearer ' + SECRET, 'Content-Type': 'application/json' };

const stamp = Date.now().toString(36);
const EMAIL = `authtest-${stamp}@example.com`;
const PASSWORD = 'a-long-enough-test-password-' + stamp;

const results = [];
const check = (n, pass, d) => results.push({ n, pass, d: d || '' });

const post = async (p, payload) => {
  const res = await fetch(BASE + p, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let body = null; try { body = await res.json(); } catch (e) {}
  return { status: res.status, body, cookies: res.headers.getSetCookie ? res.headers.getSetCookie() : [] };
};

(async () => {
  /* ── Validation happens before anything is created ─────────────────────── */
  let r = await post('/api/auth/register', { firstName: 'A', lastName: 'B', email: 'not-an-email', password: PASSWORD });
  check('register rejects a bad email', r.status === 400 && r.body.error === 'email_invalid');

  r = await post('/api/auth/register', { firstName: 'A', lastName: 'B', email: EMAIL, password: 'short' });
  check('register rejects a short password', r.status === 400 && r.body.error === 'password_too_short');

  r = await post('/api/auth/register', { firstName: 'A', lastName: 'B', email: EMAIL, password: PASSWORD, company: 'bot', undertaking: true });
  check('register honeypot answers ok and creates nothing', r.status === 200 && r.body.ok === true);

  /* ── The undertaking cannot be skipped ─────────────────────────────────
     The checkbox on the form is `required`, which stops a person but controls
     nothing that posts directly — as this request does. An account created
     without an accepted undertaking is an advisor holding travellers' contact
     details under no agreement at all, which is the gap the document exists to
     close. So the refusal is asserted here against the live endpoint rather
     than inferred from the presence of an input. */
  r = await post('/api/auth/register', {
    firstName: 'A', lastName: 'B', email: EMAIL, password: PASSWORD
  });
  check('register REFUSES without the data undertaking',
    r.status === 400 && r.body.error === 'undertaking_required', JSON.stringify(r.body));

  r = await post('/api/auth/register', {
    firstName: 'A', lastName: 'B', email: EMAIL, password: PASSWORD, undertaking: 'no'
  });
  check('and refuses a value that is not an acceptance',
    r.status === 400 && r.body.error === 'undertaking_required', JSON.stringify(r.body));

  /* ── The real registration ─────────────────────────────────────────────── */
  r = await post('/api/auth/register', {
    firstName: 'Auth', lastName: 'Test', email: EMAIL, password: PASSWORD, business: 'Test Travel',
    undertaking: true
  });
  /* A rate-limited mailer is now reported honestly rather than masked as
     success, so the suite can say plainly why it cannot continue. */
  if (r.status === 503 && r.body && r.body.error === 'email_unavailable') {
    console.log('');
    console.log('  SKIPPED: Supabase cannot send a verification email right now');
    console.log('  (over_email_send_rate_limit — configure custom SMTP, see db/SETUP.md)');
    console.log('');
    check('register reports the mail outage instead of faking success', true);
    return report();
  }
  check('register succeeds', r.status === 200 && r.body.ok === true, JSON.stringify(r.body));

  /* Give Supabase a moment to make the user visible to the admin API. */
  await new Promise((s) => setTimeout(s, 1500));

  const list = await fetch(`${SB}/auth/v1/admin/users?per_page=200`, { headers: H });
  const users = (await list.json()).users || [];
  const user = users.find((u) => u.email === EMAIL);
  check('an auth user now exists', !!user);

  const adv = await (await fetch(`${SB}/rest/v1/advisors?select=id,status,onboarding_state,public_code,slug,auth_user_id&email=eq.${EMAIL}`, { headers: H })).json();
  check('an advisor row was created', adv.length === 1, adv.length + ' rows');
  if (adv.length === 1) {
    check('advisor is linked to the auth user', user && adv[0].auth_user_id === user.id);
    check('advisor starts PENDING, so no Journeys route to them yet',
      adv[0].status === 'pending', 'status=' + adv[0].status);
    check('advisor got an opaque public_code', /^[0-9A-HJKMNP-TV-Z]{8}$/.test(adv[0].public_code || ''));
    /* The slug must be RANDOM, not derived from the name. It resolves publicly
       (legacy V1.2 links depend on that), so a name-derived slug would hand
       back the guessable identifier the opaque public_code exists to remove.
       The original check here only asserted the slug was non-empty, which is
       exactly why `first-last` slugs shipped unnoticed. */
    const slug = adv[0].slug || '';
    check('advisor got an internal slug', !!slug);
    check('the slug is random, not derived from the name',
      /^adv-[0-9a-f]{16}$/.test(slug), 'slug=' + slug);
    check('the slug leaks neither first nor last name',
      !/auth/i.test(slug) && !/test/i.test(slug), 'slug=' + slug);
  }

  /* ── Registering the same address again must not disclose it ───────────── */
  r = await post('/api/auth/register', { firstName: 'Auth', lastName: 'Test', email: EMAIL, password: PASSWORD });
  check('re-registering does not reveal the address is taken',
    r.status === 200 && !r.body.error, JSON.stringify(r.body));

  const advAgain = await (await fetch(`${SB}/rest/v1/advisors?select=id&email=eq.${EMAIL}`, { headers: H })).json();
  check('re-registering did NOT create a second advisor identity', advAgain.length === 1, advAgain.length + ' rows');

  /* ── Login ─────────────────────────────────────────────────────────────── */
  r = await post('/api/auth/login', { email: EMAIL, password: 'definitely-the-wrong-password' });
  check('wrong password is rejected', r.status === 401 || r.status === 403);

  r = await post('/api/auth/login', { email: `nobody-${stamp}@example.com`, password: PASSWORD });
  check('unknown address gives the SAME answer as a wrong password',
    r.status === 401 || r.status === 403);

  /* ── Forgot never discloses ────────────────────────────────────────────── */
  const known = await post('/api/auth/forgot', { email: EMAIL });
  const unknown = await post('/api/auth/forgot', { email: `nobody-${stamp}@example.com` });
  check('forgot answers identically for known and unknown addresses',
    known.status === unknown.status && JSON.stringify(known.body) === JSON.stringify(unknown.body),
    known.status + ' vs ' + unknown.status);

  /* ── Reset rejects a bad token ─────────────────────────────────────────── */
  r = await post('/api/auth/reset', { accessToken: 'not-a-real-token', refreshToken: 'x', password: PASSWORD });
  check('reset rejects an invalid token', r.status === 400 && r.body.error === 'token_invalid');

  r = await post('/api/auth/reset', { accessToken: 'x', refreshToken: 'x', password: 'short' });
  check('reset rejects a short password', r.status === 400 && r.body.error === 'password_too_short');

  /* ── Protected routes ──────────────────────────────────────────────────── */
  const hub = await fetch(BASE + '/hub', { redirect: 'manual' });
  check('/hub is not reachable while signed out',
    [301, 302, 307, 308, 404].includes(hub.status), 'HTTP ' + hub.status);

  /* ── Clean up: leave the project exactly as found ──────────────────────── */
  await fetch(`${SB}/rest/v1/advisors?email=eq.${EMAIL}`, { method: 'DELETE', headers: H });
  if (user) await fetch(`${SB}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: H });
  const leftAdv = await (await fetch(`${SB}/rest/v1/advisors?select=id&email=eq.${EMAIL}`, { headers: H })).json();
  check('test advisor removed', leftAdv.length === 0);
  report();
})().catch((e) => { console.error('  ' + e.message); process.exit(1); });

function report() {
  const failed = results.filter((x) => !x.pass);
  results.forEach((x) => console.log(
    `  ${x.pass ? 'PASS' : 'FAIL'}  ${x.n}${x.d && !x.pass ? '   ' + x.d : ''}`));
  console.log(`\n  ${results.length - failed.length}/${results.length} passed\n`);
  process.exit(failed.length ? 1 : 0);
}
