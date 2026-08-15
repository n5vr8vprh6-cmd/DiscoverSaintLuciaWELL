/* ============================================================================
   regress.js — the V1.2 acceptance suite, runnable against any deployment
   ----------------------------------------------------------------------------
   V2 is an extension, and the spec is emphatic that it must not regress working
   V1.2 behaviour. That is only checkable if the V1.2 behaviour is written down
   as something executable rather than as a paragraph someone re-reads.

   So this is the contract. Run it before starting a workstream and after
   finishing one; anything that flips from pass to fail is attributable to the
   work in between.

   Run:  node tools/regress.js                    against production
         node tools/regress.js http://localhost:3000

   ATTRIBUTION CHECKS NEED A REAL ADVISOR REFERENCE, and they now say so rather
   than quietly passing without one. Pass a code or slug:

         node tools/regress.js --advisor=8K4PX7
         TEST_ADVISOR=8K4PX7 node tools/regress.js

   Why this is not hardcoded any more: the suite used to name a seeded
   `test-advisor` row. When that row is deleted, two of the three attribution
   assertions go on PASSING — /api/visit answers 204 for an unknown advisor by
   design, so they would be exercising the unknown-advisor path while claiming
   to prove attribution. A green suite that has stopped testing the thing is
   worse than a red one. Without a reference they are reported as SKIP and the
   summary says so.

   NOT COVERED HERE, ON PURPOSE: the browser-side guarantees — that an
   unattributed Finder completion makes zero network calls, and that the no-JS
   page still renders the six-village explainer. Those need a real browser and
   live in the headless harness; asserting them from curl would be a false
   green.
   ========================================================================== */
'use strict';

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith('--')) || 'https://discoversaintluciawell.com')
  .replace(/\/$/, '');

/* A code or legacy slug for an ACTIVE advisor. Absent means the attribution
   checks skip rather than pass vacuously — see the header. */
const ADVISOR = (args.find((a) => a.startsWith('--advisor=')) || '').split('=')[1] ||
  process.env.TEST_ADVISOR || '';

const ROUTES = ['/', '/journey', '/explore', '/eclipse', '/about', '/advisors',
  '/advisors/intro', '/advisors/immersion', '/advisors/foundations',
  '/privacy', '/terms', '/accessibility'];

const results = [];
const check = (name, pass, detail) => results.push({ name, pass, detail: detail || '' });
/* A skipped check is neither a pass nor a failure. It must be visible in the
   output and counted separately, or "31/31 passed" starts meaning less than it
   appears to. */
const skip = (name, why) => results.push({ name, skipped: true, detail: why || '' });

async function json(path, init) {
  const res = await fetch(BASE + path, init);
  let body = null;
  try { body = await res.json(); } catch (e) { /* 204 etc. */ }
  return { status: res.status, body };
}

const post = (path, payload) => json(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

(async () => {
  console.log(`\n  V1.2 regression suite against ${BASE}\n`);

  /* ── Public routes still serve ──────────────────────────────────────────── */
  for (const p of ROUTES) {
    const res = await fetch(BASE + p);
    check(`route ${p}`, res.status === 200, 'HTTP ' + res.status);
  }

  /* ── Advisor resolution ────────────────────────────────────────────────── */
  let r;
  if (ADVISOR) {
    r = await json('/api/advisor?slug=' + encodeURIComponent(ADVISOR));
    check('advisor lookup resolves a name',
      r.status === 200 && r.body && r.body.advisor && r.body.advisor.firstName,
      JSON.stringify(r.body));
  } else {
    skip('advisor lookup resolves a name', 'no --advisor=<code> given');
  }

  r = await json('/api/advisor?slug=definitely-not-a-real-slug');
  check('unknown slug -> null, not an error',
    r.status === 200 && r.body && r.body.advisor === null, JSON.stringify(r.body));

  r = await json('/api/advisor');
  check('missing slug -> 400', r.status === 400);

  /* ── Share guards. Each of these must reject BEFORE anything is stored. ── */
  const base = { firstName: 'Regress', lastName: 'Suite', email: 'regress@example.com',
                 consent: true, consentText: 'regression suite' };

  r = await post('/api/share', Object.assign({}, base, { company: 'bot' }));
  check('honeypot -> 200 and not stored',
    r.status === 200 && r.body && r.body.ok === true, JSON.stringify(r.body));

  r = await post('/api/share', Object.assign({}, base, { consent: false }));
  check('no consent -> consent_required',
    r.status === 400 && r.body.error === 'consent_required', JSON.stringify(r.body));

  r = await post('/api/share', Object.assign({}, base, { consentText: '' }));
  check('consent without recorded wording -> 400', r.status === 400);

  r = await post('/api/share', Object.assign({}, base, { email: 'not-an-email' }));
  check('invalid email -> email_invalid',
    r.status === 400 && r.body.error === 'email_invalid', JSON.stringify(r.body));

  r = await post('/api/share', Object.assign({}, base, { firstName: '' }));
  check('missing name -> name_required', r.status === 400);

  r = await json('/api/share', { method: 'GET' });
  check('share rejects GET -> 405', r.status === 405);

  /* ── Attribution pings accept and stay silent ──────────────────────────── */
  /* These two answer 204 whether or not the advisor exists — that is deliberate
     (a stale QR code must never show a visitor an error). It also means they
     prove nothing about attribution unless the reference is real, which is why
     they skip rather than run when none was supplied. */
  if (ADVISOR) {
    r = await post('/api/visit', { kind: 'visit', advisor: ADVISOR, session: 'regress' });
    check('visit ping -> 204', r.status === 204);

    r = await post('/api/visit', { kind: 'finder_complete', advisor: ADVISOR, session: 'regress' });
    check('completion ping -> 204', r.status === 204);
  } else {
    skip('visit ping -> 204', 'no --advisor=<code> given');
    skip('completion ping -> 204', 'no --advisor=<code> given');
  }

  r = await post('/api/visit', { kind: 'visit', advisor: 'no-such-advisor' });
  check('unknown advisor -> 204, never an error', r.status === 204);

  r = await post('/api/visit', {});
  check('no advisor -> 204, nothing to credit', r.status === 204);

  /* ── Nothing secret is served ──────────────────────────────────────────── */
  for (const asset of ['/js/journey.js', '/js/attribution.js']) {
    const text = await (await fetch(BASE + asset)).text();
    const leaked = /SERVICE_ROLE|RESEND_API_KEY|IP_HASH_SALT|eyJhbGci|re_[A-Za-z0-9]{20}/.test(text);
    check(`no secrets in ${asset}`, !leaked);
  }

  /* ── Consumer promises that are load-bearing ───────────────────────────── */
  const journey = await (await fetch(BASE + '/journey')).text();
  check('no-JS explainer still ships (six village cards)',
    (journey.match(/village-card/g) || []).length >= 6);
  check('Finder app hidden pre-JS', /id="finder-app"[^>]*hidden/.test(journey));
  /* Assert on a phrase that lives inside ONE string literal. The consent is
     built by concatenation, so "independent travel professional" is split
     across a `+` in the source and a regex for it fails against code that is
     in fact correct — which is exactly what happened the first time this ran. */
  const finderJs = await (await fetch(BASE + '/js/journey.js')).text();
  check('share consent carries the guide §B wording',
    finderJs.includes('does not subscribe you to marketing emails'));
  check('share consent states advisor independence',
    finderJs.includes('independent travel'));

  /* ── No third party sees a visitor before they consent ──────────────────
     The typefaces were served from fonts.googleapis.com until 2026-08-14,
     which disclosed every visitor's IP address to Google in order to render
     text. They are self-hosted now, and the sentence about it came OUT of §10
     of the privacy policy — so if a Google font link ever comes back, the
     policy silently becomes wrong about who receives your data.

     Checked against the SHIPPED HTML of both heads. /advisors/foundations
     carries its own source head and was the one that still had the link after
     the main template was fixed, which is exactly why it is asserted
     separately rather than trusted to follow. */
  for (const path of ['/', '/privacy', '/advisors/foundations']) {
    const html = await (await fetch(BASE + path)).text();
    check(`${path} loads no typeface from Google`,
      !/fonts\.googleapis\.com\/css|fonts\.gstatic\.com/.test(html));
  }

  /* And that they are actually served from here — a page with neither the
     Google link nor a local @font-face would pass the check above while
     rendering in Georgia. */
  const tokens = await (await fetch(BASE + '/css/tokens.css')).text();
  check('the typefaces are declared locally instead',
    (tokens.match(/@font-face/g) || []).length >= 6 &&
    tokens.includes('/assets/fonts/'));
  check('and the OFL licence ships with them',
    (await fetch(BASE + '/assets/fonts/OFL.txt')).status === 200);

  const failed = results.filter((x) => !x.skipped && !x.pass);
  const skipped = results.filter((x) => x.skipped);
  const ran = results.length - skipped.length;

  results.forEach((x) => console.log(
    `  ${x.skipped ? 'SKIP' : x.pass ? 'PASS' : 'FAIL'}  ${x.name}` +
    `${x.detail && !x.pass ? '   ' + x.detail : ''}`));

  console.log(`\n  ${ran - failed.length}/${ran} passed`);
  if (skipped.length) {
    console.log(`  ${skipped.length} skipped — pass --advisor=<code> to run the attribution checks`);
  }
  console.log('');
  process.exit(failed.length ? 1 : 0);
})();
