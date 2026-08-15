/* ============================================================================
   UNDERTAKING — the one place that knows which version is current
   ----------------------------------------------------------------------------
   The document itself is content/advisor-undertaking.js, which is a page in the
   static build. This file holds only the version string and the accept/record
   logic, and the page REQUIRES THIS ONE rather than the other way round.

   The direction matters. A serverless function must not pull a whole page
   object into its bundle to learn a date, and — more importantly — two copies
   of a version string is exactly how an acceptance ends up recorded against a
   document that was never the one shown. One constant, imported by both.

   BUMPING THE VERSION RE-GATES EVERY ADVISOR. That is the intended cost of
   changing what they promised: an acceptance you cannot tie to specific wording
   is not evidence of anything. Only bump it for a material change — fixing a
   typo and re-gating eleven people teaches them to click through it.
   ========================================================================== */
'use strict';

const { db } = require('./core.js');

/* Date-stamped rather than numbered, so the version and the document are
   obviously the same thing when they sit next to each other in an audit row. */
const UNDERTAKING_VERSION = '2026-08-14';

const PATH = '/advisors/data-undertaking';
const ACCEPT_PATH = '/hub/undertaking';

/* True when this advisor still owes us an acceptance of the CURRENT version.
   Deliberately a version comparison rather than a null check: an advisor who
   accepted 2026-08-14 has not accepted whatever replaces it. */
function needsUndertaking(advisor) {
  if (!advisor) return false;

  /* An admin viewing somebody else's Hub is never asked to accept. They would
     be accepting on behalf of a person who has not read it, and the record
     would be a forgery — which is the same reason 007 does not backfill. The
     advisor is asked the next time they sign in themselves. */
  if (advisor.viewingAs) return false;

  /* ── THE HOUSE ACCOUNT IS STAFF, NOT AN INDEPENDENT ADVISOR ─────────────
     Every clause of the undertaking begins from "you are an independent
     professional and we are passing you somebody else's data". The team
     working the central pool are the operator — the people the traveller's
     details were given to in the first place — and they are covered by the
     privacy policy directly.

     Asking them to accept it would put a statement that is not true into the
     one record built to prove that acceptances are real. That is a worse
     outcome than the small amount of logic this line costs. */
  if (advisor.is_house) return false;

  return advisor.undertaking_version !== UNDERTAKING_VERSION;
}

/* Recorded through the service role. The column grant in 007-undertaking.sql
   deliberately excludes these two from what an advisor may write, so an
   acceptance cannot be self-certified by posting extra keys at /hub/account. */
async function recordAcceptance(advisorId) {
  const supabase = db();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const { error } = await supabase.from('advisors').update({
    undertaking_version: UNDERTAKING_VERSION,
    undertaking_at: new Date().toISOString()
  }).eq('id', advisorId);
  if (error) {
    /* Migration 007 not applied yet: the columns do not exist, so every advisor
       is permanently gated and cannot get past the accept screen. Loud, because
       the symptom on its own reads as a broken Hub. */
    console.error('recordAcceptance — is migration 007 applied?', error);
    return { ok: false, error: 'failed' };
  }
  return { ok: true };
}

module.exports = { UNDERTAKING_VERSION, PATH, ACCEPT_PATH, needsUndertaking, recordAcceptance };
