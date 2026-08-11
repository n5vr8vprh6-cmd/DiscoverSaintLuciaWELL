/* ============================================================================
   /advisors/immersion — THE SAINT LUCIA WELL IMMERSION
   ----------------------------------------------------------------------------
   CONVERSION layout. One action: apply.

   Copy is from the brochure's ADVISOR_INSERT (saint-lucia-well/content/copy.js),
   the two-page advisor piece that sits outside the bound 52 pages.

   Two claims need care and are handled deliberately:

     · "Certification" — the insert says the Immersion earns Discover Saint
       Lucia WELL certification. The designation/proof layer is listed as
       IN DEVELOPMENT on /advisors §11. Those two statements cannot both be
       presented as live, so this page describes certification as part of the
       programme being built rather than a credential available today.
     · Dates, price and cohort size are not stated anywhere we can evidence,
       so they render as marked placeholders rather than invented numbers.
   ========================================================================== */
'use strict';

module.exports = {
  key: 'advisor-immersion',
  path: '/advisors/immersion',
  layout: 'conversion',
  surface: 'advisor',
  title: 'Saint Lucia WELL Immersion — for trained advisors',
  description: 'Not a traditional FAM. Experience how Saint Lucia’s properties, nature, culture and practitioners connect to create intentional wellbeing journeys.',
  ogTitle: 'The Saint Lucia WELL Immersion',

  conversion: {
    context: 'Professional Education',
    title: 'The Saint Lucia WELL Immersion',
    anchors: [
      { label: 'What it is',   href: '#what' },
      { label: 'You will',     href: '#outcomes' },
      { label: 'Prerequisite', href: '#fit' },
      { label: 'Apply',        href: '#apply' }
    ],
    cta: { label: 'Apply', href: '#apply' },
    footerCols: [
      {
        title: 'The Immersion',
        links: [
          { label: 'What it is',   href: '#what' },
          { label: 'You will',     href: '#outcomes' },
          { label: 'Prerequisite', href: '#fit' }
        ]
      },
      {
        title: 'The pathway',
        links: [
          { label: 'Complimentary briefing',       href: '/advisors/intro' },
          { label: 'Well Destination Foundations', href: '/advisors/foundations' }
        ]
      }
    ]
  },

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'Advisor Immersion',
      headline: 'You have seen the journey through your client’s eyes. <em>Now experience it through your own.</em>',
      lead: 'Not a traditional FAM. A guided passage through the Wellness Villages, learning the journey architecture from inside it.',
      meta: ['In Saint Lucia', 'Foundations required', 'By application']
    },

    {
      type: 'split',
      id: 'what',
      skin: 'paper',
      eyebrow: 'What it is',
      headline: 'Not a traditional FAM.',
      body: [
        'A familiarization trip shows you rooms. This shows you how Saint Lucia’s properties, nature, culture and practitioners connect to create intentional wellbeing journeys.',
        'You travel the villages roughly as a guest would — sequenced, paced, and debriefed — so that the architecture stops being a diagram and becomes something you have felt.'
      ],
      closing: 'Learn to sell and market wellbeing journeys without becoming a health practitioner.',
      img: {
        src: '/assets/properties/village-rainforest-960.jpg',
        w: 960, h: 640,
        alt: 'A rainforest spa pavilion set among the canopy and volcanic rock.'
      }
    },

    {
      type: 'lens',
      id: 'outcomes',
      eyebrow: 'You will',
      headline: 'What the Immersion covers.',
      items: [
        { title: 'Experience the villages',   text: 'All six, in sequence, as a traveller moves through them rather than as a site inspection.' },
        { title: 'Meet the partners',         text: 'Resort and destination partners, local guides, practitioners and cultural hosts.' },
        { title: 'Learn journey architecture', text: 'How sequencing, pacing and readiness turn a good itinerary into a designed journey.' },
        { title: 'Know the difference',       text: 'Between wellness travel and structured recovery — and which client is asking for which.' },
        { title: 'Identify client profiles',  text: 'Who this is for, who it is not for, and how to tell early in a conversation.' },
        { title: 'Practise the conversation', text: 'The actual client discussion, rehearsed with feedback rather than described on a slide.' }
      ],
      closing: 'Marketing and sales assets are provided at the end.'
    },

    {
      type: 'split',
      id: 'fit',
      skin: 'sand',
      flip: true,
      eyebrow: 'Prerequisite',
      headline: 'Foundations comes first.',
      body: [
        'The Immersion assumes the method. Three days of Foundations gives you the client-matching approach, the village structure and the language — the Immersion is where you use them in the place itself.',
        'Places are limited by the nature of the format: small groups, real practitioners, actual properties. Applications are reviewed rather than processed.'
      ],
      cta: { label: 'Start with Foundations', href: '/advisors/foundations' },
      ctaVariant: 'gold',
      img: {
        src: '/assets/properties/village-movement-960.jpg',
        w: 960, h: 640,
        alt: 'The forested coastline and the Pitons seen from above at first light.'
      }
    },

    {
      type: 'contact',
      id: 'apply',
      eyebrow: 'Apply',
      headline: 'Applications are reviewed individually.',
      lead: 'Cohort dates, investment and group size are being finalized with the destination and property partners.',
      routes: [
        {
          title: 'Complete Foundations first',
          text: 'The three-day programme is the prerequisite, and the fastest route to being eligible.',
          label: 'See Foundations',
          href: '/advisors/foundations'
        },
        {
          title: 'Not there yet?',
          text: 'The complimentary briefing explains the whole pathway with no commitment.',
          label: 'Join the briefing',
          href: '/advisors/intro'
        },
        {
          title: 'Dates and investment',
          text: 'Cohort dates, price and group size for the Immersion.',
          /* Not confirmed anywhere we can cite — stated as pending, not invented. */
          label: '[ to be confirmed ]'
        }
      ]
    },

    {
      type: 'finalCta',
      id: 'begin',
      headline: 'Begin with Foundations.',
      lead: 'The method first, then the island.',
      primaryOverride: { label: 'See Foundations', href: '/advisors/foundations' },
      secondary: { label: 'Back to the advisor hub', href: '/advisors' },
      img: {
        base: '/assets/cta/cta-dawn', widths: [771], w: 771, h: 330,
        src: '/assets/cta/cta-dawn-771.jpg', alt: ''
      }
    }
  ]
};
