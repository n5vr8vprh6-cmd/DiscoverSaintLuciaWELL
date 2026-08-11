/* ============================================================================
   /advisors — THE TRAVEL ADVISOR GATEWAY
   ----------------------------------------------------------------------------
   PROFESSIONAL DISCOVERY layout (brief §7, §11): full global navigation plus a
   professional context band. This page is an EXPLORATION page, not a funnel —
   it explains the whole professional pathway without forcing every visitor
   directly into Foundations.

   That distinction is why it keeps the consumer nav while its three children
   (/intro, /foundations, /immersion) drop it entirely. Same path segment,
   opposite chrome — which is exactly why layout is declared, never inferred.

   The six rungs are brief §11 verbatim. Two of them are NOT yet live products:
   `Demonstrate` (the designation/proof layer) and `Activate` (campaign tools)
   are described as forthcoming and carry no CTA. Shipping a dead link into a
   programme that does not exist would undo the credibility this page is for.

   The Founding Advisor Campaign Kit stays an appendix-level acquisition source
   (brief §14, Appendix A) — it is deliberately not a nav item here.
   ========================================================================== */
'use strict';

const SITE = require('./site.js');

module.exports = {
  key: 'advisors',
  path: '/advisors',
  layout: 'professional',
  surface: 'advisor',
  title: 'For travel advisors — the Saint Lucia WELL professional pathway',
  description: 'Learn to design wellness journeys rather than book wellness hotels. A complimentary briefing, the Well Destination Foundations programme, and the Saint Lucia WELL Immersion.',
  ogTitle: 'For Travel Advisors',

  professionalContext: {
    eyebrow: 'Discover Saint Lucia WELL · For Travel Advisors',
    anchors: [
      { label: 'The pathway',  href: '#pathway' },
      { label: 'Briefing',     href: '/advisors/intro' },
      { label: 'Foundations',  href: '/advisors/foundations' },
      { label: 'Immersion',    href: '/advisors/immersion' }
    ]
  },

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'For travel advisors',
      headline: 'The next era of travel isn’t booked. <em>It’s designed.</em>',
      lead: 'Saint Lucia WELL gives advisors a shared language for wellbeing travel — a way to match a client’s intention to a real island, and to hold the relationship before and after the trip.',
      meta: ['Six steps', 'Start with a free briefing', 'No prerequisite']
    },

    /* ── WHY THIS EXISTS ────────────────────────────────────────────────── */
    {
      type: 'split',
      id: 'why',
      skin: 'paper',
      headline: '“Wellness” is too vague to sell well.',
      body: [
        'It is hard to differentiate, hard to price, and hard to train staff against. Most destinations selling wellness are selling disconnected spa add-ons, and most clients cannot tell one from another.',
        'A Well Destination replaces that vagueness with structure: six villages, a continuum that positions every experience honestly, and journeys that are sequenced rather than assembled.',
        /* Was "a language every partner on the island already speaks" — a
           present-tense operational claim about parties who have not been
           trained on any of it. The promise is the same without it. */
        'What an advisor gets is not a new niche to bolt on. It is a shared language that advisors, properties and destination partners can build on.'
      ],
      list: [
        'Match motivation to experience, credibly',
        'Position honestly on the continuum — not everything must transform',
        'Hold the relationship before arrival and after return',
        'Work from confirmed properties and named experiences'
      ],
      img: {
        src: '/assets/properties/village-heritage-960.jpg',
        w: 960, h: 640,
        alt: 'A terrace table set for dinner with the Pitons beyond at golden hour.',
        caption: 'One language every partner can speak'
      }
    },

    /* ── THE SIX RUNGS ──────────────────────────────────────────────────── */
    {
      type: 'pathway',
      id: 'pathway',
      headline: 'Six steps, in order.',
      lead: 'You do not have to take all of them, and you do not have to start at the top. Most advisors begin with the complimentary briefing and decide from there.',
      steps: [
        {
          key: 'discover',
          title: 'Discover',
          text: 'A complimentary briefing on what a Well Destination is, how the six villages work, and whether this specialty fits the business you already run.',
          cta: { label: 'Join the briefing', href: '/advisors/intro' }
        },
        {
          key: 'build',
          title: 'Build',
          text: 'Well Destination Foundations — three live days building a client-matching method, a sellable Saint Lucia offer, and a 90-day launch plan.',
          cta: { label: 'See Foundations', href: '/advisors/foundations' }
        },
        {
          key: 'experience',
          title: 'Experience',
          text: 'The Saint Lucia WELL Immersion. Not a traditional FAM — you travel the villages as a guest does, and learn the journey architecture from inside it.',
          cta: { label: 'See the Immersion', href: '/advisors/immersion' }
        },
        {
          key: 'demonstrate',
          title: 'Demonstrate',
          text: 'An advisor designation and proof layer, so trained advisors are identifiable to travellers and to the destination.',
          status: 'In development'
        },
        {
          key: 'activate',
          title: 'Activate',
          text: 'Campaign tools and attributable distribution — referral links, QR codes and creative — available after the required training.',
          status: 'Available after training'
        },
        {
          key: 'current',
          title: 'Stay current',
          text: 'Ongoing education and resources as the destination programme matures, so what you learned does not go stale.',
          status: 'Ongoing'
        }
      ],
      footnote: 'Steps four and five are described as they are being built. Nothing on this page is bookable that does not yet exist.'
    },

    /* ── WHAT THE ISLAND GIVES YOU TO SELL ──────────────────────────────── */
    {
      type: 'lens',
      id: 'inventory',
      headline: 'Real inventory, not a concept.',
      lead: 'The framework only matters if there is something behind it. There is.',
      items: [
        { title: 'Six villages',          text: 'Longevity · Rainforest & Nature · Ocean & Restoration · Heritage & Nourishment · Movement & Adventure · Connection & Romance.' },
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

    /* ── CREDIBILITY ────────────────────────────────────────────────────── */
    {
      type: 'credibility',
      id: 'partners',
      label: 'Partners',
      eyebrow: 'In collaboration with',
      partners: SITE.partners
    },

    /* ── ENTRY POINT ────────────────────────────────────────────────────── */
    {
      type: 'finalCta',
      id: 'begin',
      headline: 'Start with the briefing.',
      lead: 'Complimentary, and the honest place to find out whether this specialty is for you before committing to anything.',
      primaryOverride: { label: 'Join the free briefing', href: '/advisors/intro' },
      secondary: { label: 'Read about Foundations', href: '/advisors/foundations' },
      video: { webm: '/assets/video/seacliff-loop.webm', mp4: '/assets/video/seacliff-loop.mp4' },
      img: {
        base: '/assets/cta/cta-seacliff', widths: [960, 1440], w: 1456, h: 624,
        src: '/assets/cta/cta-seacliff-1440.jpg', alt: ''
      }
    }
  ]
};
