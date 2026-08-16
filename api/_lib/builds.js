/* ============================================================================
   BUILDS — the balance, and the only two things that move it
   ----------------------------------------------------------------------------
   Three plan builds for a registered advisor, three more for nine dollars.
   Foundations and Immersion are unlimited and their balance is never read and
   never spent.

   ── WHY A PACK AND NOT A SUBSCRIPTION ─────────────────────────────────────
   Duncan's reasoning, and it is right: Foundations graduates are trained to
   use this well, so they will not hammer it — and the people who would are
   the ones for whom a monthly fee is a subscription they forget to cancel.
   A pack of three is bought once, spent when it is worth spending, and never
   has to be cancelled. It also puts a real decision in front of the advisor at
   the moment they are deciding whether the last plan was any good.

   ── SPEND HAPPENS AFTER SUCCESS, AND THAT IS A DELIBERATE TRADE ───────────
   Two orderings were available.

     Reserve first, refund on failure — safe against a concurrent double
     generation, but a crash between reserving and refunding costs the ADVISOR
     a build they never got a plan from.

     Spend after the plan is saved — a crash costs US a build, and two
     simultaneous requests could in principle produce two plans for one build.

   The second, because everywhere else in this codebase a bug is made to
   under-claim rather than over-claim, and the same rule should hold when the
   thing being claimed is the advisor's money. The double-generation window is
   also already bounded by the plans-per-hour limit in api/gtm.js.

   ── A MISSING COLUMN MEANS "DO NOT GATE" ──────────────────────────────────
   The code ships before Duncan runs migration 017. Until then every read
   returns null and every gate falls back to the old behaviour — one plan, no
   rebuild. A payment feature that fails open into "everything is free" would
   be worse than one that fails closed into what we already shipped.
   ========================================================================== */
'use strict';

const { db } = require('./core.js');

/* Postgres and PostgREST disagree about how to report a column that is not
   there yet, and only some of these appear in practice. Checking one and
   assuming it covered the others is how a log fills up. */
const MISSING = ['42703', '42P01', 'PGRST204', 'PGRST205'];
const isMissing = (e) => e && MISSING.indexOf(String(e.code)) !== -1;

const PACK_SIZE = 3;
const FREE_BUILDS = 3;
const PACK_PRICE = '$9';

/* Unlimited, and the balance is not even looked at. Kept as one function so
   there is one answer to "is this advisor metered" rather than a condition
   repeated in four places that can drift apart. */
function unmetered(advisor) {
  return Boolean(advisor && (advisor.foundations_at || advisor.immersion_at));
}

/* null means "we cannot tell" — the column is missing or the row is gone —
   and every caller treats null as "do not gate on this". */
function balance(advisor) {
  if (!advisor) return null;
  if (unmetered(advisor)) return null;
  const n = advisor.plan_builds;
  if (n === null || n === undefined) return null;
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, v) : null;
}

function mayBuild(advisor) {
  if (unmetered(advisor)) return true;
  const n = balance(advisor);
  if (n === null) return null;   /* caller falls back to the old gate */
  return n > 0;
}

/* ── Spend ────────────────────────────────────────────────────────────────
   One statement in the database — see 017. Returns the new balance, or null
   when there was nothing to spend or nothing to spend it against.

   IT IS NEVER CALLED FOR AN UNMETERED ADVISOR. Not "called and ignored":
   a Foundations graduate's balance must not move, because the moment it does,
   somebody later reads it and reaches a conclusion from a number that has been
   quietly counting down against a person who is not being counted. */
async function spend(advisor) {
  if (unmetered(advisor)) return { ok: true, unmetered: true, left: null };

  const supabase = db();
  if (!supabase || !advisor || !advisor.id) return { ok: false, reason: 'no_db' };

  const { data, error } = await supabase.rpc('spend_plan_build', { p_advisor: advisor.id });
  if (error) {
    if (isMissing(error)) return { ok: true, ungated: true, left: null };
    console.error('spend_plan_build', error);
    return { ok: false, reason: 'spend_failed' };
  }

  /* No row back means the conditional UPDATE matched nothing: exhausted. */
  const left = Array.isArray(data) ? data[0] : data;
  if (left === null || left === undefined) return { ok: false, reason: 'exhausted' };
  return { ok: true, left: Number(left) };
}

/* ── Grant ────────────────────────────────────────────────────────────────
   ADDS, never sets. Duncan was explicit and he is right: a top-up that refills
   TO three throws away builds somebody already paid for if they buy while they
   still have one left. Adding is also the only version that behaves sanely
   when two packs are bought in a week. */
async function grant(advisorId, n) {
  const supabase = db();
  if (!supabase || !advisorId) return { ok: false, reason: 'no_db' };

  const { data, error } = await supabase.rpc('add_plan_builds', {
    p_advisor: advisorId, p_n: Number(n) || 0
  });
  if (error) {
    if (isMissing(error)) return { ok: false, reason: 'not_migrated' };
    console.error('add_plan_builds', error);
    return { ok: false, reason: 'grant_failed' };
  }
  const left = Array.isArray(data) ? data[0] : data;
  if (left === null || left === undefined) return { ok: false, reason: 'no_such_advisor' };
  return { ok: true, left: Number(left) };
}

/* ── Recording what arrived ───────────────────────────────────────────────
   Insert first and let the UNIQUE constraint answer "have we seen this
   before". A select-then-insert would be a race, and the whole reason this
   exists is that providers retry exactly when the first attempt worked and the
   response was lost.

   Returns { fresh: false } for a replay, which is a normal outcome and not an
   error — the caller must not treat it as a failure and must not retry. */
async function record(event) {
  const supabase = db();
  if (!supabase) return { ok: false, reason: 'no_db' };

  const { error } = await supabase.from('purchase_events').insert({
    provider: event.provider,
    event_id: event.eventId,
    kind: event.kind,
    advisor_id: event.advisorId || null,
    email: event.email || null,
    builds_delta: event.delta || 0,
    note: event.note || null,
    raw: event.raw || null
  });

  if (error) {
    /* 23505 is the unique violation: we have already handled this one. */
    if (String(error.code) === '23505') return { ok: true, fresh: false };
    if (isMissing(error)) return { ok: false, reason: 'not_migrated' };
    console.error('purchase_events insert', error);
    return { ok: false, reason: 'record_failed' };
  }
  return { ok: true, fresh: true };
}

/* What the advisor is told. Written here rather than in the screen so the
   webhook, the gate and the Hub cannot describe the same balance differently.

   No padlock vocabulary — see loopback.js. It states a number and a price. */
function balanceLine(advisor) {
  if (unmetered(advisor)) return null;
  const n = balance(advisor);
  if (n === null) return null;
  if (n === 0) {
    return `You have used your plan builds. Another ${PACK_SIZE} is ${PACK_PRICE}, once — ` +
      'not a subscription. Editing, regenerating single pieces and trying another angle ' +
      'all stay free and always did.';
  }
  return n === 1
    ? 'One plan build left. Editing any piece of this plan is free and does not use it.'
    : `${n} plan builds left. Editing any piece of this plan is free and does not use one.`;
}

module.exports = {
  unmetered, balance, mayBuild, spend, grant, record, balanceLine,
  PACK_SIZE, FREE_BUILDS, PACK_PRICE
};
