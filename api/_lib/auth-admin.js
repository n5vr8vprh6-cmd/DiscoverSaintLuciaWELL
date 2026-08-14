/* ============================================================================
   AUTH ADMIN — the Supabase operations only staff can perform
   ----------------------------------------------------------------------------
   Locking an account and issuing a password-reset link. Both go through the
   Auth Admin REST API with the service-role key, the same surface
   tools/auth-test.js and tools/seed-advisors.js already use, rather than
   through a particular version of supabase-js.

   TWO THINGS HERE ARE NOT IN THE DOCUMENTATION, and are isolated in this file
   precisely so they can be tested rather than assumed:

     · the value that UN-bans. `ban_duration: '876000h'` bans and is documented;
       the docs do not state how to reverse it. `'none'` is the community
       answer and is what BAN_NONE below carries.
     · the response field holding a generated recovery link. Expected at
       `properties.action_link`, with fallbacks, because a rename would
       otherwise produce an email containing "undefined".

   tools/admin-test.js exercises both against a seeded advisor. Until that
   passes, neither control should be trusted — this project has produced three
   false greens from assumptions that read as obviously correct.

   NO PASSWORD IS EVER SET HERE. An admin can send someone a link to choose
   their own; there is exactly one code path in this system that sets a
   credential, and it is the advisor's own reset flow.
   ========================================================================== */
'use strict';

const BAN_FOREVER = '876000h';   /* ~100 years, the documented idiom */
const BAN_NONE = 'none';         /* undocumented; verified by tools/admin-test.js */

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' } };
}

/* Block or restore sign-in. Distinct from `status = 'paused'`, which only stops
   an advisor being offered to consumers — a paused advisor still signs in and
   still works the Journeys they already hold. This is the hard lever. */
async function setLocked(authUserId, locked) {
  const c = config();
  if (!c || !authUserId) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(`${c.url}/auth/v1/admin/users/${authUserId}`, {
      method: 'PUT',
      headers: c.headers,
      body: JSON.stringify({ ban_duration: locked ? BAN_FOREVER : BAN_NONE })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (body && body.msg) || ('HTTP ' + res.status) };
    return { ok: true, user: body };
  } catch (e) {
    console.error('setLocked', e);
    return { ok: false, error: 'request_failed' };
  }
}

/* Generate a recovery link. Supabase GENERATES ONLY — it does not send. That is
   not a limitation here, it is the design: we deliver through Resend, which is
   proven working, so this feature does not inherit the Supabase custom-SMTP
   outage that has email confirmation switched off. */
async function recoveryLink(email, redirectTo) {
  const c = config();
  if (!c) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(`${c.url}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: c.headers,
      body: JSON.stringify({
        type: 'recovery',
        email,
        redirect_to: redirectTo
      })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (body && body.msg) || ('HTTP ' + res.status) };

    /* Read defensively. A renamed field would otherwise put the string
       "undefined" into an email a real person receives — the same failure the
       build guard in build.js exists to catch on pages. */
    const link = (body.properties && body.properties.action_link) || body.action_link || null;
    if (!link) {
      console.error('recoveryLink: no action_link in response', Object.keys(body));
      return { ok: false, error: 'no_link_in_response' };
    }

    /* ── SUPABASE SILENTLY IGNORES AN UNLISTED redirect_to ────────────────
       If the URL is not in the project's Redirect URLs allow-list, Supabase
       does not error — it substitutes the configured Site URL and returns a
       200. The link then works, lands somewhere else entirely, and the token
       arrives on a page with nothing to consume it.

       Measured on this project: asking for either
       https://discoversaintluciawell.com/hub/reset or the www form came back
       pointing at the .vercel.app preview domain instead.

       So the honoured target is read back and compared. A caller that is about
       to EMAIL this link to a person should refuse rather than send one that
       cannot work. */
    let honoured = true, got = redirectTo;
    try {
      got = new URL(link).searchParams.get('redirect_to') || '';
      honoured = got === redirectTo;
    } catch (e) { /* leave as-is; the link itself is what matters */ }

    if (!honoured) {
      console.error('recoveryLink: redirect_to NOT honoured. asked=' + redirectTo + ' got=' + got +
        ' — add it to Supabase → Authentication → URL Configuration → Redirect URLs');
    }
    return { ok: true, link, honoured, redirectGot: got };
  } catch (e) {
    console.error('recoveryLink', e);
    return { ok: false, error: 'request_failed' };
  }
}

/* Whether Supabase currently considers this account banned. Read back rather
   than inferred from our own column, so the console reports what is true. */
async function isLocked(authUserId) {
  const c = config();
  if (!c || !authUserId) return null;
  try {
    const res = await fetch(`${c.url}/auth/v1/admin/users/${authUserId}`, { headers: c.headers });
    if (!res.ok) return null;
    const u = await res.json();
    if (!u.banned_until) return false;
    return new Date(u.banned_until).getTime() > Date.now();
  } catch (e) { return null; }
}

module.exports = { setLocked, recoveryLink, isLocked, BAN_FOREVER, BAN_NONE };
