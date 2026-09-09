/* ============================================================================
   ITINERARY MAIL — the link, emailed inside the request that issued it
   ----------------------------------------------------------------------------
   The token is shown once and stored only as a sha256, so the ONLY moment a
   link can be emailed is the request that minted it. That is why "email it" is
   a checkbox on Issue and not a button afterwards: afterwards there is nothing
   readable to send. Issue again to send again.

   ── THE ENVELOPE IS THE INTRODUCTION'S ─────────────────────────────────────
   From journeys@ (the brand the traveller trusts), To the traveller, Cc the
   advisor, Reply-To the advisor — the same shape introductions.js established,
   for the same reasons: the advisor sees exactly what the client received, and
   a reply from either side reaches the advisor.

   ── TWO SENTENCES AND THE LINK. NEVER AN ATTACHMENT. ───────────────────────
   A link can be withdrawn; a PDF in an inbox cannot. The estimate is on the
   page, not in the mail — the mail is a pointer to a document that stays
   under the advisor's control. Nothing about the trip's cost is in an email
   body that can be forwarded.
   ========================================================================== */
'use strict';

const { esc } = require('./hub-render.js');
const { toText } = require('./waitlist-mail.js');
const { SITE_ORIGIN } = require('./introductions.js');

function compose(input) {
  const i = input || {};
  const journey = i.journey || {};
  const advisor = i.advisor || {};
  const first = String(journey.consumer_first || '').trim() || 'Hello';
  const who = [advisor.first_name, advisor.last_name].filter(Boolean).join(' ').trim() || 'Your advisor';
  const url = /^https?:\/\//.test(String(i.url || '')) ? String(i.url) : SITE_ORIGIN + String(i.url || '');
  const version = Number(i.version) || null;

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#133239">` +
    `<p style="margin:0 0 1.2em">${esc(first)},</p>` +
    `<p style="margin:0 0 1.2em">${esc(who)} has prepared a plan for your Saint Lucia WELL journey${version && version > 1 ? ' (version ' + version + ')' : ''}. ` +
    `It is a planning estimate, not a quote, and nothing in it is booked.</p>` +
    `<p style="margin:0 0 1.4em"><a href="${esc(url)}" style="color:#00706F">${esc(url)}</a></p>` +
    `<p style="margin:0 0 1.2em">Reply to this email to reach ${esc(advisor.first_name || who)} directly.</p>` +
    `<p style="margin:0 0 1.2em">With warm regards,<br>Discover Saint Lucia WELL</p>` +
    `<hr style="border:0;border-top:1px solid #E5E0D6;margin:1.6em 0">` +
    `<p style="margin:0;color:#5c6b68;font-size:13px">${esc(who)} is an independent travel professional. ` +
    `Discover Saint Lucia WELL is not a travel agency and does not take bookings. ` +
    `The link may be withdrawn by your advisor; if it stops working, they will have a current one.</p></div>`;

  return {
    from: process.env.NOTIFY_FROM,
    to: journey.consumer_email,
    cc: advisor.email,
    replyTo: advisor.email,
    subject: `Your Saint Lucia WELL plan from ${advisor.first_name || who}`,
    html,
    text: toText(html)
  };
}

/* Send. Never throws; the caller decides what a failure means (the document is
   already issued and live — a failed mail is "copy the link and send it
   yourself", not a failed issue). */
async function send(input) {
  const mail = compose(input);
  if (!mail.from || !process.env.RESEND_API_KEY) return { ok: false, error: 'mail_not_configured' };
  if (!mail.to) return { ok: false, error: 'no_recipient' };
  try {
    const { Resend } = require('resend');
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: mail.from, to: mail.to, cc: mail.cc, replyTo: mail.replyTo,
      subject: mail.subject, html: mail.html, text: mail.text
    });
    if (error) throw error;
    return { ok: true, to: mail.to };
  } catch (e) {
    console.error('itinerary email failed', e && e.message ? e.message : e);
    return { ok: false, error: 'email_failed' };
  }
}

module.exports = { compose, send };
