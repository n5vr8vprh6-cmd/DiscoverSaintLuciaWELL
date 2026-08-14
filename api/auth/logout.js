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

  /* The sign-out control is a real <form> so it works without JavaScript. A
     plain form post navigates, and answering it with `{"ok":true}` would put
     raw JSON on the screen — so a browser navigation gets a redirect and a
     fetch gets the JSON it asked for.

     Sec-Fetch-Mode tells them apart: browsers send `navigate` for a form
     submission and `cors`/`same-origin` for fetch. Accept is the fallback for
     anything that does not send it. */
  const mode = String(req.headers['sec-fetch-mode'] || '');
  const wantsHtml = mode === 'navigate' ||
    (!mode && String(req.headers.accept || '').includes('text/html'));

  if (wantsHtml) {
    res.statusCode = 303;
    res.setHeader('Location', '/');
    return res.end();
  }
  return json(res, 200, { ok: true });
};
