/* ============================================================================
   /advisors/data-undertaking — what an advisor agrees to about a traveller's data
   ----------------------------------------------------------------------------
   THE GAP THIS FILLS. The single point where personal data leaves Empowerment's
   control is an advisor receiving a traveller's name, email, phone and a
   free-text note about what they are looking for. Until this document, that was
   the one point with no agreement covering it: registration said "you agree to
   our terms", but /terms is a consumer document. Read it as an advisor and it
   tells you what the site is not and that properties are independent. It says
   nothing about what you must do with somebody's details.

   Under PIPEDA Principle 4.1.3 an organisation remains accountable for personal
   information transferred to a third party for processing, and is expected to
   use contractual means to secure comparable protection. The Privacy Policy §5
   already tells the consumer their advisor is independent and handles their
   information under their own practices — honest, and not the same thing as
   the advisor having promised anything.

   WRITTEN AS A SEPARATE DOCUMENT, NOT A SECTION OF /terms, because it addresses
   a different reader with different obligations, and because an advisor has to
   be able to read the thing they are accepting without wading through what the
   site is not.

   DELIBERATELY SHORT AND IN PLAIN LANGUAGE. An undertaking nobody reads is one
   nobody follows, and every clause here is something an advisor could actually
   be asked to do on a Tuesday. It is not a DPA — Duncan's lawyer may want one —
   and this file should not pretend otherwise.

   VERSIONED. The string in UNDERTAKING_VERSION is stored on the advisor row the
   moment they accept it, the same evidence pattern as consent_text on a Journey
   share. Changing the wording means bumping the version, which re-gates every
   advisor. That is the intended cost: an acceptance of a document nobody can
   produce is not evidence of anything.

   NOT LEGAL ADVICE.
   ========================================================================== */
'use strict';

/* THE VERSION LIVES IN api/_lib/undertaking.js, and is imported rather than
   repeated. Two copies of a version string is precisely how an acceptance ends
   up recorded against a document that was never the one shown — the page and
   the gate must be unable to disagree. */
const { UNDERTAKING_VERSION } = require('../api/_lib/undertaking.js');

const OPERATOR = 'Empowerment Human Performance Ltd.';
const CONTACT = 'concierge@discoversaintluciawell.com';
const MAILTO = `<a href="mailto:${CONTACT}">${CONTACT}</a>`;

module.exports = {
  key: 'advisor-undertaking',
  path: '/advisors/data-undertaking',
  layout: 'destination',
  surface: 'advisor',
  title: 'Advisor Data Undertaking — Discover Saint Lucia WELL',
  description: 'What a Saint Lucia WELL advisor agrees to when a traveller shares their WELL Journey: use it to plan their trip, keep it safe, delete it when asked.',
  ogTitle: 'Advisor Data Undertaking',
  /* Its own version is exported so api/_lib/undertaking.js and the registration
     form read the same constant. Two copies of a version string is how an
     acceptance ends up recorded against a document that was never shown. */
  version: UNDERTAKING_VERSION,

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'For advisors',
      headline: 'What you agree to about a traveller’s data.',
      lead: 'When someone shares their WELL Journey with you, they hand a stranger their name, ' +
            'their phone number and something honest about what they are looking for. This is ' +
            'the short version of what you promise to do with it.',
      meta: [`Version ${UNDERTAKING_VERSION}`]
    },

    {
      type: 'prose',
      id: 'undertaking',
      updated: '14 August 2026',
      blocks: [
        {
          body: [
            `This undertaking is between you — the travel advisor holding a Saint Lucia WELL ` +
            `advisor account — and ${OPERATOR}, which operates Discover Saint Lucia WELL.`,
            'You are an independent professional, not our employee or our agent. Nothing here ' +
            'changes that. It covers one narrow thing: what happens to a traveller’s personal ' +
            'information after we pass it to you.',
            '<strong>Why it exists.</strong> A traveller who shares their Journey is told, by ' +
            'name, that you will receive it. They agreed to reach one travel advisor. They did ' +
            'not agree to enter a mailing list, to be passed around an agency, or to have their ' +
            'details sit in an inbox forever. We remain accountable for what happens to their ' +
            'information after it reaches you, which is why we ask you to agree to this rather ' +
            'than assume it.'
          ]
        },

        {
          title: '1. Use it for their trip',
          id: 'purpose',
          body: [
            'Use what you receive to contact that traveller and help plan the journey they asked ' +
            'about — including passing what is genuinely needed to a hotel, tour operator, ' +
            'airline, insurer or your host agency in order to arrange it.',
            'Do not use it for anything else without asking them first.'
          ]
        },

        {
          title: '2. No mailing lists without asking',
          id: 'marketing',
          body: [
            '<strong>Sharing a Journey is not a marketing opt-in, and we tell them so in the ' +
            'words they agree to.</strong> Adding them to a newsletter, a campaign list or a ' +
            'CRM sequence on the strength of that share breaks the promise we made on your ' +
            'behalf.',
            'If you would like to market to them, ask them, the way you would ask anyone else. ' +
            'Most people say yes to an advisor who has actually helped them.'
          ]
        },

        {
          title: '3. Keep it to yourself, and keep it safe',
          id: 'security',
          body: [
            'Keep their details somewhere access-controlled — your own devices and accounts, ' +
            'protected the way you would protect a client file, not a shared spreadsheet or a ' +
            'group inbox that half an office can read.',
            'Do not sell it, trade it, publish it, or hand it to another advisor. If you work ' +
            'through a host agency, their usual confidentiality applies too.'
          ]
        },

        {
          title: '4. Delete it when they ask, and tell us',
          id: 'erasure',
          body: [
            'A traveller can ask to have their information deleted. If they ask us, we will ' +
            'delete what we hold — and we will ask you to delete your copy, including the ' +
            'notification email we sent you, which we cannot reach.',
            '<strong>Please act on that within 30 days and confirm to us that you have.</strong> ' +
            'That confirmation is the only way we can honestly tell someone their request has ' +
            'been carried out. Without it we have to tell them their data may still exist, ' +
            'which is a poor answer for everyone.',
            'The same applies if they ask you directly. Do it, and let us know so our records ' +
            'match reality.'
          ]
        },

        {
          title: '5. Do not keep it forever',
          id: 'retention',
          body: [
            'We delete a Journey nobody has acted on after 24 months. Please do not hold your ' +
            'copy substantially longer than you have a live reason to — a traveller who never ' +
            'replied three years ago is not a lead, and their wellbeing notes are not something ' +
            'to keep out of habit.',
            'Records you must retain for tax, accounting or your own legal obligations are a ' +
            'different matter, and this does not ask you to breach those.'
          ]
        },

        {
          title: '6. Tell us quickly if it goes wrong',
          id: 'breach',
          body: [
            'If a traveller’s details are lost, exposed, sent to the wrong person, or your ' +
            'email or systems are compromised in a way that could have reached them, ' +
            `<strong>tell us within 72 hours</strong> at ${MAILTO}.`,
            'This is not about blame. Canadian and UK/EU law puts short clocks on assessing a ' +
            'breach and, where the risk is real, telling the people affected and the regulator. ' +
            'We cannot start that clock if we do not know. Telling us late is a much bigger ' +
            'problem than telling us at all.'
          ]
        },

        {
          title: '7. Sensitive information',
          id: 'sensitive',
          body: [
            'We ask travellers not to send medical information, and the form says so. Some ' +
            'people will anyway, and some will write something candid about why they need rest.',
            'Treat that with the discretion it deserves. Do not repeat it to a supplier who does ' +
            'not need it, do not put it in a subject line, and do not use it as a selling point ' +
            'back to them. If someone sends you a diagnosis, you do not need it to book a trip.'
          ]
        },

        {
          title: '8. When your account ends',
          id: 'ending',
          body: [
            'If your account is closed, paused or removed, your access to the Advisor Hub ends ' +
            'and you stop receiving new Journeys.',
            'Travellers already working with you are still your clients — this does not ask you ' +
            'to abandon somebody mid-plan. It does mean you should stop treating the Journeys ' +
            'you hold as a list, and delete what you no longer need.'
          ]
        },

        {
          title: '9. If this is broken',
          id: 'enforcement',
          body: [
            'We may suspend or close an advisor account where this undertaking is not being ' +
            'followed, and we will say why.',
            'This is not a data-processing agreement, and your own legal obligations under ' +
            'Canadian, UK, EU or other applicable privacy law apply regardless of what is ' +
            'written here. Where your host agency or consortium imposes stricter requirements, ' +
            'follow those.'
          ]
        },

        {
          title: '10. Changes',
          id: 'changes',
          body: [
            'If this document changes materially we will ask you to accept the new version the ' +
            'next time you sign in, and the version you accepted is recorded with the date.',
            `Questions: ${MAILTO}.`
          ]
        }
      ]
    }
  ]
};
