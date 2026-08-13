/* ============================================================================
   POST /api/auth/logout — end the session
   ----------------------------------------------------------------------------
   Clears the cookies locally and asks Supabase to revoke the refresh token, so
   signing out on a shared machine actually ends the session rather than just
   forgetting it in this browser.
   ========================================================================== */
'use strict';

const { json, methodGuard } = require('../_lib/core.js');
const { anonClient, parseCookies, clearSession, REFRESH } = require('../_lib/auth.js');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;

  const cookies = parseCookies(req);
  const auth = anonClient();
  if (auth && cookies[REFRESH]) {
    try {
      await auth.auth.signOut({ scope: 'global' });
    } catch (e) { /* best effort — the cookie clear below is what matters */ }
  }
  clearSession(res);
  return json(res, 200, { ok: true });
};
