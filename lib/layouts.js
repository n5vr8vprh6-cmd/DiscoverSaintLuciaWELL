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
const { esc, pitonsMark, wordmark, coordMark } = require('./brand.js');

/* Footer social glyphs: 24-unit, currentColor, so the footer's own colour and hover
   apply. Instagram is drawn as an outline; the rest are the filled brand glyphs. */
const SOCIAL_ICONS = {
  linkedin: '<path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/>',
  facebook: '<path fill="currentColor" d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07z"/>',
  whatsapp: '<path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>'
};
const socialLinks = () => (SITE.social || []).map((s) => `<li><a href="${esc(s.href)}" target="_blank" rel="noopener me" aria-label="${esc(s.label)}"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${SOCIAL_ICONS[s.key]}</svg></a></li>`).join('');

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
  /* `scroll` opts the band into a single row that scrolls sideways on a phone
     instead of wrapping onto several lines (css/practitioners.css). Off by
     default, so /advisors and the Hub band are exactly as they were. */
  return `<div class="pro-context${ctx.scroll ? ' pro-context--scroll' : ''}">
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

  /* NO ANCHORS AND NO CTA MEANS NO BAR. Every conversion page in content/ has
     both, so this changes nothing for them — but /j/:token uses this layout
     precisely because it wants a wordmark and nothing else, and without this
     it rendered an empty ruled strip with a "Sections" toggle that opened onto
     nothing. A navigation control that navigates nowhere is worse on a client's
     document than anywhere else on the site. */
  const hasNav = Boolean(anchors) || Boolean(c.cta);

  return `<header class="site-header site-header--conversion" data-layout="conversion">
  <div class="conv-bar wrap">
    ${wordmark({ href: '/', context: c.context || 'Professional Education', label: 'Discover Saint Lucia WELL — home' })}
    ${c.title ? `<p class="conv-title">${esc(c.title)}</p>` : ''}
  </div>
  ${hasNav ? `<nav class="conv-nav" aria-label="Page sections">
    <div class="wrap conv-nav-inner">
      <button class="nav-toggle" aria-expanded="false" aria-controls="conv-links">
        <span class="nav-toggle-label">Sections</span>
      </button>
      <div class="conv-links" id="conv-links">
        ${anchors}
      </div>
      ${c.cta ? `<a class="btn btn--gold btn--sm" href="${esc(c.cta.href)}">${esc(c.cta.label)}</a>` : ''}
    </div>
  </nav>` : ''}
</header>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   GLOBAL FOOTER — the consumer umbrella
   ══════════════════════════════════════════════════════════════════════════ */
function globalFooter() {
  /* A column is one { title, links } group, or — when two groups share a column
     rather than earning a fifth one — `{ groups: [{ title, links }, …] }`. The
     grid was drawn for the brand block plus four columns; stacking keeps it at
     that. Every existing column is the first shape and renders as before. */
  const group = (g) => `<h2>${esc(g.title)}</h2>
        <ul>
          ${g.links.map((l) => `<li>${link(l)}</li>`).join('\n          ')}
        </ul>`;
  const cols = SITE.footer.map((col) => `<div class="footer-col${col.groups ? ' footer-col--stack' : ''}">
        ${(col.groups || [col]).map(group).join('\n        ')}
      </div>`).join('\n      ');

  const utility = SITE.utility.map((l) => `<li>${link(l)}</li>`).join('\n          ');

  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="footer-brand-mark">
          ${pitonsMark({ height: 28 })}
          <p class="wordmark">Discover Saint&nbsp;Lucia <b>WELL</b></p>
        </div>
        <p class="footer-tagline">${esc(SITE.tagline)}</p>
        <ul class="footer-social" aria-label="Our channels">${socialLinks()}</ul>
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

  const isAdvisor = page.surface === 'advisor';
  /* Same gate. A client reading their itinerary has no use for the Advisor Hub
     and should not be invited into it; Privacy, Terms and Contact stay, because
     those belong on any page that holds somebody's information. */
  const utility = SITE.advisorFooter.utility
    .filter((l) => isAdvisor || l.href !== '/hub')
    .map((l) => `<li>${link(l)}</li>`).join('\n        ');

  return `<footer class="site-footer site-footer--conversion">
  <div class="wrap">
    <div class="footer-grid footer-grid--conversion">
      <div class="footer-brand">
        <div class="footer-brand-mark">
          ${pitonsMark({ height: 22 })}
          <span class="footer-brand-words">
          <p class="wordmark">Discover Saint&nbsp;Lucia <b>WELL</b></p>
          ${/* The category line the header lockup already carries, from the
                same field the header reads (conversion.context). An advisor
                arriving on one of these pages is told once at the top that
                this is Professional Education or Professional Tools, and the
                footer was the one place that dropped it — so the page ended
                by looking like the consumer site again.

                Deliberately NOT added to globalFooter(). /advisors renders
                that one, and an advisor eyebrow above columns of Explore,
                Eclipse and Villages links would be a label arguing with the
                thing it labels. */''}
          ${c.context ? `<p class="footer-context">${esc(c.context)}</p>` : ''}
          </span>
        </div>
      </div>
      ${cols}
      ${/* THE ADVISOR FURNITURE IS GATED ON THE SURFACE, NOT ON THE LAYOUT.
            Every conversion page in content/ declares surface 'advisor', so
            this changes nothing for them. But /j/:token borrows this layout to
            get a wordmark and no navigation, and it is read by a CLIENT — who
            was ending their own travel document under a column headed "Exit"
            pointing at "Back to advisor overview", beside a link to the Advisor
            Hub. Not a leak, but an unmistakable signal that the page was built
            for somebody else. */''}
      ${isAdvisor ? `<div class="footer-col">
        <h2>Exit</h2>
        <ul><li>${link(SITE.advisorFooter.exit)}</li></ul>
      </div>` : ''}
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
  /* Before Journeys, following V2 spec §7's own order. Demand generation comes
     before the pipeline it fills — an advisor with an empty pipeline needs the
     campaign, not a longer look at the emptiness. */
  { label: 'Campaign', href: '/hub/campaign' },
  { label: 'Journeys', href: '/hub/journeys' },
  /* Prize draws sit beside Journeys because that is what they are a view of —
     the entrants ARE Journeys, filtered. A separate top-level idea would
     suggest a separate pool of contest data, and there isn't one. */
  { label: 'Draws',    href: '/hub/sweepstakes' },
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
