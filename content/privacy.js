/* ============================================================================
   /privacy — PRIVACY POLICY
   ----------------------------------------------------------------------------
   Public-facing text supplied by Duncan (Privacy Policy + Implementation Guide,
   12 August 2026), operator Empowerment Human Performance Ltd. That document
   is the source of truth for this page; it replaced an earlier draft written
   from the code alone, which had the right shape but no legal entity.

   TWO PROCESSORS WERE ADDED TO §10, AND THE ADDITION IS DELIBERATE.
   The supplied guide instructs (page 11): "Flag discrepancies between the
   policy and the actual implementation for human review." Auditing the repo
   against the vendor list turned up two the policy did not name:

     · RESEND — sends the advisor notification when a consumer shares a
       Journey, so it processes consumer name, email and travel context. An
       undisclosed processor of personal data is the dangerous direction of
       error, so it is listed here rather than left for later.
     · JSDELIVR — serves the GSAP/Lenis libraries on the Foundations page.
       Loading a script from a CDN discloses the visitor's IP address to it.

   Going the other way, the policy names technologies this site does not yet
   load — Encharge, Meta, Stripe, ThriveCart, OpenAI, Anthropic, and Google
   Analytics (GTM_ID in js/analytics.js is empty, so no request is made). The
   wording is "may use ... depending on configuration", which is forward-looking
   rather than inaccurate, so it stands. §7's rule is the one to keep in view if
   that changes: the policy must reflect the scripts actually deployed.

   NOT LEGAL ADVICE, AND NOT A SUBSTITUTE FOR THE REVIEW DUNCAN HAS PLANNED.
   ========================================================================== */
'use strict';

const OPERATOR = 'Empowerment Human Performance Ltd.';
const CONTACT = 'concierge@discoversaintluciawell.com';
const MAILTO = `<a href="mailto:${CONTACT}">${CONTACT}</a>`;

module.exports = {
  key: 'privacy',
  path: '/privacy',
  layout: 'destination',
  surface: 'consumer',
  title: 'Privacy Policy — Discover Saint Lucia WELL',
  description: 'How Empowerment Human Performance Ltd. collects, uses, discloses, retains and protects personal information through Discover Saint Lucia WELL.',
  ogTitle: 'Privacy Policy',

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'Discover Saint Lucia WELL',
      headline: 'Privacy Policy.',
      lead: `Operated by ${OPERATOR}. What we collect, how we use it, who receives it, and the choices available to you.`,
      meta: ['Effective 12 August 2026']
    },

    {
      type: 'prose',
      id: 'policy',
      updated: '12 August 2026',
      blocks: [
        {
          body: [
            `${OPERATOR} (“Empowerment,” “we,” “us,” or “our”) operates Discover Saint Lucia WELL, including the website, Journey Finder, advisor-facing tools, educational programs, communications, and related services (collectively, the “Services”).`,
            'We respect your privacy and aim to collect, use, disclose, retain, and protect personal information in a transparent and proportionate manner. This Privacy Policy explains our practices and the choices and rights that may be available to you depending on where you live.',
            `Contact: ${MAILTO}<br>Mail: ${OPERATOR}, 540-5 Hanna Avenue, Toronto, Ontario M6K 0B3, Canada`
          ]
        },

        {
          title: '1. Scope',
          id: 'scope',
          body: [
            'This Policy applies to personal information handled through Discover Saint Lucia WELL, including when you browse the website, use the Journey Finder, choose to share a WELL Journey with a travel advisor, subscribe to communications, register for a webinar or educational program, make a purchase, contact us, or use an advisor account or Advisor Hub.',
            'This Policy does not govern the independent privacy practices of travel advisors, host agencies, hotels, airlines, tour operators, wellness providers, or other third parties. Where you choose to share information with an independent travel advisor, that advisor may handle the information under their own privacy policy and legal obligations.'
          ]
        },

        {
          title: '2. Information we collect',
          id: 'collect',
          body: ['<strong>A. Information you provide directly</strong>'],
          list: [
            'Contact information, such as name, email address, telephone number, mailing address, or business contact information.',
            'Travel-related information, such as travel timing, party or companion information, preferences, interests, destination intentions, and information you choose to provide about the kind of trip you are seeking.',
            'Journey sharing information, including Journey Finder results and any additional context you voluntarily submit when asking an advisor to contact you.',
            'Advisor account information, including business name, host agency or consortium affiliation, market, website or social profiles, specialties, campaign preferences, and account credentials.',
            'Registration and communications information for briefings, webinars, Foundations, Immersion, newsletters, events, waitlists, or similar programs.',
            'Purchase and transaction information. Payment card details are generally handled by our payment providers rather than stored directly by us.',
            'Messages, feedback, survey responses, support requests, testimonials, and other information you voluntarily provide.'
          ]
        },
        {
          body: [
            '<strong>B. Journey Finder information</strong>',
            'The Journey Finder is designed so that you may complete the core experience without identifying yourself. Your answers may be processed in your browser or otherwise used to generate your Journey result. We do not require you to provide contact information merely to receive a Journey result.',
            'If you later choose to share your Journey with an advisor, we may associate your Journey result and relevant responses with the contact information you provide. Some Journey responses may reflect personal wellbeing interests or intentions. <strong>Please do not submit medical records, diagnoses, or other information that is not needed for travel planning.</strong>'
          ]
        },
        {
          body: ['<strong>C. Information collected automatically</strong>'],
          list: [
            'Device and browser information, IP address, approximate location derived from IP, operating system, language, referring pages, and similar technical data.',
            'Usage information, such as pages viewed, links clicked, campaign source, session activity, Journey Finder engagement, and interactions with the Services.',
            'Cookie, pixel, local-storage, and similar technology data, subject to applicable consent requirements.'
          ]
        },
        {
          body: [
            '<strong>D. Information from third parties</strong>',
            'We may receive information from service providers, payment processors, marketing and analytics providers, participating travel advisors, host agencies, referral partners, event or program partners, and other sources where permitted by law.'
          ]
        },

        {
          title: '3. How we use personal information',
          id: 'use',
          body: ['We may use personal information to:'],
          list: [
            'Provide, operate, maintain, personalize, and improve the Services.',
            'Generate and display Journey Finder results.',
            'At your request, share your WELL Journey and contact details with a selected or assigned independent travel advisor so they can follow up about travel planning.',
            'Create and administer advisor accounts, attributed campaign links, the Advisor Hub, and Journey workspaces.',
            'Attribute campaign traffic and measure campaign effectiveness.',
            'Register you for briefings, webinars, programs, events, or other requested services.',
            'Process transactions, administer purchases, and maintain transaction records.',
            'Send service, account, security, transactional, or program-related communications.',
            'Send marketing communications where we have an appropriate legal basis or consent, and manage your communication preferences.',
            'Respond to questions, support requests, feedback, privacy requests, and complaints.',
            'Detect, prevent, investigate, or address fraud, misuse, security incidents, technical problems, or unlawful activity.',
            'Comply with legal obligations, enforce agreements, and establish, exercise, or defend legal claims.',
            'Create aggregated or de-identified information for analytics, service improvement, destination-development research, and reporting, where the information no longer reasonably identifies an individual.'
          ]
        },

        {
          title: '4. Legal bases for UK/EEA processing',
          id: 'legal-bases',
          body: ['Where UK GDPR or EU GDPR applies, our legal basis depends on the activity. We may rely on:'],
          list: [
            '<strong>Consent</strong> — for optional marketing, certain cookies or advertising technologies, and other processing where consent is required.',
            '<strong>Contract</strong> — where processing is necessary to provide a service, program, account, or purchase you requested.',
            '<strong>Legitimate interests</strong> — for appropriate business operations such as service improvement, security, fraud prevention, limited analytics, advisor campaign administration, and responding to business inquiries, where those interests are not overridden by your rights.',
            '<strong>Legal obligation</strong> — where processing is necessary to comply with applicable law.'
          ]
        },
        {
          body: ['Where we rely on consent, you may withdraw it at any time, without affecting processing that occurred before withdrawal.']
        },

        {
          title: '5. Sharing your WELL Journey with an independent travel advisor',
          id: 'sharing',
          body: [
            '<strong>Sharing a Journey is optional. Completing the Journey Finder does not automatically send your answers or contact information to a travel advisor.</strong>',
            'If you select an option such as <em>Share My WELL Journey with [Advisor]</em>, you direct us to disclose the information identified at that point — which may include your name, contact information, Journey result, relevant Journey Finder responses, travel timing, and additional context you submit — to that independent advisor so they can contact you about travel planning.',
            'A participating advisor may operate independently or through a host agency or other travel business. Once the advisor receives your information, their own privacy practices and legal responsibilities may apply. We encourage you to review the advisor’s privacy information when available.',
            'Sharing a Journey with an advisor does not, by itself, subscribe you to Discover Saint Lucia WELL marketing communications.'
          ]
        },

        {
          title: '6. Marketing communications',
          id: 'marketing',
          body: [
            'We may send promotional or commercial electronic messages only where permitted by applicable law. Where required, we will seek consent separately from consent to share a Journey or receive a requested service.',
            'Marketing messages will include appropriate sender identification and a way to unsubscribe. You may unsubscribe at any time using the link provided in an email or by contacting us. Transactional, security, account, or service communications may still be sent when necessary to provide a service you requested.',
            'Our email marketing platform is Encharge. Information needed to manage subscriptions, segments, campaign activity, and communications may be processed through that service.'
          ]
        },

        {
          title: '7. Cookies, analytics and advertising technologies',
          id: 'cookies',
          body: [
            'We use or may use cookies, pixels, local storage, and similar technologies to operate the website, remember preferences, understand usage, measure campaigns, improve performance, and support advertising or audience measurement.',
            'Our analytics and advertising technologies include services provided by Google, Vercel, and Meta. Depending on configuration, these technologies may receive device, browser, usage, campaign, cookie, IP-address, or similar information.',
            'Where applicable law requires consent before non-essential analytics or advertising technologies are used, we intend to obtain that consent through an appropriate consent mechanism. You should be able to change or withdraw applicable cookie choices. Browser controls and recognized privacy signals may also apply depending on jurisdiction and our technical configuration.',
            'Because advertising and analytics configurations can change, the live cookie/consent implementation should accurately reflect which technologies are active at the time you visit.'
          ]
        },

        {
          title: '8. Payments',
          id: 'payments',
          body: [
            'Purchases may be facilitated through ThriveCart and processed by Stripe or other payment infrastructure used through that checkout flow. Payment processors may collect payment card, billing, fraud-prevention, and transaction information directly under their own terms and privacy practices.',
            'We generally receive transaction confirmation and related purchase information rather than full payment card credentials. We may retain transaction records as required for accounting, tax, fraud prevention, customer support, and legal purposes.'
          ]
        },

        {
          title: '9. Artificial intelligence',
          id: 'ai',
          body: [
            'We may use artificial intelligence service providers, including OpenAI and Anthropic (Claude), to support features such as summarization, content personalization, advisor campaign assistance, or analysis of information submitted through the Services.',
            'We aim to limit information sent to AI providers to what is reasonably necessary for the relevant feature. AI-generated outputs may be inaccurate and should not be treated as medical advice, diagnosis, or a guarantee about travel suitability, availability, pricing, or outcomes.',
            'We do not intend to use AI to make solely automated decisions that produce legal or similarly significant effects about consumers. If that practice changes, we will update our disclosures and implement any rights or safeguards required by applicable law.',
            'Users should avoid entering unnecessary medical, financial, identity-document, or other highly sensitive information into free-text fields or AI-assisted features.'
          ]
        },

        {
          title: '10. Service providers and other recipients',
          id: 'recipients',
          body: ['We may disclose personal information to service providers and recipients that help us operate the Services, including:'],
          list: [
            '<strong>Supabase</strong> for authentication, database, and related infrastructure.',
            '<strong>Resend</strong> for transactional email, including the notification sent to an advisor when you choose to share your Journey.',
            '<strong>Encharge</strong> for email marketing and communications.',
            '<strong>Google, Vercel, and Meta</strong> for analytics, measurement, performance, and/or advertising technologies, depending on configuration and consent. Google Fonts serves the typefaces used on this site and receives your IP address when a page loads.',
            '<strong>jsDelivr</strong> serves animation libraries used on the Well Destination Foundations page and receives your IP address when that page loads.',
            '<strong>Stripe and ThriveCart</strong> for checkout, payment, and transaction-related services.',
            '<strong>OpenAI and Anthropic (Claude)</strong> for AI-enabled processing where used.',
            'Independent travel advisors and, where relevant to the requested travel service, their host agencies or travel businesses.',
            'Professional advisers, auditors, insurers, security providers, and other operational service providers where reasonably necessary.',
            'Government, regulatory, law-enforcement, courts, or other parties where required or permitted by law.'
          ]
        },
        {
          body: ['We may also disclose information in connection with a merger, financing, reorganization, sale of assets, or similar corporate transaction, subject to applicable legal requirements.']
        },

        {
          title: '11. International processing and transfers',
          id: 'transfers',
          body: [
            `${OPERATOR} is based in Canada, while our users, advisors, partners, and service providers may be located in Canada, the United States, the United Kingdom, the European Economic Area, and other jurisdictions.`,
            'As a result, personal information may be processed or stored outside your province, state, or country. Laws in those locations may differ from the laws where you live, and information may be accessible to courts, law-enforcement, or governmental authorities in accordance with local law.',
            'Where UK or EEA data-protection law requires safeguards for a restricted international transfer, we will use an applicable lawful transfer mechanism, such as an adequacy framework, contractual safeguards, or another permitted mechanism, as appropriate to the transfer.'
          ]
        },

        {
          title: '12. Data retention',
          id: 'retention',
          body: [
            'We retain personal information only for as long as reasonably necessary for the purposes described in this Policy, including providing services, maintaining appropriate business and transaction records, complying with legal obligations, resolving disputes, preventing fraud, and enforcing agreements.',
            'Retention periods vary by category. For example, anonymous or pseudonymous analytics may be retained according to platform settings; account and Journey records may be retained while an advisor relationship or travel-planning purpose remains active and for an appropriate period afterward; transaction records may be retained for tax, accounting, and legal requirements.',
            'When information is no longer required, we will take reasonable steps to delete, destroy, anonymize, or otherwise de-identify it, subject to legal and technical limitations.'
          ]
        },

        {
          title: '13. Security',
          id: 'security',
          body: [
            'We use administrative, technical, and organizational safeguards intended to protect personal information against loss, theft, misuse, unauthorized access, disclosure, alteration, and destruction. Safeguards are selected with regard to the nature and sensitivity of the information.',
            'No internet transmission or storage system can be guaranteed to be completely secure. If a privacy or security breach occurs, we will assess and respond to it in accordance with applicable legal requirements.'
          ]
        },

        {
          title: '14. Your privacy rights',
          id: 'rights',
          body: ['Your rights depend on where you live and which law applies. Subject to applicable exceptions and verification requirements, you may have rights to:'],
          list: [
            'Request access to personal information we hold about you.',
            'Request correction of inaccurate or incomplete information.',
            'Request deletion or erasure of certain information.',
            'Withdraw consent where processing is based on consent.',
            'Object to or request restriction of certain processing.',
            'Request portability of certain information where applicable.',
            'Opt out of certain targeted advertising, sale, or sharing practices where applicable.',
            'Complain to an applicable privacy or data-protection regulator.'
          ]
        },
        {
          rows: [
            {
              term: 'Canada',
              def: 'Canadian privacy law may provide rights to understand the existence, use, and disclosure of personal information, request access, challenge accuracy, withdraw consent subject to legal or contractual restrictions, and challenge compliance.'
            },
            {
              term: 'UK / EEA',
              def: 'Where UK GDPR or EU GDPR applies, you may have rights of access, rectification, erasure, restriction, objection, portability, withdrawal of consent, and the right to complain to the relevant supervisory authority. Some rights depend on the legal basis and circumstances of processing.'
            },
            {
              term: 'United States',
              def: 'Certain U.S. state privacy laws provide eligible residents with additional rights, where their statutory requirements and thresholds are met. If an applicable law gives you rights regarding access, deletion, correction, portability, targeted advertising, sale, sharing, or sensitive information, we will process qualifying requests as required.'
            },
            {
              term: 'California',
              def: 'If the California Consumer Privacy Act, as amended, applies to us, eligible California residents may have rights including to know, delete, correct, opt out of sale or sharing, limit certain uses of sensitive personal information, and receive non-discriminatory treatment.'
            }
          ]
        },
        {
          body: [`To exercise a privacy right, email ${MAILTO}. We may need to verify your identity and may request information reasonably necessary to process the request.`]
        },

        {
          title: '15. Children',
          id: 'children',
          body: [
            'The Services are intended for adults planning or selling travel and are not directed to children. We do not knowingly seek to collect personal information from children through the Services. If you believe a child has provided personal information to us inappropriately, please contact us so we can review the matter.'
          ]
        },

        {
          title: '16. Third-party websites and services',
          id: 'third-parties',
          body: [
            'The Services may link to independent travel advisors, properties, travel providers, social networks, payment services, or other third-party websites and services. We are not responsible for the privacy or security practices of those independent parties. Review their privacy information before providing personal information directly to them.'
          ]
        },

        {
          title: '17. Changes to this Policy',
          id: 'changes',
          body: [
            'We may update this Privacy Policy as our Services, technology, vendors, or legal obligations change. We will post the updated version with a revised effective date and provide additional notice where required by law or where changes are material.'
          ]
        },

        {
          title: '18. Contact and privacy complaints',
          id: 'contact',
          body: [
            `Questions, requests, or complaints about this Policy or our handling of personal information may be directed to:`,
            `${OPERATOR}<br>Discover Saint Lucia WELL<br>540-5 Hanna Avenue<br>Toronto, Ontario M6K 0B3<br>Canada<br>Email: ${MAILTO}`,
            'We will review privacy concerns and respond in accordance with applicable law. You may also have the right to contact the privacy or data-protection authority in your jurisdiction.'
          ]
        }
      ]
    }
  ]
};
