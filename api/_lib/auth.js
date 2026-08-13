/* ============================================================================
   AUTH — sessions, advisor resolution, route protection
   ----------------------------------------------------------------------------
   Supabase Auth owns credentials. This file never sees, hashes, compares or
   stores a password: register/login/reset all hand the credential straight to
   Supabase and get back a token. That is the whole reason for using it.

   TWO CLIENTS, AND THE DIFFERENCE MATTERS
     · anonClient()  — the public anon key, used ONLY to exchange credentials
                       for a session. It can read nothing: every table is RLS
                       denied to it.
     · db()          — the service role, used by public endpoints that must
                       write without a user (a consumer sharing a Journey has
                       no account).
   Hub reads go through `advisorFor(req)`, which resolves the signed-in user to
   exactly one advisor row and returns null for everyone else.

   THE SESSION COOKIE IS HttpOnly.
   The access token never touches JavaScript, so an XSS bug on any page of the
   site cannot read it. That costs a round trip on some interactions and is
   worth it.
   ========================================================================== */
'use strict';

const { db, json } = require('./core.js');

const COOKIE = 'dslw_session';
const REFRESH = 'dslw_refresh';

function anonClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/* ── Cookies ─────────────────────────────────────────────────────────────── */
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

/* SameSite=Lax rather than Strict: an advisor clicking the "View Journey" link
   in a notification email arrives from another origin, and Strict would drop
   the cookie and bounce them to a login they do not need. Lax still blocks the
   cross-site POSTs that matter. */
function setSession(res, session) {
  const secure = process.env.NODE_ENV !== 'development';
  const parts = (name, value, maxAge) => [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/', 'HttpOnly', 'SameSite=Lax',
    secure ? 'Secure' : '',
    `Max-Age=${maxAge}`
  ].filter(Boolean).join('; ');

  res.setHeader('Set-Cookie', [
    parts(COOKIE, session.access_token, session.expires_in || 3600),
    parts(REFRESH, session.refresh_token, 60 * 60 * 24 * 30)
  ]);
}

function clearSession(res) {
  const secure = process.env.NODE_ENV !== 'development';
  const kill = (n) => `${n}=; Path=/; HttpOnly; SameSite=Lax; ${secure ? 'Secure; ' : ''}Max-Age=0`;
  res.setHeader('Set-Cookie', [kill(COOKIE), kill(REFRESH)]);
}

/* ── Who is this request? ────────────────────────────────────────────────── */
/* Returns the auth user, transparently refreshing an expired access token so a
   session that is merely stale does not look like a logged-out one. */
async function userFor(req, res) {
  const client = anonClient();
  if (!client) return null;
  const cookies = parseCookies(req);

  if (cookies[COOKIE]) {
    const { data, error } = await client.auth.getUser(cookies[COOKIE]);
    if (!error && data && data.user) return data.user;
  }

  if (cookies[REFRESH] && res) {
    const { data, error } = await client.auth.refreshSession({ refresh_token: cookies[REFRESH] });
    if (!error && data && data.session) {
      setSession(res, data.session);
      return data.user;
    }
    /* A refresh token that no longer works is a dead session, not a transient
       failure. Clear it so the visitor is not stuck in a redirect loop. */
    clearSession(res);
  }
  return null;
}

/* The advisor row for the signed-in user, or null. Every Hub read goes through
   here, so there is exactly one place that decides who you are. */
async function advisorFor(req, res) {
  const user = await userFor(req, res);
  if (!user) return null;
  const supabase = db();
  if (!supabase) return null;
  const { data } = await supabase
    .from('advisors')
    .select('id, slug, public_code, first_name, last_name, email, business, host_agency, phone, website, socials, bio, market, status, onboarding_state, photo_url')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!data) return null;
  return Object.assign({ authUserId: user.id, authEmail: user.email }, data);
}

/* Guard for Hub pages. Redirects rather than 401s, because these are documents
   a person is looking at, not API calls. `next` round-trips them back to the
   page they wanted after signing in. */
async function requireAdvisor(req, res) {
  const advisor = await advisorFor(req, res);
  if (advisor) return advisor;
  const next = encodeURIComponent(req.url || '/hub');
  res.statusCode = 302;
  res.setHeader('Location', `/hub/login?next=${next}`);
  res.end();
  return null;
}

/* Same guard for JSON endpoints, which should get a status rather than HTML. */
async function requireAdvisorJson(req, res) {
  const advisor = await advisorFor(req, res);
  if (!advisor) { json(res, 401, { error: 'not_signed_in' }); return null; }
  return advisor;
}

/* Where a `next` parameter may send someone. An open redirect here would let a
   phishing link bounce off our domain, so only same-origin Hub paths pass. */
function safeNext(value) {
  const v = String(value || '');
  if (!v.startsWith('/hub')) return '/hub';
  if (v.startsWith('//') || v.includes('://')) return '/hub';
  return v;
}

module.exports = {
  anonClient, parseCookies, setSession, clearSession,
  userFor, advisorFor, requireAdvisor, requireAdvisorJson, safeNext,
  COOKIE, REFRESH
};
