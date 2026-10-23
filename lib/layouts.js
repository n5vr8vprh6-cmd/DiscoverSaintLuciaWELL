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
  /* `consent` marks the footer's "Cookie settings": js/consent.js opens the
     notice on click, and the href (the policy's cookie section) is what a
     visitor without JavaScript gets instead. */
  const attrs = ext ? ' target="_blank" rel="noopener"' : (l.consent ? ' data-consent-open' : '');
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
function globalFooter({ footer = SITE.footer, utility: utilityLinks = SITE.utility, variant = '' } = {}) {
  /* A column is one { title, links } group, or — when two groups share a column
     rather than earning a fifth one — `{ groups: [{ title, links }, …] }`. The
     grid was drawn for the brand block plus four columns; stacking keeps it at
     that. Every existing column is the first shape and renders as before. */
  const group = (g) => `<h2>${esc(g.title)}</h2>
        <ul>
          ${g.links.map((l) => `<li>${link(l)}</li>`).join('\n          ')}
        </ul>`;
  const cols = footer.map((col) => `<div class="footer-col${col.groups ? ' footer-col--stack' : ''}">
        ${(col.groups || [col]).map(group).join('\n        ')}
      </div>`).join('\n      ');

  const utility = utilityLinks.map((l) => `<li>${link(l)}</li>`).join('\n          ');

  return `<footer class="site-footer${variant ? ` site-footer--${variant}` : ''}">
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
   It used to borrow the consumer header and hang a dark band of its own under
   it. Two stacked navigations, one of them pointing at Eclipse and the
   Journey Finder, told an advisor at work that they were still on a holiday
   site — and at 860px and below neither could be opened, because the toggle
   script that drives the consumer menu never loads on a Hub page.

   So the Hub has ONE header now (Hub brief v2, 23 Oct 2026). Continuity with
   the destination site comes from what it is made of — the same Pitons mark,
   the same lockup, the same type and palette — not from repeating the
   consumer's menu. "View the public site" sits in the account menu for the
   advisor who wants the destination.

   Five destinations, in the order an advisor's week runs:
     Home · Clients · Journey Designer · Explore Saint Lucia · Marketing
   Account settings and Admin live in the account menu. Every URL that existed
   before still exists: "Clients" is a label over /hub/journeys, and Marketing
   is a parent over /hub/campaign and /hub/sweepstakes, so bookmarks, the
   notification email's links and ASK WELL's URLs are untouched.

   The menu works before JavaScript: the drawer and both menus are <details>.

   `page.advisor` is set by the route before rendering. When it is absent the
   page is a signed-out one (login, register, reset), which gets the lockup and
   a way back to the site and nothing else — navigation to places you cannot
   go is noise.
   ══════════════════════════════════════════════════════════════════════════ */
const HUB_NAV = [
  { key: 'home',      label: 'Home',                href: '/hub' },
  { key: 'clients',   label: 'Clients',             href: '/hub/journeys' },
  { key: 'designer',  label: 'Journey Designer',    href: '/hub/designer' },
  { key: 'explore',   label: 'Explore Saint Lucia', href: '/hub/explore' },
  { key: 'marketing', label: 'Marketing',           href: '/hub/marketing' }
];

/* Which destination a path belongs to. A screen can override it with
   page.hubSection (ASK WELL passes 'designer' while its URL stays under
   /hub/journeys/:id/design, which is where it has always lived). */
function hubSection(page) {
  if (page.hubSection) return page.hubSection;
  const p = page.path || '';
  if (p === '/hub') return 'home';
  if (/^\/hub\/designer(\/|$)/.test(p) || /^\/hub\/journeys\/[^/]+\/design/.test(p)) return 'designer';
  if (/^\/hub\/journeys(\/|$)/.test(p)) return 'clients';
  if (/^\/hub\/explore(\/|$)/.test(p)) return 'explore';
  if (/^\/hub\/(marketing|campaign|sweepstakes)(\/|$)/.test(p)) return 'marketing';
  return null;
}

/* Is this advisor the webinar demo account? Mirrors api/_lib/demo.js — kept as
   a one-line copy rather than a require so lib/ never reaches into api/. */
const isDemoAdvisor = (a) => !!a && /^demo-[0-9a-f]{16}$/.test(a.slug || '');

function hubNavLinks(page, cls) {
  const here = hubSection(page);
  return HUB_NAV.map((n) =>
    `<a class="${cls}" href="${esc(n.href)}"${n.key === here ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`
  ).join('\n        ');
}

/* The account menu. Admin is decided HERE, from the server-read role, and
   never from a cookie — `role` reaches page.advisor through advisorFor()'s
   explicit select in api/_lib/auth.js, and removing it there makes this
   silently disappear. It is also hidden while staff are viewing as someone,
   because requireAdmin refuses view-as sessions anyway. */
function hubAccountLinks(a) {
  const admin = a.role === 'admin' && !a.viewingAs
    ? '<a href="/hub/admin">Admin</a>' : '';
  return `<a href="/hub/account">Account settings</a>
          ${admin}
          <a href="/" target="_blank" rel="noopener">View the public site</a>
          <a href="/advisors/intro">Help and training</a>
          <form method="POST" action="/api/auth/logout" data-signout>
            <button type="submit">Sign out</button>
          </form>`;
}

function hubHeader(page) {
  const a = page.advisor;
  const lockup = `<a class="brand-lockup" href="${a ? '/hub' : '/'}" aria-label="${a ? 'Advisor Hub home' : 'Discover Saint Lucia WELL — home'}">
      ${pitonsMark({ height: 26 })}
      <span class="brand-words"><b>Discover Saint&nbsp;Lucia WELL</b><i>Advisor Hub</i></span>
    </a>`;

  if (!a) {
    return `<header class="hub-bar hub-bar--out">
  <div class="wrap hub-bar-inner">
    ${lockup}
    <a class="hub-bar-out" href="/">Back to Discover Saint&nbsp;Lucia WELL</a>
  </div>
</header>`;
  }

  const name = a.first_name || 'You';
  const initials = initialsFor(a);
  const link = page.wellLink || '';

  /* "Share my link" is in the header because sharing is the one action an
     advisor needs from every screen. The QR is drawn by js/hub.js into
     [data-qr-inline]; without script the menu still holds the link and Copy. */
  const share = link ? `<details class="hub-pop hub-share">
      <summary class="hub-share-btn"><span>Share my link</span></summary>
      <div class="hub-pop-panel hub-share-panel">
        <p class="hub-pop-title">Your WELL link</p>
        <div class="hub-copyfield">
          <input id="hub-bar-link" value="${esc(link)}" readonly aria-label="Your WELL link">
          <button class="hub-btn hub-btn--primary hub-btn--sm" type="button" data-copy="#hub-bar-link">Copy</button>
        </div>
        <div class="hub-share-qr" data-qr-inline="${esc(link)}" data-qr-size="132"></div>
        <p class="hub-pop-note">Opaque on purpose: it identifies you without your name in the address.
          <a href="/hub/marketing#well-link">QR downloads and preview</a></p>
      </div>
    </details>` : '';

  const demo = isDemoAdvisor(a)
    ? '<span class="hub-demo-chip" title="This account holds fictional sample data for demonstrations.">Sample data</span>'
    : '';

  return `<header class="hub-bar">
  <div class="wrap hub-bar-inner">
    ${lockup}
    <nav class="hub-nav" aria-label="Hub">
        ${hubNavLinks(page, 'hub-nav-link')}
    </nav>
    <div class="hub-bar-tools">
      ${demo}
      ${share}
      <details class="hub-pop hub-acct">
        <summary aria-label="Your account">
          <span class="hub-acct-avatar" aria-hidden="true">${esc(initials)}</span>
          <span class="hub-acct-name">${esc(name)}</span>
        </summary>
        <div class="hub-pop-panel hub-acct-menu">
          ${hubAccountLinks(a)}
        </div>
      </details>
      <details class="hub-drawer">
        <summary><span class="hub-drawer-label">Menu</span></summary>
        <div class="hub-drawer-panel">
          <nav aria-label="Hub (menu)">
        ${hubNavLinks(page, 'hub-drawer-link')}
          </nav>
          <div class="hub-drawer-acct">
            ${hubAccountLinks(a)}
          </div>
        </div>
      </details>
    </div>
  </div>
</header>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   HUB FOOTER — the consumer footer, adapted for someone signed in
   --------------------------------------------------------------------------
   The same component and the same SITE.footer data, so legal links, cookie
   control and channels can never drift between the two (brief v2 §11). Two
   differences, both because the reader is an advisor at work:
     · the Travel Advisors column leads with the Hub itself;
     · the utility row's "Advisor sign in" becomes "Account" — you are signed
       in, and a sign-in link reads as if you were not.
   Signed-out Hub pages (login, reset) get the ordinary footer unchanged.
   ══════════════════════════════════════════════════════════════════════════ */
function hubFooter(page) {
  if (!page.advisor) return globalFooter();
  const footer = SITE.footer.map((col) => {
    if (col.title !== 'Travel Advisors') return col;
    return Object.assign({}, col, {
      links: [{ label: 'Advisor Hub home', href: '/hub' }]
        .concat(col.links.filter((l) => l.href !== '/advisors/hub'))
    });
  });
  const utility = SITE.utility.map((l) => (l.href === '/hub' ? { label: 'Account', href: '/hub/account' } : l));
  return globalFooter({ footer, utility, variant: 'hub' });
}

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


const LAYOUTS = {
  destination: {
    header: globalHeader,
    footer: () => globalFooter()
  },
  hub: {
    /* The banner goes ABOVE the header, so it is the first thing on the page
       and cannot be mistaken for part of the Hub being looked at. */
    header: (page) => viewAsBanner(page) + hubHeader(page),
    footer: hubFooter
  },
  professional: {
    header: (page) => globalHeader(page) + '\n' + professionalContext(page),
    footer: () => globalFooter()
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

module.exports = { chrome, LAYOUTS, link, hubSection, HUB_NAV };
