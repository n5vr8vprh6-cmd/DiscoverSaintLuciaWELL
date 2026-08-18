/* ============================================================================
   /advisors/immersion/waitlist — ask to be told when the dates exist
   ----------------------------------------------------------------------------
   A PUBLIC page rendered by the Hub router. It has no advisor and does not want
   one: an advisor interested in the Immersion may well not have a Hub account,
   and putting a sign-in between them and a waiting list would be charging
   admission to a queue.

   It is here rather than in the static build because it writes to a database,
   and here rather than in its own function because Vercel counts functions and
   api/hub/index.js exists precisely so screens do not.

   ONE HANDLER, BOTH METHODS. GET renders the form; POST accepts it and renders
   the confirmation. js/hub.js intercepts the submit and posts JSON, then
   follows `data-done` to the confirmed state — but with JavaScript off the
   browser posts the form itself and lands on the same confirmation, because a
   waiting list that needs JavaScript to join is a waiting list that quietly
   loses people.

   WHAT IT PROMISES: nothing. No date, no price, no place held. The dates do not
   exist yet — that is the entire reason this page exists — and the copy here
   and in the email both say so plainly. If that ever stops being true, this
   file changes before the marketing does.
   ========================================================================== */
'use strict';

const { json, body, str } = require('../core.js');
const { hubPage, esc } = require('../hub-render.js');
const { authForm } = require('../hub-forms.js');
const { join } = require('../waitlist.js');
const { sendJoined, sendNotice } = require('../waitlist-mail.js');

const PATH = '/advisors/immersion/waitlist';

/* The honeypot cannot be called `company` here — see hub-forms.js. `website` is
   the other field a form-filling bot reaches for, and no real field on this
   form has that name. */
const HP = 'website';

function form() {
  return authForm({
    title: 'Join the Immersion waiting list.',
    lead: 'Cohort dates, investment and group size are still being set with the '
        + 'destination and the property partners. Leave your details and you will '
        + 'hear them before they are announced anywhere else.',
    action: PATH,
    done: PATH + '?joined=1',
    submit: 'Join the waiting list',
    hp: HP,
    hpLabel: 'Website',
    fields: [
      { name: 'first_name',   label: 'First name',  autocomplete: 'given-name' },
      { name: 'last_name',    label: 'Last name',   autocomplete: 'family-name' },
      { name: 'email',        label: 'Email',       type: 'email', autocomplete: 'email', wide: true },
      { name: 'phone',        label: 'Phone',       type: 'tel',   autocomplete: 'tel' },
      { name: 'company_name', label: 'Company',     autocomplete: 'organization' },
      { name: 'host_agency',  label: 'Host agency', optional: true, required: false,
        autocomplete: 'organization', wide: true,
        hint: 'If you sell under one. Leave blank if you do not.' }
    ],
    alt: 'This is a waiting list, not a booking — nothing is held and nothing is '
       + 'charged. <a href="/advisors/immersion">Back to the Immersion</a>.'
  });
}

function confirmed(name) {
  return `<div class="hub-auth">
  <div class="hub-auth-card">
    <h1>You are on the list${name ? ', ' + esc(name) : ''}.</h1>
    <p class="hub-lead">We have your details. When the cohort dates, the
      investment and the group size are settled, you will hear them from us
      directly — before they go anywhere public.</p>
    <p class="hub-lead">Nothing is held and nothing is charged. In the meantime,
      Foundations is the prerequisite for the Immersion, so it is the useful
      thing to do next.</p>
    <p class="hub-auth-alt">
      <a class="btn btn--gold" href="/advisors/foundations">See Foundations</a>
    </p>
    <p class="hub-auth-alt">Wrong details, or want to come off the list?
      <a href="/about#contact">Tell us</a> and we will fix it.</p>
  </div>
</div>`;
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'https://x');

  if (req.method === 'GET') {
    const done = url.searchParams.get('joined') === '1';
    return hubPage(res, {
      path: PATH,
      title: done ? 'You are on the list' : 'Immersion waiting list',
      body: done ? confirmed('') : form()
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.statusCode = 405;
    return res.end();
  }

  const b = body(req) || {};

  /* The honeypot. Answered as success, deliberately: telling a bot it failed
     teaches whoever wrote it to stop filling the field. */
  if (str(b[HP], 200)) {
    return wantsJson(req)
      ? json(res, 200, { ok: true })
      : hubPage(res, { path: PATH, title: 'You are on the list', body: confirmed('') });
  }

  const r = await join(b, req);

  if (!r.ok) {
    if (wantsJson(req)) return json(res, r.error === 'unavailable' ? 503 : 400, { error: r.error });
    /* No JavaScript: re-render the form with the message above it rather than
       leaving them on a blank 400. */
    return hubPage(res, {
      path: PATH, title: 'Immersion waiting list', status: r.error === 'unavailable' ? 503 : 400,
      body: `<div class="hub-auth"><div class="hub-auth-card">
        <p class="hub-form-status hub-form-status--error">${esc(MESSAGE[r.error] || MESSAGE.server)}</p>
      </div></div>` + form()
    });
  }

  /* Both emails are best-effort and both are awaited only far enough to log.
     The row is already written: a mail outage must not turn a successful join
     into an error the person sees, because the thing they asked for happened. */
  await sendJoined(r.fields).catch((e) => console.error('waitlist: confirmation failed', e && e.message));
  await sendNotice(r.fields).catch((e) => console.error('waitlist: notification failed', e && e.message));

  return wantsJson(req)
    ? json(res, 200, { ok: true })
    : hubPage(res, { path: PATH, title: 'You are on the list', body: confirmed(r.fields.first_name) });
};

/* js/hub.js posts JSON and reads JSON back; a browser without it posts a form
   and needs a page. Content-Type is what distinguishes them. */
function wantsJson(req) {
  return /json/i.test(String(req.headers['content-type'] || ''));
}

const MESSAGE = {
  name_required:    'We need a first and last name.',
  email_invalid:    'That email address does not look right.',
  phone_required:   'We need a phone number.',
  company_required: 'We need your company name.',
  unavailable:      'The waiting list is temporarily unavailable. Please try again shortly.',
  server:           'Something went wrong. Please try again.'
};
