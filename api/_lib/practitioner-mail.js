/* ============================================================================
   PRACTITIONER APPLICATIONS · the notification
   ----------------------------------------------------------------------------
   One email, to the practitioner inbox, with the applicant as Reply-To so
   answering is answering. There is deliberately NO acknowledgement email to the
   applicant: this is an unauthenticated form, and a message sent from our domain
   to an address a stranger typed is exactly the relay abuse the rate limit is
   there to make expensive. The page's success state is the acknowledgement, and
   the brief's promise is "we'll reach out by email if there appears to be a
   strong fit" — which needs nothing sent until there is one.

   BEST-EFFORT, AND IT CANNOT FAIL THE SUBMISSION. The row is written before this
   runs. Somebody told their application failed because a mail provider was down
   would submit again, and it had already happened once.

   THE RECIPIENT is PRACTITIONER_EMAIL, defaulting to the address the brief
   names. It is refused when it equals the sending identity (NOTIFY_FROM), for
   the reason core.js records under adminEmail(): a sender is not a mailbox, and
   the first real waiting-list signup was mailed from the sender to the sender
   and nobody saw it.

   Degrades silently when RESEND_API_KEY or NOTIFY_FROM is absent, like every
   other mailer here. The application is still in the database.
   ========================================================================== */
'use strict';

const { esc, fromAddress } = require('./core.js');
const { toText } = require('./waitlist-mail.js');
const { PATHWAYS, CONCEPT, HELP_WITH } = require('./practitioner.js');

const DEFAULT_TO = 'concierge@discoversaintluciawell.com';

function recipient() {
  const to = String(process.env.PRACTITIONER_EMAIL || DEFAULT_TO).trim();
  if (to.toLowerCase() === fromAddress().toLowerCase()) {
    console.error('PRACTITIONER_EMAIL is the same address as NOTIFY_FROM (' + to + '). '
      + 'That is a sending identity, not a mailbox — nobody would read it.');
    return '';
  }
  return to;
}

/* A subject line is a header: a newline in it is header injection, and applicant
   text is attacker-controlled. Collapsed to single spaces and length-bounded. */
const oneLine = (v, max) => String(v == null ? '' : v)
  .replace(/[\r\n\t\u2028\u2029]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);

/* Brief §09: [DSW Practitioner] {Retreat / Visiting / Both} - First Last - Business */
function subjectFor(f) {
  const kind = { retreat: 'Retreat', visiting: 'Visiting', both: 'Both' }[f.pathway] || 'Both';
  return `[DSW Practitioner] ${kind} - ${oneLine(f.first_name, 80)} ${oneLine(f.last_name, 80)} - ${oneLine(f.business, 140)}`;
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

  const shared = [
    ['Pathway', PATHWAYS[f.pathway]],
    ['Email', f.email],
    ['Phone', f.phone],
    ['Business / practice', f.business],
    ['Website', f.website],
    ['Social profile', f.social],
    ['Country', f.country],
    ['Years in practice', f.years],
    ['Primary modality', f.modality]
  ];

  const fit = [
    ['Their work', f.work],
    ['Who they serve', f.serves],
    ['Community / audience', f.community],
    ['Audience size', f.audience_size],
    ['Has led groups before', f.led_before ? 'Yes' : 'No'],
    ['Detail', f.led_before_detail],
    ['Anything else', f.notes]
  ];

  let extra = '';
  if (f.retreat) {
    const r = f.retreat;
    extra += H('Retreat Collaboration') + table([
      ['Concept', CONCEPT[r.concept]],
      ['Group size', r.group_size],
      ['Price per participant', r.price_range],
      ['Timing / dates', r.timing],
      ['Previously hosted', r.previous_locations],
      ['Wants help with', (r.help_with || []).map((h) => HELP_WITH[h] || h).join(', ')]
    ]);
  }
  if (f.visiting) {
    const v = f.visiting;
    extra += H('Visiting Practitioner Network') + table([
      ['Credentials', v.credentials],
      ['Onsite experience', v.experience_type],
      ['Session capacity', v.capacity],
      ['Availability', v.availability],
      ['Resort / hospitality experience', v.hospitality]
    ]);
  }

  const html = '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#133239">'
    + `<p style="margin:0 0 1.2em"><strong>${esc(name)}</strong> (${esc(f.business)}) applied on the `
    + `<strong>${esc(PATHWAYS[f.pathway])}</strong> pathway.</p>`
    + H('About them') + table(shared)
    + H('Fit') + table(fit)
    + extra
    + '<p style="margin:1.4em 0 0;color:#5b6b6a;font-size:13px">Reply to this message to reach them. '
    + 'Nothing has been promised or held. Any invitation to talk is sent by you, privately, by email, after review.</p>'
    + '</div>';

  return { subject: subjectFor(f), html, text: toText(html) };
}

async function sendNotice(f) {
  const from = process.env.NOTIFY_FROM;
  if (!from || !process.env.RESEND_API_KEY) {
    console.log('practitioner: RESEND_API_KEY / NOTIFY_FROM missing — nothing sent');
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
