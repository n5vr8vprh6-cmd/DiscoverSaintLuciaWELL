/* ============================================================================
   DESIGN DATA — reading and writing a consultation, a workspace, an artifact
   ----------------------------------------------------------------------------
   Every function here is scoped by advisor_id IN THE QUERY, on top of RLS. The
   Hub reads through the service role, which bypasses RLS entirely, so the WHERE
   clause is not a second belt — it is the only one.

   ── IT SHIPS BEFORE THE MIGRATION RUNS ────────────────────────────────────
   Deploys here routinely run ahead of hand-applied migrations, and this feature
   degrades in three different directions depending on which table is missing:

     journey_consultations   THE WORKSPACE STILL WORKS, READ-ONLY. Every input
                             the matcher needs is already in journey_shares
                             .answers, and the matching is pure computation — so
                             the shortlist, the mismatches and the day skeleton
                             all render behind a banner saying saving is not
                             available yet. This is the honest degradation, and
                             it is only possible because the valuable half of
                             this feature needs no database at all.

     journey_itineraries     Issue renders DISABLED WITH A NAMED REASON, never
                             hidden. A hidden button is a suggestion; a disabled
                             one with a sentence beside it is an explanation.

     design_generation       FAILS CLOSED. Generation refuses rather than
                             proceeding uncounted, because the ledger's absence
                             is exactly the state in which a runaway loop is
                             unbounded. Every other degradation here opens; this
                             one must not.

   ── NEVER THROWS ──────────────────────────────────────────────────────────
   Same contract as core.js and openai.js. Reads return null or an empty list;
   writes return { ok, reason }. A screen renders in every one of those states.
   ========================================================================== */
'use strict';

const { db } = require('./core.js');

/* Postgres and PostgREST disagree about how to report a table or column that is
   not there yet, and only some of these appear in practice. Checking one and
   assuming it covered the others is how a log fills up — builds.js learned this
   and the list is copied deliberately rather than re-derived. */
const MISSING = ['42703', '42P01', 'PGRST204', 'PGRST205'];
const isMissing = (e) => e && MISSING.indexOf(String(e.code)) !== -1;

/* What a screen is allowed to say about each degradation. Prose lives here so
   two screens cannot describe the same missing table differently. */
const UNAVAILABLE = {
  consultation: 'Saving is not available on this deployment yet — migration 022 has not been applied. You can still work through the shortlist; nothing will be kept.',
  itinerary: 'Issuing is not available on this deployment yet — migration 022 has not been applied.',
  ledger: 'Generation is switched off on this deployment: the usage ledger is missing, and generating without it would be unmetered.'
};

/* ── Capability probe ─────────────────────────────────────────────────────
   Asked once per render rather than discovered by each call failing in turn, so
   a screen can decide what to show before it starts drawing. A count query with
   head:true reads no rows. */
async function capabilities() {
  const supabase = db();
  const out = { database: Boolean(supabase), consultation: false, itinerary: false, ledger: false };
  if (!supabase) return out;

  const probe = async (table) => {
    const { error } = await supabase.from(table).select('id', { count: 'exact', head: true }).limit(1);
    if (!error) return true;
    if (isMissing(error)) return false;
    /* A real error — permissions, network — is not a missing migration. Report
       the capability as present so the failure surfaces where it happens rather
       than being reported as "not migrated yet", which would send somebody to
       the wrong file. */
    console.error('design-data probe ' + table, String(error.message || error.code));
    return true;
  };

  out.consultation = await probe('journey_consultations');
  out.itinerary = await probe('journey_itineraries');
  out.ledger = await probe('design_generation');
  return out;
}

/* ── Consultation ─────────────────────────────────────────────────────────── */

async function consultationFor(shareId, advisorId) {
  const supabase = db();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('journey_consultations').select('*')
    .eq('share_id', shareId).eq('advisor_id', advisorId).maybeSingle();
  if (error && !isMissing(error)) console.error('consultationFor', error.code);
  return data || null;
}

/* Upsert on share_id, which is unique — so the screen is a save rather than a
   create-or-find dance, the same reasoning 011 gives for gtm_profile. */
async function saveConsultation(shareId, advisorId, state, seeded) {
  const supabase = db();
  if (!supabase) return { ok: false, reason: 'not_configured' };

  const row = {
    share_id: shareId,
    advisor_id: advisorId,
    current_states: state.current || {},
    desired_states: state.desired || {},
    village_weights: state.villages || {},
    compass_weights: state.compass || {},
    pillar_weights: state.pillars || {},
    trigger: state.trigger || null,
    uncertainty: state.uncertainty || null,
    readiness: state.readiness || null,
    party: state.party || null,
    orientation: state.orientation || null,
    budget: state.budget || null,
    mobility: state.mobility || null,
    continuum_floor: state.continuumFloor || null,
    continuum_ceiling: state.continuumCeiling || null,
    rhythm: state.rhythm == null ? null : state.rhythm,
    activity: state.activity == null ? null : state.activity,
    social: state.social == null ? null : state.social,
    experience: state.experience == null ? null : state.experience,
    adults: state.adults == null ? null : state.adults,
    children: state.children == null ? null : state.children,
    nights: state.nights == null ? null : state.nights,
    constraints: state.constraints || [],
    updated_at: new Date().toISOString()
  };
  if (seeded) {
    row.seeded_from = seeded.state || null;
    row.advisor_overrode = seeded.overrode || [];
  }

  const { data, error } = await supabase
    .from('journey_consultations').upsert(row, { onConflict: 'share_id' })
    .select('id').maybeSingle();

  if (error) {
    if (isMissing(error)) return { ok: false, reason: 'not_migrated', message: UNAVAILABLE.consultation };
    console.error('saveConsultation', error.code, error.message);
    return { ok: false, reason: 'write_failed' };
  }
  return { ok: true, id: data && data.id };
}

/* Turn a stored row back into the shape need-state.js and design-match.js
   speak. The column names and the object keys differ on purpose — the database
   names what it stores, the modules name what they reason about — so this is
   the one place that knows both. */
function toNeedState(row) {
  if (!row) return null;
  return {
    current: row.current_states || {},
    desired: row.desired_states || {},
    villages: row.village_weights || {},
    compass: row.compass_weights || {},
    pillars: row.pillar_weights || {},
    trigger: row.trigger, uncertainty: row.uncertainty, readiness: row.readiness,
    party: row.party, orientation: row.orientation, budget: row.budget, mobility: row.mobility,
    continuumFloor: row.continuum_floor, continuumCeiling: row.continuum_ceiling,
    rhythm: row.rhythm, activity: row.activity, social: row.social, experience: row.experience,
    adults: row.adults, children: row.children, nights: row.nights,
    constraints: row.constraints || []
  };
}

/* ── Sessions ─────────────────────────────────────────────────────────────── */

/* Newest wins. "Current" is a timestamp question, not a flag — a flag is a
   second fact that can disagree with the timestamps, and there would be
   nothing to arbitrate it (012). */
async function currentSession(shareId, advisorId) {
  const supabase = db();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('design_sessions').select('*')
    .eq('share_id', shareId).eq('advisor_id', advisorId)
    .order('created_at', { ascending: false }).limit(1);
  if (error && !isMissing(error)) console.error('currentSession', error.code);
  return (data && data[0]) || null;
}

async function openSession(consultationId, shareId, advisorId, knowledgeVersion) {
  const supabase = db();
  if (!supabase) return { ok: false, reason: 'not_configured' };
  const { data, error } = await supabase.from('design_sessions').insert({
    consultation_id: consultationId,
    share_id: shareId,
    advisor_id: advisorId,
    knowledge_version: knowledgeVersion || null
  }).select('*').maybeSingle();

  if (error) {
    if (isMissing(error)) return { ok: false, reason: 'not_migrated', message: UNAVAILABLE.consultation };
    console.error('openSession', error.code, error.message);
    return { ok: false, reason: 'write_failed' };
  }
  return { ok: true, session: data };
}

const SESSION_WRITABLE = ['stage', 'status', 'recipe_key', 'shortlist', 'day_plan', 'narrative'];

async function updateSession(sessionId, advisorId, patch) {
  const supabase = db();
  if (!supabase) return { ok: false, reason: 'not_configured' };

  /* An allow-list, not a filter. knowledge_version and the ownership columns
     are not writable through here at any price: the first is frozen by
     definition and the others decide who can read the row. */
  const row = { updated_at: new Date().toISOString() };
  SESSION_WRITABLE.forEach((k) => { if (patch[k] !== undefined) row[k] = patch[k]; });

  const { error } = await supabase.from('design_sessions')
    .update(row).eq('id', sessionId).eq('advisor_id', advisorId);

  if (error) {
    if (isMissing(error)) return { ok: false, reason: 'not_migrated', message: UNAVAILABLE.consultation };
    console.error('updateSession', error.code, error.message);
    return { ok: false, reason: 'write_failed' };
  }
  return { ok: true };
}

/* ── Candidates ───────────────────────────────────────────────────────────
   Replaced wholesale when a shortlist is recomputed. A candidate row is a
   record of what was considered under one set of weights; keeping stale ones
   beside fresh ones would make the aggregate — the reason this table is
   normalised at all — a mixture of two different questions. */
async function saveCandidates(sessionId, advisorId, scored) {
  const supabase = db();
  if (!supabase) return { ok: false, reason: 'not_configured' };

  const rows = scored.map((c, i) => ({
    session_id: sessionId,
    advisor_id: advisorId,
    property_slug: c.slug,
    source: c.collection || 'deep',
    rank: i + 1,
    bands: c.bands || {},
    score_detail: c.detail || {},
    mismatches: c.mismatches || [],
    verified_at: c.verified_at || null
  }));

  await supabase.from('design_candidates').delete().eq('session_id', sessionId).eq('advisor_id', advisorId);
  const { error } = await supabase.from('design_candidates').insert(rows);

  if (error) {
    if (isMissing(error)) return { ok: false, reason: 'not_migrated' };
    console.error('saveCandidates', error.code, error.message);
    return { ok: false, reason: 'write_failed' };
  }
  return { ok: true, saved: rows.length };
}

/* The one field worth more than the rest of this table. Why an advisor put a
   property down is the only signal that will ever say the mapping is wrong. */
async function declineCandidate(sessionId, advisorId, slug, reason) {
  const supabase = db();
  if (!supabase) return { ok: false, reason: 'not_configured' };
  const { error } = await supabase.from('design_candidates')
    .update({ chosen: false, declined_reason: reason || null })
    .eq('session_id', sessionId).eq('advisor_id', advisorId).eq('property_slug', slug);
  if (error && !isMissing(error)) console.error('declineCandidate', error.code);
  return { ok: !error };
}

/* ── The ledger ───────────────────────────────────────────────────────────
   DB-counted, never in-process: each request may be a different serverless
   instance, so an in-process counter would be reset by the platform constantly
   (share.js). These are loop guards, not quotas — if a real person ever hits
   one, the number is wrong, not the person. */
const LIMITS = { session: 12, generation: 60, itinerary: 24 };

async function countSince(table, advisorId, minutes) {
  const supabase = db();
  if (!supabase) return null;
  const since = new Date(Date.now() - minutes * 60000).toISOString();
  const { count, error } = await supabase.from(table)
    .select('id', { count: 'exact', head: true })
    .eq('advisor_id', advisorId).gte('created_at', since);
  if (error) {
    if (isMissing(error)) return null;
    console.error('countSince ' + table, error.code);
    return null;
  }
  return count;
}

/* FAILS CLOSED, and it is the only thing here that does. A null count means the
   ledger could not be read, and generating without a count is generating
   without a limit. Everywhere else an unreadable table degrades toward letting
   the advisor work; here it degrades toward refusing, because the failure mode
   on the other side is an unbounded loop against a paid API. */
async function mayGenerate(advisorId) {
  const n = await countSince('design_generation', advisorId, 60);
  if (n === null) return { ok: false, reason: 'no_ledger', message: UNAVAILABLE.ledger };
  if (n >= LIMITS.generation) return { ok: false, reason: 'rate_limited' };
  return { ok: true, used: n, of: LIMITS.generation };
}

async function recordGeneration(advisorId, sessionId, entry) {
  const supabase = db();
  if (!supabase) return;
  const { error } = await supabase.from('design_generation').insert({
    advisor_id: advisorId,
    session_id: sessionId || null,
    kind: entry.kind,
    model: entry.model || null,
    ms: entry.ms == null ? null : Math.round(entry.ms),
    prompt_chars: entry.promptChars == null ? null : entry.promptChars,
    tokens_in: (entry.usage && entry.usage.prompt_tokens) || null,
    tokens_out: (entry.usage && entry.usage.completion_tokens) || null,
    reason: entry.reason || null
  });
  /* Best effort. A ledger write that fails must not take down the thing it was
     recording — but it is logged, because a silent ledger is not a ledger. */
  if (error && !isMissing(error)) console.error('recordGeneration', error.code);
}

module.exports = {
  capabilities, isMissing, UNAVAILABLE, LIMITS, SESSION_WRITABLE, MISSING,
  consultationFor, saveConsultation, toNeedState,
  currentSession, openSession, updateSession,
  saveCandidates, declineCandidate,
  countSince, mayGenerate, recordGeneration
};

/* ══════════════════════════════════════════════════════════════════════════
   THE ITINERARY — issue, resolve, revoke
   --------------------------------------------------------------------------
   The only rows in this feature that anyone outside the Hub can reach, which
   is why the token rules are stricter than anything above.
   ══════════════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');

/* ── The token ────────────────────────────────────────────────────────────
   Generated here, hashed here, and returned to the caller EXACTLY ONCE. What
   the database holds is a sha256 of it, so a dump — a backup, a support export,
   a leaked read-replica — yields no working links. The advisor copies the link
   at the moment of issue; if they lose it they issue a new version, which is
   the same operation a bank performs when you lose a card.

   Plain sha256 rather than a salted HMAC, unlike ipHash() in core.js. That is
   deliberate and the reason differs in each case: an IP is low-entropy and
   guessable, so it needs a secret to stop a dictionary attack. This token is 32
   random bytes — there is no dictionary — and a keyed hash would make every
   issued link stop resolving the day the key rotates. */
const TOKEN_BYTES = 32;
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const newToken = () => crypto.randomBytes(TOKEN_BYTES).toString('base64url');

/* Long enough that a trip can be planned around it, short enough that a link
   forwarded and forgotten does not stay live indefinitely. An advisor can
   revoke sooner and can always issue again. */
const SHARE_DAYS = 180;

/* THIS IS THE 24-AN-HOUR CAP AND NOTHING ELSE. It counts journey_itineraries,
   which is the table being written to — so "cannot count" here means the
   itinerary table is missing, and the caller has already refused for that
   reason before reaching this.

   It does NOT decide the missing-ledger question. Issuing makes two model calls
   on the way, so it is subject to the same fail-closed rule as any other
   generation, and design.js gates it on mayGenerate() first. An earlier draft of
   this function opened on a null count with a comment about not stopping an
   advisor mid-call; that reasoning only holds for something that generates
   nothing, which this is not. */
async function mayIssue(advisorId) {
  const n = await countSince('journey_itineraries', advisorId, 60);
  if (n === null) return { ok: false, reason: 'not_migrated' };
  if (n >= LIMITS.itinerary) return { ok: false, reason: 'rate_limited' };
  return { ok: true, used: n, of: LIMITS.itinerary };
}

/* ── Issue ────────────────────────────────────────────────────────────────
   Never updates. Version n+1 is a new row, and the old one keeps resolving
   until it is revoked, because a link going dead in an inbox with no
   explanation is worse than one extra live document.

   Returns the token in the clear ONCE. Nothing here logs it. */
async function issueItinerary(advisorId, sessionId, shareId, doc, brand) {
  const supabase = db();
  if (!supabase) return { ok: false, reason: 'no_database' };

  /* The next version for this session, read rather than counted, so two
     concurrent issues collide on itinerary_version_once instead of silently
     overwriting. A unique violation here is the constraint doing its job. */
  const { data: prior, error: readErr } = await supabase
    .from('journey_itineraries')
    .select('version')
    .eq('session_id', sessionId)
    .order('version', { ascending: false })
    .limit(1);

  if (readErr && isMissing(readErr)) return { ok: false, reason: 'not_migrated' };
  if (readErr) return { ok: false, reason: 'read_failed' };

  const version = (prior && prior[0] ? Number(prior[0].version) : 0) + 1;
  const token = newToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SHARE_DAYS * 86400000);

  const { data, error } = await supabase.from('journey_itineraries').insert({
    session_id: sessionId,
    share_id: shareId,
    advisor_id: advisorId,
    version: version,
    document: doc,
    brand: brand || {},
    knowledge_version: doc && doc.knowledge_version,
    share_token_hash: hashToken(token),
    share_expires_at: expires.toISOString(),
    /* Set in the same insert as the document. The trigger freezes a row the
       moment issued_at is non-null, so a two-step "insert then issue" would
       leave a window in which the document is editable and already has a live
       token. */
    issued_at: now.toISOString()
  }).select('id, version').single();

  if (error && isMissing(error)) return { ok: false, reason: 'not_migrated' };
  if (error && String(error.code) === '23505') return { ok: false, reason: 'version_race' };
  if (error) return { ok: false, reason: 'write_failed' };

  return { ok: true, id: data.id, version: data.version, token: token,
           expires_at: expires.toISOString() };
}

/* ── Resolve ──────────────────────────────────────────────────────────────
   The public read. Returns a REASON rather than null so the page can tell a
   withdrawn document from one that never existed — those deserve different
   words, and "withdrawn, speak to your advisor" is the difference between a
   client thinking they were forgotten and a client picking up the phone.

   A token that never matched still returns not_found. There is nothing to
   enumerate: the id space is 32 random bytes. */
async function itineraryByToken(token) {
  const supabase = db();
  if (!supabase) return { ok: false, reason: 'no_database' };
  const t = String(token || '');
  if (!t) return { ok: false, reason: 'not_found' };

  const { data, error } = await supabase
    .from('journey_itineraries')
    .select('id, version, document, brand, share_expires_at, revoked_at, issued_at, view_count')
    .eq('share_token_hash', hashToken(t))
    .limit(1);

  if (error && isMissing(error)) return { ok: false, reason: 'not_migrated' };
  if (error) return { ok: false, reason: 'read_failed' };
  if (!data || !data[0]) return { ok: false, reason: 'not_found' };

  const row = data[0];
  if (row.revoked_at) return { ok: false, reason: 'revoked' };
  if (row.share_expires_at && new Date(row.share_expires_at) < new Date()) {
    return { ok: false, reason: 'expired' };
  }
  if (!row.issued_at) return { ok: false, reason: 'not_found' };

  return { ok: true, row: row };
}

/* ── Counted, not logged ──────────────────────────────────────────────────
   "Opened three times, last Tuesday" is useful to an advisor and identifies
   nobody. No IP, no user agent, no session, no row per view — there is
   deliberately no table here that could later be joined against anything.

   Best effort: a client reading their itinerary must never see an error
   because a counter failed. */
async function recordView(id, current) {
  const supabase = db();
  if (!supabase) return;
  const { error } = await supabase.from('journey_itineraries')
    .update({ view_count: Number(current || 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error && !isMissing(error)) console.error('recordView', error.code);
}

/* ── Revoke ───────────────────────────────────────────────────────────────
   Scoped by advisor in the query like everything else. Nulls the token hash as
   well as stamping revoked_at: a revoked document should stop resolving even if
   some future code path forgets to check the timestamp. Two independent reasons
   for a link to be dead is the right number for the one thing here that a
   stranger can hold. */
async function revokeItinerary(advisorId, id) {
  const supabase = db();
  if (!supabase) return { ok: false, reason: 'no_database' };
  const { error } = await supabase.from('journey_itineraries')
    .update({ revoked_at: new Date().toISOString(), share_token_hash: null })
    .eq('id', id).eq('advisor_id', advisorId);
  if (error && isMissing(error)) return { ok: false, reason: 'not_migrated' };
  if (error) return { ok: false, reason: 'write_failed' };
  return { ok: true };
}

/* Everything issued for one session, newest first. The advisor's own list. */
async function itinerariesFor(advisorId, sessionId) {
  const supabase = db();
  if (!supabase) return [];
  const { data, error } = await supabase.from('journey_itineraries')
    .select('id, version, issued_at, share_expires_at, revoked_at, view_count, last_viewed_at')
    .eq('advisor_id', advisorId).eq('session_id', sessionId)
    .order('version', { ascending: false });
  if (error) return [];
  return data || [];
}

module.exports.issueItinerary = issueItinerary;
module.exports.itineraryByToken = itineraryByToken;
module.exports.itinerariesFor = itinerariesFor;
module.exports.revokeItinerary = revokeItinerary;
module.exports.recordView = recordView;
module.exports.mayIssue = mayIssue;
module.exports.hashToken = hashToken;
module.exports.SHARE_DAYS = SHARE_DAYS;
