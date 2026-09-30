/* ============================================================================
   /practitioners/apply — where the /practitioners form posts
   ----------------------------------------------------------------------------
   Rendered by the Hub router, for the reasons hub-screens/waitlist.js gives: it
   writes to a database, and Vercel counts functions while api/hub/index.js
   exists precisely so screens do not.

   THE FORM ITSELF IS NOT HERE. It is static markup on /practitioners
   (lib/practitioner-sections.js), because the page is the sales conversation
   and a static page is what the CDN serves fast. This screen is only what the
   form submits to:

     · POST, JSON  — js/practitioners.js. Answers JSON; the page shows its own
                     success state and never navigates.
     · POST, form  — a browser with JavaScript off. Answers a small page, because
                     an application that needs JavaScript to be sent is one that
                     quietly loses people.
     · GET         — somebody who typed the address. There is nothing to show
                     here, so send them to the form.

   WHAT IT PROMISES: nothing beyond the brief's own sentence — we will review it
   and write by email if there appears to be a strong fit. No calendar, no
   booking link, no "book a call", here or in the email. Any invitation to talk
   is sent privately, by a person, after review.
   ========================================================================== */
'use strict';

const { json, body, str } = require('../core.js');
const { hubPage, esc } = require('../hub-render.js');
const { submit, THANKS } = require('../practitioner.js');
const { sendNotice } = require('../practitioner-mail.js');

const PATH = '/practitioners/apply';
const FORM = '/practitioners#apply';

/* `company` is the honeypot, and it is safe to call it that here — unlike the
   waiting list, no real field on this form has that name (the business is
   `business`). A bot expects to fill `company`; a person never sees it. */
const HP = 'company';

const MESSAGE = {
  pathway_required:    'Please choose what you are interested in.',
  name_required:       'We need a first and last name.',
  email_invalid:       'That email address does not look right.',
  business_required:   'We need your business or practice name.',
  presence_required:   'Please add a link to your website or to your main social profile, so we can see your work.',
  website_invalid:     'That website does not look like a single link. Please paste one link, for example https://yourwebsite.com.',
  social_invalid:      'Please paste the full link to one profile, for example https://instagram.com/yourname — not a handle, and one link only.',
  country_required:    'We need your country.',
  modality_required:   'Please tell us your primary area of practice.',
  work_required:       'Please describe your work.',
  serves_required:     'Please tell us who you serve.',
  community_required:  'Please tell us about your community or audience.',
  led_before_required: 'Please tell us whether you have led groups before.',
  concept_required:    'Please tell us where your retreat idea is today.',
  help_required:       'Please choose what you would most like help with.',
  help_unknown:        'One of the choices was not recognised. Please try again.',
  credentials_required: 'Please list your certifications or credentials.',
  experience_required: 'Please describe the experience you could deliver onsite.',
  rate_limited:        'That is a lot of applications from one place. Please try again later.',
  unavailable:         'Applications are temporarily unavailable. Please try again shortly.',
  server:              'Something went wrong. Please try again.'
};

function wantsJson(req) {
  return /json/i.test(String(req.headers['content-type'] || ''));
}

function confirmed(pathway) {
  return `<div class="hub-auth">
  <div class="hub-auth-card">
    <h1>Application received.</h1>
    <p class="hub-lead">${esc(THANKS[pathway] || THANKS.retreat)}</p>
    <p class="hub-auth-alt"><a class="btn btn--gold" href="/practitioners">Back to Practitioners &amp; Retreat Leaders</a></p>
  </div>
</div>`;
}

function refused(error) {
  return `<div class="hub-auth"><div class="hub-auth-card">
    <h1>We could not send that.</h1>
    <p class="hub-form-status hub-form-status--error">${esc(MESSAGE[error] || MESSAGE.server)}</p>
    <p class="hub-auth-alt"><a class="btn btn--gold" href="${FORM}">Back to the form</a></p>
  </div></div>`;
}

const statusFor = (e) => (e === 'unavailable' ? 503 : e === 'rate_limited' ? 429 : e === 'server' ? 500 : 400);

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    res.statusCode = 302;
    res.setHeader('Location', FORM);
    return res.end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.statusCode = 405;
    return res.end();
  }

  const json_ = wantsJson(req);
  const b = body(req);
  if (!b) {
    return json_ ? json(res, 400, { error: 'bad_body' })
                 : hubPage(res, { path: PATH, title: 'Application', status: 400, body: refused('server') });
  }

  /* The honeypot. Answered as success: telling a bot it failed teaches whoever
     wrote it to stop filling the field. */
  if (str(b[HP], 200)) {
    return json_ ? json(res, 200, { ok: true })
                 : hubPage(res, { path: PATH, title: 'Application received', body: confirmed('retreat') });
  }

  const r = await submit(b, req);

  if (!r.ok) {
    if (json_) {
      return json(res, statusFor(r.error), { error: r.error, field: r.field || null, message: MESSAGE[r.error] || MESSAGE.server });
    }
    return hubPage(res, { path: PATH, title: 'Application', status: statusFor(r.error), body: refused(r.error) });
  }

  /* Best-effort and awaited only far enough to log. The row is written; a mail
     outage must not turn a successful application into an error the person
     sees, because the thing they asked for happened. */
  await sendNotice(r.fields).catch((e) => console.error('practitioner: notification failed', e && e.message));

  return json_
    ? json(res, 200, { ok: true, pathway: r.fields.pathway })
    : hubPage(res, { path: PATH, title: 'Application received', body: confirmed(r.fields.pathway) });
};

module.exports.MESSAGE = MESSAGE;
