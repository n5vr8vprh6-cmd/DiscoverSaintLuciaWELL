/* ============================================================================
   /privacy — PRIVACY POLICY
   ----------------------------------------------------------------------------
   WRITTEN FROM THE CODE, NOT FROM A TEMPLATE.
   Every claim here was checked against what the site actually does:

     · js/attribution.js  — sessionStorage, never a cookie, never transmitted
                            except as the campaign-visit ping below
     · js/journey.js      — Finder answers stay in the browser; the result is
                            reproducible from the URL hash alone
     · js/analytics.js    — events queue on dataLayer; GTM_ID is empty, so no
                            analytics request leaves the browser today
     · api/visit.js       — records that an advisor's link was used
     · api/share.js       — the ONLY place consumer contact details are stored,
                            and only after an explicit action
     · lib/page.js        — loads fonts from Google, which sees the visitor's IP
     · advisors/foundations — loads GSAP/Lenis from jsDelivr, same

   If any of those change, this page changes in the same commit. A privacy
   policy that drifts from the code is worse than none, because it is a
   statement people rely on.

   TWO PLACEHOLDERS, MARKED. The legal entity and its jurisdiction are not in
   the repo and must not be guessed — a policy naming the wrong controller is
   not a cosmetic error. They carry the site's `[ … ]` unconfirmed marker until
   Duncan supplies them, and Duncan is having this page reviewed before the
   beta takes real consumer data.
   ========================================================================== */
'use strict';

const ENTITY = '[ legal entity to confirm ]';
const JURISDICTION = '[ jurisdiction to confirm ]';

module.exports = {
  key: 'privacy',
  path: '/privacy',
  layout: 'destination',
  surface: 'consumer',
  title: 'Privacy — Discover Saint Lucia WELL',
  description: 'What Discover Saint Lucia WELL collects, when, who receives it, how long it is kept, and how to have it deleted.',
  ogTitle: 'Privacy',
  noindex: false,

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'Discover Saint Lucia WELL',
      headline: 'Privacy.',
      lead: 'What we collect, when, who receives it, and how to have it removed. Written to match what the site actually does.'
    },

    {
      type: 'prose',
      id: 'policy',
      updated: '12 August 2026',
      blocks: [
        {
          title: 'The short version',
          body: [
            'You can read this entire site, and complete the WELL Journey Finder, <strong>without telling us who you are</strong>. The Finder runs in your browser; your answers are not sent to us and are not stored.',
            'We only hold your contact details if you deliberately give them to us — by asking us to email you your result, or by choosing to share your Journey with a named travel advisor. Those are two separate choices, and neither happens unless you make it.'
          ]
        },

        {
          title: 'The Journey Finder is anonymous',
          body: [
            'The four questions, the scoring and the result all run inside your browser. Nothing about your answers is transmitted to us when you complete it.',
            'Your result is encoded in the web address itself — that is what lets you bookmark it, return to it, or send the link to someone else. It means the result travels with the link rather than with a record we keep about you. Anyone you send that link to can see the result.',
            'We do count how many Journeys are completed, as a number. That count carries no answers and nothing that identifies you.'
          ]
        },

        {
          title: 'What we collect, and when',
          rows: [
            {
              term: 'Browsing the site',
              def: 'Our host, Vercel, records ordinary web-server information such as IP address, browser type and the page requested. This is standard for any website and is used for security and to keep the site running.'
            },
            {
              term: 'Arriving by an advisor link',
              def: 'If a travel advisor sends you a link that identifies them, we record that their link was used — which advisor, which channel it came from, a random session identifier, the page you landed on and the time. This does not identify you.'
            },
            {
              term: 'Emailing yourself a result',
              def: 'Your email address, and the result you asked us to send. Used only to send you that result and one short introduction to the island.'
            },
            {
              term: 'Sharing a Journey with an advisor',
              def: 'Your name, email address, optionally your phone number, your travel timing, anything you choose to write in the open field, and the Finder answers behind your result. Recorded only when you choose to share, and only then.'
            }
          ]
        },

        {
          title: 'When you share a Journey with an advisor',
          body: [
            'This is the one place where information about you is passed to someone outside our organisation, so it is worth being exact.',
            'If you choose to share your Journey, we send it to <strong>the specific travel advisor named on the button you pressed</strong>, and to no one else. They receive your name, your travel timing and a summary of what your Journey pointed toward, so that they can contact you about planning a trip.',
            'That advisor is an independent travel professional, not an employee of Discover Saint Lucia WELL. Once you are in contact with them, their own privacy practices govern that relationship. We do not sell your details, and we do not pass them to any advisor other than the one you chose.',
            'You will be asked to confirm this explicitly before anything is sent. If you would rather not, the result stays yours and nothing is shared.'
          ]
        },

        {
          title: 'Storage on your device',
          body: [
            '<strong>We do not set advertising or tracking cookies.</strong>',
            'When you arrive through an advisor link we keep a note of which advisor it was in your browser’s session storage, so the connection survives while you move around the site. It is cleared when you close the tab. It is not a cookie and it is not shared with anyone.'
          ]
        },

        {
          title: 'Who else is involved',
          body: [
            'We keep the number of companies handling your information as small as we can. These are the ones that necessarily see something:'
          ],
          rows: [
            { term: 'Vercel', def: 'Hosts the website and serves every page. Sees ordinary web-server information including your IP address.' },
            { term: 'Supabase', def: 'Stores advisor records, campaign-visit counts and shared Journeys. Only holds your contact details if you shared a Journey.' },
            { term: 'Resend', def: 'Sends the notification email to your chosen advisor, and any email you asked us to send you.' },
            { term: 'Google Fonts', def: 'Serves the typefaces this site is set in. Loading a font means Google receives your IP address.' },
            { term: 'jsDelivr', def: 'Serves two animation libraries used on the Well Destination Foundations page only. Same position: it receives your IP address.' }
          ]
        },

        {
          title: 'How long we keep things',
          body: [
            'Campaign-visit records and completion counts are kept for two years, then deleted.',
            'A shared Journey is kept for as long as it is commercially useful to the advisor you sent it to, and no longer than three years, unless you ask us to remove it sooner.',
            'If you asked us to email you a result and later unsubscribe, we remove your address.'
          ]
        },

        {
          title: 'Your rights',
          body: [
            'You can ask us for a copy of what we hold about you, ask us to correct it, or ask us to delete it. We will act on it.',
            'The simplest route is to email <a href="mailto:concierge@discoversaintluciawell.com">concierge@discoversaintluciawell.com</a>. Please tell us the email address you used, so we can find the right record.',
            'If you shared a Journey with an advisor and want the advisor to delete their copy as well, say so and we will pass that on — though you are also free to contact them directly.'
          ]
        },

        {
          title: 'Children',
          body: [
            'This site is intended for adults planning travel. We do not knowingly collect information from anyone under 16. If you believe a child has given us their details, contact us and we will remove them.'
          ]
        },

        {
          title: 'Changes to this page',
          body: [
            'When the site changes what it collects, this page changes with it. The date at the foot of this page is the date of the last change.'
          ]
        },

        {
          title: 'Who we are',
          body: [
            `Discover Saint Lucia WELL is operated by ${ENTITY}, ${JURISDICTION}. For anything on this page, write to <a href="mailto:concierge@discoversaintluciawell.com">concierge@discoversaintluciawell.com</a>.`
          ]
        }
      ]
    }
  ]
};
