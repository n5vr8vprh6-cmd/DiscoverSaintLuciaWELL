/* ============================================================================
   THE SIX WELLNESS VILLAGES
   ----------------------------------------------------------------------------
   Shared by the homepage, /explore and the Journey Finder so all three describe
   the villages identically.

   Every string traces to saint-lucia-well/content/copy.js (spreads 7–12) or
   content/properties.js. Nothing here is newly written marketing copy.

   The villages are NOT separate locations or exclusive resort categories —
   they are a way of understanding what each part of the island contributes.
   A property may belong to more than one; an experience may connect several.
   Keep that framing: it is what stops this reading as six resort brochures.

   `anchors` — confirmed by Duncan 2026-08-08. These are named third-party
   businesses; do not extend beyond what each property publishes about itself.
   `folder` keys into content/properties-media.js for that property's imagery.

   Cap Maison (Connection & Romance) and Stonefield Villa Resort (Rainforest &
   Nature) arrived with the 2026-08-10 asset library; their village placements
   were confirmed by Duncan on 2026-08-10 and now match the brochure.
   ========================================================================== */
'use strict';

const MEDIA = require('./properties-media.js');

const VILLAGES = [
  {
    key: 'longevity',
    name: 'Longevity Village',
    short: 'Longevity',
    color: '#2E5E5C',
    ink: '#224645',
    subline: 'Restore the body. Rebuild capacity.',
    headline: 'Wellbeing with greater depth',
    body: 'Advanced wellbeing support, nutrition, recovery therapies, restorative hospitality and longer-term health thinking — for travelers seeking more than a spa escape.',
    themesTitle: 'Signature themes',
    themes: [
      'Recovery and nervous-system regulation',
      'Nutrition and metabolic wellbeing',
      'Diagnostics and individualized support',
      'Sleep and restoration',
      'Longevity-oriented lifestyle practices'
    ],
    eclipseRole: 'Provides the physiological and hospitality foundation for Eclipse.',
    anchors: [
      { name: "A'ila Resorts", role: 'Anchor property',        folder: '07-aila-resorts-villas-residences' },
      { name: 'TheLifeCo',     role: 'Wellbeing programming',  folder: '12-thelifeco-st-lucia' }
    ],
    /* Journey Finder — which intentions route here. See content/journey.js. */
    intentions: ['restore', 'reflect']
  },

  {
    key: 'rainforest',
    name: 'Rainforest & Nature Village',
    short: 'Rainforest & Nature',
    color: '#566E4E',
    ink: '#3F523A',
    subline: 'Not every part of recovery needs to be spoken.',
    headline: 'Return to a slower intelligence',
    body: 'The rainforest changes the pace of attention. Sound becomes more textured, breathing more noticeable, movement less performative and more responsive.',
    themesTitle: 'Best suited for',
    themes: [
      'Mental decompression',
      'Reflection',
      'Creative renewal',
      'Gentle movement',
      'Reconnection with natural rhythms'
    ],
    anchors: [
      { name: 'Sugar Beach, A Viceroy Resort', role: 'Anchor stay — rainforest', folder: '01-sugar-beach-viceroy' },
      { name: 'Zoëtry Marigot Bay St. Lucia',  role: 'Anchor stay — marina', folder: '14-zoetry-marigot-bay' },
      { name: 'Stonefield Villa Resort',       role: 'Anchor stay — Soufrière hillside', folder: '13-stonefield-villa-resort' }
    ],
    intentions: ['reflect', 'restore']
  },

  {
    key: 'ocean',
    name: 'Ocean & Restoration Village',
    short: 'Ocean & Restoration',
    color: '#3F7B7B',
    ink: '#2E5A5A',
    subline: 'Reflect. Regulate. Let movement return.',
    headline: 'Water runs through the whole story',
    body: 'From quiet bays and mineral pools to sailing, floating, swimming and ocean-facing ritual — this village supports downregulation, spaciousness and integration.',
    themesTitle: 'Signature possibilities',
    themes: [
      'Sunrise or sunset sailing',
      'Float and sound experiences',
      'Coastal walking meditation',
      'Water-based movement',
      'Quiet beach recovery',
      'Evening reflection rituals'
    ],
    anchors: [
      { name: 'BodyHoliday',                role: 'Anchor stay — wellness institution', folder: '06-bodyholiday' },
      { name: 'StolenTime by Rendezvous',   role: 'Anchor stay — sister resort',        folder: '08-stolentime' },
      { name: 'Calabash Cove Resort & Spa', role: 'Anchor stay — boutique',             folder: '15-calabash-cove' }
    ],
    intentions: ['restore', 'reflect']
  },

  {
    key: 'heritage',
    name: 'Heritage & Nourishment Village',
    short: 'Heritage & Nourishment',
    color: '#A6803F',
    ink: '#6E5426',
    subline: 'Nourishment is what reconnects us to life.',
    headline: 'Wellbeing is also cultural',
    body: 'Cacao, cuisine, agriculture, music, storytelling and community traditions reconnect travelers with pleasure, meaning, creativity and the people behind a destination.',
    themesTitle: 'Experiences',
    themes: [
      'Cacao and chocolate rituals',
      'Farm and garden experiences',
      'Creole cuisine',
      'Local markets',
      'Music and movement',
      'Community storytelling'
    ],
    anchors: [
      { name: 'Ladera Resort',                   role: 'Anchor stay — heritage & craft', folder: '10-ladera-resort' },
      { name: 'Rabot Hotel from Hotel Chocolat', role: 'Anchor stay — cacao estate',     folder: '09-rabot-hotel-hotel-chocolat' }
    ],
    intentions: ['nourish', 'connect']
  },

  {
    key: 'movement',
    name: 'Movement & Adventure Village',
    short: 'Movement & Adventure',
    color: '#B06248',
    ink: '#834635',
    subline: 'Vitality returns through movement.',
    headline: 'Paced to your energy, not to the activity list',
    body: 'Adventure can either stimulate an already overextended system or help it rediscover energy. The difference is intention, pacing and fit.',
    themesTitle: 'Personalized around',
    themes: [
      'Intensity level',
      'Private or group format',
      'Mobility considerations',
      'Recovery time',
      'Companion preferences'
    ],
    note: 'Movement is selected according to the traveler’s energy, confidence and stage in the journey — not simply because an activity is available.',
    anchors: [
      { name: 'Sandals Grande St. Lucian', role: 'Anchor stay — sport & watersports',  folder: '05-sandals-grande-st-lucian' },
      { name: 'Anse Chastanet',            role: 'Anchor stay — dive & jungle biking', folder: '03-anse-chastanet' }
    ],
    intentions: ['move']
  },

  {
    key: 'connection',
    name: 'Connection & Romance Village',
    short: 'Connection & Romance',
    color: '#97545E',
    ink: '#6F3D45',
    subline: 'Presence is a form of intimacy.',
    headline: 'Beyond celebration and scenery',
    body: 'Relationship wellbeing, shared presence and meaningful time together — for couples, partners moving through transition, or travelers reconnecting with themselves first.',
    themesTitle: 'Experiences',
    themes: [
      'Private dining',
      'Sunset rituals',
      'Couples spa and restoration',
      'Shared nature experiences',
      'Guided reflection',
      'Celebration and renewal'
    ],
    anchors: [
      { name: 'The Landings Resort & Spa', role: 'Anchor stay — villa suites & spa',   folder: '04-the-landings' },
      { name: 'Jade Mountain',             role: 'Anchor stay — romantic sanctuaries', folder: '02-jade-mountain' },
      { name: 'Cap Maison Resort & Spa',   role: 'Anchor stay — cliffside villas',     folder: '11-cap-maison' }
    ],
    intentions: ['connect', 'reflect']
  }
];

/* ── Signature excursions ────────────────────────────────────────────────────
   From copy.js:633 `excursionGrid`. Grouped by what they DO for you rather than
   where they are — the organizing idea of the whole /explore page.
   Not a fixed catalogue: coordinated by local partners, paced by an advisor.  */
const EXPERIENCES = [
  {
    intention: 'Regulate & downshift',
    villageKey: 'ocean',
    items: [
      { title: 'Sulphur Springs mud baths', note: 'Balneotherapy in mineral-rich, volcano-heated pools at the Caribbean’s drive-in volcano.' },
      { title: 'Sunset catamaran along the Pitons', note: 'Open-water downshift as the light falls behind the peaks.' }
    ]
  },
  {
    intention: 'Move & find vitality',
    villageKey: 'movement',
    items: [
      { title: 'Gros Piton guided summit', note: 'The island’s iconic climb, with a mineral soak for muscle recovery after.' },
      { title: 'Waterfall immersion — Diamond & Toraille', note: 'Cool freshwater plunges in botanical gardens and rainforest.' },
      { title: 'Reef snorkel & dive', note: 'The Anse Chastanet house reef and Anse Cochon — calm, clear, alive.' }
    ]
  },
  {
    intention: 'Nourish & connect',
    villageKey: 'heritage',
    items: [
      { title: 'Cacao estate tree-to-bar trail', note: 'Walk a working cocoa estate and grind your own bar.' },
      { title: 'Castries market & Creole cooking', note: 'Island produce, spice and foodways, hands-on.' },
      { title: 'Anse La Raye Fish Friday', note: 'A village street feast — culture as nourishment.' }
    ]
  },
  {
    intention: 'Reflect & reconnect',
    villageKey: 'rainforest',
    items: [
      { title: 'Rainforest forest-bathing & birding', note: 'Slow sensory walks and the En Bas Saut waterfall trail.' },
      { title: 'Pigeon Island National Park', note: 'A coastal heritage walk through fort ruins and sea views.' },
      { title: 'Tet Paul Nature Trail', note: 'A gentle ridge walk with the Pitons in full view.' }
    ]
  }
];

/* Attach imagery: village frame, plus each anchor's own photograph. Done here
   rather than in the content so a re-run of the image tool flows through
   without touching hand-written data. */
VILLAGES.forEach((v) => {
  v.image = MEDIA.villages[v.key] || null;
  v.anchors.forEach((a) => { a.image = a.folder ? MEDIA.properties[a.folder] || null : null; });
});

const byKey = (key) => VILLAGES.find((v) => v.key === key);
const allAnchors = () => VILLAGES.flatMap((v) => v.anchors.map((a) => ({ ...a, village: v })));

module.exports = { VILLAGES, EXPERIENCES, byKey, allAnchors };
