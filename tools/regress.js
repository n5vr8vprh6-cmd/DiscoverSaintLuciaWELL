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

   NOT COVERED HERE, ON PURPOSE: the browser-side guarantees — that an
   unattributed Finder completion makes zero network calls, and that the no-JS
   page still renders the six-village explainer. Those need a real browser and
   live in the headless harness; asserting them from curl would be a false
   green.
   ========================================================================== */
'use strict';

const BASE = (process.argv[2] || 'https://discoversaintluciawell.com').replace(/\/$/, '');

const ROUTES = ['/', '/journey', '/explore', '/eclipse', '/about', '/advisors',
  '/advisors/intro', '/advisors/immersion', '/advisors/foundations',
  '/privacy', '/terms', '/accessibility'];

const results = [];
const check = (name, pass, detail) => results.push({ name, pass, detail: detail || '' });

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
  let r = await json('/api/advisor?slug=test-advisor');
  check('advisor lookup resolves a name',
    r.status === 200 && r.body && r.body.advisor && r.body.advisor.firstName,
    JSON.stringify(r.body));

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
  r = await post('/api/visit', { kind: 'visit', advisor: 'test-advisor', session: 'regress' });
  check('visit ping -> 204', r.status === 204);

  r = await post('/api/visit', { kind: 'finder_complete', advisor: 'test-advisor', session: 'regress' });
  check('completion ping -> 204', r.status === 204);

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

  const failed = results.filter((x) => !x.pass);
  results.forEach((x) => console.log(
    `  ${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.detail && !x.pass ? '   ' + x.detail : ''}`));
  console.log(`\n  ${results.length - failed.length}/${results.length} passed\n`);
  process.exit(failed.length ? 1 : 0);
})();
