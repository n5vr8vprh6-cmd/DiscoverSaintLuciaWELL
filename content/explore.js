/* ============================================================================
   /explore — EXPLORE SAINT LUCIA WELL
   ----------------------------------------------------------------------------
   The destination's own territory, in the three parts the V4 brief names:
   Villages · Experiences · Places & Properties.

   The organizing idea, carried from the Editorial Founding Edition: the island
   is grouped by WHAT IT DOES FOR YOU, not by where things are. Villages are
   themes, not postcodes. Experiences are listed under an intention. Properties
   are basecamps inside a village rather than a ranked hotel list. Keep that —
   it is the whole difference between this and a destination directory.
   ========================================================================== */
'use strict';

const { VILLAGES, EXPERIENCES, byKey } = require('./villages.js');
const SITE = require('./site.js');

module.exports = {
  key: 'explore',
  path: '/explore',
  layout: 'destination',
  surface: 'consumer',
  title: 'Explore Saint Lucia WELL — villages, experiences and places',
  description: 'Six wellness villages, the island-wide experiences inside them, and the properties that anchor each one. Saint Lucia organized by what it does for you.',
  ogTitle: 'Explore Saint Lucia WELL',

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'Explore',
      headline: 'The island, grouped by what it does for you.',
      lead: 'Not by region, and not by resort category. Saint Lucia WELL reads the island as six wellbeing worlds — with the experiences and places that sit inside each.',
      meta: ['Six villages', 'Eleven signature experiences', 'Fifteen anchor properties']
    },

    /* ── VILLAGES ───────────────────────────────────────────────────────── */
    {
      type: 'villageBlocks',
      id: 'villages',
      eyebrow: 'The Wellness Villages',
      headline: 'One destination. Distinct wellbeing worlds.',
      lead: 'A property may belong to more than one village. An experience may connect several. Together they reveal the island as a living wellness ecosystem.',
      villages: VILLAGES
    },

    /* ── EXPERIENCES ────────────────────────────────────────────────────── */
    {
      type: 'experienceGroups',
      id: 'experiences',
      eyebrow: 'Signature experiences',
      headline: 'Wellness, by intention.',
      lead: 'A living map of what the island offers — grouped not by where it is, but by what it does for you.',
      groups: EXPERIENCES,
      villageOf: byKey,
      footnote: 'None of this is a fixed catalogue. Experiences are coordinated by local partners and paced by your advisor — chosen for your energy, mobility and stage in the journey, never simply because an activity exists.'
    },

    /* ── PLACES & PROPERTIES ────────────────────────────────────────────── */
    {
      type: 'propertyDirectory',
      id: 'places',
      eyebrow: 'Places & properties',
      headline: 'Where you rest between.',
      lead: 'The villages are the themes. The properties are the basecamps — chosen for what each one contributes to a journey, not ranked against each other.',
      villages: VILLAGES,
      /* "Participation is confirmed" claimed a commercial agreement none of
         these properties has made. What is confirmed is the mapping — that
         these are the right anchors for each village. The Founding Advisor
         deck already says "validation pending"; this line said the opposite,
         and the deck is the one that was right. */
      footnote: 'These fifteen are mapped to the villages they anchor. Descriptions stay within what each property publishes about itself; nothing here extends beyond that.'
    },

    /* ── ISLAND AS CAMPUS ───────────────────────────────────────────────── */
    {
      type: 'split',
      id: 'campus',
      skin: 'sand',
      flip: true,
      eyebrow: 'Wellness across the whole island',
      /* Same change as home.js and the brochure — see the note there. */
      headline: 'You don’t visit the wellness. You move through it.',
      body: [
        'Saint Lucia’s landscape does real physiological work: mineral-rich mud and volcano-heated springs, magnesium drawn in on a mountain trail, cool freshwater after heat, slow sensory time beneath the canopy.',
        'The island has long known this as natural healing.'
      ],
      closing: 'What Saint Lucia WELL adds is sequence — the order things happen in, and the pacing between them.',
      cta: SITE.primaryCta,   /* the one definition — never retype it */
      ctaVariant: 'gold',
      img: {
        src: '/assets/sulphur-springs.jpg',
        w: 896, h: 1162,
        alt: 'Steam rising from the terraced mineral pools of Sulphur Springs, forested Piton slopes behind.',
        caption: 'Sulphur Springs · the drive-in volcano'
      }
    },

    {
      type: 'finalCta',
      id: 'begin',
      headline: 'Which of these is yours?',
      lead: 'Four questions, about a minute, and the villages that answer what you actually need.',
      secondary: { label: 'Go deeper: Eclipse', href: '/eclipse' },
      video: { webm: '/assets/video/cta-dawn-loop.webm', mp4: '/assets/video/cta-dawn-loop.mp4' },
      img: {
        base: '/assets/cta/cta-dawn', widths: [771], w: 771, h: 330,
        src: '/assets/cta/cta-dawn-771.jpg', alt: ''
      }
    }
  ]
};
