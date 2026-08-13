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

module.exports = { resolveAdvisor, activeAdvisor, REF };
