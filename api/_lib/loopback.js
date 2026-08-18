/* ============================================================================
   LOOPBACK — what actually happened, and the one place Foundations is mentioned
   ----------------------------------------------------------------------------
   The Hub already counts the whole funnel per advisor: campaign_visits →
   finder_completions → journey_shares, each with a timestamp. Nothing has ever
   read them back to the advisor who caused them.

   "You posted on day 3 — your link got 14 visits and 2 Journeys that week" is
   what turns a document into an operating system. It is also the only report
   in the product that can tell an advisor whether any of this worked, which is
   the question they actually have.

   ── WHY FOUNDATIONS IS MENTIONED HERE AND NOWHERE ELSE ────────────────────
   Nothing about Foundations appears in the campaign flow until the Hub can
   show something real. Not on the plan screen, not in the empty state, not
   beside a locked button.

   The reason is not delicacy. Before a result there is no argument, only a
   pitch — and an advisor who has just been sold to before being helped
   discounts everything after it. After a result there is evidence: they can
   see fourteen visits and two Journeys, and the sentence "a Brand Profile
   changes what the next month's copy can say" lands as a next step rather than
   as an upsell.

   This is the guard most likely to erode, because moving it earlier will
   always look like it would convert better. tools/loopback-test.js asserts a
   zero-result advisor is never shown it.

   ── THE NUMBERS ARE SMALL AND SAID SO ─────────────────────────────────────
   An advisor with eleven visits does not need a dashboard, and presenting
   eleven visits as though it were analytics is how a small number gets made to
   feel like a failure. Plain sentences, real counts, no percentages on
   single-digit bases.
   ========================================================================== */
'use strict';

const { db } = require('./core.js');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/* Which week of the plan today falls in — 1-4 while it runs, 5+ once the month
   is over. Derived from the plan's own created_at rather than from a calendar
   week, because the month starts when the plan was built. */
function weekNumber(plan, now) {
  if (!plan || !plan.created_at) return 0;
  const started = new Date(plan.created_at).getTime();
  const elapsed = (now || Date.now()) - started;
  return Math.floor(elapsed / WEEK_MS) + 1;
}

function windowFor(plan, week) {
  const started = new Date(plan.created_at).getTime();
  return {
    from: new Date(started + (week - 1) * WEEK_MS).toISOString(),
    to: new Date(started + week * WEEK_MS).toISOString()
  };
}

async function countIn(supabase, table, advisorId, from, to) {
  const { count, error } = await supabase
    .from(table).select('id', { count: 'exact', head: true })
    .eq('advisor_id', advisorId).gte('created_at', from).lt('created_at', to);
  if (error) {
    /* A missing table must not take the campaign screen down with it — the
       report is the least important thing on that page. */
    if (['42P01', 'PGRST205', 'PGRST204'].indexOf(String(error.code)) === -1) {
      console.error('loopback ' + table, error);
    }
    return null;
  }
  return count || 0;
}

/* The report for one week. Returns null when there is nothing to say, so a
   caller can render nothing rather than render zeros — "0 visits, 0 Journeys"
   is a worse thing to show somebody in week one than silence. */
async function forWeek(advisor, plan, week, now) {
  const supabase = db();
  if (!supabase || !advisor || !plan || week < 1) return null;

  const { from, to } = windowFor(plan, week);
  const [visits, completions, journeys] = await Promise.all([
    countIn(supabase, 'campaign_visits', advisor.id, from, to),
    countIn(supabase, 'finder_completions', advisor.id, from, to),
    countIn(supabase, 'journey_shares', advisor.id, from, to)
  ]);

  if (visits === null && completions === null && journeys === null) return null;

  const v = visits || 0, c = completions || 0, j = journeys || 0;
  return {
    week, from, to,
    visits: v, completions: c, journeys: j,
    anything: v + c + j > 0,
    /* The sentence, written rather than assembled from fragments, because
       "1 visits" is the kind of thing assembled sentences say. */
    line: sentence(v, c, j)
  };
}

function sentence(v, c, j) {
  if (v + c + j === 0) return 'Nothing came through your link this week.';

  const parts = [];
  if (v) parts.push(v === 1 ? 'one visit to your link' : `${v} visits to your link`);
  if (c) parts.push(c === 1 ? 'one Journey started' : `${c} Journeys started`);
  if (j) parts.push(j === 1 ? 'one person shared theirs with you' : `${j} people shared theirs with you`);

  const list = parts.length > 1
    ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]
    : parts[0];

  /* The last clause is the one that matters. A shared Journey is a person
     waiting for a reply, and saying so is more useful than any number. */
  return j
    ? `${cap(list)}. ${j === 1 ? 'That is somebody' : 'Those are people'} waiting to hear from you.`
    : `${cap(list)}.`;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* The whole month, once it is over. */
async function forPlan(advisor, plan, now) {
  const weeks = [];
  const upto = Math.min(4, weekNumber(plan, now));
  for (let w = 1; w <= upto; w++) {
    const r = await forWeek(advisor, plan, w, now);
    if (r) weeks.push(r);
  }
  const totals = weeks.reduce((t, w) => ({
    visits: t.visits + w.visits, completions: t.completions + w.completions,
    journeys: t.journeys + w.journeys
  }), { visits: 0, completions: 0, journeys: 0 });

  return {
    weeks,
    totals,
    anything: totals.visits + totals.completions + totals.journeys > 0,
    currentWeek: weekNumber(plan, now),
    finished: weekNumber(plan, now) > 4
  };
}

/* ── The one Foundations mention in the whole campaign flow ───────────────
   Returns null unless there is a result to stand on. See the header: before
   evidence this is a pitch, and an advisor sold to before being helped
   discounts everything that follows.

   Described in ENGINE TERMS, never course terms. "Day 1 produces a Brand
   Profile the campaign engine reads directly" is concrete and checkable;
   "transform your marketing" is neither, and advisors have heard it.

   AND NO PADLOCK VOCABULARY. The first draft of this said Foundations "unlocks
   rebuilding" — which is the exact register the plan bans, written by the
   person who wrote the ban. "Unlock" frames the product as withholding
   something it is choosing not to give you; "graduates also rebuild their plan
   as often as they want" states the same fact without the hostage-taking. It
   was caught by a test looking for the word, which is why that test greps for
   vocabulary rather than for intent. */
function foundationsNote(report, advisor, profile) {
  if (!report || !report.anything) return null;

  /* Already trained, or already PAID and waiting to attend. In both cases the
     note would be selling somebody a thing they own. The paid case is new with
     021: an advisor can hold the entitlement for weeks before a date goes in
     foundations_at, and pitching Foundations to them the whole time would be
     the product failing to notice a purchase it processed itself. */
  if (advisor && (advisor.foundations_paid_at ||
      advisor.foundations_at || advisor.immersion_at)) return null;

  const hasBrief = Boolean(profile && profile.brief_parsed &&
    Object.keys(profile.brief_parsed).length);

  return {
    heading: 'What would make the next month better',
    body: hasBrief
      ? 'You have given this campaign your own clients and proof, and it shows in the copy. ' +
        'Foundations Day 1 produces a Brand Profile the campaign engine reads directly — the ' +
        'same idea, one level deeper. Graduates also build campaigns without limit.'
      : 'This month was built from five answers and the Saint Lucia fact bank. The campaign ' +
        'reads a Brand Profile directly when there is one, and Foundations Day 1 is where that ' +
        'gets built. Graduates also build campaigns without limit.',
    /* The short page rather than the long one. /advisors/foundations is written
       for somebody who has never met any of this; the reader here has a month
       of their own results in front of them and one question — what would be
       different. /hub/campaign/more answers that in three screens and knows
       who is asking. */
    href: '/hub/campaign/more'
  };
}

module.exports = { weekNumber, windowFor, forWeek, forPlan, foundationsNote, sentence };
