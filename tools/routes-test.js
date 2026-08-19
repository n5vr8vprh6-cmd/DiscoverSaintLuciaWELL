/* ============================================================================
   routes-test.js — the edges of the URL space
   ----------------------------------------------------------------------------
     node tools/routes-test.js

   Four things that all failed quietly, and all of them were found by somebody
   typing a URL rather than by a test:

   1. THE SITE HAD NO 404 PAGE. Every typo anywhere landed on the host's own
      screen with an error ID on it. Duncan reached it by guessing
      /advisors/hub/journeys, which is exactly how an advisor would.

   2. /advisors/hub/* WENT NOWHERE. /advisors/hub is the public page and /hub
      is the Hub; the sub-paths under the public one never existed. The naming
      collision was settled in the copy and not in the URL space.

   3. THE HUB HAD NO CATCH-ALL, so /hub/Journeys 404d while /hub/journeys
      worked — 24 exact routes and nothing else.

   4. THE AUTH REDIRECT WAS PUBLICLY CACHEABLE. hub-render sets
      `private, no-store` on rendered pages, but a guard never renders, so the
      one response carrying the access decision had no header of its own. That
      distinction — page versus redirect — is why nothing caught it, and it is
      what this file asserts directly.

   Runs with NO environment: with no Supabase keys anonClient() returns null,
   userFor() returns null, and every guard takes its signed-out branch. That is
   the branch worth testing.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (what, cond, detail) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + what + (cond || !detail ? '' : '\n          ' + detail));
  if (!cond) failed++;
};
const section = (t) => console.log('\n  ' + t);

function fakeRes() {
  return {
    statusCode: 200, headers: {}, body: '', ended: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    getHeader(k) { return this.headers[k.toLowerCase()]; },
    end(b) { if (b) this.body += b; this.ended = true; return this; },
    write(b) { this.body += b; return this; }
  };
}

(async () => {

  /* ══ 1 · The 404 page exists and is where the edge looks ════════════════ */
  section('The site has a 404 page of its own');

  const page = require('../content/404.js');
  ok('it is registered in the build',
    fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8').indexOf("content/404.js") !== -1);
  ok('and it is noindex', page.noindex === true,
    'a 404 in the sitemap is an invitation to index the one page that must never rank');

  const built = path.join(ROOT, 'dist', '404.html');
  ok('dist/404.html exists after a build', fs.existsSync(built),
    'Vercel serves the custom not-found from the output ROOT. Without this file ' +
    'every mistyped URL keeps landing on the host error screen — run node build.js');

  if (fs.existsSync(built)) {
    const html = fs.readFileSync(built, 'utf8');
    ok('it carries the site chrome', /<header|site-header|<footer/.test(html),
      'the point is that it belongs to the site rather than to the host');
    ok('and offers the three doors',
      html.indexOf('/journey') !== -1 && html.indexOf('/advisors/hub') !== -1 &&
      html.indexOf('/advisors/foundations') !== -1,
      'traveller, advisor, and somebody who came from the training');
    ok('it does not show an error code at the reader',
      !/NOT_FOUND|Code:|ID: /.test(html),
      'a person who mistyped a URL has done nothing that warrants a stack identifier');
    ok('and it stays out of the sitemap',
      fs.readFileSync(path.join(ROOT, 'dist', 'sitemap.xml'), 'utf8').indexOf('/404') === -1);
  }

  /* ══ 2 · The two catch-alls, and their ORDER ════════════════════════════ */
  section('vercel.json routes the paths people actually type');

  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

  const hubRedirect = (v.redirects || []).find((r) => /^\/advisors\/hub\//.test(r.source));
  ok('/advisors/hub/* redirects to the Hub', Boolean(hubRedirect),
    'the exact mistake Duncan made, and the one an advisor makes from the public page');
  if (hubRedirect) {
    ok('and it is a REDIRECT, not a rewrite',
      hubRedirect.destination.indexOf('/hub/') === 0,
      'the address bar has to correct itself, or the next attempt is wrong too');
    ok('the bare /advisors/hub is untouched',
      !(v.redirects || []).some((r) => r.source === '/advisors/hub'),
      'that is a real page and stays one');
  }

  const last = v.rewrites[v.rewrites.length - 1];
  ok('the Hub catch-all is LAST in the rewrites',
    last && last.source === '/hub/:rest*',
    'Vercel matches first-wins. Listed earlier it would swallow all 24 real Hub ' +
    'routes — the same trap that broke a deploy when api/**/*.js preceded api/gtm.js. ' +
    'Last is: ' + (last && last.source));

  /* ══ 3 · The screen's route list agrees with the edge's ═════════════════ */
  section('The two lists of Hub routes cannot drift');

  const nf = fs.readFileSync(path.join(ROOT, 'api', '_lib', 'hub-screens', 'not-found.js'), 'utf8');
  const known = (nf.match(/'\/hub[^']*'/g) || []).map((s) => s.slice(1, -1));

  /* Exact-match rewrites only: the :id routes cannot be listed literally. */
  const routed = v.rewrites
    .filter((r) => /^\/hub/.test(r.source) && r.source.indexOf(':') === -1)
    .map((r) => r.source);

  const missing = routed.filter((r) => known.indexOf(r) === -1);
  ok('every routed Hub path is in the screen\'s KNOWN list', missing.length === 0,
    'missing: ' + missing.join(', ') + '\n          ' +
    'The case-correcting redirect reads KNOWN, so a route absent from it means ' +
    '/hub/NewScreen stays a dead end while /hub/newscreen works.');

  /* ══ 4 · The auth redirect carries its own header ═══════════════════════ */
  section('The redirect, not just the page');

  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  const { requireAdvisor } = require('../api/_lib/auth.js');

  const res = fakeRes();
  const got = await requireAdvisor({ url: '/hub/journeys', headers: {} }, res, '/hub/journeys');

  ok('a signed-out request is refused', got === null);
  ok('and redirected to login', res.statusCode === 302 &&
    String(res.getHeader('location')).indexOf('/hub/login') === 0,
    'got ' + res.statusCode + ' ' + res.getHeader('location'));
  ok('carrying where they were going', /next=%2Fhub%2Fjourneys/.test(String(res.getHeader('location'))));

  /* THE ONE THAT WAS MISSING. */
  ok('and Cache-Control: private, no-store',
    String(res.getHeader('cache-control')) === 'private, no-store',
    'got "' + res.getHeader('cache-control') + '". hub-render sets this on rendered ' +
    'pages, but a guard never renders — it sets Location and ends. The one response ' +
    'whose meaning depends on who is signed in had no header of its own.');

  /* ══ 5 · The not-found screen's three branches ══════════════════════════ */
  section('An unrecognised Hub path');

  const screen = require('../api/_lib/hub-screens/not-found.js');
  const call = async (p) => {
    const r = fakeRes();
    await screen({ url: '/api/hub?screen=notFound&path=' + p, headers: {} }, r);
    return r;
  };

  const cased = await call('Journeys');
  ok('a casing mistake is corrected, not refused',
    cased.statusCode === 308 && cased.getHeader('location') === '/hub/journeys',
    'got ' + cased.statusCode + ' ' + cased.getHeader('location') +
    ' — /hub/Journeys 404d before this existed');
  ok('and that redirect is private too',
    String(cased.getHeader('cache-control')) === 'private, no-store');

  const unknown = await call('nonsense');
  ok('a genuinely unknown path signed out goes to login',
    unknown.statusCode === 302 && unknown.getHeader('location') === '/hub/login?next=%2Fhub',
    'got ' + unknown.getHeader('location'));
  ok('with next=/hub, NOT the path they mistyped',
    String(unknown.getHeader('location')).indexOf('nonsense') === -1,
    'signing in would otherwise deliver them straight back to the dead end');

  console.log('\n  ' + (failed ? failed + ' FAILED\n' : 'All good.\n'));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('\n  ' + (e && e.stack || e) + '\n'); process.exit(2); });
