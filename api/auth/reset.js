/* ============================================================================
   POST /api/auth/reset — set a new password from a reset link
   ----------------------------------------------------------------------------
   Supabase puts the recovery token in the URL fragment, which never reaches a
   server. The reset page reads it client-side and posts it here, where it is
   exchanged for a session and used once to set the new password.
   ========================================================================== */
'use strict';

const { json, body, methodGuard } = require('../_lib/core.js');
const { anonClient, setSession } = require('../_lib/auth.js');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;

  const b = body(req);
  if (!b) return json(res, 400, { error: 'bad_body' });

  const accessToken = typeof b.accessToken === 'string' ? b.accessToken : '';
  const refreshToken = typeof b.refreshToken === 'string' ? b.refreshToken : '';
  const password = typeof b.password === 'string' ? b.password : '';

  if (!accessToken) return json(res, 400, { error: 'token_missing' });
  if (password.length < 10) return json(res, 400, { error: 'password_too_short' });

  const auth = anonClient();
  if (!auth) return json(res, 503, { error: 'not_configured' });

  try {
    const { data: sess, error: sessErr } =
      await auth.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    /* An expired or already-used link is the single most common failure here,
       and it needs to say so plainly rather than "something went wrong". */
    if (sessErr || !sess || !sess.session) return json(res, 400, { error: 'token_invalid' });

    const { error } = await auth.auth.updateUser({ password });
    if (error) {
      const m = String(error.message || '').toLowerCase();
      return json(res, 400, { error: m.includes('password') ? 'password_weak' : 'reset_failed' });
    }

    setSession(res, sess.session);
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error('reset failed', e);
    return json(res, 500, { error: 'reset_failed' });
  }
};
