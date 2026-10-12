/* ============================================================================
   WELL GROUP STUDIO APPLICATIONS
   ----------------------------------------------------------------------------
   One module for the whole thing: validate, rate-limit, write, read. Every
   query against advisor_group_applications goes through here, so "who can read
   this" is a question with one answer rather than one per screen.

   The shape is api/_lib/practitioner.js's, deliberately: same guards, same
   fail-closed rate limit, same insert-only write, same fixed vocabularies. It
   REUSES that module's cleanLink and core.js's helpers rather than restating
   them, so a fix to URL handling lands once.

   WHAT A ROW MEANS, AND WHAT IT DOES NOT
   An advisor described a group concept and asked DSW to consider a
   collaboration. That is all. No price is quoted, no departure exists, nothing
   is held or promised — the page says so and this module never gains a
   function that implies otherwise.

   NOT practitioner_applications. A practitioner asks to be considered; an
   advisor asks to produce a group around an audience they already sell to.
   The brief is explicit that the two must not blend, so this is a table of its
   own and `submission_source` is a column with a CHECK constraint, not a
   convention (db/migrations/029).

   THIS IS AN UNAUTHENTICATED ENDPOINT THAT WRITES TO THE DATABASE AND SENDS
   MAIL TO OUR OWN INBOX, so it has the same guards as api/capture.js:
     1. honeypot     — answered as success (in the screen)
     2. rate limit   — counted in the table itself, by salted IP hash
     3. length caps  — every field, because it all ends up in an email
     4. NOTHING TYPED IS TRUSTED AS A CHOICE. Program interest and every
        "support needed" option must be one of the fixed values below or the
        whole submission is refused. The caller sends codes; labels live here.
   ========================================================================== */
'use strict';

const { db, str, looksLikeEmail, ipHash } = require('./core.js');
const { cleanLink } = require('./practitioner.js');

const SOURCE = 'advisor_group_studio';
const RATE_LIMIT = { max: 5, windowMinutes: 60 };

/* ── The fixed vocabularies ──────────────────────────────────────────────── */
const PROGRAM_INTEREST = {
  eclipse: 'Eclipse, designed around my group',
  custom:  'A custom-branded WELL departure',
  unsure:  'Not sure yet'
};

const SUPPORT = {
  design:        'Journey and programme design',
  property:      'Property and experience matching',
  practitioners: 'Programme and practitioners',
  commercial:    'Pricing and commercial modelling',
  marketing:     'Marketing and a launch campaign',
  operations:    'Destination coordination',
  unsure:        'Not sure yet'
};

/* The brief's success sentence, verbatim. It lives here, not in the screen,
   because the static page needs it too: js/groups.js shows it inline after a
   JSON submit and the markup it reads it from is built from this table, so the
   page and the no-JavaScript fallback cannot promise different things.
   It promises review and nothing else: no response time, no acceptance. */
const THANKS = 'Thanks—your group concept has been received. We’ll review the fit and contact you if there is a relevant collaboration opportunity.';

/* Hard caps. A name is not 4KB; long answers are still bounded. */
const MAX = {
  name: 80, email: 200, phone: 40, business: 140, url: 200, country: 80,
  short: 120, medium: 300, long: 2000
};

/* A list posted from a form arrives as a string when one box is ticked and an
   array when several are; JSON arrives as an array. Normalised once, here. */
function list(v) {
  if (Array.isArray(v)) return v.map((x) => str(x, 40)).filter(Boolean);
  const one = str(v, 40);
  return one ? [one] : [];
}

const TRUTHY = new Set(['yes', 'true', 'on', '1']);
const isChecked = (v) => v === true || TRUTHY.has(String(v == null ? '' : v).trim().toLowerCase());

/* ── Validation ──────────────────────────────────────────────────────────────
   Returns { ok, fields } or { ok: false, error, field }. `error` strings are
   short and stable; the screen maps them to sentences and js/groups.js uses
   `field` to put focus on the offending input. */
function validate(input) {
  const b = input || {};
  const fail = (error, field) => ({ ok: false, error, field });
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  const interest = str(b.program_interest, 20);
  if (!has(PROGRAM_INTEREST, interest)) return fail('interest_required', 'program_interest');

  const f = {
    submission_source: SOURCE,
    program_interest: interest,
    first_name: str(b.first_name, MAX.name),
    last_name:  str(b.last_name, MAX.name),
    email:      str(b.email, MAX.email).toLowerCase(),
    phone:      str(b.phone, MAX.phone),
    business:   str(b.business, MAX.business),
    country:    str(b.country, MAX.country),
    host_agency:      str(b.host_agency, MAX.medium),
    experience:       str(b.experience, MAX.long),
    group_experience: str(b.group_experience, MAX.long),
    concept:    str(b.concept, MAX.long),
    audience:   str(b.audience, MAX.long),
    audience_size:       str(b.audience_size, MAX.short),
    expected_travellers: str(b.expected_travellers, MAX.short),
    departure_window:    str(b.departure_window, MAX.medium),
    budget_range:        str(b.budget_range, MAX.short),
    how_you_sell: str(b.how_you_sell, MAX.long),
    notes:      str(b.notes, MAX.long),
    source:     str(b.source, 40)
  };

  if (!f.first_name || !f.last_name) return fail('name_required', !f.first_name ? 'first_name' : 'last_name');
  if (!looksLikeEmail(f.email)) return fail('email_invalid', 'email');
  if (!f.business) return fail('business_required', 'business');
  if (!f.country) return fail('country_required', 'country');

  /* One link per box, or nothing. Both optional: a host-agency advisor may have
     neither, and the honeypot and rate limit do the work a required link would
     do on the practitioner form. */
  const site = cleanLink(b.website_url), soc = cleanLink(b.social);
  if (!site.ok) return fail('website_invalid', 'website_url');
  if (!soc.ok) return fail('social_invalid', 'social');
  f.website = site.value || null;
  f.social = soc.value || null;

  if (!f.concept) return fail('concept_required', 'concept');
  if (!f.audience) return fail('audience_required', 'audience');
  if (!f.how_you_sell) return fail('sell_required', 'how_you_sell');

  const support = list(b.support_needed);
  if (!support.length) return fail('support_required', 'support_needed');
  if (support.some((s) => !has(SUPPORT, s))) return fail('support_unknown', 'support_needed');
  f.support_needed = Array.from(new Set(support));

  /* Consent to be contacted about THIS application. Refused, not defaulted: the
     column has a CHECK for it, but the person should hear it from the form
     rather than from a constraint violation. */
  if (!isChecked(b.contact_consent)) return fail('consent_required', 'contact_consent');
  f.contact_consent = true;

  /* Empty optionals are null, not '': a blank string is a thing somebody typed,
     and null is the absence of an answer. */
  ['phone', 'host_agency', 'experience', 'group_experience', 'audience_size',
   'expected_travellers', 'departure_window', 'budget_range', 'notes', 'source']
    .forEach((k) => { if (!f[k]) f[k] = null; });

  return { ok: true, fields: f };
}

/* ── Write ──────────────────────────────────────────────────────────────────
   INSERT ONLY. A second application is a second row.

   Order: validate, then look at the database. What somebody typed is knowable
   without a database; only the write is not — and telling a person whose email
   has a typo that "the service is unavailable" sends them away instead of back
   to the field. */
async function submit(input, req) {
  const v = validate(input);
  if (!v.ok) return v;

  const supabase = db();
  if (!supabase) return { ok: false, error: 'unavailable' };

  const hash = ipHash(req) || null;

  /* Rate limit, counted in the table. FAIL CLOSED ON AN UNKNOWN COUNT, for the
     reason api/capture.js spells out at length: a head-count against a table
     that does not exist can come back as `{ count: null, error: null }`, and
     `(count || 0) >= 5` then passes every request. The test is not "did it
     error" but "do I know the number". With no salt at all the check is skipped,
     loudly — that is a deployment mistake, not an outage. */
  if (hash) {
    const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60000).toISOString();
    const { count, error } = await supabase
      .from('advisor_group_applications')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', hash)
      .gte('created_at', since);

    if (error || typeof count !== 'number') {
      console.error('group-studio: rate limit could not be checked — refusing.',
        (error && (error.code + ' ' + error.message)) || 'count came back null',
        '\n  If advisor_group_applications is missing, run db/migrations/029.');
      return { ok: false, error: 'unavailable' };
    }
    if (count >= RATE_LIMIT.max) return { ok: false, error: 'rate_limited' };
  } else {
    console.error('group-studio: IP_HASH_SALT unset — THIS FORM IS UNRATE-LIMITED.');
  }

  const row = Object.assign({}, v.fields, { ip_hash: hash });

  const { data, error } = await supabase
    .from('advisor_group_applications')
    .insert(row)
    .select('id, created_at')
    .maybeSingle();

  if (error) {
    /* PGRST205 is PostgREST's "not in the schema cache", 42P01 is Postgres's
       "no such relation"; which arrives depends on whether the cache or the
       database answered. A missing migration must read as "unavailable", not as
       a generic failure on a form that looked fine. */
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.error('group-studio: advisor_group_applications is missing — run db/migrations/029.');
      return { ok: false, error: 'unavailable' };
    }
    console.error('group-studio: insert failed', error.code || '', error.message || '');
    return { ok: false, error: 'server' };
  }

  return { ok: true, id: data && data.id, fields: v.fields };
}

/* ── Read ───────────────────────────────────────────────────────────────────
   Callers are behind requireAdmin. Not checked here, on purpose: a guard that
   lives in two places is a guard that disagrees with itself. */
async function listApplications(limit) {
  const supabase = db();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('advisor_group_applications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit || 500);
  if (error) {
    console.error('group-studio: list failed', error.code || '', error.message || '');
    return [];
  }
  return data || [];
}

module.exports = {
  validate, submit, listApplications,
  PROGRAM_INTEREST, SUPPORT, THANKS, MAX, RATE_LIMIT, SOURCE
};
