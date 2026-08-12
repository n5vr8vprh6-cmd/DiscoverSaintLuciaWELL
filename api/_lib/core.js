/* ============================================================================
   API SHARED CORE — client, guards, escaping
   ----------------------------------------------------------------------------
   Everything security-relevant lives here so it is reviewed in one place
   rather than re-implemented per endpoint.

   THE ONE RULE THIS FILE EXISTS TO ENFORCE:
   the service-role key never leaves the server. `build.js` copies `js/`
   verbatim into `dist/`, so anything in client code is public. Nothing in
   `api/` is ever bundled to the browser — the browser only ever talks to our
   own endpoints, never to Supabase directly.

   DEGRADES INSTEAD OF EXPLODING. If the environment variables are absent —
   which is the case on any deploy before Duncan has created the accounts —
   `db()` returns null and every endpoint answers 503 quietly. The website is
   static and must keep working whether or not the backend exists.
   ========================================================================== */
'use strict';

const crypto = require('crypto');

/* ── Supabase ────────────────────────────────────────────────────────────── */
let _client;
function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!_client) {
    const { createClient } = require('@supabase/supabase-js');
    _client = createClient(url, key, { auth: { persistSession: false } });
  }
  return _client;
}

/* ── Responses ───────────────────────────────────────────────────────────── */
function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  /* These endpoints are called by our own pages and must never be cached by a
     CDN — a cached share response would be a correctness bug, and a cached
     advisor lookup would outlive a deactivated advisor. */
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(body));
}

/* ── Input hygiene ───────────────────────────────────────────────────────── */

/* Hard length caps on everything. Without these, a single request can write
   megabytes into the database and into an email. */
function str(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

/* Escapes for the HTML email body. Consumer input is attacker-controlled: a
   name of `<img src=x onerror=...>` must arrive at the advisor as text, not as
   markup. Everything interpolated into an email goes through this. */
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Deliberately permissive: the goal is to reject obvious rubbish, not to
   adjudicate the RFC. An address that passes here still has to receive mail. */
function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/* Never store the address itself — only a salted hash, so a rate limit does
   not become an IP log. Without a salt configured we return null and the
   caller treats rate limiting as unavailable rather than hashing with a
   guessable constant. */
function ipHash(req) {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) return null;
  const fwd = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(fwd) ? fwd[0] : String(fwd || '')).split(',')[0].trim();
  if (!ip) return null;
  return crypto.createHmac('sha256', salt).update(ip).digest('hex');
}

/* ── Body parsing ────────────────────────────────────────────────────────── */
/* Vercel usually parses JSON for us, but not for every content type, and a
   malformed body must be a 400 rather than a crash. */
function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return null; }
  }
  return {};
}

function methodGuard(req, res, allowed) {
  if (req.method === allowed) return true;
  res.setHeader('Allow', allowed);
  json(res, 405, { error: 'method_not_allowed' });
  return false;
}

module.exports = { db, json, str, esc, looksLikeEmail, ipHash, body, methodGuard };
