/* ============================================================================
   /about — WHAT A WELL DESTINATION IS, AND WHY SAINT LUCIA
   ----------------------------------------------------------------------------
   Sourced from Well-Destination-Framework-one-pager.html, but TRANSLATED, not
   transplanted. That document is explicit about which of its layers are which:

     · "The 5 Conditions — design & governance language"
     · "The 8 Pillars — market & product language"

   Both are partner-facing vocabulary. A traveller does not need to learn eight
   pillar names to book a trip, and a consumer page that teaches them reads as a
   strategy deck with photographs. So this page keeps the two ideas that are
   genuinely consumer-meaningful — the definition, and the Continuum's promise
   that not every journey has to transform you — and leaves the framework
   vocabulary to /advisors where it earns its place.

   The GWI market figures ($6.8T, $893.9B, 9.1%) are deliberately NOT here.
   They are a business case, not a reason to visit an island, and any use of
   them has to carry a source note.
   ========================================================================== */
'use strict';

const SITE = require('./site.js');

module.exports = {
  key: 'about',
  path: '/about',
  layout: 'destination',
  surface: 'consumer',
  title: 'About — what a Well Destination is, and why Saint Lucia',
  description: 'A Well Destination is a place where travel, nature, culture, hospitality and community are organized to help people and places flourish. Why Saint Lucia is becoming the first.',
  ogTitle: 'What is a Well Destination?',

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'About',
      headline: 'Saint Lucia is not simply becoming a wellness destination.',
      /* The category-building sentence is the right one for SLTA, host
         agencies and properties — but it was the FIRST thing a traveller met,
         and it answers a question they have not asked. One plain sentence goes
         in front of it. The thesis is untouched; it just no longer has to
         carry the introduction as well. */
      lead: 'Travel designed around how you want to feel, on an island that already holds the ingredients. Saint Lucia is becoming a <em>Well Destination</em> — a place where travel helps people, communities, culture and nature flourish.',
      meta: ['A shared definition', 'Why here', 'How it works']
    },

    /* ── THE DEFINITION ─────────────────────────────────────────────────── */
    {
      type: 'split',
      id: 'definition',
      skin: 'paper',
      headline: 'What is a Well Destination?',
      body: [
        'A place where travel, nature, culture, hospitality, health and community are <strong>intentionally organized</strong> to help people and places flourish.',
        'For Saint Lucia, wellbeing is not another niche to bolt on. It is the connective tissue that strengthens romance, luxury, adventure, culinary, culture, nature and recovery travel — one language every partner can speak.',
        'For a traveller, that shows up as something simpler: the parts of a trip stop competing with each other.'
      ],
      img: {
        src: '/assets/properties/village-rainforest-960.jpg',
        w: 960, h: 640,
        alt: 'A rainforest spa pavilion set among the canopy and volcanic rock.',
        caption: 'Nature as wellbeing infrastructure — not scenery'
      }
    },

    /* ── WHY SAINT LUCIA ────────────────────────────────────────────────── */
    {
      type: 'split',
      id: 'why-saint-lucia',
      skin: 'sand',
      flip: true,
      eyebrow: 'Why here',
      headline: 'The island already holds the ingredients.',
      body: [
        'The Pitons. Rainforest. Geothermal springs. Ocean. Cacao estates and Creole foodways. Practitioners, guides and cultural hosts. Resorts that already know how to care for people.',
        'Most destinations selling "wellness" are selling disconnected spa add-ons. Saint Lucia’s advantage is not that it has more — it is that these things sit close enough together to be <em>sequenced</em>.'
      ],
      list: [
        'Land, water and climate that restore',
        'Creole food, music and story that build belonging',
        'Sleep, food, recovery and service designed on purpose',
        'A journey that begins before arrival and continues after'
      ],
      img: {
        src: '/assets/properties/village-movement-960.jpg',
        w: 960, h: 640,
        alt: 'The forested coastline and the Pitons seen from above at first light.',
        caption: 'Val des Pitons · a UNESCO World Heritage landscape'
      }
    },

    /* ── HOW IT WORKS ───────────────────────────────────────────────────────
       Moved ahead of the Continuum. The page answers three plain questions in
       order — what is this (Well Destination) · why here (the ingredients) ·
       how does it work for me (this section) — and the Continuum used to sit
       in the middle of them, interrupting a consumer's path with framework
       theory before they had been told how any of it applies to them.

       The theory is not cut, only moved beneath the answers. Anchor ids are
       unchanged, so #continuum and #approach keep working.               */
    {
      type: 'finder',
      id: 'approach',
      headline: 'How a journey gets designed.',
      lead: 'The same sequence every time, whether the answer is three easy days or a fully structured recovery journey.',
      steps: [
        { title: 'Intention',       text: 'Begin with how you want to feel, not with a hotel or a list of attractions.' },
        { title: 'Villages',        text: 'The parts of the island that answer that intention — six wellbeing worlds rather than regions.' },
        { title: 'Experiences',     text: 'What the island actually does for you: volcano, waterfall, forest, cacao estate, sea.' },
        { title: 'Personalization', text: 'An advisor shapes pacing, rooms, companions and logistics around your real life.' },
        { title: 'Return',          text: 'Preparation before arrival, and a pathway for what happens after you go home.' }
      ],
      note: 'The journey is curated. The travel experience remains personal.'
    },

    /* ── THE CONTINUUM ──────────────────────────────────────────────────── */
    {
      type: 'lens',
      id: 'continuum',
      eyebrow: 'The Wellness Continuum',
      headline: 'Not everything has to transform you.',
      lead: 'One of the more useful ideas in the framework, and the one most worth saying out loud to travellers: every experience sits honestly somewhere on this range. A week of ease is a legitimate answer.',
      items: [
        { title: 'Relax',     text: 'Ease and pleasure. Nothing to achieve, nothing to process.' },
        { title: 'Restore',   text: 'Rest and regulation — sleep that works again, a nervous system that settles.' },
        { title: 'Reconnect', text: 'With yourself, with the people you came with, and with the place you are in.' },
        { title: 'Recover',   text: 'Repair and renewal, where something specific needs to mend.' },
        { title: 'Transform', text: 'A shift in identity — rarer, slower, and not the goal of every trip.' },
        { title: 'Sustain',   text: 'Change that lasts past the flight home. The hardest one, and the point.' }
      ],
      closing: 'Position honestly. Then sequence well.'
    },

    /* ── PARTNERS ───────────────────────────────────────────────────────── */
    {
      type: 'credibility',
      id: 'partners',
      label: 'Partners',
      eyebrow: 'In collaboration with',
      partners: SITE.partners,
      /* Sits directly under the partner logos, which makes any overstatement
         here read as an endorsement by the named partners. The properties are
         mapped to villages; they have not joined a programme. */
      note: 'Fifteen anchor properties are mapped across the six villages. Local guides, practitioners and cultural partners deliver the experiences alongside them.'
    },

    /* ── CONTACT ────────────────────────────────────────────────────────── */
    {
      type: 'contact',
      id: 'contact',
      headline: 'Start a conversation.',
      lead: 'Most journeys begin with an advisor rather than a booking form.',
      routes: [
        {
          title: 'Travellers',
          text: 'Begin with the Journey Finder, then speak with a Saint Lucia WELL Advisor about shaping it around you.',
          label: 'Find my WELL journey',
          href: '/journey'
        },
        {
          title: 'Travel advisors',
          text: 'The professional pathway — a complimentary briefing, the Foundations programme, and the Saint Lucia WELL Immersion.',
          label: 'Visit the advisor hub',
          href: '/advisors'
        },
        {
          title: 'Properties, partners and press',
          text: 'For destination partnership, property participation or media enquiries.',
          /* No public enquiry address is confirmed yet — this renders as a
             visible placeholder rather than an invented mailbox. */
          label: '[ contact address to be confirmed ]'
        }
      ]
    },

    {
      type: 'finalCta',
      id: 'begin',
      headline: 'Begin with how you want to feel.',
      lead: 'Six villages, one island, and a journey shaped around you.',
      secondary: { label: 'Explore the island', href: '/explore' },
      video: { webm: '/assets/video/seacliff-loop.webm', mp4: '/assets/video/seacliff-loop.mp4' },
      img: {
        base: '/assets/cta/cta-seacliff', widths: [960, 1440], w: 1456, h: 624,
        src: '/assets/cta/cta-seacliff-1440.jpg', alt: ''
      }
    }
  ]
};
