/* ============================================================================
   GET /well/<code> — the advisor's campaign entry point
   ----------------------------------------------------------------------------
   V2 §6. This is the link an advisor prints on a card, puts in a newsletter,
   or turns into a QR code. It says nothing about who they are.

   IT IS A REDIRECT, NOT A PAGE. Two reasons, and the second is the important
   one:

     · the consumer experience should be the consumer site, not a branded
       interstitial that makes the visitor feel handed off;
     · attribution already works. `js/attribution.js` reads the reference from
       the query string, stores it first-touch, decorates internal links and
       pings /api/visit. Landing them on `/?advisor=<code>` reuses all of it
       rather than building a second attribution path that could disagree with
       the first.

   A `to` parameter allows the advisor to point the link at a specific page —
   /journey for "take the Finder", /eclipse for a particular conversation — and
   is restricted to a known list, because an open redirect on a link designed
   to be printed and trusted would be a genuinely bad thing to ship.
   ========================================================================== */
'use strict';

const { db, str } = require('./_lib/core.js');
const { resolveAdvisor } = require('./_lib/advisors.js');

/* Where an advisor may aim their link. Deliberately a list, not a pattern. */
const DESTINATIONS = {
  '':         '/',
  home:       '/',
  journey:    '/journey',
  eclipse:    '/eclipse',
  explore:    '/explore',
  about:      '/about'
};

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'https://x');
  const code = str(url.searchParams.get('code'), 120);
  const to = DESTINATIONS[str(url.searchParams.get('to'), 20).toLowerCase()] || '/';

  const supabase = db();
  const advisor = supabase
    ? await resolveAdvisor(supabase, code, 'public_code, slug, status') : null;

  /* An unknown, retyped-wrong or deactivated code sends the visitor to the site
     anyway, unattributed. They came here to read about Saint Lucia; a 404 would
     punish them for the advisor's typo. */
  const attributed = advisor && advisor.status === 'active';

  /* Forward the CANONICAL reference rather than whatever was typed. A visitor
     who arrives in lower case, or through an old slug, continues with the one
     identifier the rest of the funnel will agree on. */
  const ref = attributed ? (advisor.public_code || advisor.slug) : null;
  const target = ref ? `${to}?advisor=${encodeURIComponent(ref)}` : to;

  /* 302, not 301. A permanent redirect would be cached by the browser, and an
     advisor who is later paused — or a code aimed somewhere new — would keep
     resolving to the old target on every device that had already seen it. */
  res.statusCode = 302;
  res.setHeader('Location', target);
  res.setHeader('Cache-Control', 'no-store');
  /* The redirect itself is not a page and must never be indexed; the code is
     meant to be given out, not discovered. */
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end();
};
