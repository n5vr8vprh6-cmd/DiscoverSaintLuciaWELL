/* ============================================================================
   /journey — THE WELL JOURNEY FINDER
   ----------------------------------------------------------------------------
   The primary consumer conversion engine (brief §13). Everything else on the
   destination layout points here.

   HOW IT WORKS
   Six questions, scored against the six villages, top three returned with the
   experiences that sit inside them. No backend, no account, no stored answers
   until the visitor chooses to share.

   PROGRESSIVE ENHANCEMENT
   Without JavaScript the page is a complete static explainer — the six villages
   described, with routes to /explore and to an advisor. The interactive quiz is
   revealed by js/journey.js only once it can actually run, so no visitor ever
   meets a form that cannot submit.

   SCORING
   `weights` maps an answer to village keys and the points it contributes.
   `intention` and `place` carry the most weight — brief §6 names them as the
   questions that capture desire and environmental pull, and they are allowed to
   compete when they disagree. `orientation` carries NO weights: it changes what
   is proposed inside a village, not which village. `recognition` scores nothing
   either — it decides whether
   Eclipse is surfaced, and it is worded as recognition rather than diagnosis.
   Nobody is told they are burned out by a website.
   ========================================================================== */
'use strict';

const { VILLAGES, EXPERIENCES } = require('./villages.js');

/* The eight Compass directions, taken from the homepage's own Compass section
   rather than retyped here. The result screen shows the same ring the visitor
   met on the way in, and deriving it means the two can never disagree about
   what the eight directions are or what order they sit in. Throwing here is
   deliberate: a silent fallback would ship a compass missing a direction. */
const COMPASS_POINTS = (() => {
  const section = require('./home.js').sections.find((s) => s.type === 'compass');
  if (!section || !section.points || section.points.length !== 8) {
    throw new Error('journey: could not read the eight Compass directions from home.js');
  }
  return section.points.map((p) => (typeof p === 'string' ? p : p.label));
})();

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
    /* ── Q3 · PLACE PULL ─────────────────────────────────────────────────
       Consumer Engine brief §5. Restored 15 August 2026 after the spec review
       found it missing, and it is the one that mattered: §6 names Q1, Q2 and
       Q3 as the highest-weight questions "because they capture desire and
       environmental pull", and this is the direct village signal. Without it
       the whole result rested on `intention` plus two modifiers, which is why
       a slow solo traveller and a slow couple could land in the same place.

       WEIGHTED 4, ONE MORE THAN `intention`, AND THE COVERAGE MATRIX IS WHY.
       At 3 the two questions tied in 18 of the 30 intention x place
       combinations, and every tie was decided by the order of the villages
       array — which handed them to Longevity first, then Nature, then Ocean,
       for no reason a traveller would recognise. Somebody who needed rest but
       pictured food and culture was sent to Longevity, which nothing in their
       answers had mentioned.

       So place wins when they disagree: the villages ARE places, and where you
       pictured yourself is where you will be. The need still shapes what is
       proposed once you are there, and still decides outright when the two
       agree. Reverse this by dropping it back to 3 if the matrix ever says
       otherwise — but re-read the matrix, not the number.

       The six choices map almost one-to-one onto the six villages, which is
       not a coincidence: the villages were built from the island's landscapes.
       Volcanic earth carries a little rainforest with it because Sulphur
       Springs sits inside it. */
    id: 'place',
    question: 'Which Saint Lucia calls you first?',
    help: 'Go with the one you pictured, not the one that sounds most sensible.',
    options: [
      { value: 'ocean',      label: 'The ocean',           note: 'Water, light, and the sound of it from where you sleep.',      weights: { ocean: 4 } },
      { value: 'rainforest', label: 'The rainforest',      note: 'Canopy, waterfalls, and air that smells like rain.',           weights: { rainforest: 4 } },
      { value: 'volcanic',   label: 'The volcanic earth',  note: 'Sulphur springs, mineral heat, the island still working.',      weights: { longevity: 4, rainforest: 1 } },
      { value: 'culture',    label: 'Food and culture',    note: 'Cacao estates, Creole kitchens, markets and music.',            weights: { heritage: 4 } },
      { value: 'adventure',  label: 'Somewhere to climb',  note: 'The Pitons, the trails, the water you get into properly.',      weights: { movement: 4 } },
      { value: 'romance',    label: 'Somewhere for two',   note: 'A place that does not need you to do anything but be there.',   weights: { connection: 4 } }
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
    /* ── Q5 · WELLNESS ORIENTATION ───────────────────────────────────────
       Brief §5, and §9 lists it as a lead-brief field: it is what tells an
       advisor whether to propose a retreat or a holiday, which is the single
       most useful thing to know before the first call.

       IT CARRIES NO VILLAGE WEIGHTS, DELIBERATELY. §6: "Q5 modifies the
       depth/structure of the recommended journey without overriding the
       traveller's place preferences." Any weight at all would make it a
       seventh village signal competing with the two questions that are
       supposed to decide, so the honest reading is zero — it changes what is
       proposed inside a village, not which village.

       Reverse this by giving the options weights if it ever turns out that
       "wellness-led" should genuinely pull toward Longevity. */
    id: 'orientation',
    question: 'What kind of journey sounds like you?',
    help: 'This shapes how much is planned, not where you go.',
    options: [
      { value: 'vacation', label: 'A beautiful vacation, with wellness woven in',
        note: 'Mostly free. The restorative parts are there when you want them.' },
      { value: 'balance',  label: 'A balance of exploring and restoring',
        note: 'Some structure, some space. Days that alternate.' },
      { value: 'led',      label: 'A wellness-led journey with real depth',
        note: 'Built around the restoration, with the island around it.' }
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
  /* Still the destination layout: the server sends the ordinary page, header
     and footer and all, so a visitor without JavaScript gets a complete
     explainer rather than a chrome-less dead end. `appShell` adds one inline
     stamp in <head> that promotes it to a full-screen tool before first paint —
     see the note in lib/page.js for why it cannot be deferred. */
  layout: 'destination',
  appShell: true,
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
      anchors: v.anchors.map((a) => a.name),
      /* Trimmed to what the result card renders. The village photography is
         already built and sized (content/properties-media.js, attached in
         villages.js); this only adds a few strings to the payload, and only
         the three matched images are ever fetched. */
      image: v.image
        ? { base: v.image.base, widths: v.image.widths, alt: v.image.alt }
        : null
    })),
    experiences: EXPERIENCES
  },

  sections: [
    /* This page was the thinnest on the site: one section, no header, no exit.
       It is also the primary consumer conversion path, so it now gets the same
       editorial framing every other page has — and, importantly, a route for
       the visitor who decides part-way through that they would rather browse. */
    /* Everything outside the Finder — this header, the browse-instead section
       and the closing CTA — is the NO-JS page. In app mode all of it is hidden
       before first paint and the Finder takes the viewport. Do not thin it out
       on the assumption nobody sees it: without JavaScript, it is the page. */
    {
      type: 'pageHeader',
      eyebrow: 'The WELL Journey Finder',
      headline: 'Begin with how you want to feel.',
      lead: 'Four questions, about a minute, and the parts of Saint Lucia that answer what you actually need.',
      meta: ['Four questions', 'About a minute', 'No account']
    },

    {
      type: 'finderApp',
      id: 'finder',
      headline: 'What are you looking for?',
      lead: 'There are no wrong answers here. Start with whatever is loudest.',
      questions: QUESTIONS,
      villages: VILLAGES,

      toolName: 'The WELL Journey Finder',

      /* STATE 0. The launch screen carries what used to be spread across a page
         header and a section head: what this is, how long it takes, and the one
         honest line about data. It is also the only place that offers a way out
         other than Exit — once someone has started, we stop inviting them to
         leave. */
      launchHeadline: 'Begin with how you want to feel.',
      launchLead: 'Four questions. About a minute. We match what you are looking for with the parts of Saint Lucia that fit.',
      beginLabel: 'Begin',

      /* ONE trust statement, not three.
         This used to appear in the page lead, again as a meta chip, and a third
         time under the form — and repetition at that volume starts to sound
         like protesting. It was also drifting out of true: the capture form on
         the result *does* transmit an address once the ESP is wired, so a flat
         "nothing is stored" was about to become wrong. This is precise about
         what it covers — the answers — and the email consent line on the result
         speaks for itself separately. */
      privacy: 'Your answers are used to create your result. You do not need to give your name or email to complete the Finder.',

      altPrefix: 'Not ready?',
      altLabel: 'Explore Saint Lucia WELL instead',

      /* The four step names, lit in turn.
         The fourth is FIT, not "Depth". Question 4 is the Eclipse gate and it is
         deliberately worded as recognition rather than diagnosis — see the
         SCORING note at the top of this file. A step labelled "Depth" grades the
         person answering it, which is the one thing this question was written to
         avoid. */
      steps: ['Intention', 'Company', 'Pace', 'Fit'],

      /* STATE 5. Beats that settle as the result renders — the reveal covers the
         work rather than a timer pretending there is some. */
      shapingBeats: ['Intention', 'Place', 'Pace', 'Journey'],

      compassPoints: COMPASS_POINTS,
      compassCentre: 'YOUR COMPASS',

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
