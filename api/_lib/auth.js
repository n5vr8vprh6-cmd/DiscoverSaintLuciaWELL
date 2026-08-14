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

/* ── The one cookie JavaScript is allowed to read ─────────────────────────
   `dslw_who` exists so the static consumer pages can show a signed-in advisor
   their profile control without asking the server who they are.

   IT IS NOT HttpOnly, AND THAT IS THE POINT. It therefore contains nothing
   that could be used to act as anybody: a first name and two initials, both of
   which are already printed on the screen the moment it is used. No token, no
   email, no id.

   NOTHING SERVER-SIDE MAY EVER TRUST IT. It is display state, set by us and
   editable by anyone with a browser console. Every decision about who you are
   still comes from the HttpOnly session through advisorFor(). */
const WHO = 'dslw_who';

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

/* Appends to Set-Cookie rather than replacing it: setSession() may already have
   written the session pair on this response, and res.setHeader would discard
   them. */
function appendCookie(res, value) {
  const existing = res.getHeader('Set-Cookie');
  const list = existing ? (Array.isArray(existing) ? existing.slice() : [existing]) : [];
  list.push(value);
  res.setHeader('Set-Cookie', list);
}

/* Display state for the signed-in header. Deliberately readable — see WHO. */
function setWho(res, advisor) {
  const secure = process.env.NODE_ENV !== 'development';
  const initials = ((advisor.first_name || '?')[0] + ((advisor.last_name || '')[0] || '')).toUpperCase();
  const value = encodeURIComponent(JSON.stringify({
    n: String(advisor.first_name || '').slice(0, 40),
    i: initials
  }));
  appendCookie(res, [
    `${WHO}=${value}`,
    'Path=/', 'SameSite=Lax',
    secure ? 'Secure' : '',
    `Max-Age=${60 * 60 * 24 * 30}`
  ].filter(Boolean).join('; '));
}

function clearSession(res) {
  const secure = process.env.NODE_ENV !== 'development';
  const kill = (n, httpOnly) =>
    `${n}=; Path=/; ${httpOnly ? 'HttpOnly; ' : ''}SameSite=Lax; ${secure ? 'Secure; ' : ''}Max-Age=0`;
  /* The hint cookie goes with them. Leaving it behind would show a profile
     control to someone who has just signed out — harmless in terms of access,
     but it would look broken, which is its own kind of wrong. */
  res.setHeader('Set-Cookie', [kill(COOKIE, true), kill(REFRESH, true), kill(WHO, false)]);
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

  /* Refresh the display cookie here rather than at sign-in, because this is the
     only place that has actually read the advisor row. Setting it at login
     would mean a name changed in account settings stayed stale in the header
     until the next sign-in; setting it here means it corrects itself on the
     next Hub page. Only written when it would change, so an ordinary page load
     does not carry a redundant Set-Cookie. */
  if (res) {
    const initials = ((data.first_name || '?')[0] + ((data.last_name || '')[0] || '')).toUpperCase();
    let current = null;
    try { current = JSON.parse(parseCookies(req)[WHO] || 'null'); } catch (e) { current = null; }
    if (!current || current.n !== data.first_name || current.i !== initials) setWho(res, data);
  }

  return Object.assign({ authUserId: user.id, authEmail: user.email }, data);
}

/* Guard for Hub pages. Redirects rather than 401s, because these are documents
   a person is looking at, not API calls. `next` round-trips them back to the
   page they wanted after signing in.

   THE CALLER PASSES ITS OWN PATH, and it matters. `req.url` here is the
   REWRITTEN url — `/api/hub/journey?id=…`, not `/hub/journeys/…` — which
   safeNext() correctly refuses, so relying on it would drop every signed-out
   advisor on Home. That breaks the single most important journey in the
   product: the deep link in a notification email, followed on a phone,
   by someone whose session has expired. */
async function requireAdvisor(req, res, next) {
  const advisor = await advisorFor(req, res);
  if (advisor) return advisor;
  const target = safeNext(next || req.url || '/hub');
  res.statusCode = 302;
  res.setHeader('Location', `/hub/login?next=${encodeURIComponent(target)}`);
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
  const raw = String(value || '');
  if (raw.startsWith('//') || raw.includes('://') || raw.includes('\\')) return '/hub';

  /* Normalise BEFORE testing the prefix. `/hub/../admin` passes any prefix
     check and then resolves to `/admin` in the browser, which would let a
     crafted login link steer someone anywhere on the site. Parsing against a
     dummy origin collapses the traversal so the test sees the real path. */
  let url;
  try { url = new URL(raw, 'https://x'); } catch (e) { return '/hub'; }

  const path = url.pathname + url.search + url.hash;
  /* `/hub`, `/hub/…`, `/hub?…` — but not `/hubsomethingelse`, so the prefix
     test cannot be widened by adding a route that merely starts the same way. */
  if (!/^\/hub($|[/?#])/.test(path)) return '/hub';
  return path;
}

module.exports = {
  anonClient, parseCookies, setSession, setWho, clearSession,
  userFor, advisorFor, requireAdvisor, requireAdvisorJson, safeNext,
  COOKIE, REFRESH, WHO
};
