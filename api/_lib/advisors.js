/* ============================================================================
   ADVISOR REFERENCE RESOLUTION — one place, two vocabularies, forever
   ----------------------------------------------------------------------------
   V2 §6 requires opaque public codes: an advisor's name must not appear in a
   consumer URL. V2 §20 requires that nothing already in circulation breaks.
   Both are satisfied by resolving a reference against EITHER identifier:

     · public_code — `8K4PX7`, opaque, what we mint and print from now on
     · slug        — `diana-lee`, human-readable, what V1.2 minted

   New links only ever carry the code. Old links keep resolving indefinitely,
   because a QR code on a printed card cannot be recalled and an advisor whose
   link quietly stopped attributing would never know.

   Codes are matched case-insensitively. People retype them off cards and out of
   voice notes, and a code that only works in capitals is a code that fails in
   the field.
   ========================================================================== */
'use strict';

/* The reference character set: Crockford base32 without I/L/O/U, plus the
   hyphen and lowercase letters a legacy slug uses. Anything else is not a
   reference we ever issued, so it is rejected before it reaches the database. */
const REF = /^[A-Za-z0-9-]{2,120}$/;

async function resolveAdvisor(supabase, ref, fields = 'id, first_name, last_name, email, status') {
  if (!supabase) return null;
  const value = String(ref || '').trim();
  if (!REF.test(value)) return null;

  /* Code first: it is the canonical identifier, and the codes we generate can
     never collide with a slug (no hyphens, always upper case). */
  const byCode = await supabase
    .from('advisors').select(fields).eq('public_code', value.toUpperCase()).maybeSingle();
  if (byCode.data) return byCode.data;

  const bySlug = await supabase
    .from('advisors').select(fields).eq('slug', value.toLowerCase()).maybeSingle();
  return bySlug.data || null;
}

/* Attribution is only conferred by an advisor who is actually taking Journeys.
   A pending or paused advisor resolves to null here, and the consumer flow
   falls back to the unattributed path — a complete experience on its own. */
async function activeAdvisor(supabase, ref, fields) {
  const a = await resolveAdvisor(supabase, ref, fields);
  return a && a.status === 'active' ? a : null;
}

/* ── The central lead pool ────────────────────────────────────────────────
   Consumer Engine brief §8, third rung: "No attributable advisor → central
   Discover Saint Lucia WELL lead pool." An ordinary advisor row carrying
   is_house (010-house-account.sql), so every screen, query and notification
   already written works on it without a special case.

   ONLY EVER A FALLBACK. Callers reach for this after a referral has failed to
   resolve, never before — an advisor's own link must always win, or a printed
   card quietly stops earning them anything.

   Returns null when there is no house account, when it is not active, or when
   migration 010 has not been applied. Every one of those means "carry on as
   before": the Journey is stored unattributed exactly as it was until today,
   and the result page keeps its contact-form CTA. The feature degrades to the
   previous behaviour rather than failing. */
async function houseAdvisor(supabase, fields = 'id, first_name, last_name, email, business, status, public_code') {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('advisors').select(fields)
    .eq('is_house', true).eq('status', 'active')
    .maybeSingle();
  if (error) {
    /* 42703 — the column does not exist yet. Not worth a log line on every
       unreferred share until the migration lands. */
    if (String(error.code) !== '42703') console.error('houseAdvisor', error);
    return null;
  }
  return data || null;
}

module.exports = { resolveAdvisor, activeAdvisor, houseAdvisor, REF };
