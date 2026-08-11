/* ============================================================================
   /journey — THE WELL JOURNEY FINDER
   ----------------------------------------------------------------------------
   The primary consumer conversion engine (brief §13). Everything else on the
   destination layout points here.

   HOW IT WORKS
   Four questions, scored against the six villages, top three returned with the
   experiences that sit inside them. No backend, no account, no stored answers.

   PROGRESSIVE ENHANCEMENT
   Without JavaScript the page is a complete static explainer — the six villages
   described, with routes to /explore and to an advisor. The interactive quiz is
   revealed by js/journey.js only once it can actually run, so no visitor ever
   meets a form that cannot submit.

   SCORING
   `weights` maps an answer to village keys and the points it contributes.
   Question 1 carries the most weight because a stated intention should beat an
   inferred one. Question 4 does not score villages at all — it decides whether
   Eclipse is surfaced, and it is worded as recognition rather than diagnosis.
   Nobody is told they are burned out by a website.
   ========================================================================== */
'use strict';

const { VILLAGES, EXPERIENCES } = require('./villages.js');

const QUESTIONS = [
  {
    id: 'intention',
    compass: true,
    question: 'What do you need most from this journey?',
    help: 'One direction to begin with. You can hold more than one — start with what is loudest.',
    options: [
      { value: 'restore', compass: 'Restore',   label: 'Rest that actually restores',      note: 'Sleep, quiet, and a nervous system that finally settles.',        weights: { longevity: 3, ocean: 3, rainforest: 2 } },
      { value: 'reflect', compass: 'Reflect',   label: 'Space to think clearly',            note: 'Decompression, perspective, and room for your own thoughts.',    weights: { rainforest: 3, ocean: 2, longevity: 1, connection: 1 } },
      { value: 'move',    compass: 'Move',      label: 'Energy and vitality back',          note: 'Movement that returns capacity rather than spending it.',        weights: { movement: 3, ocean: 1 } },
      { value: 'nourish', compass: 'Nourish',   label: 'Pleasure, food and culture',        note: 'Cacao, Creole cooking, markets, music, the people behind it.',   weights: { heritage: 3, connection: 1 } },
      { value: 'connect', compass: 'Reconnect', label: 'Reconnection with someone',         note: 'Shared presence and meaningful time, not just a celebration.',   weights: { connection: 3, heritage: 1 } }
    ]
  },
  {
    id: 'companions',
    question: 'Who is traveling?',
    options: [
      { value: 'solo',    label: 'On my own',        weights: { rainforest: 2, longevity: 1 } },
      { value: 'partner', label: 'With a partner',   weights: { connection: 2 } },
      { value: 'friends', label: 'With friends',     weights: { movement: 1, heritage: 1 } },
      { value: 'family',  label: 'With family',      weights: { heritage: 1, movement: 1, ocean: 1 } }
    ]
  },
  {
    id: 'pace',
    question: 'What pace feels right?',
    help: 'There is no correct answer here. The island works at all three.',
    options: [
      { value: 'still',  label: 'Almost still',   note: 'Very little scheduled. Long, unhurried days.',        weights: { longevity: 2, ocean: 2 } },
      { value: 'gentle', label: 'Gentle',         note: 'A little structure. Walking pace.',                    weights: { rainforest: 2, heritage: 1, connection: 1 } },
      { value: 'active', label: 'Active',         note: 'Real movement, with recovery built around it.',        weights: { movement: 3 } }
    ]
  },
  {
    id: 'recognition',
    question: 'Does any of this sound familiar?',
    help: 'Answering yes simply adds one option to your results. Nothing else changes.',
    eclipseGate: true,
    options: [
      { value: 'yes', label: 'Yes, some of it',       note: 'Still functioning, still meeting expectations — but sleep no longer fully restores, and effort has replaced ease.' },
      { value: 'no',  label: 'Not really',            note: 'I am looking for a good journey, not a recovery from anything.' }
    ]
  }
];

module.exports = {
  key: 'journey',
  path: '/journey',
  layout: 'destination',
  surface: 'consumer',
  title: 'Find My WELL Journey — Discover Saint Lucia WELL',
  description: 'Answer four questions and see which of Saint Lucia’s six wellness villages match what you actually need — with the experiences and places inside them.',
  ogTitle: 'Find My WELL Journey',
  js: ['/js/journey.js'],

  /* Handed to the client as JSON. Villages are trimmed to what the result view
     renders, so the payload stays small. */
  finderData: {
    questions: QUESTIONS,
    villages: VILLAGES.map((v) => ({
      key: v.key, name: v.name, short: v.short, color: v.color, ink: v.ink,
      subline: v.subline, body: v.body, themes: v.themes.slice(0, 4),
      anchors: v.anchors.map((a) => a.name)
    })),
    experiences: EXPERIENCES
  },

  sections: [
    /* This page was the thinnest on the site: one section, no header, no exit.
       It is also the primary consumer conversion path, so it now gets the same
       editorial framing every other page has — and, importantly, a route for
       the visitor who decides part-way through that they would rather browse. */
    {
      type: 'pageHeader',
      eyebrow: 'The WELL Journey Finder',
      headline: 'Begin with how you want to feel.',
      lead: 'Four questions, about a minute, and the parts of Saint Lucia that answer what you actually need. No account, and nothing is stored.',
      meta: ['Four questions', 'About a minute', 'Nothing stored']
    },

    {
      type: 'finderApp',
      id: 'finder',
      headline: 'What are you looking for?',
      lead: 'There are no wrong answers here. Start with whatever is loudest.',
      questions: QUESTIONS,
      villages: VILLAGES,
      staticIntro: 'Saint Lucia WELL organizes the island into six wellness villages — six ways of understanding what each part of the island contributes to a journey. Below is each one, with what it is best suited to. To have a journey shaped around you, speak with a Saint Lucia WELL Advisor.',
      advisorCta: { label: 'Speak with an advisor', href: '/about#contact' },
      exploreCta: { label: 'Explore all six villages', href: '/explore#villages' }
    },

    /* Not everyone finishes a quiz, and a dead end is a lost visitor. Both
       routes out of this page are real destinations, not a repeat of the CTA
       they just declined. */
    {
      type: 'lens',
      id: 'other-ways',
      headline: 'Would you rather just look around?',
      lead: 'The Finder is a shortcut, not a gate. Everything it points at is browsable directly.',
      items: [
        { title: 'The six villages', href: '/explore#villages', text: 'Read them side by side and pick the one that sounds like you. Each carries its own experiences and places.' },
        { title: 'What the island does', href: '/explore#experiences', text: 'Volcano, waterfalls, rainforest, cacao estates and open water — grouped by what they do for you.' },
        { title: 'Eclipse', href: '/eclipse', text: 'The one fully sequenced signature journey, for when rest alone is no longer enough.' }
      ]
    },

    {
      type: 'finalCta',
      id: 'begin',
      headline: 'Or start with a conversation.',
      lead: 'A Saint Lucia WELL Advisor can shape the whole thing around you — the Finder simply gives you a place to begin.',
      primaryOverride: { label: 'Speak with an advisor', href: '/about#contact' },
      secondary: { label: 'Explore the island', href: '/explore' },
      video: { webm: '/assets/video/seacliff-loop.webm', mp4: '/assets/video/seacliff-loop.mp4' },
      img: {
        base: '/assets/cta/cta-seacliff', widths: [960, 1440], w: 1456, h: 624,
        src: '/assets/cta/cta-seacliff-1440.jpg', alt: ''
      }
    }
  ]
};
