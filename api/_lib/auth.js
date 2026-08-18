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
const { needsUndertaking, ACCEPT_PATH } = require('./undertaking.js');

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

/* ── Viewing another advisor's Hub ────────────────────────────────────────
   `dslw_viewas` holds the id of the advisor being looked at. It is HttpOnly,
   short-lived, and — the important part — SEPARATE FROM THE SESSION. The
   session cookie stays the admin's throughout. This is not a login as somebody
   else; it is the admin's own session, rendering somebody else's data.

   That distinction is what makes the audit trail meaningful: every row still
   carries the real admin's identity, because the real admin is who is signed
   in. It is also why the cookie alone grants nothing — advisorFor() only
   honours it when the signed-in account is genuinely an admin, checked against
   the database on every request. */
const VIEWAS = 'dslw_viewas';
const VIEWAS_MINUTES = 30;

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

function setViewAs(res, advisorId) {
  const secure = process.env.NODE_ENV !== 'development';
  appendCookie(res, [
    `${VIEWAS}=${encodeURIComponent(advisorId)}`,
    'Path=/', 'HttpOnly', 'SameSite=Lax',
    secure ? 'Secure' : '',
    `Max-Age=${VIEWAS_MINUTES * 60}`
  ].filter(Boolean).join('; '));
}

/* Deliberately does not touch the session. Exiting is only ever forgetting who
   you were looking at, which is why it needs no permission check of its own —
   clearing this cookie can never grant anything. */
function clearViewAs(res) {
  const secure = process.env.NODE_ENV !== 'development';
  appendCookie(res, `${VIEWAS}=; Path=/; HttpOnly; SameSite=Lax; ${secure ? 'Secure; ' : ''}Max-Age=0`);
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

/* ── What the Hub can see about you ───────────────────────────────────────
   An explicit column list, not select('*'). A column missing from this string
   is `undefined` on every Hub page — which for `role` would mean every admin
   check silently denying everyone, with nothing in the logs to explain it.

   THREE COLUMNS WERE MISSING FROM IT FOR WEEKS, and the comment that used to
   sit here said "add columns here when a screen needs them" — which is a
   reminder, and reminders are what failed. 017 added `plan_builds`, and the
   whole build-pack feature then read `undefined`: no balance line, no rebuild
   button, no pack CTA, from the day it shipped. `foundations_at` and
   `immersion_at` were worse than invisible — rung() reads only those two
   dates, so every advisor in the Hub was `registered`, and a Foundations
   graduate generated copy forbidden from saying they had been trained. It
   failed CLOSED, under-claiming rather than over-claiming, which is exactly
   why it survived so long.

   So it is one constant now (the two loaders below cannot drift), and
   tools/session-columns-test.js asserts that everything read off an advisor
   in api/_lib is actually in here. The next migration gets a failing test
   rather than a silent undefined. */
const SESSION_COLUMNS = 'id, slug, public_code, first_name, last_name, email, business, host_agency, phone, website, socials, bio, market, status, onboarding_state, photo_url, role, is_master, approved_at, registration_note, locked_at, undertaking_version, undertaking_at, is_house, plan_builds, foundations_at, immersion_at, foundations_paid_at';

/* The advisor row for the signed-in user, or null. Every Hub read goes through
   here, so there is exactly one place that decides who you are. */
async function advisorFor(req, res) {
  const user = await userFor(req, res);
  if (!user) return null;
  const supabase = db();
  if (!supabase) return null;
  const { data } = await supabase
    .from('advisors')
    /* An explicit column list, not select('*'). A column missing from this
       string is `undefined` on every Hub page — which for `role` would mean
       every admin check silently denying everyone, with nothing in the logs to
       explain it. Add columns here when a screen needs them. */
    .select(SESSION_COLUMNS)
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

  const self = Object.assign({ authUserId: user.id, authEmail: user.email }, data);

  /* ── The view-as override ───────────────────────────────────────────────
     Deliberately the LAST thing this function does, and the only place in the
     system where the advisor you get back is not the advisor you signed in as.
     Putting it anywhere else would mean two answers to "who is this request",
     which is how support tooling turns into a privilege bug.

     Three conditions, all required, all checked here:
       · the cookie is present;
       · the SIGNED-IN account is genuinely an admin, read from the database on
         this request — not from the session, not from a claim in a cookie;
       · the target still exists.

     Any of them failing returns the admin as themselves. A stale cookie after
     a demotion is therefore inert rather than dangerous. */
  const viewAsId = parseCookies(req)[VIEWAS];
  if (!viewAsId || data.role !== 'admin' || viewAsId === data.id) return self;

  const { data: target } = await supabase
    .from('advisors')
    .select(SESSION_COLUMNS)
    .eq('id', viewAsId)
    .maybeSingle();
  if (!target) return self;

  return Object.assign({}, target, {
    authUserId: user.id,
    authEmail: user.email,
    /* Screens branch on this to refuse writes and to mask consumer details. */
    viewingAs: true,
    /* The real identity travels with the request so the audit trail records the
       person, not the costume. */
    realAdmin: { id: self.id, email: self.email, first_name: self.first_name }
  });
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
/* ── The undertaking gate ─────────────────────────────────────────────────
   An advisor who has not accepted the current Advisor Data Undertaking is sent
   to accept it before they can reach any Hub screen. Placed here, beside the
   other two guards, because a gate applied screen-by-screen is a gate somebody
   forgets on the ninth screen.

   THREE THINGS IT MUST NOT TRAP, and each is a way to make the Hub unusable:

     · the accept screen itself, or the redirect loops forever;
     · sign-out, which is /api/auth/logout — a separate function that never
       calls these guards, so somebody who does not want to accept can always
       leave rather than being held hostage by a legal document;
     · an admin viewing as somebody. needsUndertaking() returns false while
       viewingAs, so staff are never asked to accept on another person's
       behalf. That acceptance would be a forgery, which is the same reason
       007-undertaking.sql does not backfill the eleven existing advisors.

   Returns true when it has redirected and the caller must stop. */
function undertakingGate(advisor, req, res, next) {
  if (!needsUndertaking(advisor)) return false;

  const here = safeNext(next || req.url || '/hub');
  if (here === ACCEPT_PATH || here.indexOf(ACCEPT_PATH + '?') === 0) return false;

  res.statusCode = 302;
  res.setHeader('Location', `${ACCEPT_PATH}?next=${encodeURIComponent(here)}`);
  res.end();
  return true;
}

async function requireAdvisor(req, res, next) {
  const advisor = await advisorFor(req, res);
  if (advisor) {
    if (undertakingGate(advisor, req, res, next)) return null;
    return advisor;
  }
  const target = safeNext(next || req.url || '/hub');
  res.statusCode = 302;
  res.setHeader('Location', `/hub/login?next=${encodeURIComponent(target)}`);
  res.end();
  return null;
}

/* ── Staff ────────────────────────────────────────────────────────────────
   One place decides who is staff, for the same reason advisorFor() is the one
   place that decides who you are.

   A signed-in advisor who is NOT an admin is sent to their own Hub rather than
   to a login screen — they are not unauthenticated, they are simply not staff,
   and bouncing them to a sign-in form they have already passed would be a lie
   about what went wrong.

   `role` comes from the advisors row via the service role. It never comes from
   the session, and never from the `dslw_who` cookie, which is readable and
   editable by anyone with a browser console. */
async function requireAdmin(req, res, next) {
  const advisor = await advisorFor(req, res);

  if (!advisor) {
    const target = safeNext(next || '/hub');
    res.statusCode = 302;
    res.setHeader('Location', `/hub/login?next=${encodeURIComponent(target)}`);
    res.end();
    return null;
  }

  /* Two refusals, and the second is not covered by the first.

     While viewing as somebody, you are not acting as an admin — you are looking
     at their Hub, and the admin console is not part of what they can see. The
     role check alone would miss the case of an admin viewing as ANOTHER ADMIN,
     where the effective role is still 'admin'. So `viewingAs` is refused
     outright, whoever the target happens to be.

     The way back is the banner's Stop viewing, which clears the cookie and
     needs no permission of its own. */
  if (advisor.viewingAs || advisor.role !== 'admin') {
    res.statusCode = 302;
    res.setHeader('Location', '/hub');
    res.end();
    return null;
  }

  /* Staff accept it too. An exemption for the person who wrote the document is
     the sort of exemption that reads badly later, and Duncan holds travellers'
     contact details like every other advisor. */
  if (undertakingGate(advisor, req, res, next)) return null;

  return advisor;
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
  setViewAs, clearViewAs,
  userFor, advisorFor, requireAdvisor, requireAdmin, requireAdvisorJson, safeNext,
  COOKIE, REFRESH, WHO, VIEWAS, VIEWAS_MINUTES
};
