/* ============================================================================
   POST /api/auth/forgot — send a password reset link
   ----------------------------------------------------------------------------
   ALWAYS ANSWERS THE SAME WAY. Whether or not the address has an account, the
   response is "if that address has an account, a link is on its way". Anything
   else turns this into an endpoint for discovering who is registered.

   THAT NON-DISCLOSURE IS ALSO WHY THIS HAD TO STOP USING SUPABASE'S MAILER.
   This used resetPasswordForEmail(), which sends through Supabase SMTP — the
   configuration that has been failing on their side, and the reason email
   confirmation is switched off. A delivery failure here is invisible by
   construction: the endpoint answers "on its way" either way, so an advisor
   locked out of their account would be told to check an inbox nothing ever
   arrives in, and nobody would find out.

   So it now does what the admin console does: generate the link with the Auth
   Admin API, and deliver it through Resend, which is proven to work. One mailer
   for every transactional message this system sends, not subject to Supabase's
   per-hour limit, and using a template we control.

   Still best-effort, and still silent about the outcome to the caller — but the
   failure now lands in the logs as a real error rather than as nothing at all.
   ========================================================================== */
'use strict';

const { json, str, esc, looksLikeEmail, body, methodGuard } = require('../_lib/core.js');
const { recoveryLink } = require('../_lib/auth-admin.js');

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.discoversaintluciawell.com';

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;

  const b = body(req);
  if (!b) return json(res, 400, { error: 'bad_body' });
  if (str(b.company, 200)) return json(res, 200, { ok: true });   /* honeypot */

  const email = str(b.email, 200).toLowerCase();
  if (!looksLikeEmail(email)) return json(res, 400, { error: 'email_invalid' });

  try {
    const r = await recoveryLink(email, SITE_ORIGIN + '/hub/reset');

    /* An address with no account returns an error from Supabase. That is
       expected and must stay invisible — it is exactly the fact this endpoint
       refuses to disclose. Logged at a low level, answered as success. */
    if (!r.ok) {
      console.log('forgot: no link generated for a submitted address (likely no account)');
    } else if (!r.honoured) {
      /* Loud, because this is the failure that shipped silently once already:
         Supabase quietly repointing the link at a different host. */
      console.error('forgot: NOT SENT — Supabase repointed the redirect to ' + r.redirectGot +
        '. Add ' + SITE_ORIGIN + '/hub/reset to Authentication → URL Configuration.');
    } else {
      await send(email, r.link);
    }
  } catch (e) {
    console.error('forgot failed', e);
  }

  return json(res, 200, { ok: true });
};

async function send(email, link) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  if (!key || !from) {
    console.error('forgot: RESEND_API_KEY / NOTIFY_FROM missing — nothing sent');
    return;
  }
  try {
    const { Resend } = require('resend');
    const { error } = await new Resend(key).emails.send({
      from,
      to: email,
      subject: 'Reset your Saint Lucia WELL Hub password',
      html:
        `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#133239">` +
        `<p style="margin:0 0 1.2em">Hello,</p>` +
        `<p style="margin:0 0 1.4em">You asked to reset the password for your Saint Lucia WELL ` +
        `Advisor Hub. If that was not you, nothing has changed and you can ignore this — ` +
        `your current password still works.</p>` +
        `<p style="margin:0 0 1.4em"><a href="${esc(link)}" style="display:inline-block;` +
        `background:#E89A12;color:#133239;text-decoration:none;font-weight:600;padding:11px 20px;` +
        `border-radius:2px">Choose a new password</a></p>` +
        `<p style="margin:0;color:#5c6b68;font-size:13px">The link works once and expires.</p></div>`
    });
    if (error) throw error;
  } catch (e) {
    console.error('forgot: reset email failed to send', e);
  }
}
