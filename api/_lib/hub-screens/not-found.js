/* ============================================================================
   Any /hub path we do not recognise
   ----------------------------------------------------------------------------
   vercel.json carries 24 exact Hub routes and, until now, no wildcard — so
   anything not on the list died at the edge before our code ran. Wrong casing,
   a typo, a renamed route, an old bookmark: all of them landed on the host's
   own error screen with an ID on it.

   Three outcomes, in this order, because they answer three different mistakes.

   ── 1 · IT IS ONLY THE CASE ────────────────────────────────────────────────
   /hub/Journeys 404s while /hub/journeys works, because Vercel matches
   literally. A capital letter from a phone keyboard should not be a dead end,
   so a path that matches a known route apart from case is redirected to the
   canonical one. A redirect and not a render: the address bar corrects itself,
   so the next attempt and any bookmark are right.

   ── 2 · SIGNED OUT ─────────────────────────────────────────────────────────
   To login — with next=/hub, NOT next= the path they mistyped. Sending them
   back to the same dead end after they sign in would be a worse experience
   than the 404 was, and it is the kind of detail that only shows up when
   somebody actually does it.

   This also removes a small asymmetry: a signed-out visitor could previously
   tell which Hub paths exist (302 to login) from which do not (404 from the
   edge). We got nothing for that.

   ── 3 · SIGNED IN ──────────────────────────────────────────────────────────
   The message inside Hub chrome, with the doors they might have wanted. Being
   thrown out to a public 404 when you are signed in reads as being logged out,
   which is alarming in a way the situation does not deserve.

   AND IT STILL RETURNS 404. A page that says "not found" with a 200 lies to
   every crawler and every uptime monitor, and this one is reachable by anybody
   typing anything.
   ========================================================================== */
'use strict';

const { advisorFor } = require('../auth.js');
const { hubPage, esc } = require('../hub-render.js');

/* The canonical Hub paths, lowercase. Kept here rather than imported from
   vercel.json because the routing file is data for the edge, not a module —
   and tools/hub-test.js asserts the two agree, so a new route cannot land in
   one without the other. */
const KNOWN = [
  '/hub', '/hub/login', '/hub/register', '/hub/forgot', '/hub/reset',
  '/hub/account', '/hub/journeys', '/hub/campaign', '/hub/campaign/profile',
  '/hub/campaign/more', '/hub/sweepstakes', '/hub/undertaking',
  '/hub/admin', '/hub/admin/advisors', '/hub/admin/advisors/new',
  '/hub/admin/import', '/hub/admin/audit', '/hub/admin/subject',
  '/hub/admin/waitlist', '/hub/viewas/exit'
];

module.exports = async function handler(req, res) {
  const url = new URL(req.url || '/hub', 'https://x');

  /* The path as typed. Vercel hands us the original in the rewrite, but fall
     back to the request URL so this is correct when called directly. */
  const asked = String(url.searchParams.get('path') || '')
    .replace(/^\/*/, '');
  const full = ('/hub/' + asked).replace(/\/+$/, '') || '/hub';

  /* ── 1 · A casing mistake, and nothing more ─────────────────────────── */
  const canonical = KNOWN.find((k) => k === full.toLowerCase());
  if (canonical && canonical !== full) {
    res.statusCode = 308;
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Location', canonical);
    return res.end();
  }

  const advisor = await advisorFor(req, res);

  /* ── 2 · Signed out ─────────────────────────────────────────────────── */
  if (!advisor) {
    res.statusCode = 302;
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Location', '/hub/login?next=%2Fhub');
    return res.end();
  }

  /* ── 3 · Signed in, and the page genuinely is not there ─────────────── */
  res.statusCode = 404;
  return hubPage(res, {
    path: '/hub',
    title: 'Page not found',
    advisor,
    body: `<div class="hub-main">
  <div class="wrap">
    <section class="hub-card">
      <h1>That page isn&rsquo;t here.</h1>
      <p class="hub-hint">The link may be out of date, or the address may have a typo in it.
        You are still signed in &mdash; nothing has happened to your account.</p>
      <div class="hub-actions">
        <a class="btn btn--gold" href="/hub">Your Hub</a>
        <a class="btn btn--ghost btn--sm" href="/hub/journeys">Journeys</a>
        <a class="btn btn--ghost btn--sm" href="/hub/campaign">My Campaign</a>
      </div>
    </section>
  </div>
</div>`
  });
};
