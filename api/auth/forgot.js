/* ============================================================================
   POST /api/auth/forgot — send a password reset link
   ----------------------------------------------------------------------------
   ALWAYS ANSWERS THE SAME WAY. Whether or not the address has an account, the
   response is "if that address has an account, a link is on its way". Anything
   else turns this into an endpoint for discovering who is registered.
   ========================================================================== */
'use strict';

const { json, str, looksLikeEmail, body, methodGuard } = require('../_lib/core.js');
const { anonClient } = require('../_lib/auth.js');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;

  const b = body(req);
  if (!b) return json(res, 400, { error: 'bad_body' });
  if (str(b.company, 200)) return json(res, 200, { ok: true });   /* honeypot */

  const email = str(b.email, 200).toLowerCase();
  if (!looksLikeEmail(email)) return json(res, 400, { error: 'email_invalid' });

  const auth = anonClient();
  if (auth) {
    const origin = process.env.SITE_ORIGIN || 'https://discoversaintluciawell.com';
    try {
      await auth.auth.resetPasswordForEmail(email, { redirectTo: origin + '/hub/reset' });
    } catch (e) {
      console.error('reset email failed', e);   /* still answered as success */
    }
  }
  return json(res, 200, { ok: true });
};
