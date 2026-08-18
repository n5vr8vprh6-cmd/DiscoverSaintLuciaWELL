/* ============================================================================
   IMMERSION WAITING LIST
   ----------------------------------------------------------------------------
   One module for the whole thing: validate, write, read, export. Every query
   against immersion_waitlist goes through here, so "who can read this list" is
   a question with one answer rather than one per screen.

   WHAT A ROW MEANS, AND WHAT IT DOES NOT
   Somebody asked to be told when Immersion dates exist. That is all. No place
   is held, no price has been quoted, nothing has been paid. The confirmation
   email says so in those words, and this module never gains a `confirm()` or a
   `status` until there is a real offer for it to describe — the moment code
   here implies more than the page does, the page becomes the lie.

   RE-SUBMISSION IS AN UPDATE, NOT A DUPLICATE. The commonest reason a person
   fills a form twice is that they were not sure it worked. Two rows would mean
   two emails from Duncan later, so a repeat address updates the existing row
   and answers exactly as the first submission did — including not disclosing
   that they were already on the list, which is nobody's business but theirs.
   ========================================================================== */
'use strict';

const { db, str, looksLikeEmail, ipHash } = require('./core.js');

/* Hard caps. A name is not 4KB, and everything here ends up in an email. */
const MAX = { name: 80, email: 200, phone: 40, company: 120, agency: 120 };

/* ── Validation ──────────────────────────────────────────────────────────────
   Returns { ok, fields } or { ok: false, error }. The error strings are the
   ones js/hub.js maps to sentences; anything it does not recognise falls back
   to its generic message, which is why they are short and stable. */
function validate(input) {
  const b = input || {};

  const fields = {
    first_name:  str(b.first_name, MAX.name),
    last_name:   str(b.last_name, MAX.name),
    email:       str(b.email, MAX.email).toLowerCase(),
    phone:       str(b.phone, MAX.phone),
    company:     str(b.company_name, MAX.company),
    host_agency: str(b.host_agency, MAX.agency)
  };

  if (!fields.first_name || !fields.last_name) return { ok: false, error: 'name_required' };
  if (!looksLikeEmail(fields.email)) return { ok: false, error: 'email_invalid' };
  if (!fields.phone) return { ok: false, error: 'phone_required' };
  if (!fields.company) return { ok: false, error: 'company_required' };

  /* Empty optional fields are stored as null rather than '': a blank string is
     a thing somebody typed, and null is the absence of an answer. The CSV and
     the admin screen both read better for the distinction. */
  if (!fields.host_agency) fields.host_agency = null;

  return { ok: true, fields };
}

/* ── Write ───────────────────────────────────────────────────────────────────
   Upsert on the case-insensitive email index from migration 018. `updated_at`
   is set explicitly because the column has a default, not a trigger — a
   default only fires on insert, so without this an updated row would keep
   claiming it was last touched on the day it was created. */
async function join(input, req) {
  /* VALIDATE BEFORE LOOKING AT THE DATABASE. It was the other way round, and
     the consequence was that somebody who mistyped their email address was
     told the service was unavailable — a message that is both wrong and
     unactionable, and which sends them away instead of back to the field.
     What they typed is knowable without a database; only the write is not. */
  const v = validate(input);
  if (!v.ok) return v;

  const supabase = db();
  if (!supabase) return { ok: false, error: 'unavailable' };

  const row = Object.assign({}, v.fields, {
    source: 'immersion',
    ip_hash: ipHash(req) || null,
    updated_at: new Date().toISOString()
  });

  const { data, error } = await supabase
    .from('immersion_waitlist')
    .upsert(row, { onConflict: 'email', ignoreDuplicates: false })
    .select('id, created_at')
    .maybeSingle();

  if (error) {
    /* BOTH codes, because the one that actually arrives is PostgREST's, not
       Postgres's: PGRST205 is "not in the schema cache", 42P01 is "no such
       relation", and which you get depends on whether the request was resolved
       by the cache or reached the database. Handling only 42P01 — which is what
       this did first — turns a missing migration into a generic "something went
       wrong" on a form that otherwise looks fine. */
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.error('waitlist: immersion_waitlist is missing — run db/migrations/018.');
      return { ok: false, error: 'unavailable' };
    }
    console.error('waitlist: insert failed', error.code || '', error.message || '');
    return { ok: false, error: 'server' };
  }

  return { ok: true, id: data && data.id, fields: v.fields };
}

/* ── Read ────────────────────────────────────────────────────────────────────
   Callers are behind requireAdmin. This does not check that itself, on purpose:
   a guard that lives in two places is a guard that disagrees with itself. The
   screens own the authorisation; this owns the query. */
async function list(limit) {
  const supabase = db();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('immersion_waitlist')
    .select('id, created_at, first_name, last_name, email, phone, company, host_agency, source')
    .order('created_at', { ascending: false })
    .limit(limit || 500);
  if (error) {
    console.error('waitlist: list failed', error.code || '', error.message || '');
    return [];
  }
  return data || [];
}

async function count() {
  const supabase = db();
  if (!supabase) return null;
  const { count: n, error } = await supabase
    .from('immersion_waitlist')
    .select('id', { count: 'exact', head: true });
  /* null, not 0. A failed count and an empty list are different facts, and a
     dashboard tile that says "0 waiting" when the query broke is worse than
     one that says nothing. */
  if (error) return null;
  return n;
}

/* ── Export ──────────────────────────────────────────────────────────────────
   Same shape as sweepstakes.toCsv(): quoting is unconditional, because a
   company name with a comma in it breaks a naive join and the file that breaks
   is the one somebody is about to import into a mail tool. CRLF and a UTF-8
   BOM because these get opened in Excel on Windows, which renders an accented
   name as mojibake without them. */
function toCsv(rows) {
  const cell = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
  const head = ['Joined', 'First name', 'Last name', 'Email', 'Phone',
                'Company', 'Host agency', 'Source'];
  const body = (rows || []).map((r) => [
    new Date(r.created_at).toISOString().slice(0, 10),
    r.first_name, r.last_name, r.email, r.phone, r.company, r.host_agency, r.source
  ].map(cell).join(','));

  return '﻿' + [head.map(cell).join(',')].concat(body).join('\r\n') + '\r\n';
}

module.exports = { validate, join, list, count, toCsv, MAX };
