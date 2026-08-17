/* ============================================================================
   /advisors/hub — THE TRAVEL ADVISOR HUB, EXPLAINED
   ----------------------------------------------------------------------------
   CONVERSION layout. One action: create a Hub. The public front door to the
   authenticated workspace at /hub.

   THE COPY PROBLEM THIS PAGE HAS TO SOLVE
   `content/advisor-intro.js:92` promises, on the site's own advisor page, that
   this specialty is for people who "want positioning, not another supplier
   login." That line is right, and it is aimed squarely at pages like this one.

   So the page does not sell a portal. A portal is somewhere you go to do
   administration. This is where the people who answered your link arrive — the
   link is the thing that works, and the Hub is where it lands. Every section is
   written from that direction, and none of it describes the Hub as software.

   THE OTHER CONSTRAINT: `content/journey.js:136` and `content/home.js:169`
   promise travellers "No account". That promise is about travellers and must
   stay true. Nothing here may blur it — the account is the advisor's, and the
   consumer never has one. The header eyebrow says "For travel advisors" partly
   for that reason.

   ONLY WHAT EXISTS. The link, the QR code, the Journeys, the briefing and the
   30-day campaign are built and deployed. The advisor designation is not, and
   the pathway on /advisors still honestly calls it "In development". Nothing
   on this page hints otherwise.

   The campaign moved into that first list on 2026-08-17. It had been listed as
   unbuilt since this page was written, which was true then and stopped being
   true when Release D shipped — leaving the site describing a smaller product
   than the one it has. The rule that put campaign creative in the second list
   is the same rule that now moves it to the first: say what shipped.
   ========================================================================== */
'use strict';

module.exports = {
  key: 'advisor-hub',
  path: '/advisors/hub',
  layout: 'conversion',
  surface: 'advisor',
  title: 'The Travel Advisor Hub — Discover Saint Lucia WELL',
  description: 'A free workspace for travel advisors: your own WELL link and QR code, the Journeys people share with you, and a briefing on each one you can pick up the phone with.',
  ogTitle: 'The Travel Advisor Hub',

  conversion: {
    context: 'Professional Tools',
    title: 'The Travel Advisor Hub',
    anchors: [
      { label: 'What it is',   href: '#what' },
      { label: 'What’s in it', href: '#inside' },
      { label: 'How it works', href: '#how' },
      { label: 'Sign in',      href: '/hub/login' }
    ],
    cta: { label: 'Create your Hub', href: '/hub/register' },
    footerCols: [
      {
        title: 'The Hub',
        links: [
          { label: 'What it is',      href: '#what' },
          { label: 'Create your Hub', href: '/hub/register' },
          { label: 'Sign in',         href: '/hub/login' }
        ]
      },
      {
        title: 'The pathway',
        links: [
          { label: 'Complimentary briefing',       href: '/advisors/intro' },
          { label: 'Well Destination Foundations', href: '/advisors/foundations' },
          { label: 'Saint Lucia WELL Immersion',   href: '/advisors/immersion' }
        ]
      }
    ]
  },

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'Free · For travel advisors',
      headline: 'Where the people who answer your link <em>arrive.</em>',
      lead: 'The WELL Journey Finder asks a traveller four questions about how they want to feel. When someone completes it through your link and chooses to share the result, it lands in your Hub — with what they actually asked for, not just an email address.',
      meta: ['Free', 'No card', 'Yours in about a minute']
    },

    /* Why it exists, before what is in it. An advisor deciding whether to
       bother needs the argument, not the feature list. */
    {
      type: 'lens',
      id: 'what',
      eyebrow: 'What it is',
      headline: 'A link that belongs to you, and somewhere for it to land.',
      items: [
        {
          title: 'Not a booking system',
          text: 'Nothing here books anything, holds inventory or touches your commissions. Your own systems keep doing that.'
        },
        {
          title: 'Not a lead list',
          text: 'Nobody is sold to you. Every Journey in your Hub is there because a specific person finished the Finder through your link and chose to send it to you.'
        },
        {
          title: 'A conversation, already started',
          text: 'They have told you how they want to feel, who they are travelling with and roughly when — before you have spoken. That is a better first call than most.'
        }
      ],
      closing: 'The link is the part that works. The Hub is where it lands.'
    },

    {
      type: 'lens',
      id: 'inside',
      eyebrow: 'What’s in it',
      headline: 'Four things, and they all exist today.',
      items: [
        {
          title: 'Your WELL link and QR code',
          text: 'An opaque link — no name in the address — and a QR code generated from it. Put them in a newsletter, on a card, or in a message to ten people you already know.'
        },
        {
          /* Second, not last. The order is the order somebody uses them: you
             get a link, you need something to put around it, then people
             arrive, then you read them. The campaign is how the link gets in
             front of anybody, so it belongs before the arrivals.

             The second sentence is load-bearing. It sets the expectation before
             an advisor meets the gate, and it corrects the misreading that
             matters most — that editing costs something. An advisor who thinks
             editing is metered will not edit, and unedited AI copy published
             under their own name is the exact failure the whole feature is
             built to avoid. */
          title: 'A 30-day campaign, written for you',
          text: 'Four weeks of small actions with the words already written — posts, emails, what to say on a call — each one pointing at your WELL link. Three plans to start with; editing every word of them is free and always will be.'
        },
        {
          title: 'Your Journeys',
          text: 'Everyone who shared with you, ordered by who is waiting on a reply rather than by who travels soonest. Stages, notes and dates you can keep on top of.'
        },
        {
          title: 'A briefing on each one',
          text: 'Not a quiz dump. What they asked for in plain sentences, their own words where they wrote any, and a few questions worth asking — assembled only from what they actually answered.'
        }
      ],
      closing: 'What you see is what has been built. The advisor designation is still in development, and the pathway says so.'
    },

    {
      type: 'pathway',
      id: 'how',
      headline: 'Three steps, then it is running.',
      lead: 'There is no setup, no integration and nothing to configure.',
      steps: [
        {
          key: 'create',
          title: 'Create your Hub',
          text: 'Name, email, password. You are in immediately, with your link and QR code ready to copy.',
          cta: { label: 'Create your Hub', href: '/hub/register' }
        },
        {
          key: 'share',
          title: 'Put your link somewhere',
          text: 'Ten people you already know works better than a broadcast, and it is quicker. You can see how many arrived and how many finished.'
        },
        {
          key: 'answer',
          title: 'Answer the ones who raise a hand',
          text: 'A Journey shared with you is someone asking to be helped. Replying in the first day or two is what turns it into a conversation.'
        }
      ],
      /* The one thing that would be dishonest to omit. Registration is open and
         immediate; RECEIVING Journeys is not, and an advisor who found that out
         only after handing out their link would rightly be annoyed. */
      footnote: 'One honest caveat: you get the Hub and your link straight away, but we confirm you are a working travel advisor before consumers are offered the option to share a Journey with you. It is a short conversation, not a queue.'
    },

    {
      type: 'contact',
      id: 'talk',
      eyebrow: 'Before you sign up',
      headline: 'Would you rather speak to someone?',
      lead: 'The confirmation step is a conversation anyway, so there is no harm in having it first.',
      routes: [
        {
          title: 'Ask a question',
          text: 'About the Hub, the villages, or whether this specialty fits the business you already run.',
          label: 'Get in touch',
          href: '/about#contact'
        },
        {
          title: 'Start with the briefing',
          text: 'A complimentary hour on what a Well Destination is and what selling one asks of you. No prerequisite, no pressure.',
          label: 'See the briefing',
          href: '/advisors/intro'
        },
        {
          title: 'Already have a Hub',
          text: 'Your Journeys, your campaign link and your account are where you left them.',
          label: 'Sign in',
          href: '/hub/login'
        }
      ]
    },

    {
      type: 'finalCta',
      id: 'start',
      headline: 'Create your Hub.',
      lead: 'Free, about a minute, and you leave with a link you can use the same afternoon.',
      primaryOverride: { label: 'Create your Hub', href: '/hub/register' },
      secondary: { label: 'Sign in', href: '/hub/login' },
      /* cta-seacliff rather than cta-dawn: intro and immersion both close on
         dawn, and the README asks for these to alternate across pages. */
      img: {
        base: '/assets/cta/cta-seacliff', widths: [960, 1440], w: 1440, h: 617,
        src: '/assets/cta/cta-seacliff-1440.jpg', alt: ''
      }
    }
  ]
};
