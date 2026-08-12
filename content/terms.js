/* ============================================================================
   /terms — TERMS OF USE
   ----------------------------------------------------------------------------
   Deliberately short, and deliberately not a commercial contract. Nothing is
   sold on this site: the Journey Finder is free, the advisor programmes are
   sold elsewhere, and no booking happens here. So these terms cover what this
   site actually is — an information service that can introduce you to an
   independent travel advisor.

   The load-bearing paragraph is "What this site is not". This site is run by a
   mental health professional and describes wellness travel; it must say plainly
   that it does not give medical advice. That is the same discipline that keeps
   physiological claims out of the copy (see the truth-discipline section of the
   README), stated once in the place a reader would look for it.

   Same two placeholders as /privacy, same reason.
   ========================================================================== */
'use strict';

const ENTITY = '[ legal entity to confirm ]';
const JURISDICTION = '[ jurisdiction to confirm ]';

module.exports = {
  key: 'terms',
  path: '/terms',
  layout: 'destination',
  surface: 'consumer',
  title: 'Terms of use — Discover Saint Lucia WELL',
  description: 'The terms on which Discover Saint Lucia WELL is offered: what the site is, what it is not, and the limits of what it can tell you.',
  ogTitle: 'Terms of use',

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'Discover Saint Lucia WELL',
      headline: 'Terms of use.',
      lead: 'Short, because this site sells nothing and books nothing. What it does, what it does not, and where its limits are.'
    },

    {
      type: 'prose',
      id: 'terms',
      updated: '12 August 2026',
      blocks: [
        {
          title: 'What this site is',
          body: [
            'Discover Saint Lucia WELL is an information service about Saint Lucia as a wellness destination. It describes the island through six wellness villages, the experiences and places within them, and a signature journey called Eclipse.',
            'The WELL Journey Finder is a free tool that suggests which parts of the island answer what you say you are looking for. It is a starting point for a conversation, not a booking and not a recommendation tailored to your circumstances.'
          ]
        },

        {
          title: 'What this site is not',
          body: [
            '<strong>Nothing here is medical, psychological or clinical advice.</strong> Descriptions of rest, recovery, movement and restoration are descriptions of travel experiences. They are not treatment, they are not diagnosis, and they are not a substitute for talking to a qualified professional about your health. If you have a health condition, or you are unsure whether an activity suits you, ask your own clinician.',
            'Nothing here is a booking. We do not take payment for travel, hold reservations, or act as a travel agency.',
            'Nothing here is a guarantee of outcome. We describe what places and experiences are, not how they will make you feel.'
          ]
        },

        {
          title: 'Properties and experiences we name',
          body: [
            'The hotels, resorts, guides and experiences named on this site are independent businesses. We describe them from what they publish about themselves. We do not control them, we do not warrant their availability, pricing, standards or conduct, and being named here is not an endorsement of anything beyond their fit with the village they sit in.',
            'Availability, prices and offerings change without our knowledge. Confirm anything that matters to you directly with the business, or with an advisor.'
          ]
        },

        {
          title: 'Travel advisors',
          body: [
            'If you choose to share your Journey with a travel advisor, that advisor is an independent professional. They are not our employee or our agent, and we are not party to whatever you agree with them.',
            'Advisors who have completed our programmes have been taught a method; that is a statement about their training, not a warranty of their service. Any contract for travel is between you and the advisor, or you and the supplier they book with.'
          ]
        },

        {
          title: 'Accuracy',
          body: [
            'We work hard to describe this island accurately and to publish nothing we cannot support. Even so, this site is provided as it stands: we do not promise it is complete, current or error-free, and content may change without notice.',
            'If you spot something wrong, please tell us — <a href="mailto:concierge@discoversaintluciawell.com">concierge@discoversaintluciawell.com</a>. We would rather fix it than defend it.'
          ]
        },

        {
          title: 'Using the site',
          body: [
            'Please use it as intended. Do not attempt to disrupt it, extract data from it in bulk, submit other people’s personal details through it, or use the advisor-sharing feature to send anything you have not been asked to send.',
            'The text, photography, design and the WELL Compass are ours or licensed to us. You are welcome to link to any page. You may not republish substantial parts of it as your own.'
          ]
        },

        {
          title: 'Liability',
          body: [
            'To the extent the law allows, we are not liable for loss arising from your use of this site or from your dealings with any business or advisor named on it. Nothing here limits liability that cannot lawfully be limited.'
          ]
        },

        {
          title: 'Privacy',
          body: [
            'How we handle information about you is set out separately on the <a href="/privacy">privacy page</a>, which is written from what the site actually does.'
          ]
        },

        {
          title: 'Who we are',
          body: [
            `Discover Saint Lucia WELL is operated by ${ENTITY}, ${JURISDICTION}. These terms are governed by the law of that jurisdiction. Questions: <a href="mailto:concierge@discoversaintluciawell.com">concierge@discoversaintluciawell.com</a>.`
          ]
        }
      ]
    }
  ]
};
