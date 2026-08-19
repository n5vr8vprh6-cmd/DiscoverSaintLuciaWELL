/* ============================================================================
   /404 — the page nobody means to reach
   ----------------------------------------------------------------------------
   Until now there was not one. Every mistyped URL on this site — a typo in a
   printed QR code, an old link in an email, a truncated WELL link, a guessed
   Hub path — landed on Vercel's own screen:

     404: NOT_FOUND · Code: `NOT_FOUND` · ID: `yul1::zcpvx-1787097828481-…`

   Reachable from anywhere, owned by nobody, and carrying an error ID at a
   person who has done nothing wrong. Duncan found it by guessing
   /advisors/hub/journeys, which is exactly how a real advisor would find it.

   ── WHAT IT DOES AND DOES NOT DO ──────────────────────────────────────────
   One line saying what happened, then the three doors somebody is actually
   trying to reach. No search box, no "report this error", no illustration of a
   lost suitcase: a person who mistyped a URL wants a way onward, not a
   feature, and anything else here is decoration on a dead end.

   THE THREE DESTINATIONS ARE THE THREE AUDIENCES. A traveller wants the
   Journey Finder, an advisor wants their Hub, and somebody who arrived from
   the training wants Foundations. Between them they cover every path on this
   site that anybody would type from memory.

   ── noindex ───────────────────────────────────────────────────────────────
   Keeps it out of sitemap.xml, which buildSitemap already honours. A 404 page
   in a sitemap is an invitation to index the one page that should never rank.

   The 404 STATUS comes from the edge, not from here: build.js copies this to
   dist/404.html, which is what Vercel serves — with a 404 — for any unmatched
   path. A "not found" page returning 200 lies to every crawler and monitor.
   ========================================================================== */
'use strict';

module.exports = {
  key: '404',
  path: '/404',
  layout: 'destination',
  surface: 'consumer',
  noindex: true,
  title: 'Page not found — Discover Saint Lucia WELL',
  description: 'That page does not exist. Here is the way back.',
  ogTitle: 'Page not found',

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'Discover Saint Lucia WELL',
      headline: 'That page isn&rsquo;t here.',
      lead: 'The link may be out of date, or the address may have a typo in it. ' +
        'Nothing has gone wrong on your end &mdash; here are the three places most people are heading.',
      actions: [
        { label: 'Find your WELL journey', href: '/journey' },
        { label: 'The Travel Advisor Hub', href: '/advisors/hub' },
        { label: 'Well Destination Foundations', href: '/advisors/foundations' }
      ]
    }
  ]
};
