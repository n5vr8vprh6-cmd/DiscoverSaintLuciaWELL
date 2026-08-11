/* ============================================================================
   /eclipse — THE SIGNATURE JOURNEY
   ----------------------------------------------------------------------------
   The only signature journey promoted in V1 (brief §1, §12), and the proof that
   the WELL framework can become a fully designed journey rather than a theme.

   TONE — the hardest thing on this page. Eclipse must read as DEEPER than a
   typical wellness stay without making the Discover Saint Lucia WELL umbrella
   synonymous with burnout (brief §12). So:

     · The recognition section describes a state, never diagnoses a person.
       "Still functioning. No longer restored." — not "you are burned out."
     · Every claim about what Eclipse does is about SEQUENCE, not treatment
       efficacy. We are not making clinical claims.
     · The safety note is not optional furniture. Eclipse is explicitly not a
       substitute for emergency, inpatient or acute medical care, and that
       sentence travels with the fit checklist wherever it appears.

   Copy is verbatim or near-verbatim from the Editorial Founding Edition
   (saint-lucia-well/content/copy.js spreads 15–22). Eclipse keeps the printed
   midnight/copper palette; that shift is deliberate.
   ========================================================================== */
'use strict';

module.exports = {
  key: 'eclipse',
  path: '/eclipse',
  layout: 'destination',
  surface: 'consumer',
  title: 'Eclipse — a curated recovery journey through Saint Lucia',
  description: 'Not another retreat. A return to rhythm. Eclipse is a sequenced recovery journey through Saint Lucia, designed by practitioners and health professionals.',
  ogTitle: 'Eclipse — a return to rhythm',

  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: 'Eclipse',
    description: 'A curated recovery journey through Saint Lucia, designed by practitioners and health professionals and delivered through place, hospitality and experience.',
    touristType: 'Wellness travellers seeking structured recovery',
    provider: { '@type': 'Organization', name: 'Discover Saint Lucia WELL' }
  },

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'Signature journey',
      headline: 'Eclipse',
      lead: 'A curated recovery journey through Saint Lucia — designed by practitioners and health professionals, brought to life through place, hospitality and experience.',
      meta: ['Not another retreat. A return to rhythm.', '13°54′N 60°58′W']
    },

    /* ── RECOGNITION ────────────────────────────────────────────────────── */
    {
      type: 'split',
      id: 'recognition',
      skin: 'eclipse',
      headline: 'Still functioning. No longer restored.',
      body: [
        /* The page previously fell from "a curated recovery journey" straight
           into depletion in one step. This line is the hinge: it names the
           tonal change as deliberate before the reader has to absorb it. */
        'Most Saint Lucia WELL journeys begin with what you want more of. Eclipse begins with what has stopped restoring you.',
        'They are still showing up. Still meeting expectations. Still carrying what needs to be carried.',
        'But sleep no longer fully restores. Effort has replaced ease. The body, mind and emotions no longer seem to move together.',
        'Eclipse is designed for this quieter form of depletion — not only collapse, but the gradual loss of internal rhythm.'
      ],
      /* Dropped "You are not broken." — asserting it puts the idea of being
         broken in front of the reader in order to deny it, which is the one
         thing this page is otherwise careful never to do. The second sentence
         was always carrying the meaning. */
      closing: 'You may simply be out of rhythm.',
      /* A real Saint Lucia photograph pushed into the Eclipse colour world —
         desaturated, darkened and tinted toward the printed edition's midnight.
         The place is unaltered in form; only the grade moves. The brochure
         already treats Eclipse as a separate colour world, and this is that
         rule applied to photography rather than to page furniture. */
      img: {
        src: '/assets/eclipse/eclipse-recognition-640.jpg',
        w: 640, h: 800,
        alt: 'The Pitons and the sea at low light, drained of colour.'
      }
    },

    /* ── WHAT MAKES IT DIFFERENT ────────────────────────────────────────── */
    {
      type: 'comparison',
      id: 'different',
      eyebrow: 'What makes Eclipse different',
      headline: 'Experience is the intervention.',
      lead: 'The value of Eclipse is not any single treatment, workshop, excursion or property. It comes from how each element is selected, paced and connected.',
      colA: {
        head: 'A typical wellness stay',
        items: [
          'Choose from a menu of activities',
          'Attend experiences independently',
          'Optimize or escape',
          'Limited preparation',
          'Limited support after departure'
        ]
      },
      colB: {
        head: 'Eclipse',
        items: [
          'Experiences intentionally sequenced',
          'Pacing based on readiness',
          'Environment, physiology and emotional work connected',
          'Guided entry before arrival',
          'Integration after returning home'
        ]
      },
      closing: 'Rainforest before deeper reflection. Movement before emotional release. Restoration after intensity. Ocean and sound for integration.'
    },

    /* ── THE ARC ────────────────────────────────────────────────────────── */
    {
      type: 'journeyArc',
      id: 'arc',
      headline: 'Rhythm returns in phases.',
      lead: 'Depletion is rarely created in a single moment. Recovery should not be treated as one either. Eclipse follows a gradual progression that respects readiness and avoids turning wellbeing into another performance demand.',
      phases: [
        { k: 'ARRIVE',   s: 'Safety and softening' },
        { k: 'REGULATE', s: 'Sleep, nourishment and nervous-system support' },
        { k: 'REAWAKEN', s: 'Movement, sensory engagement and vitality' },
        { k: 'RELEASE',  s: 'Guided emotional and somatic work' },
        { k: 'RESTORE',  s: 'Treatments, rest and integration' },
        { k: 'RETURN',   s: 'Clarity, support and continuity' }
      ],
      footnote: 'Nothing is rushed. Nothing is forced. Each stage creates the conditions for the next.'
    },

    /* ── AN ILLUSTRATIVE JOURNEY ────────────────────────────────────────── */
    {
      type: 'dayPlan',
      id: 'five-days',
      headline: 'How the arc becomes days.',
      lead: 'One way the phases can be sequenced. Final pacing is set with you, not for you.',
      days: [
        { d: 'Day 1', t: 'Arrival and Softening',   items: ['Welcome supper', 'Cacao and arrival ritual', 'Guided stillness', 'Early sleep support'] },
        { d: 'Day 2', t: 'Reawakening',             items: ['Coastal walking meditation', 'Gentle movement', 'Breath and body awareness', 'Restorative free time'] },
        { d: 'Day 3', t: 'Earth and Nightfall',     items: ['Pitons, waterfalls or volcanic landscape', 'Nature immersion', 'Expressive movement', 'Nighttime sound and Yoga Nidra'] },
        { d: 'Day 4', t: 'Restoration and Heart',   items: ['Massage or recovery therapies', 'Supported wellbeing options', 'Breathwork and sound', 'Water or lantern ritual'] },
        { d: 'Day 5', t: 'Integration and Return',  items: ['Learning salon', 'Guided reflection', 'Float or sound integration', 'Closing dinner', 'Return-home commitments'] }
      ],
      footer: 'Illustrative only. Final sequencing, properties and experiences are subject to programme design and partner confirmation.'
    },

    /* ── SIGNATURE EXPERIENCES ──────────────────────────────────────────── */
    {
      type: 'tileGrid',
      id: 'experiences',
      eyebrow: 'Signature Eclipse experiences',
      headline: 'Nine experiences, sequenced across the journey.',
      tiles: [
        { t: 'First Light',         s: 'Arrival supper, cacao and guided stillness' },
        { t: 'The Rising Tide',     s: 'Walking meditation and rhythm-led movement' },
        { t: 'Earth Descent',       s: 'Pitons, waterfall and volcanic nature journey' },
        { t: 'The Phoenix Passage', s: 'Breathwork and guided visualization' },
        { t: 'The Tides Within',    s: 'Sound, breath and emotional integration' },
        { t: 'Nightfall',           s: 'Sleep-focused restoration with Yoga Nidra' },
        { t: 'The Learning Salon',  s: 'Energy audit, learning and recovery pathways' },
        { t: 'TheLifeCo Therapies', s: 'Optional physiological recovery support' },
        { t: 'Ocean Within',        s: 'Twilight sound, water and closing integration' }
      ]
    },

    /* ── THE TEAM ───────────────────────────────────────────────────────── */
    {
      type: 'expertise',
      id: 'team',
      headline: 'Designed by specialists. Personalized by your advisor.',
      roles: [
        { role: 'Practitioners and health professionals', text: 'Design the recovery architecture, sequencing and facilitation.' },
        { role: 'Properties and hospitality teams',        text: 'Create the environments, service and comfort that allow the journey to unfold.' },
        { role: 'Local guides and cultural partners',      text: 'Bring Saint Lucia’s nature, food, stories and traditions to life.' },
        { role: 'Your travel advisor',                     text: 'Personalizes flights, rooms, companion travel, pre- and post-stays and everything around the journey itself.' }
      ],
      pullquote: 'The recovery journey is curated. The travel experience remains personal.'
    },

    /* ── FIT + SAFETY ───────────────────────────────────────────────────── */
    {
      type: 'checklist',
      id: 'fit',
      eyebrow: 'Is this for you?',
      headline: 'Eclipse may be for you if…',
      items: [
        'You are still performing, but recovery no longer holds.',
        'Rest helps briefly, but does not feel sufficient.',
        'Your pace no longer matches who you are becoming.',
        'You want depth without a harsh or overly clinical environment.',
        'You value privacy, thoughtful guidance and exceptional hospitality.',
        'You are ready to participate in recovery, not simply observe it.'
      ],
      noteTitle: 'What Eclipse is not',
      note: 'Eclipse is not a substitute for emergency, inpatient or acute medical care, and it is not a clinical treatment programme. Guest suitability is considered through a guided entry process before booking.'
    },

    /* ── THE RETURN ─────────────────────────────────────────────────────── */
    {
      type: 'split',
      id: 'return',
      skin: 'eclipse',
      flip: true,
      headline: 'The journey does not end at departure.',
      body: [
        'Guests return to the same responsibilities, relationships and environments. What changes is how they meet them.',
        'Eclipse includes preparation before arrival and a pathway for integration afterwards, helping insights become lived practices rather than distant memories.'
      ],
      closing: 'Return with greater rhythm, clarity and capacity.',
      cta: { label: 'Speak with an advisor', href: '/about#contact' },
      ctaVariant: 'copper',
      /* Deliberately NOT graded. The page opens in the Eclipse world and closes
         in real light — the ungraded frame is the point, and grading it flattened
         the blue-to-gold horizon into mud. */
      img: {
        src: '/assets/dawn-horizon.jpg',
        w: 771, h: 998,
        alt: 'First light over a calm sea, the island low on the horizon.',
        caption: 'The eclipse passing'
      }
    },

    {
      type: 'finalCta',
      id: 'begin',
      headline: 'Not sure Eclipse is the one?',
      lead: 'The Journey Finder starts from what you need, and shows you the parts of the island that answer it — Eclipse included, when it fits.',
      secondary: { label: 'Explore the villages', href: '/explore#villages' },
      img: {
        base: '/assets/cta/cta-dawn', widths: [771], w: 771, h: 330,
        src: '/assets/cta/cta-dawn-771.jpg', alt: ''
      }
    }
  ]
};
