/* ============================================================================
   /advisors/groups/apply — where the WELL Group Studio form posts
   ----------------------------------------------------------------------------
   Rendered by the Hub router, for the reasons hub-screens/practitioner.js
   gives: it writes to a database, and Vercel counts functions while
   api/hub/index.js exists precisely so screens do not.

   THE FORM ITSELF IS NOT HERE. It is static markup on /advisors/groups
   (lib/group-sections.js), because the page is the sales conversation and a
   static page is what the CDN serves fast. This screen is only what the form
   submits to:

     · POST, JSON  — js/groups.js. Answers JSON; the page shows its own success
                     state and never navigates.
     · POST, form  — a browser with JavaScript off. Answers a small page, because
                     an application that needs JavaScript to be sent is one that
                     quietly loses people.
     · GET         — somebody who typed the address. There is nothing to show
                     here, so send them to the form.

   WHAT IT PROMISES: the brief's own sentence — we will review the fit and
   contact you if there is a relevant opportunity. No fixed response time, no
   acceptance, no price, no calendar. Any invitation to talk is sent privately,
   by a person, after review.

   THE FORM IS NOT OFFERED UNTIL IT CAN WORK. SITE.groupStudio.intakeOpen is
   false until db/migrations/029 has been run, so no visitor is invited to use
   this screen before the table exists. If something posts here anyway, the
   write fails closed as `unavailable` rather than pretending to have stored it.
   ========================================================================== */
'use strict';

const { json, body, str } = require('../core.js');
const { hubPage, esc } = require('../hub-render.js');
const { submit, THANKS } = require('../group-studio.js');
const { sendNotice } = require('../group-studio-mail.js');

const PATH = '/advisors/groups/apply';
const FORM = '/advisors/groups#apply';

/* `company` is the honeypot, and it is safe to call it that here: no real
   field on this form has that name (the business is `business`). A bot expects
   to fill `company`; a person never sees it. */
const HP = 'company';

const MESSAGE = {
  interest_required:   'Please choose which kind of collaboration you are interested in.',
  name_required:       'We need a first and last name.',
  email_invalid:       'That email address does not look right.',
  business_required:   'We need your agency or business name.',
  country_required:    'We need your country.',
  website_invalid:     'That website does not look like a single link. Please paste one link, for example https://yourwebsite.com.',
  social_invalid:      'Please paste the full link to one profile, for example https://instagram.com/yourname — not a handle, and one link only.',
  concept_required:    'Please describe your group or retreat concept.',
  audience_required:   'Please tell us about the travellers or audience.',
  sell_required:       'Please tell us how you currently reach and sell to this audience.',
  support_required:    'Please choose at least one thing you would like help with.',
  support_unknown:     'One of the choices was not recognised. Please try again.',
  consent_required:    'Please confirm that we may contact you about this application.',
  rate_limited:        'That is a lot of applications from one place. Please try again later.',
  unavailable:         'Applications are temporarily unavailable. Please try again shortly.',
  server:              'Something went wrong. Please try again.'
};

function wantsJson(req) {
  return /json/i.test(String(req.headers['content-type'] || ''));
}

function confirmed() {
  return `<div class="hub-auth">
  <div class="hub-auth-card">
    <h1>Application received.</h1>
    <p class="hub-lead">${esc(THANKS)}</p>
    <p class="hub-auth-alt"><a class="btn btn--gold" href="/advisors/groups">Back to WELL Group Studio</a></p>
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
                 : hubPage(res, { path: PATH, title: 'Application received', body: confirmed() });
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
  await sendNotice(r.fields).catch((e) => console.error('group-studio: notification failed', e && e.message));

  return json_
    ? json(res, 200, { ok: true, program_interest: r.fields.program_interest })
    : hubPage(res, { path: PATH, title: 'Application received', body: confirmed() });
};

module.exports.MESSAGE = MESSAGE;
