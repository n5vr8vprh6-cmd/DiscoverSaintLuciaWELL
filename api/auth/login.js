/* ============================================================================
   POST /api/auth/login — exchange credentials for a session
   ----------------------------------------------------------------------------
   The password goes straight to Supabase and is never read here. On success the
   session lands in an HttpOnly cookie, so no script on any page of the site can
   read the token.
   ========================================================================== */
'use strict';

const { json, str, looksLikeEmail, body, methodGuard } = require('../_lib/core.js');
const { anonClient, setSession, safeNext } = require('../_lib/auth.js');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;

  const b = body(req);
  if (!b) return json(res, 400, { error: 'bad_body' });

  const email = str(b.email, 200).toLowerCase();
  const password = typeof b.password === 'string' ? b.password : '';
  if (!looksLikeEmail(email) || !password) {
    return json(res, 400, { error: 'credentials_required' });
  }

  const auth = anonClient();
  if (!auth) return json(res, 503, { error: 'not_configured' });

  try {
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data || !data.session) {
      /* One message for "no such account" and for "wrong password". Telling
         them apart would let anyone test whether a given advisor has an
         account here. */
      const m = String((error && error.message) || '').toLowerCase();
      if (m.includes('confirm')) return json(res, 403, { error: 'email_unverified' });
      return json(res, 401, { error: 'invalid_credentials' });
    }
    setSession(res, data.session);
    return json(res, 200, { ok: true, next: safeNext(b.next) });
  } catch (e) {
    console.error('login failed', e);
    return json(res, 500, { error: 'login_failed' });
  }
};
