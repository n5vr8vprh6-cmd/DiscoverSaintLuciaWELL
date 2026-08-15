/* ============================================================================
   THE THREE LAYOUT TEMPLATES
   ----------------------------------------------------------------------------
   V4 brief §7. The critical rule, quoted:

     "Being part of the same website does not require every page to share the
      same navigation. Brand coherence should come from identity, typography,
      visual language, data and components — not mandatory exit links."

   | Layout       | Chrome                                    | Goal                        |
   |--------------|-------------------------------------------|-----------------------------|
   | destination  | GlobalHeader + GlobalFooter               | discovery → Journey Finder  |
   | professional | GlobalHeader + ProfessionalContext        | orient advisors → briefing  |
   | conversion   | ConversionHeader + ConversionFooter       | complete the action         |

   Layout is ALWAYS declared explicitly on the page object. It is never inferred
   from the URL — brief §15 is explicit about this, because /advisors and
   /advisors/foundations sit in the same path segment but need opposite chrome.
   ========================================================================== */
'use strict';

const SITE = require('../content/site.js');
const { esc, ringMark, wordmark, coordMark } = require('./brand.js');

/* ── Link helper — `pending` entries render as text, never as broken links ── */
function link(l) {
  if (l.pending) return `<span class="link-pending" title="Coming soon">${esc(l.label)}</span>`;
  const ext = /^https?:/.test(l.href);
  const attrs = ext ? ' target="_blank" rel="noopener"' : '';
  return `<a href="${esc(l.href)}"${attrs}>${esc(l.label)}</a>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   PROFILE CONTROL — the signed-in advisor's way into their Hub
   --------------------------------------------------------------------------
   Sits BESIDE the primary CTA, never instead of it. An advisor with an account
   is still a person who might want to explore the destination, so "Find My WELL
   Journey" stays exactly where it is; this is an addition, not a replacement.

   A visitor who has never signed in never sees it and never learns it exists.

   THE MARKUP LIVES HERE AND IS MIRRORED IN js/site.js, because two surfaces
   need it and they know different things. Hub pages are server-rendered by a
   process that has read the advisor row, so they call this. Consumer pages are
   static files on a CDN that cannot know who is reading them, so js/site.js
   builds the same DOM from the readable `dslw_who` cookie. If you change the
   shape here, change it there — the CSS is shared and will not forgive a
   mismatch.
   ══════════════════════════════════════════════════════════════════════════ */
function profileControl({ firstName, initials }) {
  return `<details class="acct">
        <summary aria-label="Your account">
          <span class="acct-avatar" aria-hidden="true">${esc(initials)}</span>
          <span class="acct-name">${esc(firstName)}</span>
        </summary>
        <div class="acct-menu">
          <a href="/hub">Your Hub</a>
          <a href="/hub/journeys">Journeys</a>
          <a href="/hub/account">Account settings</a>
          <form method="POST" action="/api/auth/logout" data-signout>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </details>`;
}

/* Initials the same way everywhere: first letter of each name, upper case. */
function initialsFor(a) {
  return ((a.first_name || a.firstName || '?')[0] +
          ((a.last_name || a.lastName || '')[0] || '')).toUpperCase();
}

/* ══════════════════════════════════════════════════════════════════════════
   GLOBAL HEADER — every layout
   --------------------------------------------------------------------------
   `page.nav` and `page.headerCta` let a surface supply its own items; both
   default to the consumer ones, which is what all but the Hub want.
   ══════════════════════════════════════════════════════════════════════════ */
function globalHeader(page) {
  const items = (page.nav || SITE.nav).map((n) => {
    const current = n.href === page.path ||
      (n.href !== '/' && n.href !== '/hub' && page.path.startsWith(n.href + '/'));
    return `<a href="${esc(n.href)}"${current ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`;
  }).join('\n        ');

  const cta = page.headerCta === null ? '' : (() => {
    const c = page.headerCta || SITE.primaryCta;
    return `<a class="btn btn--gold btn--sm" href="${esc(c.href)}">${esc(c.label)}</a>`;
  })();

  /* Server-rendered only when the server knows. On static pages this is absent
     and js/site.js fills it in — see profileControl(). */
  const profile = page.advisor
    ? profileControl({ firstName: page.advisor.first_name, initials: initialsFor(page.advisor) })
    : '';

  return `<header class="site-header" data-layout="${esc(page.layout)}">
  <nav class="nav wrap" aria-label="Primary">
    ${wordmark({ href: '/' })}
    <button class="nav-toggle" aria-expanded="false" aria-controls="nav-links">
      <span class="nav-toggle-label">Menu</span>
    </button>
    <div class="nav-links" id="nav-links">
      <div class="nav-items">
        ${items}
      </div>
      ${cta}
      <div class="nav-acct" data-acct-slot>${profile}</div>
    </div>
  </nav>
</header>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   PROFESSIONAL CONTEXT — /advisors only
   A quiet band under the global nav that signals "you are in the professional
   side of the house" without switching the visitor into a conversion funnel.
   ══════════════════════════════════════════════════════════════════════════ */
function professionalContext(page) {
  const ctx = page.professionalContext;
  if (!ctx) return '';
  const anchors = (ctx.anchors || [])
    .map((a) => `<a href="${esc(a.href)}">${esc(a.label)}</a>`).join('\n      ');
  return `<div class="pro-context">
  <div class="wrap pro-context-inner">
    <p class="eyebrow">${esc(ctx.eyebrow)}</p>
    ${anchors ? `<nav class="pro-context-nav" aria-label="On this page">\n      ${anchors}\n    </nav>` : ''}
  </div>
</div>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   CONVERSION HEADER — advisor conversion pages
   Brand lockup + page title + local anchors + ONE primary action.

   Deliberately absent: Explore, Eclipse, About, Find My WELL Journey. Brief §8
   forbids them here. The brand mark links quietly home but must not compete
   visually with the primary CTA.
   ══════════════════════════════════════════════════════════════════════════ */
function conversionHeader(page) {
  const c = page.conversion || {};
  const anchors = (c.anchors || [])
    .map((a) => `<a href="${esc(a.href)}">${esc(a.label)}</a>`).join('\n        ');

  return `<header class="site-header site-header--conversion" data-layout="conversion">
  <div class="conv-bar wrap">
    ${wordmark({ href: '/', context: c.context || 'Professional Education', label: 'Discover Saint Lucia WELL — home' })}
    ${c.title ? `<p class="conv-title">${esc(c.title)}</p>` : ''}
  </div>
  <nav class="conv-nav" aria-label="Page sections">
    <div class="wrap conv-nav-inner">
      <button class="nav-toggle" aria-expanded="false" aria-controls="conv-links">
        <span class="nav-toggle-label">Sections</span>
      </button>
      <div class="conv-links" id="conv-links">
        ${anchors}
      </div>
      ${c.cta ? `<a class="btn btn--gold btn--sm" href="${esc(c.cta.href)}">${esc(c.cta.label)}</a>` : ''}
    </div>
  </nav>
</header>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   GLOBAL FOOTER — the consumer umbrella
   ══════════════════════════════════════════════════════════════════════════ */
function globalFooter() {
  const cols = SITE.footer.map((col) => `<div class="footer-col">
        <h2>${esc(col.title)}</h2>
        <ul>
          ${col.links.map((l) => `<li>${link(l)}</li>`).join('\n          ')}
        </ul>
      </div>`).join('\n      ');

  const utility = SITE.utility.map((l) => `<li>${link(l)}</li>`).join('\n          ');

  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="footer-brand-mark">
          ${ringMark(30, 1.5)}
          <p class="wordmark">Discover Saint&nbsp;Lucia <b>WELL</b></p>
        </div>
        <p class="footer-tagline">${esc(SITE.tagline)}</p>
      </div>
      ${cols}
    </div>
    <div class="footer-base">
      <ul class="footer-utility">
          ${utility}
      </ul>
      <span class="footer-legal">© ${SITE.year} ${esc(SITE.name)}</span>
      ${coordMark(SITE.coords)}
    </div>
  </div>
</footer>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   CONVERSION FOOTER — restrained product footer
   Brief §8: do NOT append the full consumer mega-footer beneath a conversion
   page. Columns come from the page so Foundations can supply its own.
   ══════════════════════════════════════════════════════════════════════════ */
function conversionFooter(page) {
  const c = page.conversion || {};
  const cols = (c.footerCols || []).map((col) => `<div class="footer-col">
        <h2>${esc(col.title)}</h2>
        <ul>
          ${col.links.map((l) => `<li>${link(l)}</li>`).join('\n          ')}
        </ul>
      </div>`).join('\n      ');

  const utility = SITE.advisorFooter.utility.map((l) => `<li>${link(l)}</li>`).join('\n        ');

  return `<footer class="site-footer site-footer--conversion">
  <div class="wrap">
    <div class="footer-grid footer-grid--conversion">
      <div class="footer-brand">
        <div class="footer-brand-mark">
          ${ringMark(26, 1.5)}
          <p class="wordmark">Discover Saint&nbsp;Lucia <b>WELL</b></p>
        </div>
      </div>
      ${cols}
      <div class="footer-col">
        <h2>Exit</h2>
        <ul><li>${link(SITE.advisorFooter.exit)}</li></ul>
      </div>
    </div>
    <div class="footer-base">
      <ul class="footer-utility">
        ${utility}
      </ul>
      <span class="footer-legal">© ${SITE.year} ${esc(SITE.name)}</span>
      ${coordMark(SITE.coords)}
    </div>
  </div>
</footer>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   DISPATCH
   ══════════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════════
   HUB — the authenticated advisor surface
   --------------------------------------------------------------------------
   It used to have a shell of its own. It no longer does, and that is the point:
   an advisor moving between the destination site and their workspace should not
   feel handed to a different product. So the Hub takes the SAME header and the
   SAME footer as every other page, and puts its own navigation in a quiet band
   underneath — exactly the pattern professionalContext() already uses on
   /advisors.

   The consumer CTA stays. An advisor with an account is still someone who might
   want to look at the destination, and removing "Find My WELL Journey" from
   their view would be treating an account as a change of species. The profile
   control sits beside it, not instead of it.

   `page.advisor` is set by the route before rendering. When it is absent the
   page is a signed-out one (login, register, reset): it keeps the site header
   but gets no Hub band, because navigation to places you cannot go is noise.
   ══════════════════════════════════════════════════════════════════════════ */
const HUB_NAV = [
  { label: 'Home',     href: '/hub' },
  { label: 'Journeys', href: '/hub/journeys' },
  { label: 'Account',  href: '/hub/account' }
];

/* ══════════════════════════════════════════════════════════════════════════
   VIEW-AS BANNER
   --------------------------------------------------------------------------
   Above the navigation, in the Eclipse palette rather than the Hub's, and on
   every single page while it is active. Somebody who forgets they are inside
   another advisor's Hub will misread everything they see — so this is designed
   to be impossible to scroll past or mistake for chrome.

   It names both people. "You are Duncan, looking at Priya" is the sentence
   that prevents the mistake; "viewing as Priya" alone is the one that causes it.
   ══════════════════════════════════════════════════════════════════════════ */
function viewAsBanner(page) {
  const a = page.advisor;
  if (!a || !a.viewingAs) return '';
  const who = `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email;
  const me = (a.realAdmin && a.realAdmin.first_name) || 'an administrator';

  return `<div class="viewas-bar">
  <div class="wrap viewas-inner">
    <p><strong>You are ${esc(me)}, looking at ${esc(who)}'s Hub.</strong>
      Read-only, their clients' details hidden, and this is recorded.</p>
    <form method="POST" action="/hub/viewas/exit">
      <button class="btn btn--ghost btn--sm" type="submit">Stop viewing</button>
    </form>
  </div>
</div>`;
}

function hubContext(page) {
  if (!page.advisor) return '';

  /* The Admin entry is added HERE rather than to HUB_NAV, because the constant
     has no access to `page` and the decision depends on who is looking.

     It deliberately does NOT go in profileControl() — that menu is mirrored in
     js/site.js and rebuilt on static consumer pages from the `dslw_who` cookie,
     which carries no role and must never carry one. An Admin link there would
     either vanish on consumer pages or require putting a privilege claim in a
     cookie the user can edit.

     `role` reaches here through advisorFor()'s explicit select in
     api/_lib/auth.js. Removing it there makes this silently disappear. */
  const nav = page.advisor.role === 'admin'
    ? HUB_NAV.concat([{ label: 'Admin', href: '/hub/admin' }])
    : HUB_NAV;

  const items = nav.map((n) => {
    const current = n.href === page.path ||
      (n.href !== '/hub' && page.path.startsWith(n.href));
    return `<a href="${esc(n.href)}"${current ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`;
  }).join('\n      ');

  return `<div class="pro-context hub-context">
  <div class="wrap pro-context-inner">
    <p class="eyebrow">Travel Advisor Hub</p>
    <nav class="pro-context-nav" aria-label="Hub">
      ${items}
    </nav>
  </div>
</div>`;
}

const LAYOUTS = {
  destination: {
    header: globalHeader,
    footer: globalFooter
  },
  hub: {
    /* The banner goes ABOVE the header, so it is the first thing on the page
       and cannot be mistaken for part of the Hub being looked at. */
    header: (page) => viewAsBanner(page) + globalHeader(page) + '\n' + hubContext(page),
    footer: globalFooter
  },
  professional: {
    header: (page) => globalHeader(page) + '\n' + professionalContext(page),
    footer: globalFooter
  },
  conversion: {
    header: conversionHeader,
    footer: conversionFooter
  }
};

function chrome(page) {
  const l = LAYOUTS[page.layout];
  if (!l) {
    throw new Error(
      `Page "${page.path}" declares unknown layout "${page.layout}". ` +
      `Expected one of: ${Object.keys(LAYOUTS).join(', ')}.`
    );
  }
  return { header: l.header(page), footer: l.footer(page) };
}

module.exports = { chrome, LAYOUTS, link };
