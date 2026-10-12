/* ============================================================================
   /advisors/intro — THE COMPLIMENTARY BRIEFING
   ----------------------------------------------------------------------------
   CONVERSION layout. One action: register for the briefing.

   Brief §8's rule applies here as much as to Foundations — Explore, Eclipse,
   About and Find My WELL Journey must not appear in the header. The brand mark
   links quietly home; nothing else competes with the single CTA.

   Registration is handled by Luma, which is a real, live URL. Everything on
   this page describes what the briefing covers; nothing promises an outcome or
   a date we cannot evidence.

   REPOSITIONED 2026-10-12 (DSW_Claude_Code_Website_Implementation_Brief §3.3)
   This page used to open with "Find out whether this specialty is for you" and
   spend most of its length on education structures. The reader it now has is a
   cold-outbound advisor who has not yet been told what is in it for them, so
   it is an outcome demonstration instead: the opportunity, one worked example,
   what makes it deliverable, the group path, and how to work with DSW.

   THE WORKED EXAMPLE IS NOT NEW COPY. It is the matchflow on /advisors/
   foundations (client sentence → Compass reading → Villages), which Duncan has
   already approved, retold in the briefing's own five beats. It is labelled as
   illustrative and the traveller is invented, for the same reason the Hub's
   screenshot says "invented traveller, invented details".

   "BOOKABLE" is the brief's word and it is kept in the headline. The body
   copy then does the work of saying what it does and does not mean: supplier
   availability and rates are confirmed separately, and nothing here promises a
   booking.

   TWO SENTENCES THAT WERE REMOVED, on purpose. "Nothing automatic" and "There
   is no funnel that enrols you by default" defended against a suspicion the
   page had not yet raised, and made a free briefing sound like a trap to
   avoid. The honest replacement is the brief's: attend, explore the free tools,
   decide — with no enrolment requirement.

   The Luma event is described OUTSIDE this repository. Its title and
   description are not editable from here; the suggested replacements are in
   the implementation report for Duncan to paste.
   ========================================================================== */
'use strict';

const SITE = require('./site.js');
const { countWord } = require('./journey.js');

module.exports = {
  key: 'advisor-intro',
  path: '/advisors/intro',
  layout: 'conversion',
  surface: 'advisor',
  title: 'Complimentary live advisor briefing — Discover Saint Lucia WELL',
  description: 'A free 60-minute live briefing for working travel advisors: turn client wellness needs into personalized Saint Lucia WELL Journey proposals.',
  ogTitle: 'From client wellness needs to bookable Saint Lucia WELL Journeys',

  conversion: {
    context: 'Advisor Briefing',
    title: 'The Complimentary Briefing',
    anchors: [
      { label: 'The opportunity', href: '#opportunity' },
      { label: 'A worked example', href: '#example' },
      { label: 'What follows',    href: '#start' }
    ],
    cta: { label: 'Save my seat', href: SITE.briefingUrl },
    footerCols: [
      {
        title: 'The briefing',
        links: [
          { label: 'The opportunity',  href: '#opportunity' },
          { label: 'A worked example', href: '#example' },
          { label: 'Register',         href: SITE.briefingUrl }
        ]
      },
      {
        title: 'After the briefing',
        links: [
          { label: 'Free Travel Advisor Hub',       href: '/advisors/hub' },
          { label: 'Well Destination Foundations',  href: '/advisors/foundations' },
          { label: 'WELL Group Studio',             href: '/advisors/groups' }
        ]
      }
    ]
  },

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'Complimentary live advisor briefing',
      long: true,
      headline: 'From client wellness needs to bookable <em>Saint Lucia WELL Journeys.</em>',
      lead: 'Discover how to recognize the wellness opportunities already present in your client relationships, turn them into personalized Saint Lucia journey concepts, and have more compelling conversations and proposals.',
      meta: ['Free', 'Live online', '60 minutes', 'For working travel advisors'],
      actions: [
        { label: 'Save my seat', href: SITE.briefingUrl }
      ]
    },

    /* ── 1 · THE OPPORTUNITY ────────────────────────────────────────────── */
    {
      type: 'lens',
      id: 'opportunity',
      eyebrow: 'The opportunity',
      headline: 'It is already inside your client book.',
      lead: 'You do not need new clients to begin. You need a way to hear what the ones you have are already asking for.',
      items: [
        {
          title: 'Requests you struggle to name',
          text: 'Clients ask for rest, a reset, a way to reconnect long before they ask for a spa. The need is real. The vocabulary is what is missing.'
        },
        {
          title: 'More than a treatment menu',
          text: 'What a traveller wants from a trip is rarely an amenity. It is a feeling they want to bring home, which is harder to quote and far easier to remember.'
        },
        {
          title: 'A better conversation',
          text: 'Start from what they want to feel and the proposal stops being a comparison of room rates. It becomes a journey someone designed for them.'
        }
      ]
    },

    /* ── 2 · A WORKED EXAMPLE ───────────────────────────────────────────── */
    {
      type: 'pathway',
      id: 'example',
      skin: 'sand',
      eyebrow: 'A worked example',
      headline: 'One sentence, carried through to a proposal.',
      lead: 'An illustration, with an invented traveller. It is the shape of the method, not a client case.',
      steps: [
        {
          title: 'The traveller says',
          text: '“We need to come back rested, reconnected, and with healthier momentum.” Not a destination, not a hotel, not a treatment.'
        },
        {
          title: 'The Finder reads it',
          text: `${countWord[0].toUpperCase() + countWord.slice(1)} questions about how they want to feel. If they choose to share the result through your link, what they actually asked for arrives in your Hub.`
        },
        {
          title: 'You have the discovery call',
          text: 'You open with their own words rather than a blank intake form, and you know which questions are worth asking before you speak.'
        },
        {
          title: 'Compass and Villages fit',
          text: 'Restore, Reconnect, Return: three intentions, not a room category. They point to the Longevity, Ocean & Restoration and Love & Connection Villages.'
        },
        {
          title: 'A scoped proposal',
          text: 'A sequenced journey you can put in front of them: where, in what order, at what pace. Availability, inclusions and rates are confirmed separately before anything is sold.'
        }
      ]
    },

    /* ── 3 · WHAT MAKES IT DELIVERABLE ──────────────────────────────────── */
    {
      type: 'split',
      id: 'deliverable',
      skin: 'paper',
      eyebrow: 'What makes it deliverable',
      headline: 'A journey is only useful if it can be delivered.',
      body: [
        'Saint Lucia WELL organizes the island by what each place does for a traveller, and maps real properties and experiences to that structure, so a recommendation rests on something you can point to.',
        /* "mapped, not signed" is the site's standing position (see
           content/advisors.js and content/practitioners.js). This is where an
           advisor deciding whether to trust the page would look, so it says it. */
        'Properties and experiences are mapped, not contracted. Availability, inclusions and pricing are confirmed with the property or operator before a proposal is quoted, and clinical questions stay with qualified practitioners.'
      ],
      list: [
        'Six Villages and a continuum that position every experience honestly',
        'Fifteen anchor properties mapped across the Villages',
        'Supplier checks before anything is quoted to a client',
        'Your booking, payment and commission arrangements stay as they are'
      ],
      img: {
        src: '/assets/properties/village-longevity-960.jpg',
        w: 960, h: 640,
        alt: 'A quiet treatment room with warm light and sea view beyond.'
      }
    },

    /* ── 4 · THE GROUP OPPORTUNITY ──────────────────────────────────────── */
    {
      type: 'split',
      id: 'groups',
      skin: 'sand',
      flip: true,
      eyebrow: 'The group opportunity',
      headline: 'Some advisors have an audience, not just clients.',
      body: [
        'A community, a following, a practitioner you already work with: a group journey can be designed around that audience, with the programme, the properties and the destination coordination built alongside you.',
        /* Eclipse is a single sequenced journey with no schedule or dates on
           the site, and Duncan's decision (2026-10-12) is "designed with each
           group on request". So it is described as something that can be
           designed around a group, never as a departure that exists. */
        'Eclipse, our signature journey, shows what a sequenced programme looks like. It can be designed around a suitable group, or a custom-branded journey can be built with you. This is by application, and a concept alone does not guarantee acceptance.'
      ],
      cta: { label: 'Explore WELL Group Studio', href: '/advisors/groups' },
      img: {
        src: '/assets/properties/village-connection-960.jpg',
        w: 960, h: 640,
        alt: 'The Pitons reflected in still water at an infinity edge.'
      }
    },

    /* ── 5 · HOW TO WORK WITH DSW ───────────────────────────────────────── */
    {
      type: 'lens',
      id: 'start',
      eyebrow: 'What follows',
      headline: 'Three ways to take it further.',
      lead: 'Attend the briefing, explore the free tools, and decide whether Foundations or a group collaboration is relevant to your business. There is no enrolment requirement.',
      items: [
        {
          title: 'Start free',
          text: 'Create your Hub, get your own WELL link and QR code, and put it in front of people who already know you.',
          href: '/advisors/hub'
        },
        {
          title: 'Launch with Foundations',
          text: 'Three live days to build your offer, plus your first 30-day campaign inside a 90-day roadmap. From $697 online.',
          href: '/advisors/foundations'
        },
        {
          title: 'Apply for Group Studio',
          text: 'For advisors with a group audience or a practitioner collaboration. Reviewed by application.',
          href: '/advisors/groups'
        }
      ]
    },

    {
      type: 'finalCta',
      id: 'register',
      headline: 'Save your seat.',
      lead: 'Complimentary and live: sixty minutes, with time for your questions.',
      primaryOverride: { label: 'Save my seat', href: SITE.briefingUrl },
      secondary: { label: 'Explore the free advisor tools', href: '/advisors/hub' },
      img: {
        base: '/assets/cta/cta-dawn', widths: [771], w: 771, h: 330,
        src: '/assets/cta/cta-dawn-771.jpg', alt: ''
      }
    }
  ]
};
