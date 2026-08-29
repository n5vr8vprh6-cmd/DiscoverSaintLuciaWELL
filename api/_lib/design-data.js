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
