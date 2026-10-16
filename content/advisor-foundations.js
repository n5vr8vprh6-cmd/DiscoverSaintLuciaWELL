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

const SITE = require('./site.js');

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
/* -- PAID-CHECKOUT GATE ------------------------------------------------------
   index.src.html carries tokens instead of checkout links:

     {{cta:KEY|CLASS|LABEL}}   one button   (KEY: online | island | vip)
     {{ctarow}} / {{ctanotes}} the final-CTA pair and the two lines under it

   Each renders as a live link ONLY when SITE.checkout[product].verified is
   true. Otherwise the same spot offers the free briefing and says plainly that
   enrollment is not open yet. Why this exists and how to flip it: content/site.js.

   `vip` has no product of its own: the bump lives inside the Online cart, so it
   follows `online`. Pending buttons carry data-cta="enrollment-pending" and
   data-offer so demand is measurable without recording a purchase that has not
   happened (js/analytics.js). */
const BRIEFING = '/advisors/intro';
const productFor = (key) => (key === 'vip' ? 'online' : key);
const isLive = (key) => {
  const p = SITE.checkout[productFor(key)];
  return Boolean(p && p.verified === true);
};

function liveButton(key, cls, label) {
  const url = SITE.checkout[productFor(key)].url;
  return `<a class="btn ${cls}" data-cta="${key}" href="${url}" target="_blank" rel="noopener">${label}</a>`;
}
function pendingButton(key, cls) {
  /* The VIP button sits in a row beside a second button, and the full sentence
     does not fit it at tablet width. The VIP block already says VIP is chosen
     at checkout, so "enrollment opening soon" is carried by the cards above it. */
  const label = key === 'vip' ? 'Join the free briefing' : 'Enrollment opening soon · Join the free briefing';
  return `<a class="btn ${cls}" data-cta="enrollment-pending" data-offer="${key}" href="${BRIEFING}">${label}</a>`;
}
function button(key, cls, label) {
  return isLive(key) ? liveButton(key, cls, label) : pendingButton(key, cls);
}

/* The final-CTA pair. When BOTH are pending the pair would be two buttons to
   the same page, so it collapses to one; when only one is pending the live
   product keeps its button and the other becomes a briefing link that names
   the offer, so nobody is left guessing what is and is not open. */
function ctaRow() {
  const o = isLive('online'), i = isLive('island');
  const GAP = '\n        ';
  if (o && i) {
    return liveButton('online', 'btn--gold', 'Enroll · Online · $697') + GAP +
      liveButton('island', 'btn--ghost', 'Reserve · Saint Lucia · $300');
  }
  if (!o && !i) {
    return `<a class="btn btn--gold" data-cta="enrollment-pending" data-offer="both" href="${BRIEFING}">Join the free briefing</a>`;
  }
  return o
    ? liveButton('online', 'btn--gold', 'Enroll · Online · $697') + GAP +
      `<a class="btn btn--ghost" data-cta="enrollment-pending" data-offer="island" href="${BRIEFING}">Saint Lucia · $300 to reserve · opening soon</a>`
    : `<a class="btn btn--gold" data-cta="enrollment-pending" data-offer="online" href="${BRIEFING}">Online · $697 · opening soon</a>` + GAP +
      liveButton('island', 'btn--ghost', 'Reserve · Saint Lucia · $300');
}
/* The two lines under the final-CTA row. They must describe the row they sit
   under: "enrollment is opening soon" directly beneath a live Enroll button is
   a sentence arguing with its own button, which is what the mixed states did
   before this was split four ways. Each branch says only what is true of it. */
function ctaNotes() {
  const o = isLive('online'), i = isLive('island');
  const GAP = '\n      ';
  const refund = 'Attend day one, and if it isn’t what you expected, tell us before day two for a full refund.';
  const note = (t) => `<p class="cta-buy-note">${t}</p>`;

  if (o && i) {
    return note('Secure checkout · ' + refund[0].toLowerCase() + refund.slice(1)) + GAP +
           note('Adding VIP support? Choose it at checkout, either format · +$800.');
  }
  if (o) {
    return note('Secure checkout · ' + refund[0].toLowerCase() + refund.slice(1)) + GAP +
           note('Adding VIP support? Choose it at checkout · +$800. Foundations Saint Lucia opens for reservations soon; the free briefing is the best way to hear about it.');
  }
  if (i) {
    return note('Foundations Online opens for enrollment soon; the free briefing is the best place to start.') + GAP +
           note('Reserve your Saint Lucia place with a $300 deposit. VIP is +$800, chosen at checkout.');
  }
  return note('Enrollment is opening soon. Foundations Online is $697 and Foundations Saint Lucia is $300 to reserve; the free briefing is the best place to start.') + GAP +
         note(refund + ' VIP is +$800 on either format, chosen at checkout.');
}

/* The hero's one primary action. It always goes to the format choice — there
   are two formats, so a button straight to one checkout would pick for the
   reader — and its label says what is true: "Enroll" only once something can
   actually be enrolled in. */
const heroEnroll = () =>
  `<a class="btn btn--gold" href="#invest">${isLive('online') || isLive('island') ? 'Enroll in Foundations' : 'See formats and pricing'}</a>`;

let gated = extractMain(src) + '\n\n' + extractDialog(src);
gated = gated
  .replace(/\{\{cta:(online|island|vip)\|([^|}]+)\|([^}]+)\}\}/g, (_m, key, cls, label) => button(key, cls.trim(), label.trim()))
  .replace('{{heroenroll}}', heroEnroll)
  .replace('{{ctarow}}', ctaRow)
  .replace('{{ctanotes}}', ctaNotes);

/* A token that survives is a button that renders as literal braces. Fail the
   build, the same way a surviving relative asset path does below. */
const strayToken = gated.match(/\{\{[^}]*\}\}/);
if (strayToken) {
  throw new Error('advisor-foundations: checkout token was not rendered: ' + strayToken[0]);
}

const body = absolutise(gated);

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

/* ── STRUCTURED DATA THAT MUST MATCH THE PAGE ────────────────────────────────
   Search engines and AI answer engines read this block alongside the visible
   page, and markup that says something the page does not is worse than none.
   So neither piece below is retyped:

     · FAQPage is parsed OUT of the FAQ section in index.src.html, question and
       answer, so it cannot drift from the 12 <details> a visitor sees. The
       build fails if the count differs, i.e. if the section's markup changes
       shape and the parse silently stops matching.
     · The two instructors are named from the facilitators section; the guard
       below fails the build if either stops appearing on the page. Roles are
       the ones printed there, nothing more.

   (Google no longer shows FAQ rich results for most sites; the value of the
   markup is that a crawler or assistant gets each question and its answer as a
   clean pair.) */
const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const plain = (html) => decode(html.replace(/<\/p>\s*<p[^>]*>/g, ' ').replace(/<[^>]+>/g, ''))
  .replace(/\s+/g, ' ').trim();

function faqEntities(html) {
  const section = (html.match(/<section[^>]*id="faq"[\s\S]*?<\/section>/) || [])[0] || '';
  const found = [...section.matchAll(
    /<details>\s*<summary>([\s\S]*?)<\/summary>\s*<div class="answer">([\s\S]*?)<\/div>\s*<\/details>/g
  )].map((m) => ({
    '@type': 'Question',
    name: plain(m[1]),
    acceptedAnswer: { '@type': 'Answer', text: plain(m[2]) }
  }));
  const onPage = (section.match(/<details>/g) || []).length;
  if (!found.length || found.length !== onPage) {
    throw new Error(`advisor-foundations: FAQ markup parse found ${found.length} of ${onPage} questions — the section's shape changed`);
  }
  return found;
}

for (const must of ['<h3>Duncan So</h3>', '<p class="role">Lead facilitator</p>',
                    '<h3>Diana St. Hill</h3>', '<p class="affil">Program Director, Discover Saint Lucia WELL</p>']) {
  if (!src.includes(must)) {
    throw new Error(`advisor-foundations: instructor markup no longer on the page (${must}); update the Person schema to match`);
  }
}

module.exports = {
  key: 'advisor-foundations',
  path: '/advisors/foundations',
  layout: 'conversion',
  surface: 'advisor',
  title: 'Well Destination Foundations | Discover Saint Lucia WELL',
  description: 'Build your first market-ready WELL Journey and launch your 30-day campaign: three live days of Well Destination Foundations for travel advisors. From $697 online.',
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
    '/js/consent.js',
    '/js/analytics.js',
    '/advisors/foundations/js/site.js',
    '/advisors/foundations/js/motion.js',
    '/advisors/foundations/js/atmosphere.js',
    '/advisors/foundations/js/hero-video.js',
    '/advisors/foundations/js/experience.js',
    '/advisors/foundations/js/exit-intent.js'
  ],

  jsonLd: [{
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: 'Well Destination Foundations',
    url: SITE.domain + '/advisors/foundations',
    description: 'A three-day live virtual intensive training travel advisors to design transformational wellness journeys, and the prerequisite for the Saint Lucia WELL Immersion.',
    provider: {
      '@type': 'Organization',
      '@id': SITE.domain + '/#organization',
      name: 'Discover Saint Lucia WELL',
      url: SITE.domain
    },
    offers: Object.assign({
      '@type': 'Offer',
      price: '697',
      priceCurrency: 'USD',
      category: 'Professional Education'
    }, isLive('online') ? { url: SITE.checkout.online.url } : {}),
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: 'P3D',
      instructor: [
        { '@type': 'Person', name: 'Duncan So', jobTitle: 'Lead facilitator',
          affiliation: { '@type': 'Organization', name: 'Burnout Concierge' } },
        { '@type': 'Person', name: 'Diana St. Hill', jobTitle: 'Program Director',
          worksFor: { '@type': 'Organization', name: 'Discover Saint Lucia WELL' } }
      ]
    }
  }, {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEntities(src)
  }],

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
          { label: 'Who teaches it',        href: '#facilitators' },
          { label: 'FAQ',                    href: '#faq' },
          { label: 'Complimentary briefing', href: '/advisors/intro' }
        ]
      }
    ]
  },

  rawBody: body
};
