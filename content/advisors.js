/* ============================================================================
   /advisors — THE TRAVEL ADVISOR GATEWAY
   ----------------------------------------------------------------------------
   PROFESSIONAL DISCOVERY layout (brief §7, §11): full global navigation plus a
   professional context band. This page is an EXPLORATION page, not a funnel —
   it explains the whole professional pathway without forcing every visitor
   directly into Foundations.

   That distinction is why it keeps the consumer nav while its children
   (/intro, /foundations, /immersion) drop it entirely. Same path segment,
   opposite chrome — which is exactly why layout is declared, never inferred.

   REPOSITIONED 2026-10-12 (DSW_Claude_Code_Website_Implementation_Brief §3.1)
   ----------------------------------------------------------------------------
   This page used to open with "The next era of travel isn't booked. It's
   designed." and a six-step educational staircase. A cold-outbound advisor
   arrived and was told how to learn, before being told what they could earn
   from it. It now leads with the commercial proposition — you own the client
   relationship; we help you design, sell and coordinate the journey — and offers
   two ways to build on it.

   WHAT CHANGED IN THE ORDER, AND WHY
   · The six-step staircase is no longer the page's spine. It is retained,
     below the partnership message, as an optional "go deeper" list.
   · Hub activation no longer follows the Immersion. It was step five of six,
     which told an advisor they must be trained and travelled before they could
     put the destination in front of anyone — the opposite of the strategy the
     Hub exists to serve (see content/advisor-hub.js). It is now step two.
   · The Demonstrate rung (the designation) still carries its `In development`
     badge. Removing the badge is a factual claim; only on Duncan's word.

   "PARTNER PROGRAM" IS A LABEL, NOT A CLAIM. Decided with Duncan 2026-10-12:
   the brief's umbrella name is used once, in the "choose" lead, and always next
   to the sentence that says advisors keep their own clients, systems and
   commissions. "Partner" can read as a supplier agreement or preferred status;
   nothing here is, and no call to action says "become a partner".

   "A PARTNER ECOSYSTEM BEHIND YOU" WAS NOT USED. The brief's lead says it. The
   properties are mapped, not contracted (content/practitioners.js is explicit),
   and SITE.partners is empty on purpose, so the hero says what is true: a
   mapped island of properties and experiences.
   ========================================================================== */
'use strict';

const SITE = require('./site.js');
const { countWord } = require('./journey.js');

module.exports = {
  key: 'advisors',
  path: '/advisors',
  layout: 'professional',
  surface: 'advisor',
  title: 'For travel advisors — the Discover Saint Lucia WELL Partner Program',
  description: 'Turn the travel you already sell into more valuable WELL Journeys: a free briefing, free advisor tools, Foundations from $697 online, and WELL Group Studio by application.',
  ogTitle: 'For Travel Advisors',

  professionalContext: {
    eyebrow: 'Discover Saint Lucia WELL · For Travel Advisors',
    anchors: [
      { label: 'Pathways',          href: '#choose' },
      { label: 'Briefing',          href: '/advisors/intro' },
      { label: 'Foundations',       href: '/advisors/foundations' },
      { label: 'WELL Group Studio', href: '/advisors/groups' },
      { label: 'Immersion',         href: '/advisors/immersion' },
      /* Last, deliberately. This band is how an advisor orients on arrival, and
         the Hub is the one item here that a returning advisor — rather than a
         prospective one — is looking for. */
      { label: 'Your Hub',          href: '/advisors/hub' }
    ]
  },

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'Discover Saint Lucia WELL · For travel advisors',
      long: true,
      headline: 'Turn the travel you already sell into more valuable <em>WELL Journeys.</em>',
      lead: 'Help your clients discover what they need from travel, design personalized Saint Lucia experiences, and bring them to market with destination expertise, practical tools and a mapped island of properties and experiences behind you.',
      meta: ['Free to start', 'You own the client relationship', 'No new booking system'],
      actions: [
        { label: 'Join the free advisor briefing', href: '/advisors/intro' },
        { label: 'Explore free advisor tools',     href: '/advisors/hub' }
      ]
    },

    /* ── THE COMMERCIAL PROBLEM ─────────────────────────────────────────── */
    {
      type: 'split',
      id: 'why',
      skin: 'paper',
      headline: '“Wellness” is too vague to sell well.',
      body: [
        'It is hard to differentiate, hard to price, and hard to match to a client. Most destinations selling wellness are selling disconnected spa add-ons, and most clients cannot tell one from another.',
        'What an advisor needs is a repeatable path from what a client intends to a credible, bookable proposal: hear it, match it, design it, sell it. That is a process you can learn and a language you can share, not a niche to bolt on.'
      ],
      list: [
        'Match motivation to experience, credibly',
        'Position honestly on the continuum — not everything must transform',
        'Hold the relationship before arrival and after return',
        'Work from mapped properties and named experiences'
      ],
      img: {
        src: '/assets/properties/village-heritage-960.jpg',
        w: 960, h: 640,
        alt: 'A terrace table set for dinner with the Pitons beyond at golden hour.',
        caption: 'One language every partner can speak'
      }
    },

    /* ── ONE CONNECTED SYSTEM ───────────────────────────────────────────── */
    {
      type: 'pathway',
      id: 'system',
      skin: 'sand',
      eyebrow: 'One connected system',
      headline: 'Discover. Design. Sell. Coordinate.',
      lead: 'Four steps that hand off to one another. The first is free, and you can start there without anything else.',
      steps: [
        {
          title: 'Discover',
          text: `The free WELL Journey Finder asks a traveller ${countWord} questions about how they want to feel. When they choose to share the result through your link, it lands in your Hub, and your discovery conversation starts from their own words.`,
          cta: { label: 'Create your free Hub', href: '/advisors/hub' }
        },
        {
          title: 'Design',
          text: 'The WELL Compass and the six Villages turn what they asked for into a sequenced journey. For the Journeys shared with you, the Hub lets you begin designing from what the traveller actually answered.'
        },
        {
          title: 'Sell',
          text: 'Your own WELL link, a 30-day campaign with the words already written, and the scripts and assets that Foundations adds, so the journey reaches people who already trust you.',
          cta: { label: 'See Foundations', href: '/advisors/foundations' }
        },
        {
          title: 'Coordinate',
          /* "subject to individual agreements and operating readiness" is the
             brief's own qualifier (§3.1 step 3) and it is load-bearing: this is
             the step where an overstatement would be a promise about suppliers
             who have not been asked. */
          text: 'You keep the client relationship and the booking. Discover Saint Lucia WELL works with you on destination guidance and, where a collaboration is agreed, coordination with the properties and operators involved. Scope is set case by case, subject to individual agreements and operating readiness.',
          cta: { label: 'WELL Group Studio', href: '/advisors/groups' }
        }
      ]
    },

    /* ── CHOOSE YOUR PATHWAY ────────────────────────────────────────────── */
    {
      type: 'lens',
      id: 'choose',
      skin: 'paper',
      eyebrow: 'Choose your pathway',
      headline: 'Two ways to build on it.',
      /* The one use of the umbrella label, next to the sentence that bounds it. */
      lead: 'The Discover Saint Lucia WELL Partner Program is the way we work together: you keep your clients, your systems and your own booking and commission arrangements, and we help you design, bring to market and coordinate the journey.',
      items: [
        {
          title: 'WELL Journey Launch',
          text: 'Three live days of Well Destination Foundations, plus your first 30-day campaign inside a 90-day activation roadmap. From $697 online.',
          href: '/advisors/foundations'
        },
        {
          title: 'WELL Group Studio',
          text: 'Co-design and launch a WELL group departure around an audience you already have. By application, with scope agreed case by case.',
          href: '/advisors/groups'
        }
      ]
    },

    /* ── PROOF THAT IT IS MORE THAN A CONCEPT ───────────────────────────── */
    {
      type: 'lens',
      id: 'inventory',
      skin: 'sand',
      headline: 'Real inventory, not a concept.',
      lead: 'The framework only matters if there is something behind it. There is.',
      items: [
        { title: 'Six villages',          text: 'Longevity · Nature & Renewal · Ocean & Restoration · Heritage & Nourishment · Movement & Adventure · Connection & Romance.' },
        /* Not "confirmed participation" — the properties are mapped, not
           signed. An advisor deciding whether to invest in this pathway is
           exactly who would check, and exactly who should not be told the
           programme has commitments it does not have yet. */
        { title: 'Fifteen anchor properties', text: 'Mapped across all six villages, from a wellness institution to a working cacao estate.' },
        { title: 'A signature journey',   text: 'Eclipse — fully sequenced, designed by practitioners, and the proof that the framework becomes a real product.' },
        { title: 'Island-wide experiences', text: 'Volcano, waterfalls, rainforest, cacao trails and open water, coordinated by local partners.' },
        { title: 'A shared continuum',    text: 'Relax → Restore → Reconnect → Recover → Transform → Sustain. Position every experience honestly.' },
        { title: 'Continuity by design',  text: 'The journey begins before arrival and continues after — which is where advisor relationships actually live.' }
      ],
      closing: 'Organize the island, don’t build a new one.'
    },

    /* ── GO DEEPER (OPTIONAL) ───────────────────────────────────────────── */
    {
      type: 'pathway',
      id: 'pathway',
      skin: 'paper',
      eyebrow: 'Go deeper',
      headline: 'Professional development, if you want it.',
      lead: 'None of this is required to use the free tools, and Group Studio does not depend on any of it. Most advisors begin with the briefing and decide from there.',
      steps: [
        {
          key: 'discover',
          title: 'Briefing',
          text: 'A complimentary live briefing on what a Well Destination is, how the six villages work, and whether this specialty fits the business you already run.',
          cta: { label: 'Join the briefing', href: '/advisors/intro' }
        },
        {
          key: 'activate',
          title: 'Your free Hub',
          /* Second, not fifth. It is free, it needs nothing before it, and it
             is the step the strategy rests on: market response creates the
             motivation to learn, not the other way round. */
          text: 'Your own WELL link and QR code, a 30-day campaign with the copy already written, and a Hub where the Journeys people share with you arrive — so you can put the destination in front of your own audience and see who responds.',
          cta: { label: 'Open your Hub', href: '/advisors/hub' }
        },
        {
          key: 'build',
          title: 'Foundations',
          text: 'Well Destination Foundations — three live days building a client-matching method, a sellable Saint Lucia offer, and your first 30-day campaign inside a 90-day roadmap.',
          cta: { label: 'See Foundations', href: '/advisors/foundations' }
        },
        {
          key: 'experience',
          title: 'Immersion',
          text: 'The Saint Lucia WELL Immersion, after Foundations. Not a traditional FAM: you travel the villages as a guest does, and learn the journey architecture from inside it.',
          cta: { label: 'See the Immersion', href: '/advisors/immersion' }
        },
        {
          key: 'demonstrate',
          title: 'Demonstrate',
          text: 'An advisor designation and proof layer, so trained advisors are identifiable to travellers and to the destination.',
          status: 'In development'
        },
        {
          key: 'current',
          title: 'Stay current',
          text: 'Ongoing education and resources as the destination programme matures, so what you learned does not go stale.',
          status: 'Ongoing'
        }
      ]
    },

    /* ── CREDIBILITY ────────────────────────────────────────────────────── */
    {
      type: 'credibility',
      id: 'partners',
      label: 'Partners',
      eyebrow: SITE.partnersLabel,
      partners: SITE.partners
    },

    /* ── ENTRY POINT ────────────────────────────────────────────────────── */
    {
      type: 'finalCta',
      id: 'begin',
      headline: 'Start with the briefing.',
      lead: 'Complimentary and live. If you would rather start by doing, the Hub is free and takes about a minute; the paid steps are there when you are ready for them.',
      primaryOverride: { label: 'Join the free advisor briefing', href: '/advisors/intro' },
      secondary: { label: 'Explore free advisor tools', href: '/advisors/hub' },
      video: { webm: '/assets/video/seacliff-loop.webm', mp4: '/assets/video/seacliff-loop.mp4' },
      img: {
        base: '/assets/cta/cta-seacliff', widths: [960, 1440], w: 1456, h: 624,
        src: '/assets/cta/cta-seacliff-1440.jpg', alt: ''
      }
    }
  ]
};
