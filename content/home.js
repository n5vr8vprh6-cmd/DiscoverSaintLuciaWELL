/* ============================================================================
   HOMEPAGE — the consumer destination front door
   ----------------------------------------------------------------------------
   Section order is fixed by V4 brief §5 and should not be rearranged without a
   decision. The sequence is an argument:

     feel it → understand the island → understand yourself → see the six worlds
     → personalize → go deeper → see the whole → meet the human → trust it → act

   `Find My WELL Journey` appears three times (hero, after personalization,
   final) per brief §13. It is the dominant CTA on every destination-layout
   page; nothing else on this page may compete with it visually.

   Copy is drawn from the Editorial Founding Edition
   (saint-lucia-well/content/copy.js). Where a line is newly written for the web
   it stays inside the register already established there — declarative,
   unhurried, no hype, no superlatives we cannot support.
   ========================================================================== */
'use strict';

const { VILLAGES } = require('./villages.js');
const SITE = require('./site.js');

module.exports = {
  key: 'home',
  path: '/',
  layout: 'destination',
  surface: 'consumer',
  title: 'Discover Saint Lucia WELL — wellbeing, designed by the island',
  description: 'Saint Lucia as a Well Destination: six wellness villages, island-wide experiences, and Eclipse — a curated recovery journey. Begin with how you want to feel.',
  ogTitle: 'Discover Saint Lucia WELL',

  sections: [

    /* ── 1 · HERO ─────────────────────────────────────────────────────────
       The brief's own hero question. It reframes the category in one line
       without naming a product, which is what an umbrella hero has to do.  */
    {
      type: 'hero',
      skin: 'dark',
      eyebrow: 'Saint Lucia · A Well Destination',
      headline: 'What if your next vacation gave you<br><em>more than a break?</em>',
      /* Kept to one line at desktop on purpose — the hero text block has to
         stay inside the photograph's dark foreground band to remain legible. */
      lead: 'An island organized around how you want to feel.',
      secondary: { label: 'Explore the island', href: '/explore' },
      scrollCue: 'Scroll · the island opens',
      /* Kling cinemagraph from the same frame as the still (kling-video-v2_6,
         locked-off camera, ambient motion only, audio off). Looped by crossfade
         rather than boomerang because the cloud and water motion is directional
         and reads backwards in a boomerang. Verified: the hero scrim holds at
         >=5.03:1 under the glyphs across every frame of the loop, not just the
         poster. */
      video: { webm: '/assets/video/hero-loop.webm', mp4: '/assets/video/hero-loop.mp4' },
      /* Supplied by Duncan 2026-08-10. The Pitons seen through a rainforest
         window, a path leading down to the bay — the brief's framing concept
         exactly. Source is 1456×816 (Midjourney standard download), so the
         derivatives stop at native width; nothing is upscaled. */
      img: {
        src: '/assets/hero-saint-lucia.jpg',
        widths: [768, 1152, 1456],
        w: 1456, h: 816,
        tone: 'twilight'
      }
    },

    /* ── 2 · SAINT LUCIA THROUGH A DIFFERENT LENS ─────────────────────────
       copy.js spread 4 — "Recovery through place". The six elements the brief
       names, each given the brochure's own reasoning.                       */
    {
      type: 'lens',
      id: 'lens',
      eyebrow: 'Saint Lucia through a different lens',
      headline: 'The environment is not the backdrop.',
      lead: 'Different environments invite different states. When they are intentionally sequenced, the destination itself becomes part of the experience.',
      items: [
        { title: 'Ocean',          text: 'Water creates movement and reflection — and, reliably, the downshift that everything else depends on.' },
        { title: 'Rainforest',     text: 'The forest slows attention. Sound becomes textured, breathing noticeable, movement responsive rather than performative.' },
        { title: 'Volcanic earth', text: 'Mineral-rich mud and volcano-heated springs reconnect us with physical sensation. The island has long known this as natural healing.' },
        { title: 'Culture',        text: 'Cacao, cuisine, music and storytelling bring vitality, belonging and perspective — nourishment that is not only what we consume.' },
        { title: 'Movement',       text: 'From a gentle coastal walk to a guided summit. Chosen for your energy and your stage in the journey, never because an activity exists.' },
        { title: 'Connection',     text: 'Hospitality creates safety, ease and care — the conditions that make everything else possible.' }
      ],
      closing: 'Recovery through place.'
    },

    /* ── 3 · BEGIN WITH HOW YOU WANT TO FEEL ──────────────────────────────
       The WELL Compass. copy.js:174. The brief asks for a *light* introduction
       here — the full explanation lives on /about.                          */
    {
      type: 'compass',
      id: 'compass',
      center: 'SAINT LUCIA WELL',

      /* The eight directions were bare words everywhere they appeared — here,
         in the brochure, in the deck. A visitor was asked to "begin with how
         you want to feel" and given no idea what Nourish or Return meant.
         Each now carries one line.

         Five of the eight reuse the Journey Finder's own intention notes
         verbatim (content/journey.js Q1) so the site cannot describe Restore
         one way here and another way three clicks later. The remaining three
         trace to existing material: Explore to the /explore experience groups,
         Return to the Eclipse arc's sixth phase, Celebrate to the Connection
         & Romance village. Nothing here is a claim about a property. */
      points: [
        { label: 'Restore',   note: 'Sleep, quiet, and a nervous system that finally settles.' },
        { label: 'Reconnect', note: 'Shared presence and meaningful time, not just a celebration.' },
        { label: 'Move',      note: 'Movement that returns capacity rather than spending it.' },
        { label: 'Nourish',   note: 'Cacao, Creole cooking, markets, music, the people behind it.' },
        { label: 'Explore',   note: 'Volcano, waterfalls, rainforest and open water — the island met directly.' },
        { label: 'Reflect',   note: 'Decompression, perspective, and room for your own thoughts.' },
        { label: 'Celebrate', note: 'A milestone marked properly — presence rather than performance.' },
        { label: 'Return',    note: 'Rhythm, clarity and capacity that outlast the journey home.' }
      ],
      eyebrow: 'The WELL Compass',
      headline: 'Begin with how you want to feel.',
      lead: 'Traditional travel planning begins with a hotel, a room category, a list of attractions. Saint Lucia WELL begins with a different question: <em>what do you need from this journey?</em>',
      sidebar: {
        title: 'Your journey may combine several directions.',
        text: 'A traveler may arrive seeking rest, rediscover movement, reconnect through culture and finish with reflection by the ocean. The Compass does not replace choice. It gives choice greater meaning.'
      }
    },

    /* ── 4 · SIX WAYS TO EXPERIENCE WELLBEING ─────────────────────────── */
    {
      type: 'villages',
      id: 'villages',
      eyebrow: 'The Wellness Villages',
      headline: 'One destination. Distinct wellbeing worlds.',
      lead: 'The villages are not separate locations or exclusive resort categories. They are a way of understanding what each part of Saint Lucia contributes to the wider journey.',
      villages: VILLAGES,
      hrefBase: '/explore',
      moreLabel: 'Explore this village',
      footnote: 'A property may belong to more than one village. An experience may connect several. Together they reveal the island as a living wellness ecosystem.'
    },

    /* ── 5 · FIND YOUR WAY THROUGH THE ISLAND ─────────────────────────────
       The personalization engine. Brief §13 puts a Finder CTA here.         */
    {
      type: 'finder',
      id: 'finder',
      headline: 'Find your way through the island.',
      lead: 'Six villages, dozens of experiences and an island that rewards sequencing. The Journey Finder connects what you need to where it lives.',
      steps: [
        { title: 'Name the intention', text: 'Not a destination or a date — a direction. Rest, movement, nourishment, reflection, connection.' },
        { title: 'See your villages',  text: 'The parts of the island that answer that intention, with the experiences and places inside them.' },
        { title: 'Make it yours',      text: 'A Saint Lucia WELL Advisor personalizes the sequence around your energy, your time and who you are traveling with.' }
      ],
      note: 'Takes about a minute. No account, no obligation.'
    },

    /* ── 6 · GO DEEPER: ECLIPSE ───────────────────────────────────────────
       The only signature journey promoted in V1 (brief §1, §12). Positioned as
       deeper than a typical wellness stay WITHOUT making the whole umbrella
       synonymous with burnout — hence "when rest alone is no longer enough",
       not "for the burned out".                                             */
    {
      type: 'eclipse',
      id: 'eclipse',
      eyebrow: 'Signature journey',
      headline: 'When rest alone is no longer enough.',
      body: [
        'Some journeys ask for more than a change of scenery. <strong>Eclipse</strong> is a curated recovery journey through Saint Lucia — designed by practitioners and health professionals, brought to life through place, hospitality and experience.',
        'Its value is not any single treatment, workshop or property. It comes from how each element is selected, paced and connected: rainforest before deeper reflection, movement before emotional release, restoration after intensity, ocean and sound for integration.'
      ],
      arcLabel: 'The journey architecture',
      phases: [
        { k: 'ARRIVE',   s: 'Safety and softening' },
        { k: 'REGULATE', s: 'Sleep, nourishment and nervous-system support' },
        { k: 'REAWAKEN', s: 'Movement, sensory engagement and vitality' },
        { k: 'RELEASE',  s: 'Guided emotional and somatic work' },
        { k: 'RESTORE',  s: 'Treatments, rest and integration' },
        { k: 'RETURN',   s: 'Clarity, support and continuity' }
      ],
      cta: { label: 'Discover Eclipse', href: '/eclipse' },
      secondary: { label: 'Explore the island', href: '/explore' }
    },

    /* ── 7 · THE ISLAND IS THE WELLNESS CAMPUS ────────────────────────────
       copy.js:613. The pullquote is verbatim from the brochure.             */
    {
      type: 'split',
      id: 'campus',
      skin: 'paper',
      headline: 'The island is the therapy.',
      body: [
        'The villages are the themes and the properties are the basecamps. Experiences are where wellbeing steps outside — into the volcano, the waterfalls, the forest, the cacao estates and the sea.',
        'Saint Lucia’s landscape does real physiological work: mineral-rich mud and volcano-heated springs, magnesium drawn in on a mountain trail, cool freshwater after heat, slow sensory time beneath the canopy.',
        'None of it is a fixed catalogue. Experiences are coordinated by local partners and paced by your advisor — chosen for your energy, mobility and stage in the journey.'
      ],
      closing: 'You don’t visit the wellness. You move through it.',
      cta: { label: 'Explore the island', href: '/explore' },
      img: {
        tone: 'copper',
        ratio: '4:5',
        src: '/assets/sulphur-springs.jpg',
        w: 896, h: 1162,
        alt: 'Steam rising from the terraced mineral pools of Sulphur Springs, forested Piton slopes behind.',
        caption: 'Sulphur Springs · the drive-in volcano',
        /* Rising steam — a Kling loop already proven on the Foundations page. */
        video: { webm: '/assets/video/sulphur-loop.webm', mp4: '/assets/video/sulphur-loop.mp4' }
      }
    },

    /* ── 8 · HUMAN EXPERTISE ──────────────────────────────────────────────
       Introduces the advisor WITHOUT turning the page B2B (brief §5.8). The
       route to /advisors is deliberately a quiet ghost link, not a CTA.     */
    {
      type: 'expertise',
      id: 'expertise',
      headline: 'Designed by specialists. Personalized by your advisor.',
      lead: 'An island this varied rewards someone who knows how its parts fit together — and knows you.',
      roles: [
        { role: 'Practitioners and health professionals', text: 'Design the recovery architecture, the sequencing and the facilitation behind the signature journeys.' },
        { role: 'Properties and hospitality teams',        text: 'Create the environments, service and comfort that let a journey actually unfold.' },
        { role: 'Local guides and cultural partners',      text: 'Bring Saint Lucia’s nature, food, stories and traditions to life — the island told by the people who live it.' },
        { role: 'Your travel advisor',                     text: 'Personalizes everything around you: room selection, companion travel, pre- and post-stays, pacing, dining, logistics.' }
      ],
      pullquote: 'The journey is curated. The travel experience remains personal.'
    },

    /* ── 9 · CREDIBILITY ──────────────────────────────────────────────────
       Only relationships already stated publicly on the Foundations page.   */
    {
      type: 'credibility',
      id: 'partners',
      label: 'Destination partners',
      eyebrow: 'In collaboration with',
      partners: SITE.partners
    },

    /* ── 10 · FINAL JOURNEY FINDER CTA ────────────────────────────────── */
    {
      type: 'finalCta',
      id: 'begin',
      headline: 'Begin with how you want to feel.',
      lead: 'Six villages, one island, and a journey shaped around you.',
      secondary: { label: 'Read about the approach', href: '/about' },
      /* Rolling swell behind the closing call. Same source frame as the still,
         so the video and its poster are the same picture. */
      video: { webm: '/assets/video/seacliff-loop.webm', mp4: '/assets/video/seacliff-loop.mp4' },
      img: {
        base: '/assets/cta/cta-seacliff', widths: [960, 1440], w: 1456, h: 624,
        src: '/assets/cta/cta-seacliff-1440.jpg', alt: ''
      }
    }
  ]
};
