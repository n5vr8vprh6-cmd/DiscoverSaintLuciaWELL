/* ============================================================================
   DOCUMENT ASSEMBLY — <head>, metadata, structured data, script manifest
   ----------------------------------------------------------------------------
   Wraps a page's rendered sections in the full HTML document, with the chrome
   its declared layout calls for.

   Script loading follows the ladder proven on the Foundations page: everything
   deferred, nothing render-blocking, and the page fully readable with all of it
   disabled. The GSAP/Lenis trio loads from CDN and degrades to an
   IntersectionObserver reveal path if any of it fails.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SITE = require('../content/site.js');
const { chrome } = require('./layouts.js');
const { esc } = require('./brand.js');

/* ── Asset versioning ─────────────────────────────────────────────────────
   Every local css/js URL carries ?v=<hash of that file's contents>. Two
   problems, one fix:

     · In development the preview pane caches css/ and js/ even when the HTML
       URL is cache-busted, so an edit appears not to have landed.
     · In production a returning visitor holds a stale stylesheet until they
       hard-refresh — which we should never have to ask them to do.

   Content-hashed, so the URL only changes when the file actually changes and
   a far-future cache header stays safe to set on the directory. */
const hashCache = new Map();
function v(url) {
  if (!url.startsWith('/')) return url;
  if (!hashCache.has(url)) {
    const file = path.join(__dirname, '..', url.replace(/^\//, ''));
    let h = '0';
    try {
      h = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
    } catch (e) { /* not built yet, or an external asset — degrade quietly */ }
    hashCache.set(url, h);
  }
  return url + '?v=' + hashCache.get(url);
}

/* The typefaces are self-hosted and declared in css/tokens.css, which every
   page already loads — so there is nothing to link here, and no third party to
   preconnect to. See the @font-face header in that file for why. */

/* Consumer pages get the full motion stack; conversion pages that carry their
   own stack (Foundations) opt out via `page.scripts === false`. */
const CDN = [
  'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js',
  'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js',
  'https://cdn.jsdelivr.net/npm/lenis@1.3.4/dist/lenis.min.js'
];

/* Order matters: attribution must resolve BEFORE analytics, because
   analytics.js fires `page_view` at parse time and reads window.dslwAttribution
   to stamp the advisor referral onto it. Loaded the other way round, every
   pageview ships without its attribution and the funnel cannot be joined. */
const LOCAL = [
  '/js/attribution.js',
  '/js/analytics.js',
  '/js/site.js',
  '/js/motion.js',
  '/js/ambient-video.js'
];

function jsonLd(page) {
  const blocks = [];

  /* Organization + the destination itself, on the homepage only, so the graph
     has exactly one authoritative declaration rather than nine competing ones. */
  if (page.path === '/') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE.name,
      url: SITE.domain,
      description: SITE.tagline,
      areaServed: { '@type': 'Place', name: 'Saint Lucia' }
    });
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'TouristDestination',
      name: 'Saint Lucia',
      description: 'A Well Destination — wellbeing organized across villages, experiences and places.',
      geo: { '@type': 'GeoCoordinates', latitude: 13.9, longitude: -60.97 }
    });
  }

  if (page.jsonLd) blocks.push(...[].concat(page.jsonLd));

  return blocks.map((b) =>
    `<script type="application/ld+json">\n${JSON.stringify(b, null, 2)}\n</script>`
  ).join('\n');
}

function render(page, body) {
  const { header, footer } = chrome(page);
  const url = SITE.domain + (page.path === '/' ? '/' : page.path);
  const ogImage = SITE.domain + (page.ogImage || '/assets/og-default.jpg');
  const useScripts = page.scripts !== false;

  /* tokens + chrome go on every page. The consumer component sheet does NOT:
     a page that brings its own page styles (Foundations) must not also receive
     ours, or our component rules bleed onto its carefully tuned sections. */
  const base = page.styles && page.styles.length
    ? ['/css/tokens.css', '/css/chrome.css']
    : ['/css/tokens.css', '/css/chrome.css', '/css/site.css'];

  const styles = base
    .concat(page.styles || [])
    .map((h) => `<link rel="stylesheet" href="${v(h)}">`).join('\n');

  const scripts = useScripts
    ? CDN.map((s) => `<script src="${s}" defer></script>`)
        .concat(LOCAL.concat(page.js || []).map((s) => `<script src="${v(s)}" defer></script>`))
        .join('\n')
    : (page.js || []).map((s) => `<script src="${v(s)}" defer></script>`).join('\n');

  /* ── App shell stamp ──────────────────────────────────────────────────────
     A page declaring `appShell: true` is promoted from a document into an
     application by CSS keyed on html[data-finder="app"].

     THIS HAS TO BE INLINE, AND IT HAS TO BE HERE.
     Every other script on the site is `defer`red, which means it runs after the
     document has parsed and painted. Doing the promotion there would show the
     full website — header, nav, footer, the lot — and then vanish it a frame
     later. A flash of the thing you are claiming the visitor has left is worse
     than never leaving it. This runs before first paint, so the chrome is gone
     from the very first frame.

     It is also why the promotion is a stamp and not a rewrite: the server still
     sends the complete, navigable page, so a visitor without JavaScript gets
     the full explainer rather than a chrome-less dead end. `data-finder` is set
     only when scripting is available, by definition.

     Safe as inline script because no Content-Security-Policy is set (see
     vercel.json). If a CSP is ever added, this needs a hash or nonce — and the
     symptom of forgetting will be the flash, not an error. */
  const appShell = page.appShell
    ? '\n<script>document.documentElement.setAttribute("data-finder","app")</script>'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>${appShell}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${esc(url)}">
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
${page.noindex ? '<meta name="robots" content="noindex,follow">\n' : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:title" content="${esc(page.ogTitle || page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta name="twitter:card" content="summary_large_image">

${styles}
${jsonLd(page)}
</head>
<body data-page="${esc(page.key || page.path)}" data-surface="${esc(page.surface || 'consumer')}">
<a class="skip-link" href="#main">Skip to content</a>

${header}

<main id="main">
${body}
</main>

${footer}

${scripts}
</body>
</html>
`;
}

module.exports = { render };
