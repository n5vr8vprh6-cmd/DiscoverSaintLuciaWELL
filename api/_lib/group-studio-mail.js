/* ============================================================================
   GROUP STUDIO — NOTIFICATION TO US
   ----------------------------------------------------------------------------
   One message to the team inbox for each application. Modelled on
   api/_lib/practitioner-mail.js, and kept as its own file so the two intake
   streams stay legible as two streams: a different subject prefix, a different
   recipient variable, a different body.

   BEST-EFFORT, AND IT CANNOT FAIL THE SUBMISSION. The row is written before
   this runs. Somebody told their application failed because a mail provider was
   down would submit again.

   THE RECIPIENT is GROUP_STUDIO_EMAIL, falling back to the same concierge inbox
   practitioner applications use — one mailbox to watch, with a distinct subject
   prefix so the two never blur. It is refused when it equals the sending
   identity (NOTIFY_FROM): a sender is not a mailbox, and the first real
   waiting-list signup was mailed from the sender to the sender and nobody saw it.

   Degrades silently when RESEND_API_KEY or NOTIFY_FROM is absent, like every
   other mailer here. The application is still in the database.
   ========================================================================== */
'use strict';

const { esc, fromAddress } = require('./core.js');
const { toText } = require('./waitlist-mail.js');
const { PROGRAM_INTEREST, SUPPORT } = require('./group-studio.js');

const DEFAULT_TO = 'concierge@discoversaintluciawell.com';

function recipient() {
  const to = String(process.env.GROUP_STUDIO_EMAIL || DEFAULT_TO).trim();
  if (to.toLowerCase() === fromAddress().toLowerCase()) {
    console.error('GROUP_STUDIO_EMAIL is the same address as NOTIFY_FROM (' + to + '). '
      + 'That is a sending identity, not a mailbox — nobody would read it.');
    return '';
  }
  return to;
}

/* A subject line is a header: a newline in it is header injection, and applicant
   text is attacker-controlled. Collapsed to single spaces and length-bounded. */
const oneLine = (v, max) => String(v == null ? '' : v)
  .replace(/[\r\n\t\u2028\u2029]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);

/* [DSW Group Studio] {Eclipse / Custom / Unsure} - First Last - Business
   A prefix of its own, so a filter can tell these from [DSW Practitioner]. */
function subjectFor(f) {
  const kind = { eclipse: 'Eclipse', custom: 'Custom', unsure: 'Unsure' }[f.program_interest] || 'Unsure';
  return `[DSW Group Studio] ${kind} - ${oneLine(f.first_name, 80)} ${oneLine(f.last_name, 80)} - ${oneLine(f.business, 140)}`;
}

const TD = 'style="padding:3px 14px 3px 0;color:#5b6b6a;vertical-align:top;white-space:nowrap"';
const TV = 'style="padding:3px 0;vertical-align:top"';

function table(rows) {
  const body = rows
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => `<tr><td ${TD}>${esc(k)}</td><td ${TV}><strong>${esc(v)}</strong></td></tr>`)
    .join('');
  return `<table style="border-collapse:collapse;font-size:14px;margin:0 0 1.4em">${body}</table>`;
}

const H = (t) => `<p style="margin:1.4em 0 .4em;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8A5E15"><strong>${esc(t)}</strong></p>`;

function compose(f) {
  const name = `${f.first_name} ${f.last_name}`.trim();

  const about = [
    ['Interested in', PROGRAM_INTEREST[f.program_interest]],
    ['Email', f.email],
    ['Phone', f.phone],
    ['Business / agency', f.business],
    ['Host agency / consortium', f.host_agency],
    ['Website', f.website],
    ['Social profile', f.social],
    ['Country', f.country],
    ['Travel experience', f.experience],
    ['Group experience', f.group_experience]
  ];

  const concept = [
    ['The concept', f.concept],
    ['The audience', f.audience],
    ['Engaged audience / known travellers', f.audience_size],
    ['Expected travellers', f.expected_travellers],
    ['Target window', f.departure_window],
    ['Budget per person', f.budget_range],
    ['Support wanted', (f.support_needed || []).map((s) => SUPPORT[s] || s).join(', ')],
    ['How they sell to this audience', f.how_you_sell],
    ['Anything else', f.notes]
  ];

  const html = '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#133239">'
    + `<p style="margin:0 0 1.2em"><strong>${esc(name)}</strong> (${esc(f.business)}) applied to `
    + '<strong>WELL Group Studio</strong>.</p>'
    + H('About them') + table(about)
    + H('The group concept') + table(concept)
    + '<p style="margin:1.4em 0 0;color:#5b6b6a;font-size:13px">Reply to this message to reach them. '
    + 'Nothing has been quoted, held or promised, and no price, commission or date has been discussed. '
    + 'This applicant consented to be contacted about this application.</p>'
    + '</div>';

  return { subject: subjectFor(f), html, text: toText(html) };
}

async function sendNotice(f) {
  const from = process.env.NOTIFY_FROM;
  if (!from || !process.env.RESEND_API_KEY) {
    console.log('group-studio: RESEND_API_KEY / NOTIFY_FROM missing — nothing sent');
    return { ok: false, error: 'not_configured' };
  }
  const to = recipient();
  if (!to) return { ok: false, error: 'no_recipient' };

  const mail = compose(f);
  const { Resend } = require('resend');
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from,
    to,
    replyTo: f.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text
  });
  if (error) throw error;
  return { ok: true };
}

module.exports = { sendNotice, compose, subjectFor, recipient, DEFAULT_TO };
