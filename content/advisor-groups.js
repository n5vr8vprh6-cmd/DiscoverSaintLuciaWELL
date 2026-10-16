/* ============================================================================
   /advisors/groups — WELL GROUP STUDIO
   ----------------------------------------------------------------------------
   Source: DSW_Claude_Code_Website_Implementation_Brief.md §3.6, 2026-10-11.
   One professional page for experienced advisors and group producers: what a
   collaboration is, who does what, and a qualification form.

   THIS PAGE DOES NOT SELL A PRODUCT. No fee, no commission, no date, no
   availability. It receives commercially qualified group opportunities and
   reads them. The brief is explicit and so are the guards below.

   ── DECISIONS MADE WITH DUNCAN, 2026-10-12 ────────────────────────────────
   · ECLIPSE IS "DESIGNED AROUND YOUR GROUP", NOT A SCHEDULED DEPARTURE.
     content/eclipse.js describes a single sequenced journey and carries no
     group format, schedule or date. The brief's label "Eclipse Signature
     Departure" would have implied departures that do not exist, so the path is
     worded as a collaboration and the word "departure" is used only for the
     custom path, which is by definition built per group.
   · THE FORM IS HELD UNTIL IT CAN STORE WHAT IT COLLECTS. SITE.groupStudio.
     intakeOpen is false until db/migrations/029 has been run. Closed, the page
     says applications open shortly and offers real routes, and renders NO form.
   · UMBRELLA LABEL "PARTNER PROGRAM" is not used on this page at all.

   ── CLAIMS THAT ARE DELIBERATELY NOT MADE ─────────────────────────────────
   · No price, fee, margin or commission, and no "from". (brief §3.6)
   · No "guaranteed", no "fill your group", no promise of sales or sell-out.
   · No claim that DSW operates every departure end to end. The page says what
     DSW does, what the advisor does, and that scope is agreed case by case.
   · No partner named (SITE.partners is empty on purpose), and properties are
     "mapped", never "participating".
   · A concept alone does not guarantee acceptance — said plainly, once.

   NO SELF-SERVICE. No calendar, no booking link, no "book a call". The only
   next step is the application; any invitation to talk is sent privately, by a
   person, after review — the same rule as /practitioners.

   Distinct from /practitioners, and says so: a non-advisor retreat leader or
   practitioner is sent there, and this form never receives them.
   ========================================================================== */
'use strict';

const SITE = require('./site.js');

const open = SITE.groupStudio && SITE.groupStudio.intakeOpen === true;

module.exports = {
  key: 'advisor-groups',
  path: '/advisors/groups',
  layout: 'professional',
  surface: 'advisor',

  title: 'WELL Group Studio for Advisors | Discover Saint Lucia WELL',
  description: 'Have a community, a group opportunity or a retreat concept? Explore a collaboration with Discover Saint Lucia WELL to design and launch a Saint Lucia WELL group journey.',
  ogTitle: 'WELL Group Studio',

  /* The form and the closed panel both use the practitioner form's styling. */
  extraStyles: ['/css/practitioners.css'],
  js: open ? ['/js/groups.js'] : [],

  professionalContext: {
    eyebrow: 'Discover Saint Lucia WELL · For Travel Advisors',
    anchors: [
      { label: 'Advisor overview', href: '/advisors' },
      { label: 'Two paths',        href: '#paths' },
      { label: 'Who does what',    href: '#roles' },
      { label: 'Apply',            href: '#apply' }
    ]
  },

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'WELL Group Studio · For experienced advisors & group producers',
      long: true,
      headline: 'Your group. Your brand. <em>Our destination wellness expertise.</em>',
      lead: 'Have a community, a group opportunity or a retreat concept? Explore a collaboration to turn it into a professionally designed Saint Lucia WELL journey, with support for programme design, property fit, commercial packaging, launch strategy and defined destination coordination.',
      meta: ['By application', 'You lead the audience', 'Scope agreed case by case'],
      actions: [
        { label: 'Explore a group collaboration', href: '#apply' },
        { label: 'See Eclipse', href: '/eclipse' }
      ]
    },

    /* ── 1 · WHY GROUPS ARE HARD ────────────────────────────────────────── */
    {
      type: 'split',
      id: 'why',
      skin: 'paper',
      eyebrow: 'Why groups are hard',
      headline: 'A good idea is not yet a group journey.',
      body: [
        'A group needs the right audience, a programme that holds together, properties that fit it, a price that works, marketing that reaches the right people, and someone accountable for what happens on the ground.',
        'Most good concepts are missing two or three of those. The Studio exists to help with the ones you would rather not build alone, while you stay in charge of the audience you already know.'
      ],
      list: [
        'An audience that already trusts you',
        'A programme with a clear arc, not a list of activities',
        'Properties and experiences that fit it',
        'A commercial shape that works for you and for the travellers',
        'Defined responsibility for each part of delivery'
      ],
      img: {
        src: '/assets/properties/village-movement-960.jpg',
        w: 960, h: 640,
        alt: 'The forested coastline and the Pitons seen from above at first light.'
      }
    },

    /* ── 2 · TWO WAYS TO COLLABORATE ────────────────────────────────────── */
    {
      type: 'lens',
      id: 'paths',
      skin: 'sand',
      eyebrow: 'Two ways to collaborate',
      headline: 'Start from Eclipse, or start from your own concept.',
      items: [
        {
          title: 'Eclipse, designed around your group',
          text: 'Eclipse is our signature sequenced journey. For a suitable group and audience, it can be designed around you, subject to terms and programme readiness. There is no fixed schedule: each one is built with the group.',
          href: '/eclipse'
        },
        {
          title: 'A custom-branded WELL departure',
          text: 'Combine your established concept or community with DSW’s destination development. Practitioner partnerships can be part of it where they fit the programme.',
          href: '#apply'
        }
      ]
    },

    /* ── 3 · PROCESS ────────────────────────────────────────────────────── */
    {
      type: 'pathway',
      id: 'process',
      skin: 'paper',
      eyebrow: 'How it works',
      headline: 'Qualify. Design. Package. Activate. Coordinate.',
      lead: 'Five steps, taken together rather than sold separately. Nothing here is priced on this page, and nothing is assumed.',
      steps: [
        {
          title: 'Qualify',
          text: 'We start with the audience and the concept: who you reach, what you have led before, and whether there is a real fit.'
        },
        {
          title: 'Design',
          text: 'Programme architecture and property fit, using the WELL Compass and the six Villages.'
        },
        {
          title: 'Package',
          text: 'The commercial shape of the offer, worked out with you. Terms are agreed with you directly, not read off a page.'
        },
        {
          title: 'Activate',
          text: 'Launch assets and a campaign for your audience, with you leading the conversation with the people who know you.'
        },
        {
          title: 'Coordinate',
          text: 'Agreed destination coordination with the properties and operators involved. What is covered is settled case by case and depends on the agreements in place.'
        }
      ]
    },

    /* ── 4 · WHO DOES WHAT ──────────────────────────────────────────────── */
    {
      type: 'lens',
      id: 'roles',
      skin: 'sand',
      eyebrow: 'Who does what',
      headline: 'Four roles, kept distinct.',
      lead: 'Clarity about responsibility is most of what makes a group work.',
      items: [
        {
          title: 'You, the advisor',
          text: 'You own the traveller relationship, the qualified audience and the sales, and any regulated travel activity runs through your own authorized channels.'
        },
        {
          title: 'Discover Saint Lucia WELL',
          text: 'Wellness journey and programme architecture, destination intelligence, partner matching, and agreed launch and coordination support.'
        },
        {
          title: 'Properties and local operators',
          text: 'Contracted hospitality, ground experiences, transfers and on-site delivery, as applicable to each group.'
        },
        {
          title: 'Qualified practitioners',
          text: 'Specialist assessments, treatments and any clinical scope stay with appropriately qualified practitioners, where the programme includes them.'
        }
      ]
    },

    /* ── 5 · READINESS ──────────────────────────────────────────────────── */
    {
      type: 'split',
      id: 'ready',
      skin: 'paper',
      flip: true,
      eyebrow: 'Readiness',
      headline: 'Who this is for.',
      body: [
        'The best fit is an established advisor, a group producer, or an advisor collaborating with a practitioner or community leader: someone who already has qualified clients, an engaged community or a strong distribution partnership.',
        'A concept alone does not guarantee acceptance, and applications are reviewed individually. If you lead retreats or practise a modality but are not a travel advisor, the practitioner page is the right door.'
      ],
      list: [
        'Existing qualified clients, or an engaged community',
        'Experience producing or leading groups, or a partner who has',
        'The ability to lead the sales to your own audience',
        'A concept that fits a Saint Lucia wellness programme'
      ],
      cta: { label: 'Practitioners & retreat leaders', href: '/practitioners' },
      img: {
        src: '/assets/properties/village-heritage-960.jpg',
        w: 960, h: 640,
        alt: 'A terrace table set for dinner with the Pitons beyond at golden hour.'
      }
    },

    /* ── 6 · THE FORM (or its closed state) ─────────────────────────────── */
    {
      type: 'groupForm',
      id: 'apply',
      skin: 'sand',
      open,
      eyebrow: 'Apply',
      headline: 'Tell us about the group.',
      body: [
        'A few questions about you, the audience and the concept. We read every application and reply by email if there is a relevant collaboration to explore.',
        'There is no fee to apply, and no commitment on either side.'
      ],
      privacy: 'What you share is used to review your application and to reply to you by email. See our <a href="/privacy">Privacy Policy</a>.',

      /* The closed state. Real routes only: the briefing is a live URL and the
         concierge mailbox is already public on nine pages. Nothing here is a
         form, a waitlist or a promise to be told. */
      closedHeadline: 'Applications open shortly.',
      closedBody: [
        'The WELL Group Studio application is being prepared and is not open yet. Nothing on this page is being held for anyone in the meantime.',
        'If you have a group concept and would like to talk before it opens, write to us, or start with the free briefing.'
      ],
      closedRoutes: [
        {
          title: 'Write to us',
          text: 'Tell us briefly about the audience and the concept. A person reads it.',
          label: 'Email the concierge',
          href: 'mailto:concierge@discoversaintluciawell.com?subject=WELL%20Group%20Studio'
        },
        {
          title: 'Join the free briefing',
          text: 'A live hour that includes a short look at the group opportunity.',
          label: 'See the briefing',
          href: '/advisors/intro'
        }
      ]
    },

    {
      type: 'finalCta',
      id: 'begin',
      headline: 'Bring the audience. We’ll bring the island.',
      lead: 'If a group collaboration is not the right next step, the free tools and the briefing are open to every advisor.',
      primaryOverride: { label: open ? 'Explore a group collaboration' : 'Join the free advisor briefing', href: open ? '#apply' : '/advisors/intro' },
      secondary: { label: 'Back to advisor overview', href: '/advisors' },
      img: {
        base: '/assets/cta/cta-dawn', widths: [771], w: 771, h: 330,
        src: '/assets/cta/cta-dawn-771.jpg', alt: ''
      }
    }
  ]
};
