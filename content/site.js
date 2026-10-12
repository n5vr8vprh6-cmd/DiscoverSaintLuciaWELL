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

  /* Channels, shown as icons under the footer tagline (standard consumer footer only).
     `label` is the accessible name. The LinkedIn link is a Showcase Page. The
     WhatsApp number is +1 (647) 874-5565, in wa.me form (digits only). */
  social: [
    { key: 'instagram', label: 'Discover Saint Lucia WELL on Instagram', href: 'https://www.instagram.com/discoversaintluciawell/' },
    { key: 'facebook',  label: 'Discover Saint Lucia WELL on Facebook',  href: 'https://www.facebook.com/discoversaintluciawell' },
    { key: 'linkedin',  label: 'Discover Saint Lucia WELL on LinkedIn',  href: 'https://www.linkedin.com/showcase/discoversaintluciawell' },
    { key: 'whatsapp',  label: 'Message Discover Saint Lucia WELL on WhatsApp', href: 'https://wa.me/16478745565' }
  ],

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
        { label: 'Travel Advisor Hub',          href: '/advisors/hub' },
        { label: 'Complimentary Briefing',      href: '/advisors/intro' },
        { label: 'Well Destination Foundations',href: '/advisors/foundations' },
        { label: 'WELL Group Studio',           href: '/advisors/groups' },
        { label: 'Saint Lucia WELL Immersion',  href: '/advisors/immersion' }
      ]
    },
    {
      /* TWO GROUPS, ONE COLUMN — decided 2026-09-29. Retreat Leaders
         sits directly above About in the fourth column rather
         than earning a fifth: the footer grid was drawn for the brand block plus
         four, and a fifth narrows every column for a link pair. See `groups` in
         lib/layouts.js globalFooter().

         FOOTER ONLY. /practitioners is deliberately not in `nav` above: the
         header a holidaymaker reads stays consumer, the same rule that keeps
         "For Travel Advisors" the only professional item in it. Both links go to
         the same page; the anchors are the two pathways. */
      groups: [
        {
          title: 'Retreat Leaders',
          links: [
            { label: 'Build a Retreat',               href: '/practitioners' },
            { label: 'Visiting Practitioners', href: '/practitioners#network' }
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
      ]
    }
  ],

  /* Utility row. Sweepstakes Rules appears ONLY while a campaign is active
     (brief §4) — it stays out of the array until there is one. */
  utility: [
    { label: 'Privacy',       href: '/privacy' },
    { label: 'Terms',         href: '/terms' },
    { label: 'Accessibility', href: '/accessibility' },
    /* Two Hub routes exist in this footer and they do different jobs. The
       "Travel Advisor Hub" entry in the Travel Advisors column above explains
       what it is, for someone deciding. This one is for someone who has already
       decided and just wants the sign-in screen, which is why it stays in the
       utility row and says "sign in" rather than naming the product.

       Neither is in the primary consumer nav. V2 §3 asks for an account
       affordance; V1.2 §12 and this repo's standing decision keep professional
       surfaces out of the nav a holidaymaker reads. */
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

  /* ── PAID CHECKOUTS — the single switch ─────────────────────────────────
     Each product has a URL and a `verified` flag, and a paid button renders
     as a live link ONLY when its flag is true. Until then the same place reads
     "Enrollment opening soon" and routes to the free briefing: tuition and
     format stay visible, nobody is sent to a page that cannot take payment.

     STATUS, checked 2026-10-12 against the live pages and ThriveCart's own page
     data (not against anyone's description of them):

       online  — VERIFIED. HTTP 200, no test-mode banner rendered, price 697.00,
                 and the VIP order bump is 800.00: all agree with this site.
       island  — VERIFIED. Same checks. Titled "On-site Deposit" and priced
                 300.00, which is what this site says. It was first found priced
                 50.00 and was repriced the same day.

     TWO THINGS TO KNOW ABOUT WHAT THESE CHECKS CAN AND CANNOT SEE
       · The VIP bump is NOT pre-ticked: its summary row starts hidden and the
         default-selected setting is false, so "VIP is chosen at checkout" on
         this site is accurate.
       · ThriveCart's pages carry template strings that a buyer never sees: a
         CSS-hidden column ("Enter your bullet points here.") and a default
         bump ("Special one-time offer, only $19!") that live in markup and
         config. Text extracted from the HTML is not what is on screen. Judge
         by a rendered page.

     There are still no cohort dates for Foundations Saint Lucia. The card says
     dates are set with the destination before places open, so the page is
     honest about it, but the deposit can now be paid before any date exists.

     The rule when flipping: fix the product in ThriveCart, open the URL
     yourself in a private window, confirm the price on the page is the price
     this site states, then flip the flag and deploy. Never flip it on the
     strength of this comment. */
  checkout: {
    online: { url: 'https://shop.theburnoutclinic.com/discover-saint-lucia-well-foundations/',          verified: true  },
    island: { url: 'https://shop.theburnoutclinic.com/discover-saint-lucia-well-foundations-deposit/',  verified: true  }
  },

  /* ── WELL GROUP STUDIO INTAKE ───────────────────────────────────────────
     Off, the /advisors/groups page shows an honest "applications open
     shortly" panel and renders NO form — a form that cannot store what it
     collects is worse than none. Turn it on only after
     db/migrations/029-advisor-group-applications.sql has been run in the
     Supabase SQL editor; api/_lib/group-studio.js fails closed ("unavailable")
     without the table, but the page should not invite the attempt. */
  groupStudio: { intakeOpen: false },

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

  /* ── TEMPORARILY HIDDEN, 2026-08-27 ─────────────────────────────────────
     Approvals are still in progress with both organisations. Until they
     land, the site names neither. This is a hold, not a retraction: put the
     array below back and every page that renders it returns, unchanged.

     credibility() in lib/components.js renders nothing for an empty list, so
     the whole section disappears from home, about and advisors rather than
     leaving a labelled empty box. The about page's properties footnote is
     inside that section and goes with it for now. */
  // partners: ['Saint Lucia Tourism Authority', 'Wellness Tourism Association']
  partners: []
};

module.exports = SITE;
