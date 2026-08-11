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
   GLOBAL HEADER — destination + professional layouts
   ══════════════════════════════════════════════════════════════════════════ */
function globalHeader(page) {
  const items = SITE.nav.map((n) => {
    const current = n.href === page.path ||
      (n.href !== '/' && page.path.startsWith(n.href + '/'));
    return `<a href="${esc(n.href)}"${current ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`;
  }).join('\n        ');

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
      <a class="btn btn--gold btn--sm" href="${esc(SITE.primaryCta.href)}">${esc(SITE.primaryCta.label)}</a>
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
const LAYOUTS = {
  destination: {
    header: globalHeader,
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
