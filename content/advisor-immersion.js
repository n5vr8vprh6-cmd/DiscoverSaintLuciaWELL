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
  title: 'Saint Lucia WELL Immersion — field experience for advisors',
  description: 'Experience the destination and strengthen your ability to sell it: applied, on-island professional field learning for advisors who have completed Foundations.',
  ogTitle: 'The Saint Lucia WELL Immersion',

  conversion: {
    context: 'Professional Education',
    title: 'The Saint Lucia WELL Immersion',
    anchors: [
      { label: 'What it is',   href: '#what' },
      { label: 'What it covers', href: '#outcomes' },
      { label: 'Foundations first', href: '#fit' },
      { label: 'Waitlist',     href: '#apply' }
    ],
    cta: { label: 'Join the waitlist', href: '/advisors/immersion/waitlist' },
    footerCols: [
      {
        title: 'The Immersion',
        links: [
          { label: 'What it is',   href: '#what' },
          { label: 'What it covers', href: '#outcomes' },
          { label: 'Foundations first', href: '#fit' }
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
      eyebrow: 'Advanced professional field experience',
      headline: 'Experience the destination. <em>Strengthen your ability to sell it.</em>',
      lead: 'Go beyond familiarization into applied WELL Journey design. Meet the people behind Saint Lucia’s properties and experiences, evaluate them firsthand, and practise the judgment it takes to recommend them with confidence.',
      meta: ['On island', 'Foundations required', 'Limited places · by application'],
      actions: [
        { label: 'Join the Immersion waitlist', href: '/advisors/immersion/waitlist' },
        { label: 'Start with Foundations', href: '/advisors/foundations' }
      ]
    },

    {
      type: 'split',
      id: 'what',
      skin: 'paper',
      eyebrow: 'What it is',
      headline: 'Not a traditional FAM.',
      body: [
        'A familiarization trip shows you rooms. This shows you how Saint Lucia’s properties, nature, culture and practitioners connect to create intentional wellbeing journeys.',
        'You travel the villages roughly as a guest would — sequenced, paced, and debriefed — so that the architecture stops being a diagram and becomes something you have felt.',
        /* Two on-island offers exist and they are easy to confuse. Foundations
           Saint Lucia is the SAME three-day Foundations curriculum delivered on
           the island; this comes after it and is a different thing. */
        'This is not Foundations Saint Lucia. That is the same three-day Foundations curriculum, delivered on island. The Immersion comes after it.'
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
        { title: 'Evaluate fit firsthand',       text: 'Property and experience fit across different traveller profiles, judged by being there rather than from a brochure.' },
        { title: 'Build a sequenced journey',    text: 'How sequencing, pacing and readiness turn a good itinerary into a designed journey, using what you have seen.' },
        { title: 'Recommend within the framework', text: 'Present a recommendation grounded in the WELL Compass and the six Villages, so you can say why it fits.' },
        { title: 'Practise the conversation',    text: 'The actual client discussion, rehearsed with feedback rather than described on a slide.' },
        { title: 'Know where the boundaries are', text: 'Which destination partners to involve, how referrals and commercial handoffs work, and where practitioner scope begins.' },
        { title: 'Meet the people',              text: 'Resort and destination partners, local guides, practitioners and cultural hosts.' }
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
        'Places are limited by the nature of the format: small groups, real practitioners, actual properties. Applications are reviewed rather than processed.',
        'Attending does not by itself confer an advisor designation. That is earned on demonstrated capability, and it is still being built.'
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
          text: 'Cohort dates, price and group size are still being set. Leave your details and you will hear them first.',
          /* Was a dead "[ to be confirmed ]" — honest, but it made the third
             route the only one on the page that did nothing. The dates are
             still genuinely unset, so this does not invent them; it offers the
             one action that IS available when the answer is "not yet". */
          label: 'Join the waiting list',
          href: '/advisors/immersion/waitlist'
        }
      ]
    },

    {
      type: 'finalCta',
      id: 'begin',
      headline: 'Begin with Foundations.',
      lead: 'The method first, then the island.',
      primaryOverride: { label: 'See Foundations', href: '/advisors/foundations' },
      /* "Advisor Hub" means the authenticated workspace at /hub. This link
         goes to the public overview, so it says so. */
      secondary: { label: 'Back to advisor overview', href: '/advisors' },
      img: {
        base: '/assets/cta/cta-dawn', widths: [771], w: 771, h: 330,
        src: '/assets/cta/cta-dawn-771.jpg', alt: ''
      }
    }
  ]
};
