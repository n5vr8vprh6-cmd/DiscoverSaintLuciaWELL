/* ============================================================================
   PRACTITIONER APPLICATIONS
   ----------------------------------------------------------------------------
   One module for the whole thing: validate, rate-limit, write, read. Every query
   against practitioner_applications goes through here, so "who can read this" is
   a question with one answer rather than one per screen.

   WHAT A ROW MEANS, AND WHAT IT DOES NOT
   Somebody described their work and asked DSW to consider it. That is all. No
   retreat is agreed, no residency exists, nothing is held or promised — the
   page says so and this module never gains a function that implies otherwise.

   THIS IS AN UNAUTHENTICATED ENDPOINT THAT WRITES TO THE DATABASE AND SENDS
   MAIL TO OUR OWN INBOX, SO IT HAS THE SAME GUARDS AS api/capture.js:
     1. honeypot     — answered as success (in the screen)
     2. rate limit   — counted in the table itself, by salted IP hash
     3. length caps  — every field, because it all ends up in an email
     4. NOTHING TYPED IS TRUSTED AS A CHOICE. Pathway, yes/no answers and every
        "help with" option must be one of the fixed values below or the whole
        submission is refused. The caller sends codes; the labels live here.

   The rate limit reads the applications table rather than a second table: a
   row is written only for a real, valid submission, so the count is exactly
   "applications from this origin in the last hour" and there is nothing extra
   to migrate, purge or erase.
   ========================================================================== */
'use strict';

const { db, str, looksLikeEmail, ipHash } = require('./core.js');

const RATE_LIMIT = { max: 5, windowMinutes: 60 };

/* ── The fixed vocabularies ──────────────────────────────────────────────────
   Labels are what the notification email prints; the codes are what the form
   posts. js/practitioners.js does not need them — the values live in the markup
   (lib/practitioner-sections.js reads these same tables), so the form and the
   check cannot disagree about what a legal answer is. */
const PATHWAYS = {
  retreat:  'Retreat Collaboration',
  visiting: 'Visiting Practitioner Network',
  both:     'Both'
};

const CONCEPT = {
  established: 'An established program',
  idea:        'The beginnings of an idea',
  none:        'No concept yet'
};

const HELP_WITH = {
  program:     'Program refinement',
  property:    'Property or venue',
  travel:      'Travel logistics',
  commercial:  'Pricing or commercial model',
  marketing:   'Marketing or go-to-market',
  practitioners: 'Supporting practitioners',
  destination: 'Destination experiences',
  unsure:      'Not sure yet'
};

const YES_NO = { yes: 'Yes', no: 'No' };

/* The two success sentences are the brief's (§09), verbatim. They live here, not
   in the screen, because the static page needs them too: js/practitioners.js
   shows one inline after a JSON submit, and the markup it reads them from is
   built at deploy time from this table. One source, so the page and the
   no-JavaScript fallback cannot promise different things. */
const THANKS = {
  retreat:  'Thank you. We’ll review your application and reach out by email if there appears to be a strong fit.',
  both:     'Thank you. We’ll review your application and reach out by email if there appears to be a strong fit.',
  visiting: 'Thank you. Your profile has been submitted for review for the Discover Saint Lucia WELL practitioner network. We’ll contact you by email if there is an appropriate next step.'
};

/* Hard caps. A name is not 4KB. Long answers are still bounded: 2,000
   characters is a generous paragraph and a small enough thing to email. */
const MAX = {
  name: 80, email: 200, phone: 40, business: 140, url: 200, country: 80,
  short: 120, medium: 300, long: 2000
};

/* A list posted from a form arrives as a string when one box is ticked and an
   array when several are; JSON arrives as an array. Normalised here, once. */
function list(v) {
  if (Array.isArray(v)) return v.map((x) => str(x, 40)).filter(Boolean);
  const one = str(v, 40);
  return one ? [one] : [];
}

/* ── One link, or nothing ────────────────────────────────────────────────────
   The two "where can we see your work" boxes each hold ONE link. They used to be
   free text, which invited "instagram.com/x and linkedin.com/y" into a single
   box — a parsing problem for whoever reads the table later, and a puzzle for the
   person typing. So each is now a single URL, normalised here and refused when it
   is plainly several things or not a link at all:

     "example.com"                  -> "https://example.com/"   (scheme added)
     "https://instagram.com/x"      -> kept
     "@yourname"                    -> refused: a handle names no platform
     "a.com, b.com" / "a.com b.com" -> refused: one link per box
     "not a link"                   -> refused

   Returns { ok: true, value } (value null when empty) or { ok: false }. */
function cleanLink(raw) {
  const v = str(raw, MAX.url);
  if (!v) return { ok: true, value: null };
  if (/[\s,;]/.test(v) || v.charAt(0) === '@') return { ok: false };
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : 'https://' + v;
  let u;
  try { u = new URL(withScheme); } catch (e) { return { ok: false }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false };
  /* A real host has a dot and a letter-only top level: "https://x" and
     "https://1234" are not somewhere anybody can visit. */
  if (!/^[^.]+(\.[^.]+)+$/.test(u.hostname) || !/[a-z]{2,}$/i.test(u.hostname)) return { ok: false };
  return { ok: true, value: u.toString() };
}

/* ── Validation ──────────────────────────────────────────────────────────────
   Returns { ok, fields } or { ok: false, error, field }. `error` strings are
   short and stable; the screen maps them to sentences and js/practitioners.js
   uses `field` to put focus on the offending input. */
function validate(input) {
  const b = input || {};
  const fail = (error, field) => ({ ok: false, error, field });

  const pathway = str(b.pathway, 20);
  if (!Object.prototype.hasOwnProperty.call(PATHWAYS, pathway)) return fail('pathway_required', 'pathway');

  const f = {
    pathway,
    first_name: str(b.first_name, MAX.name),
    last_name:  str(b.last_name, MAX.name),
    email:      str(b.email, MAX.email).toLowerCase(),
    phone:      str(b.phone, MAX.phone),
    business:   str(b.business, MAX.business),
    website:    '',
    social:     '',
    country:    str(b.country, MAX.country),
    years:      str(b.years, MAX.short),
    modality:   str(b.modality, MAX.medium),

    work:       str(b.work, MAX.long),
    serves:     str(b.serves, MAX.long),
    community:  str(b.community, MAX.long),
    led_before_detail: str(b.led_before_detail, MAX.long),
    audience_size: str(b.audience_size, MAX.short),
    notes:      str(b.notes, MAX.long),
    source:     str(b.source, 40)
  };

  /* Step 1 */
  if (!f.first_name || !f.last_name) return fail('name_required', !f.first_name ? 'first_name' : 'last_name');
  if (!looksLikeEmail(f.email)) return fail('email_invalid', 'email');
  if (!f.business) return fail('business_required', 'business');
  /* Some evidence that the work exists in public. It is the cheapest honest
     qualification signal there is, and either one will do. */
  const site = cleanLink(b.website_url), soc = cleanLink(b.social);
  if (!site.ok) return fail('website_invalid', 'website_url');
  if (!soc.ok) return fail('social_invalid', 'social');
  f.website = site.value || '';
  f.social = soc.value || '';
  /* Some evidence that the work exists in public — at least one of the two links. */
  if (!f.website && !f.social) return fail('presence_required', 'website_url');
  if (!f.country) return fail('country_required', 'country');
  if (!f.modality) return fail('modality_required', 'modality');

  /* Step 2, shared */
  if (!f.work) return fail('work_required', 'work');
  if (!f.serves) return fail('serves_required', 'serves');
  if (!f.community) return fail('community_required', 'community');

  const led = str(b.led_before, 5);
  if (!Object.prototype.hasOwnProperty.call(YES_NO, led)) return fail('led_before_required', 'led_before');
  f.led_before = led === 'yes';
  if (!f.led_before) f.led_before_detail = '';

  /* Empty optionals are stored as null, not '': a blank string is a thing
     somebody typed, and null is the absence of an answer. */
  ['phone', 'website', 'social', 'years', 'led_before_detail', 'audience_size', 'notes', 'source']
    .forEach((k) => { if (!f[k]) f[k] = null; });

  /* Step 2, pathway-specific. Only the branch(es) the person chose are read —
     a visitor who picked "retreat" and then posts a `credentials` field gets
     it ignored, not stored. */
  f.retreat = null;
  f.visiting = null;

  if (pathway === 'retreat' || pathway === 'both') {
    const concept = str(b.concept, 20);
    if (!Object.prototype.hasOwnProperty.call(CONCEPT, concept)) return fail('concept_required', 'concept');

    const help = list(b.help_with);
    if (!help.length) return fail('help_required', 'help_with');
    if (help.some((h) => !Object.prototype.hasOwnProperty.call(HELP_WITH, h))) return fail('help_unknown', 'help_with');

    f.retreat = {
      concept,
      group_size:  str(b.group_size, MAX.short) || null,
      price_range: str(b.price_range, MAX.short) || null,
      timing:      str(b.timing, MAX.medium) || null,
      previous_locations: str(b.previous_locations, MAX.medium) || null,
      help_with:   Array.from(new Set(help))
    };
  }

  if (pathway === 'visiting' || pathway === 'both') {
    const credentials = str(b.credentials, MAX.long);
    const experience = str(b.experience_type, MAX.long);
    if (!credentials) return fail('credentials_required', 'credentials');
    if (!experience) return fail('experience_required', 'experience_type');

    f.visiting = {
      credentials,
      experience_type: experience,
      capacity:     str(b.session_capacity, MAX.short) || null,
      availability: str(b.availability, MAX.medium) || null,
      hospitality:  str(b.hospitality_experience, MAX.long) || null
    };
  }

  return { ok: true, fields: f };
}

/* ── Write ───────────────────────────────────────────────────────────────────
   INSERT ONLY. See the migration for why a second application is a second row.

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
     error" but "do I know the number". When there is no salt at all the check
     is skipped, loudly — that is a deployment mistake, not an outage. */
  if (hash) {
    const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60000).toISOString();
    const { count, error } = await supabase
      .from('practitioner_applications')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', hash)
      .gte('created_at', since);

    if (error || typeof count !== 'number') {
      console.error('practitioner: rate limit could not be checked — refusing.',
        (error && (error.code + ' ' + error.message)) || 'count came back null',
        '\n  If practitioner_applications is missing, run db/migrations/028.');
      return { ok: false, error: 'unavailable' };
    }
    if (count >= RATE_LIMIT.max) return { ok: false, error: 'rate_limited' };
  } else {
    console.error('practitioner: IP_HASH_SALT unset — THIS FORM IS UNRATE-LIMITED.');
  }

  const row = Object.assign({}, v.fields, { ip_hash: hash });

  const { data, error } = await supabase
    .from('practitioner_applications')
    .insert(row)
    .select('id, created_at')
    .maybeSingle();

  if (error) {
    /* Both codes: PGRST205 is PostgREST's "not in the schema cache", 42P01 is
       Postgres's "no such relation", and which arrives depends on whether the
       cache or the database answered. A missing migration must read as
       "unavailable", not as a generic failure on a form that looked fine. */
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.error('practitioner: practitioner_applications is missing — run db/migrations/028.');
      return { ok: false, error: 'unavailable' };
    }
    console.error('practitioner: insert failed', error.code || '', error.message || '');
    return { ok: false, error: 'server' };
  }

  return { ok: true, id: data && data.id, fields: v.fields };
}

/* ── Read ────────────────────────────────────────────────────────────────────
   Callers are behind requireAdmin. Not checked here, on purpose: a guard that
   lives in two places is a guard that disagrees with itself. */
async function listApplications(limit) {
  const supabase = db();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('practitioner_applications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit || 500);
  if (error) {
    console.error('practitioner: list failed', error.code || '', error.message || '');
    return [];
  }
  return data || [];
}

module.exports = {
  cleanLink, validate, submit, listApplications,
  PATHWAYS, CONCEPT, HELP_WITH, YES_NO, THANKS, MAX, RATE_LIMIT
};
