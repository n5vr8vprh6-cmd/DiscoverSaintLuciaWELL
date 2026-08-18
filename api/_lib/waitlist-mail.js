/* ============================================================================
   WAITING LIST · the two emails
   ----------------------------------------------------------------------------
   One to the person, one to Duncan. Split from waitlist.js so the module that
   owns the table is not also the module that owns the mailer: a database
   failure and a delivery failure are different problems and should not share a
   file, let alone a try block.

   BOTH ARE BEST-EFFORT AND NEITHER CAN FAIL THE JOIN. The row is already
   written by the time these are called. Somebody who filled in a form and was
   told it failed — because a mail provider was down — would fill it in again,
   and the thing they asked for had already happened both times.

   THE CONFIRMATION PROMISES NOTHING. No date, no price, no place held, because
   none of those exist. It is deliberately shorter than it could be: the only
   honest content is "we have you, we will tell you", and padding that with
   anticipation would be selling a thing that has not been built yet.

   Degrades silently when RESEND_API_KEY or NOTIFY_FROM is absent, exactly like
   every other mailer here — the site works without a backend, and that has to
   include working without a mailer.
   ========================================================================== */
'use strict';

const { esc } = require('./core.js');

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.discoversaintluciawell.com';

/* Where the notification goes. Falls back to the sender, so a deployment that
   has configured Resend at all always has somewhere to put this rather than
   dropping it — a signup nobody hears about is the failure this exists to
   prevent. */
function noticeTo() {
  return process.env.WAITLIST_NOTIFY_TO || process.env.NOTIFY_FROM || '';
}

async function send(mail) {
  const from = process.env.NOTIFY_FROM;
  if (!from || !process.env.RESEND_API_KEY) {
    console.log('waitlist: RESEND_API_KEY / NOTIFY_FROM missing — nothing sent');
    return { ok: false, error: 'not_configured' };
  }
  if (!mail.to) return { ok: false, error: 'no_recipient' };

  const { Resend } = require('resend');
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from, to: mail.to, replyTo: mail.replyTo, subject: mail.subject, html: mail.html
  });
  if (error) throw error;
  return { ok: true };
}

const WRAP = (inner) =>
  '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;'
  + 'line-height:1.6;color:#133239">' + inner + '</div>';

/* ── To the person who joined ──────────────────────────────── */
function sendJoined(f) {
  const p = 'style="margin:0 0 1.2em"';
  return send({
    to: f.email,
    replyTo: noticeTo() || undefined,
    subject: 'You are on the Saint Lucia WELL Immersion waiting list',
    html: WRAP(`
      <p ${p}>${esc(f.first_name)},</p>

      <p ${p}>You are on the waiting list for the Saint Lucia WELL Immersion.
        When the cohort dates, the investment and the group size are settled with
        the destination and the property partners, you will hear them from us
        directly — before they go anywhere public.</p>

      <p ${p}>To be clear about what this is: a list, not a booking. Nothing is
        held and nothing has been charged.</p>

      <p ${p}>Well Destination Foundations is the prerequisite for the Immersion,
        so if you have not done it yet, that is the useful next step rather than
        waiting —
        <a href="${SITE_ORIGIN}/advisors/foundations" style="color:#8A5E15">${SITE_ORIGIN}/advisors/foundations</a></p>

      <p ${p}>If your details are wrong, or you would rather come off the list,
        just reply to this message.</p>

      <p style="margin:0">— Discover Saint Lucia WELL</p>`)
  });
}

/* ── To Duncan ───────────────────────────────────────────────────────────────
   Everything on one screen, with the address as a reply-to so answering does
   not mean opening the admin list first. */
function sendNotice(f) {
  const name = `${f.first_name} ${f.last_name}`.trim();
  return send({
    to: noticeTo(),
    replyTo: f.email,
    subject: `Immersion waiting list · ${name}`,
    html: WRAP(
      `<p style="margin:0 0 1.2em"><strong>${esc(name)}</strong> joined the Immersion `
      + `waiting list.</p>` +
      `<table style="border-collapse:collapse;font-size:14px">` +
      [['Email', f.email], ['Phone', f.phone], ['Company', f.company],
       ['Host agency', f.host_agency || '—']]
        .map(([k, v]) => `<tr><td style="padding:2px 14px 2px 0;color:#5b6b6a">${esc(k)}</td>`
                       + `<td style="padding:2px 0"><strong>${esc(v)}</strong></td></tr>`).join('') +
      `</table>` +
      `<p style="margin:1.4em 0 0"><a href="${SITE_ORIGIN}/hub/admin/waitlist" `
      + `style="color:#8A5E15">The whole list</a></p>`
    )
  });
}

module.exports = { sendJoined, sendNotice, noticeTo };
