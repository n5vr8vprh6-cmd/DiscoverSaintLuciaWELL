/* ============================================================================
   HUB RENDER — serve a Hub page through the site's own renderer
   ----------------------------------------------------------------------------
   `render(page, body)` in lib/page.js is a pure function: descriptor in, full
   HTML document out. That is why the Hub can be server-rendered from a
   serverless function and still be the same product — same tokens, same type,
   same chrome, same asset pipeline — rather than a second application wearing
   a similar coat.

   Every Hub page is noindex. These are private working surfaces; a Journey
   detail page contains a real person's name, email and travel plans, and must
   never reach a search index. The Hub is behind auth anyway, but defence in
   depth costs one header.
   ========================================================================== */
'use strict';

const { render } = require('../../lib/page.js');

/* `js` adds a screen-specific script alongside hub.js. Only /hub/campaign uses
   one — it orchestrates a dozen sequential fetches and would otherwise be
   several hundred lines that every other Hub page downloads and never runs. */
function hubPage(res, { path, title, advisor, body, status, js }) {
  const html = render({
    key: 'hub',
    path,
    layout: 'hub',
    surface: 'advisor',
    title: title + ' — Saint Lucia WELL',
    description: 'Private advisor workspace.',
    noindex: true,
    /* The Hub is a working surface. It does not want GSAP, Lenis, scroll
       choreography or the consumer motion ladder — those exist to make an
       editorial page unfold, and here they would just delay a table. */
    scripts: false,
    js: ['/js/hub.js'].concat(js || []),
    /* Declaring `styles` swaps css/site.css for this one (see lib/page.js), so
       the Hub inherits the tokens and the chrome primitives — .wrap, .btn,
       .eyebrow, the type scale — without also inheriting three thousand lines
       of consumer section styling that would never match a selector here. */
    styles: ['/css/hub.css'],
    advisor
  }, body);

  res.statusCode = status || 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  /* Private, per-advisor, and often containing consumer PII. No shared cache
     may ever hold one of these. */
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(html);
}

/* ── Small shared pieces ─────────────────────────────────────────────────── */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function pageHead(eyebrow, title, lead) {
  return `<div class="hub-head">
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1>${esc(title)}</h1>
    ${lead ? `<p class="hub-lead">${esc(lead)}</p>` : ''}
  </div>`;
}

/* Empty states here always carry an action. V2 §19 is explicit that a blank
   dashboard is a failure of the product, not a neutral state. */
function emptyState(title, body, cta) {
  return `<div class="hub-empty">
    <h3>${esc(title)}</h3>
    <p>${esc(body)}</p>
    ${cta ? `<a class="btn btn--gold" href="${esc(cta.href)}">${esc(cta.label)}</a>` : ''}
  </div>`;
}

const STAGES = ['new', 'contacted', 'discovery', 'planning', 'booked', 'closed'];
const STAGE_LABEL = {
  new: 'New', contacted: 'Contacted', discovery: 'Discovery',
  planning: 'Planning', booked: 'Booked', closed: 'Closed'
};

/* Travel windows are stored normalised (see db/migrations/002-hub.sql) so that
   sorting by urgency is sorting by a known value rather than by a string a
   consumer happened to pick. */
const WINDOW_LABEL = {
  '30d': 'Within 30 days', '31-90d': '1–3 months', '3-6mo': '3–6 months',
  '6-12mo': '6–12 months', '12mo+': 'Over a year', exploring: 'Exploring'
};
const WINDOW_ORDER = { '30d': 0, '31-90d': 1, '3-6mo': 2, '6-12mo': 3, '12mo+': 4, exploring: 5 };

function since(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return days + ' days ago';
  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : months + ' months ago';
}

module.exports = {
  hubPage, esc, pageHead, emptyState,
  STAGES, STAGE_LABEL, WINDOW_LABEL, WINDOW_ORDER, since
};
