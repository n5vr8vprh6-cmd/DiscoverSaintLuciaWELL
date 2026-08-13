/* ============================================================================
   SITE-WIDE CONFIGURATION — navigation, footer, brand constants
   ----------------------------------------------------------------------------
   Data only. Rendering lives in lib/layouts.js.

   V4 brief §3 and §4 fix the V1 navigation and footer. Two rules are load-
   bearing and must not be "improved" without a decision:

     1. No Journeys dropdown. A menu containing one real journey plus several
        2027 concepts weakens credibility. Eclipse gets a direct nav item.
     2. No undeveloped journey families or WELL Pass in navigation.

   Privacy, Terms and Accessibility are real pages as of 2026-08-12 and are
   linked normally. They previously carried `pending: true`, which renders an
   entry as plain text rather than a link — the mechanism still exists in
   lib/layouts.js `linkOrText()` and is the right way to list something that
   does not exist yet. We do not ship 404s, and we did not invent a policy
   before there was one to describe.
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
    { label: 'Privacy',       href: '/privacy' },
    { label: 'Terms',         href: '/terms' },
    { label: 'Accessibility', href: '/accessibility' },
    /* The ONLY route to the Hub from a consumer page, and deliberately down
       here. V2 §3 asks for an account affordance; V1.2 §12 and this repo's
       standing decision keep the professional surfaces out of the consumer
       nav. A utility link satisfies both: an advisor who is looking will find
       it, and a holidaymaker never has to wonder what it is. */
    { label: 'Advisor sign in', href: '/hub' }
  ],

  /* ── Advisor-surface chrome ─────────────────────────────────────────────
     Conversion-layout pages replace the global footer with this restrained
     product footer (brief §8). Foundations overrides `program` with its own. */
  advisorFooter: {
    /* Renamed. "Travel Advisor Hub" now means the authenticated workspace at
       /hub; leaving that label on a link to the public gateway would send an
       advisor looking for their Journeys to a marketing page. */
    exit: { label: 'Back to advisor overview', href: '/advisors' },
    utility: [
      { label: 'Discover Saint Lucia WELL', href: '/' },
      { label: 'Advisor Hub', href: '/hub' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms',   href: '/terms' },
      { label: 'Contact', href: '/about#contact' }
    ]
  },

  /* The complimentary advisor briefing. One canonical URL, used by the
     advisor gateway, the intro page and the Foundations page alike. */
  briefingUrl: 'https://luma.com/s9th4gfr',

  /* Institutional partners. Limited to relationships already stated publicly
     on the Foundations page — nothing added without confirmation.

     THE LABEL IS A CLAIM, AND IT IS DELIBERATELY WEAK.
     This read "In collaboration with" on three pages. That wording was
     inherited from the Foundations page, where it describes an advisor
     training relationship — but on a consumer destination site, over two
     named institutions, it reads as a formal endorsement of this product.
     Neither organisation has approved that representation. "In conversation
     with" is what is actually true: the relationships exist, and nothing is
     being claimed about joint delivery or endorsement.

     Kept here as one token rather than typed into each page, so if either
     relationship is formalised in writing the word changes in exactly one
     place. Strengthening it is a factual claim — only on Duncan's word.
     The categories stay clean: research inclusion ≠ participation ≠
     partnership ≠ endorsement. */
  partnersLabel: 'In conversation with',
  partners: ['Saint Lucia Tourism Authority', 'Wellness Tourism Association']
};

module.exports = SITE;
