/* ============================================================================
   /advisors/foundations — WELL DESTINATION FOUNDATIONS
   ----------------------------------------------------------------------------
   The existing Foundations page, re-homed inside the advisor hierarchy.

   WHAT MOVED AND WHAT DID NOT
   The page body is taken verbatim from `advisors/foundations/index.src.html`
   (everything between <main> and </main>). Its CSS, its GSAP/Lenis scroll
   choreography, the hero cinemagraph ladder and the three-tier motion mode
   ladder are all preserved untouched — that page is heavily tuned and the
   brief asks for it to be preserved, not rebuilt.

   What changed is only the chrome and the addresses:
     · header  → ConversionHeader (brand lockup, sticky local anchors, Enroll)
     · footer  → ConversionFooter (Program · Resources · Exit · utility)
     · tokens  → now inherited from /css/tokens.css instead of its own :root
     · URLs    → canonical, OG and JSON-LD move to discoversaintluciawell.com

   Brief §8 is explicit and load-bearing here: Explore, Eclipse, About and Find
   My WELL Journey must NOT appear in this page's header. The brand mark links
   quietly home but must not compete with Enroll. The build enforces the
   chrome; this comment explains why nobody should "helpfully" restore the nav.

   `scripts: false` — this page brings its own script stack (analytics, site,
   motion, atmosphere, hero-video, experience, exit-intent) and must not also
   receive the consumer site's. Loading both would run two motion systems.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'advisors', 'foundations', 'index.src.html');

function extractMain(html) {
  const m = html.match(/<main id="main">([\s\S]*?)<\/main>/);
  if (!m) throw new Error('advisor-foundations: could not find <main> in index.src.html');
  return m[1];
}

/* The exit-intent dialog lives outside <main> in the source but is part of the
   page's behaviour, so it travels with the body rather than being dropped. */
function extractDialog(html) {
  const m = html.match(/<dialog class="exit-modal"[\s\S]*?<\/dialog>/);
  return m ? m[0] : '';
}

/* Make the standalone page's relative asset paths absolute.

   index.src.html was authored as its own site, sitting at a directory root,
   so it refers to `assets/hero-pitons.jpg` and friends relatively. Here the
   page is served at /advisors/foundations — with NO trailing slash, because
   vercel.json sets `trailingSlash: false` to match the canonical tags. A
   browser resolves a relative path against the parent of a slashless URL, so
   every one of those 38 references was resolving to /advisors/assets/… and
   404ing. Every image and both cinemagraphs were missing on the live page.

   Rewriting here rather than in the source keeps index.src.html working as a
   standalone document, and rather than in vercel.json because turning
   trailing slashes back on would break the canonical URLs on all nine pages
   to fix one.

   `poster` is in this list for a reason: it is easy to forget because it is the
   only asset-bearing attribute here that is not src/href/srcset, and the four
   cinemagraph posters were still 404ing after the first pass at this fix. If a
   new asset attribute ever appears in the source, add it here — the guard below
   is what catches the omission. */
const BASE = '/advisors/foundations/';
function absolutise(html) {
  return html.replace(
    /\b(src|href|srcset|poster)="(?!\/|https?:|data:|mailto:|#)((?:assets|css|js)\/)/g,
    (_m, attr, dir) => `${attr}="${BASE}${dir}`
  ).replace(
    /\bsrcset="([^"]+)"/g,
    (m, set) => `srcset="${set.replace(/(^|,\s*)((?:assets|css|js)\/)/g, `$1${BASE}$2`)}"`
  );
}

const src = fs.readFileSync(SRC, 'utf8');
const body = absolutise(extractMain(src) + '\n\n' + extractDialog(src));

/* Nothing relative may survive. A missed attribute does not throw and does not
   look wrong in the markup — it 404s silently in the browser, which is how the
   four cinemagraph posters shipped broken. Fail the build instead. */
const leaked = [...body.matchAll(/\b([a-z-]+)="((?:assets|css|js)\/[^"]*)"/g)];
if (leaked.length) {
  throw new Error(
    'advisor-foundations: relative asset path survived absolutise() — add the ' +
    `attribute to its regex:\n  ${leaked.map(m => `${m[1]}="${m[2]}"`).join('\n  ')}`
  );
}

/* Local anchors — these are the section ids that actually exist in the source.
   Verified against it at build time below, so a renamed section fails the build
   rather than shipping a dead in-page link. */
const ANCHORS = [
  { label: 'Opportunity', href: '#why-wellness-travel' },
  { label: 'Program',     href: '#program' },
  { label: 'Curriculum',  href: '#curriculum' },
  { label: 'Investment',  href: '#invest' },
  { label: 'FAQ',         href: '#faq' },
  { label: 'Enroll',      href: '#invest' }
];

for (const a of ANCHORS) {
  const id = a.href.slice(1);
  if (!src.includes(`id="${id}"`)) {
    throw new Error(`advisor-foundations: local anchor #${id} has no matching section in index.src.html`);
  }
}

module.exports = {
  key: 'advisor-foundations',
  path: '/advisors/foundations',
  layout: 'conversion',
  surface: 'advisor',
  title: 'Well Destination Foundations — Discover Saint Lucia WELL',
  description: 'A three-day live intensive that trains experienced travel advisors to design transformational wellness journeys, beginning with Saint Lucia, the Caribbean’s first Well Destination.',
  ogTitle: 'Well Destination Foundations',
  ogImage: '/advisors/foundations/assets/hero-pitons.jpg',

  /* This page owns its whole script stack. */
  scripts: false,
  styles: ['/advisors/foundations/css/site.css'],
  js: [
    'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js',
    'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js',
    'https://cdn.jsdelivr.net/npm/lenis@1.3.4/dist/lenis.min.js',
    '/js/attribution.js',
    '/js/analytics.js',
    '/advisors/foundations/js/site.js',
    '/advisors/foundations/js/motion.js',
    '/advisors/foundations/js/atmosphere.js',
    '/advisors/foundations/js/hero-video.js',
    '/advisors/foundations/js/experience.js',
    '/advisors/foundations/js/exit-intent.js'
  ],

  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: 'Well Destination Foundations',
    description: 'A three-day live virtual intensive training travel advisors to design transformational wellness journeys, and the prerequisite for the Saint Lucia WELL Immersion.',
    provider: {
      '@type': 'Organization',
      name: 'Discover Saint Lucia WELL',
      url: 'https://discoversaintluciawell.com'
    },
    offers: {
      '@type': 'Offer',
      price: '697',
      priceCurrency: 'USD',
      category: 'Professional Education'
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: 'P3D'
    }
  },

  conversion: {
    context: 'Professional Education',
    title: 'Well Destination Foundations',
    anchors: ANCHORS.slice(0, 5),
    cta: { label: 'Enroll', href: '#invest' },
    footerCols: [
      {
        title: 'Program',
        links: [
          { label: 'Overview',            href: '#program' },
          { label: 'Curriculum',          href: '#curriculum' },
          { label: 'Investment',          href: '#invest' },
          { label: 'Application pathway', href: '#pathway' }
        ]
      },
      {
        title: 'Resources',
        links: [
          { label: 'Faculty',                href: '#facilitators' },
          { label: 'FAQ',                    href: '#faq' },
          { label: 'Complimentary briefing', href: '/advisors/intro' }
        ]
      }
    ]
  },

  rawBody: body
};
