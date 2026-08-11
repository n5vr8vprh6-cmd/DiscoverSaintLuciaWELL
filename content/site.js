/* ============================================================================
   SITE-WIDE CONFIGURATION — navigation, footer, brand constants
   ----------------------------------------------------------------------------
   Data only. Rendering lives in lib/layouts.js.

   V4 brief §3 and §4 fix the V1 navigation and footer. Two rules are load-
   bearing and must not be "improved" without a decision:

     1. No Journeys dropdown. A menu containing one real journey plus several
        2027 concepts weakens credibility. Eclipse gets a direct nav item.
     2. No undeveloped journey families or WELL Pass in navigation.

   Footer entries carrying `pending: true` render as plain text, not links —
   the page does not exist yet and we do not ship 404s or invent a policy.
   ========================================================================== */
'use strict';

const SITE = {
  name: 'Discover Saint Lucia WELL',
  domain: 'https://discoversaintluciawell.com',
  tagline: 'Wellbeing, designed by the island.',
  coords: '13°54′N  60°58′W',
  year: 2026,

  /* The single global consumer CTA. Referenced everywhere rather than retyped
     so it cannot drift into three slightly different phrasings. */
  primaryCta: { label: 'Find My WELL Journey', href: '/journey' },

  /* ── Global navigation (V1) ─────────────────────────────────────────── */
  nav: [
    { label: 'Explore',           href: '/explore'  },
    { label: 'Eclipse',           href: '/eclipse'  },
    { label: 'About',             href: '/about'    },
    { label: 'For Travel Advisors', href: '/advisors' }
  ],

  /* ── Global footer (V1) — brief §4 ──────────────────────────────────── */
  footer: [
    {
      title: 'Discover',
      links: [
        { label: 'Explore Saint Lucia WELL', href: '/explore' },
        { label: 'Wellness Villages',        href: '/explore#villages' },
        { label: 'Places & Experiences',     href: '/explore#experiences' },
        { label: 'Find My WELL Journey',     href: '/journey' }
      ]
    },
    {
      title: 'Signature Journey',
      links: [
        { label: 'Eclipse',                href: '/eclipse' },
        { label: 'The Eclipse Experience', href: '/eclipse#experiences' },
        { label: 'How Eclipse Works',      href: '/eclipse#arc' }
      ]
    },
    {
      title: 'Travel Advisors',
      links: [
        { label: 'Advisor Overview',            href: '/advisors' },
        { label: 'Complimentary Briefing',      href: '/advisors/intro' },
        { label: 'Well Destination Foundations',href: '/advisors/foundations' },
        { label: 'Saint Lucia WELL Immersion',  href: '/advisors/immersion' }
      ]
    },
    {
      title: 'About',
      links: [
        { label: 'Why Saint Lucia WELL', href: '/about#why-saint-lucia' },
        { label: 'Our Approach',         href: '/about#approach' },
        { label: 'Partners',             href: '/about#partners' },
        { label: 'Contact',              href: '/about#contact' }
      ]
    }
  ],

  /* Utility row. Sweepstakes Rules appears ONLY while a campaign is active
     (brief §4) — it stays out of the array until there is one. */
  utility: [
    { label: 'Privacy',       href: '/privacy',       pending: true },
    { label: 'Terms',         href: '/terms',         pending: true },
    { label: 'Accessibility', href: '/accessibility', pending: true }
  ],

  /* ── Advisor-surface chrome ─────────────────────────────────────────────
     Conversion-layout pages replace the global footer with this restrained
     product footer (brief §8). Foundations overrides `program` with its own. */
  advisorFooter: {
    exit: { label: 'Back to Travel Advisor Hub', href: '/advisors' },
    utility: [
      { label: 'Discover Saint Lucia WELL', href: '/' },
      { label: 'Privacy', href: '/privacy', pending: true },
      { label: 'Terms',   href: '/terms',   pending: true },
      { label: 'Contact', href: '/about#contact' }
    ]
  },

  /* The complimentary advisor briefing. One canonical URL, used by the
     advisor gateway, the intro page and the Foundations page alike. */
  briefingUrl: 'https://luma.com/s9th4gfr',

  /* Institutional partners. Limited to relationships already stated publicly
     on the Foundations page — nothing added without confirmation. */
  partners: ['Saint Lucia Tourism Authority', 'Wellness Tourism Association']
};

module.exports = SITE;
