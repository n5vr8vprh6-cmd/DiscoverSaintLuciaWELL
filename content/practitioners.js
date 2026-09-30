/* ============================================================================
   /practitioners — PRACTITIONERS & RETREAT LEADERS
   ----------------------------------------------------------------------------
   Source: DSW_Practitioners_Retreat_Leaders_Implementation_Brief.pdf, V1.0,
   2026-09-29. One professional page, two pathways:

     PRIMARY    Retreat Collaboration — qualification form → DSW review → email
     SECONDARY  Visiting Practitioner Network — same form → same review → email

   NO SELF-SERVICE ANYWHERE. No calendar, no booking link, no "book a call", not
   on the page and not in the success state. The only next step this page offers
   is the application; any invitation to talk is sent privately, by a person,
   after review. tools/practitioner-test.js checks the rendered HTML for it.

   DSW IS THE QUALIFIER AND ORCHESTRATOR, not a directory or an open marketplace
   (brief, Strategic guardrail). That is why the copy says "we work selectively",
   why there is a form and not a profile builder, and why nothing here lists or
   names a practitioner.

   ── DECISIONS MADE WITH DUNCAN, 2026-09-29 (they override the brief) ─────────
   · The footer link lives in the fourth footer column above About, not a fifth
     column, and there is NO header nav item (content/site.js).
   · The Visiting Practitioner Network is not labelled "in development". It is
     described as one that is always growing, and the no-guarantee sentence
     stays: joining does not guarantee a placement or residency.
   · The six capability cards, and the travel-advisor network handling group
     bookings, are CONFIRMED — so they carry no placeholder marker.
   · People imagery may be AI-generated (Midjourney, via Duncan). Until it
     exists, every people slot is an art-directed placeholder that says so in
     the open. When a picture arrives, set `src` (+ `widths` for the hero) on
     that slot and the flag disappears with it.

   ── CLAIMS THAT ARE DELIBERATELY NOT MADE ────────────────────────────────────
   · No partner is named (SITE.partners is empty on purpose).
   · Properties are "Saint Lucia properties", never "participating properties":
     they are mapped, not signed (content/advisors.js).
   · Eclipse is proof of system thinking, not a promise that every retreat
     receives Eclipse-level production. The page says so.
   ========================================================================== */
'use strict';

const P = require('../api/_lib/practitioner.js');

/* One arrow, one place. The brief writes every CTA with a trailing → ; kept in
   the label so the button reads the same wherever it is reused. */
const to = (label) => `${label} →`;

module.exports = {
  key: 'practitioners',
  path: '/practitioners',
  layout: 'professional',
  /* Its own value so the practitioner funnel is separable in analytics from the
     travel-advisor one (js/analytics.js stamps `surface` on every event). No code
     keys off this string; see lib/layouts.js. */
  surface: 'practitioner',

  title: 'Host a Wellness Retreat in Saint Lucia | Discover Saint Lucia WELL',
  description: 'Bring your community and expertise to Saint Lucia. Discover Saint Lucia WELL helps retreat leaders connect with properties, travel advisors, destination experiences and practitioners to build exceptional group wellness journeys.',
  ogTitle: 'Practitioners & Retreat Leaders',

  extraStyles: ['/css/practitioners.css'],
  js: ['/js/practitioners.js'],

  professionalContext: {
    eyebrow: 'Discover Saint Lucia WELL · Practitioners & Retreat Leaders',
    /* One row that scrolls sideways on a phone (brief §01) instead of wrapping. */
    scroll: true,
    anchors: [
      { label: 'Build a Retreat',        href: '#build' },
      { label: 'How It Works',           href: '#how-it-works' },
      { label: 'Visiting Practitioners', href: '#network' },
      { label: 'Apply',                  href: '#apply' }
    ]
  },

  sections: [
    /* ── 02 · HERO — lead with the outcome, not the network ─────────────── */
    {
      type: 'practitionerHero',
      eyebrow: 'For practitioners & retreat leaders',
      headline: 'Bring the work. We’ll help build the retreat around it.',
      lead: [
        'You know your community. You know the work you want to bring into the world.',
        'Discover Saint Lucia WELL helps established practitioners and retreat leaders turn that work into a well-designed Saint Lucia group experience — connecting the property, travel expertise, destination experiences and supporting practitioners around your program.'
      ],
      primary:   { label: 'Build a Retreat in Saint Lucia',          href: '#apply' },
      /* The brief sends this one to the Visiting Practitioner section, not to
         the form: the reader meets the pathway before being asked to apply. */
      secondary: { label: 'Join the Visiting Practitioner Network',  href: '#network' },
      microcopy: 'You bring your community and expertise. We help assemble the ecosystem.',

      /* AI-generated (Midjourney, via Duncan; approved for these slots
         2026-09-29): a small group seated on an open-air terrace at golden hour,
         a Piton behind them, the facilitator at the centre. Derivatives are built
         by tools/build-practitioner-images.py. It is a full-bleed band UNDER the
         headline, not a background behind it (see practitionerHero), so no
         scrim sits on the people. */
      img: {
        base: '/assets/practitioners/practitioners-hero', widths: [960, 1440, 2000],
        w: 2000, h: 853,
        alt: 'A facilitator and a small group seated on an open-air terrace at golden hour, with the Pitons rising behind them.'
      }
    },

    /* ── 03 · VALUE PROPOSITION — make the complexity visible, then remove it */
    {
      type: 'ecosystem',
      id: 'value',
      eyebrow: 'Your work deserves more than a venue',
      headline: 'Leading the retreat shouldn’t mean becoming the travel operator.',
      body: [
        'A powerful retreat requires more than finding available rooms.',
        'There is the property. Group rates. Payments. Flights. Transfers. Insurance. Excursions. Guest questions. Experience design. Marketing. And the question that matters most:',
        '<span class="practitioner-question">Will your community actually want to come?</span>',
        'Discover Saint Lucia WELL helps organize those pieces around the work only you can deliver.'
      ],
      diagramLabel: 'Who does what around your program',
      nodes: [
        { pos: 'core',   k: 'Your Practice',                 t: 'Signature offer, community, facilitation.' },
        { pos: 'top',    k: 'Discover Saint Lucia WELL',     t: 'Program design, property matching, destination intelligence, launch strategy.' },
        { pos: 'left',   k: 'Saint Lucia property',          t: 'Accommodation, wellness spaces, food, hospitality, group infrastructure.' },
        { pos: 'right',  k: 'Travel advisor',                t: 'Booking, payments, insurance, flights, transfers and guest servicing.' },
        { pos: 'bottom', k: 'Supporting practitioners',      t: 'Complementary expertise when the program benefits from it.' }
      ]
    },

    /* ── 04 · RETREAT COLLABORATION — what DSW actually helps assemble ──── */
    {
      type: 'capabilities',
      id: 'build',
      eyebrow: 'Retreat Collaborations',
      headline: 'Your program. Your community. A Saint Lucia experience designed around both.',
      lead: [
        'Come with an established program or the beginnings of an idea.',
        'We can help refine the retreat proposition, identify the Saint Lucia environment and property that best fits your audience, connect the right travel advisor, and build the supporting experience around your work.',
        'The objective is not to squeeze your retreat into an available hotel. It is to find the right setting for the transformation you already know how to lead.'
      ],
      items: [
        { t: 'Shape the offer',               s: 'Clarify the audience, promise, journey and structure around your existing methodology.' },
        { t: 'Find the right property',       s: 'Match the retreat to the environment, accommodation, wellness infrastructure, capacity and experience your participants require.' },
        { t: 'Build the travel layer',        s: 'A Saint Lucia WELL travel advisor can handle group bookings, payments, insurance, travel arrangements, transfers and guest servicing.' },
        { t: 'Design the wider journey',      s: 'Connect the program to Saint Lucia WELL experiences, local partners and the wider destination.' },
        { t: 'Strengthen the practitioner team', s: 'Where appropriate, introduce complementary expertise from the wider practitioner ecosystem.' },
        { t: 'Take it to market',             s: 'Develop positioning, launch strategy and co-branded campaign assets to activate your community.' }
      ],
      cta: { label: to('Tell Us About Your Retreat'), href: '#apply' }
    },

    /* ── 05 · HOW IT WORKS — simple enough to understand at a glance ────── */
    {
      type: 'pathway',
      id: 'how-it-works',
      skin: 'paper',
      timeline: true,
      eyebrow: 'How it works',
      headline: 'From signature work to group departure.',
      steps: [
        { title: 'Qualify',  text: 'Tell us about your practice, community, program and what you want to create.' },
        { title: 'Design',   text: 'If there is a fit, we shape the concept, guest profile, experience requirements and commercial model with you.' },
        { title: 'Assemble', text: 'We identify the appropriate property, travel advisor, destination experiences and supporting collaborators.' },
        { title: 'Activate', text: 'Together, the practitioner, advisor, property and DSW take the retreat to market and prepare for the group’s arrival.' }
      ],
      /* Two sentences, so the break is written in: each line is one thought.
      The shared .pullquote is a narrow measure built for a single short line and
      wrapped this one mid-sentence ("The / ecosystem"). */
      closing: 'You remain focused on the work your guests came for.<br>The ecosystem handles what surrounds it.'
    },

    /* ── 06 · DESTINATION CREDIBILITY, then Eclipse as proof of concept ─── */
    {
      type: 'destination',
      id: 'destination',
      eyebrow: 'A destination already organized for wellbeing',
      headline: 'You don’t have to build Saint Lucia from scratch.',
      body: [
        'Discover Saint Lucia WELL organizes the destination through the WELL Compass, Wellness Villages, properties, experiences, practitioners and trained travel advisors.',
        'Your retreat can draw from that ecosystem rather than assembling unrelated activities around a hotel stay.'
      ],
      /* A real photograph, already on the site (the Foundations sea-cliff frame).
         Saint Lucia as the setting the work happens IN — water, rock, a Piton —
         not a tropical backdrop. */
      img: {
        src: '/assets/sea-cliff-wide.jpg', w: 1456, h: 668,
        alt: 'Clear water breaking over dark volcanic rock, with one of the Pitons rising in the distance.'
      },
      cta: { label: to('Explore the Saint Lucia WELL ecosystem'), href: '/explore' },
      eclipse: {
        id: 'eclipse-proof',
        kicker: 'Proof of concept: Eclipse',
        headline: 'Eclipse is one example of what this looks like in practice.',
        body: [
          'Eclipse was built as a sequenced recovery journey rather than a collection of wellness activities — connecting practitioners, hospitality, environment and experience around a defined guest outcome.',
          'Your retreat does not need to look like Eclipse. It demonstrates what becomes possible when the program, people, property and destination are designed together.'
        ],
        cta: { label: to('Explore Eclipse'), href: '/eclipse' },
        /* Visible, on purpose. The brief's guardrail: proof of system thinking,
           not a blanket promise of Eclipse-level production for every retreat. */
        note: 'Eclipse shows the thinking behind the system. It is not a promise that every retreat receives the same scope of production.'
      }
    },

    /* ── 07 · VISITING PRACTITIONER NETWORK — the secondary pathway ─────── */
    {
      type: 'network',
      id: 'network',
      eyebrow: 'Visiting Practitioner Network',
      headline: 'Bring a distinctive practice to the island.',
      body: [
        'Not every practitioner needs to lead a group.',
        'We’re always growing and developing our Visiting Practitioner Network — experienced practitioners whose work may complement the wellness strategy, programming or guest experience of Saint Lucia properties.',
        'Tell us about your expertise, how you work and the environments in which your practice is most effective.',
        'When a relevant opportunity emerges, Discover Saint Lucia WELL may introduce qualified practitioners to properties seeking that kind of expertise.'
      ],
      /* Not small print — this is the sentence the section depends on. */
      qualification: 'Joining the network does not guarantee a placement or residency. Opportunities depend on property needs, programming strategy, timing and fit.',
      cta: { label: to('Join the Practitioner Network'), href: '#apply' },

      /* AI-generated (Midjourney, via Duncan; approved 2026-09-29): a facilitator
         and a small group seated on a terrace, the coast beyond. Brief §07 asked
         for varied modalities rather than yoga instructors; this frame is a
         seated group practice, so pair it with a different modality if a second
         image is ever added. */
      img: {
        src: '/assets/practitioners/practitioners-network-960.jpg',
        w: 960, h: 1202,
        alt: 'A facilitator and a small group seated in a circle on an open-air terrace at golden hour, with green hillside and the sea beyond.'
      }
    },

    /* ── 08–09 · QUALIFICATION FORM — selective, useful, easy to complete ── */
    {
      type: 'practitionerForm',
      id: 'apply',
      eyebrow: 'Apply',
      headline: 'Tell us what you want to create.',
      body: [
        'We work selectively so that the practitioner, audience, property and destination are aligned.',
        'Start by telling us about your work. Our team will review your submission and determine the appropriate next step.'
      ],
      privacy: 'What you share is used to review your application and to reply to you by email. See our <a href="/privacy">Privacy Policy</a>.',
      thanks: P.THANKS.retreat
    },

    /* ── 10 · CLOSING — a confident invitation, not another explanation ─── */
    {
      type: 'finalCta',
      id: 'begin',
      /* The break is written in, before the italic: the two halves are two thoughts,
         and without it the line changed from roman to italic mid-way ("best. We’ll"). */
      headline: 'Bring what you do best.<br><em>We’ll explore what Saint Lucia can add around it.</em>',
      lead: 'For established practitioners, retreat leaders and communities ready to create something meaningful in Saint Lucia.',
      /* `?path=` is read by js/practitioners.js so these two land on the form with
         the right pathway chosen; without JavaScript they are ordinary links to
         #apply and the form's default (retreat) is already selected. */
      primaryOverride: { label: to('Start a Retreat Collaboration'), href: '/practitioners?path=retreat#apply' },
      secondary:       { label: to('Or join the Visiting Practitioner Network'), href: '/practitioners?path=visiting#apply' },
      video: { webm: '/assets/video/cta-dawn-loop.webm', mp4: '/assets/video/cta-dawn-loop.mp4' },
      img: {
        base: '/assets/cta/cta-dawn', widths: [771], w: 771, h: 330,
        src: '/assets/cta/cta-dawn-771.jpg', alt: ''
      }
    }
  ]
};
