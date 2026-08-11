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
   ========================================================================== */
'use strict';

const SITE = require('./site.js');

module.exports = {
  key: 'advisor-intro',
  path: '/advisors/intro',
  layout: 'conversion',
  surface: 'advisor',
  title: 'The complimentary advisor briefing — Discover Saint Lucia WELL',
  description: 'A free briefing for travel advisors: what a Well Destination is, how the six villages work, and whether the wellbeing specialty fits your business.',
  ogTitle: 'The complimentary advisor briefing',

  conversion: {
    context: 'Professional Education',
    title: 'The Complimentary Briefing',
    anchors: [
      { label: 'What it covers', href: '#covers' },
      { label: 'Who it’s for',   href: '#who' },
      { label: 'What follows',   href: '#next' }
    ],
    cta: { label: 'Save my seat', href: SITE.briefingUrl },
    footerCols: [
      {
        title: 'The briefing',
        links: [
          { label: 'What it covers', href: '#covers' },
          { label: 'Who it’s for',   href: '#who' },
          { label: 'Register',       href: SITE.briefingUrl }
        ]
      },
      {
        title: 'The pathway',
        links: [
          { label: 'Well Destination Foundations', href: '/advisors/foundations' },
          { label: 'Saint Lucia WELL Immersion',   href: '/advisors/immersion' }
        ]
      }
    ]
  },

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'Complimentary · Live · Online',
      headline: 'Find out whether this specialty is for you.',
      lead: 'Before you commit to anything, spend an hour on what a Well Destination actually is — and what selling one asks of you.',
      meta: ['Free to attend', 'Live and online', 'No prerequisite']
    },

    {
      type: 'lens',
      id: 'covers',
      eyebrow: 'What it covers',
      headline: 'An hour, honestly spent.',
      items: [
        { title: 'The category shift',   text: 'Why "wellness travel" is too vague to price or differentiate, and what replaces it.' },
        { title: 'The six villages',     text: 'How Saint Lucia is organized by what it does for a traveller rather than by region.' },
        { title: 'The continuum',        text: 'Relax through Sustain — positioning every experience honestly, including the easy ones.' },
        { title: 'Journey architecture', text: 'How a sequenced journey differs from a good itinerary, using Eclipse as the worked example.' },
        { title: 'Where advisors fit',   text: 'Continuity before and after travel — the part that is genuinely yours to own.' },
        { title: 'The pathway',          text: 'What Foundations and the Immersion involve, and what they cost, with no pressure to enrol.' }
      ]
    },

    {
      type: 'split',
      id: 'who',
      skin: 'sand',
      eyebrow: 'Who it’s for',
      headline: 'Experienced advisors, mostly.',
      body: [
        'The briefing assumes you already know how to run a travel business. It is not a beginner’s introduction to selling travel, and it does not teach booking.',
        'It is most useful if you are already sending clients to the Caribbean, already fielding requests you would describe as "wellness", and already suspect that the category is bigger than a spa credit.'
      ],
      list: [
        'You sell luxury, romance, adventure or Caribbean travel already',
        'Clients increasingly ask for something they struggle to name',
        'You want positioning, not another supplier login',
        'You are willing to be trained rather than certified in an afternoon'
      ],
      closing: 'If that is not you yet, the briefing is still free — and still the right place to start.',
      img: {
        src: '/assets/properties/village-longevity-960.jpg',
        w: 960, h: 640,
        alt: 'A quiet treatment room with warm light and sea view beyond.'
      }
    },

    {
      type: 'split',
      id: 'next',
      skin: 'paper',
      flip: true,
      eyebrow: 'What follows',
      headline: 'Nothing automatic.',
      body: [
        'There is no funnel that enrols you by default. After the briefing you will know what Foundations covers, what the Immersion involves, and roughly what each asks in time and money.',
        'Most advisors take a while to decide. That is the expected behaviour, not a failure of the briefing.'
      ],
      cta: { label: 'See Well Destination Foundations', href: '/advisors/foundations' },
      img: {
        src: '/assets/properties/village-connection-960.jpg',
        w: 960, h: 640,
        alt: 'The Pitons reflected in still water at an infinity edge.'
      }
    },

    {
      type: 'finalCta',
      id: 'register',
      headline: 'Save your seat.',
      lead: 'Complimentary, live, and the honest starting point for the whole pathway.',
      primaryOverride: { label: 'Save my seat', href: SITE.briefingUrl },
      secondary: { label: 'Back to the advisor hub', href: '/advisors' },
      img: {
        base: '/assets/cta/cta-dawn', widths: [771], w: 771, h: 330,
        src: '/assets/cta/cta-dawn-771.jpg', alt: ''
      }
    }
  ]
};
