/* ============================================================================
   CAPACITY — how big a plan this advisor will actually finish
   ----------------------------------------------------------------------------
   The Strategist Bible's sharpest critique of what we built:

     "The system should not promise a fixed count such as '30 social posts'
      because that creates asset volume as the objective."

   We generated roughly eight assets for everybody, whether they had an hour a
   week or a team. An advisor who abandons a plan in week two is worse off than
   one who finishes a smaller plan, and they blame themselves rather than the
   plan — so the size is a design decision, not a constant.

   ── CAPACITY IS NOT AUDIENCE SIZE ─────────────────────────────────────────
   The Bible is explicit and it is the thing practitioners get wrong most
   often: "A large audience does not imply production capacity, and a small
   audience does not imply low commercial potential." Capacity here means time,
   workflow, comfort, review speed and whether anybody helps — which is why the
   question asks what an advisor can sustain in a normal week rather than how
   many followers they have.

   ── WHY THE CEILING IS ENFORCED, NOT REQUESTED ────────────────────────────
   The prompt states the target and normaliseSkeleton trims to it. A prompt
   alone would be a suggestion: across this release the model has repeatedly
   returned six weeks when asked for four and nine actions when told four, and
   the whole point of the class is that the plan is finishable.
   ========================================================================== */
'use strict';

const PLAYBOOK = require('../../content/marketing-playbook.js');

/* Actions per week, and the total that follows. The shapes come from Section 8
   §5; the numbers are what those shapes mean once a week has four slots.

   `sourceAssets` is how many original pieces the advisor must actually make.
   It is the number that governs real effort — derivatives are cheap and source
   material is not — and it is why C1 is one rather than "a few small ones". */
const SEED_CLASSES = {
  C1: {
    key: 'C1',
    name: 'Essential',
    reality: 'Very limited capacity, or an inconsistent marketing habit.',
    perWeek: 2,
    total: 6,
    sourceAssets: 1,
    shape: 'One real piece of thinking, two or three small follow-ups, one conversion path, personal follow-up.',
    rule: 'Protect completion above everything. No optional channel unless it REPLACES work rather than adding it.'
  },
  C2: {
    key: 'C2',
    name: 'Standard',
    reality: 'A few hours a week, basic social and email execution.',
    perWeek: 3,
    total: 10,
    sourceAssets: 2,
    shape: 'One or two source assets, six to ten native pieces, a short email sequence, a clear next step.',
    rule: 'The default for most independent advisors. Prefer depth on two channels over presence on four.'
  },
  C3: {
    key: 'C3',
    name: 'Expanded',
    reality: 'A real marketing rhythm already, or some support.',
    perWeek: 4,
    total: 14,
    sourceAssets: 3,
    shape: 'Multiple source assets, deeper email and newsletter, a live or partner component, room to test something.',
    rule: 'Add variety only where a job and the production capacity both justify it.'
  },
  C4: {
    key: 'C4',
    name: 'Activation',
    reality: 'Event-led, community-led or team-supported.',
    perWeek: 4,
    total: 16,
    sourceAssets: 4,
    shape: 'An event arc — invitation, run-up, the event itself, capture, and post-event nurture — with partners and outreach around it.',
    rule: 'An operational calendar and an owner for each piece are mandatory, or the event eats the campaign.'
  }
};

/* ── The research wins, per class ──────────────────────────────────────────
   These four came out of the Bible (Section 8 §5) and used to live only here,
   which made the one taxonomy Duncan is most likely to want to tune the one
   taxonomy only a code change could reach. They now live in the marketing
   field guide and arrive through the generated bank.

   MERGED PER CLASS, NOT WHOLESALE. A guide that revises C2's numbers and says
   nothing about C4 upgrades C2 and leaves C4 alone — the same rule the channel
   merge follows, and the reason a partial edit cannot silently blank a class.

   The KEYS stay here, and stay structural. C1-C4 is a CHECK constraint in
   migration 014, and 014 is right that they are not editorial: a class key is
   a value already written into advisor rows. Research may retune what a class
   MEANS; it may not invent a C5. */
const CLASSES = Object.keys(SEED_CLASSES).reduce((out, k) => {
  const researched = (PLAYBOOK.capacityClasses || {})[k];
  out[k] = researched ? Object.assign({}, SEED_CLASSES[k], researched) : SEED_CLASSES[k];
  return out;
}, {});

/* DEFAULTS TO C2, not to the largest. An advisor who never answered the
   capacity question gets the shape most independent advisors can sustain —
   guessing high produces a plan they abandon, and abandonment is the failure
   this whole file exists to prevent. */
const DEFAULT = 'C2';

function classFor(profile) {
  const key = profile && profile.capacity_class;
  return CLASSES[key] || CLASSES[DEFAULT];
}

/* The block the skeleton prompt carries. States the ceiling as a ceiling —
   "never more than" — because "aim for" has been read as a floor all release. */
function capacityBlock(profile) {
  const c = classFor(profile);
  return `WHAT THIS ADVISOR CAN ACTUALLY SUSTAIN — ${c.name}
${c.reality}

SIZE THE PLAN TO THIS. Never more than ${c.perWeek} actions in a week, and
around ${c.total} across the month. Roughly ${c.sourceAssets} of them should be
original pieces they have to make from nothing; the rest should reuse or adapt
those.

The shape that fits: ${c.shape}
${c.rule}

A plan they abandon in week two is worse than a smaller one they finish, and
they will blame themselves rather than the plan. Fewer, better, done.`;
}

/* Trim a skeleton to the class. The prompt asks; this enforces — the model has
   returned six weeks when asked for four and nine actions when told four, more
   than once in this release.

   ── IT SPREADS, IT DOES NOT FILL AND TRUNCATE ─────────────────────────────
   The obvious implementation takes actions in order until the total runs out.
   That gave a C1 advisor a THREE-week plan: six actions at two a week is
   exhausted by week three, and week four disappeared entirely. A thirty-day
   plan that stops on day twenty-one is not a small plan, it is a broken one.

   So the budget is divided across the weeks first, with the remainder going to
   the earlier weeks — a campaign wants its momentum at the front, and the last
   week of any month is the one most likely to be interrupted anyway.

   Trims from the END of each week, because a model front-loads the actions it
   thinks matter most and the tail is where the filler collects. Never pads: a
   plan that came back smaller than the ceiling stays that size, because the
   ceiling is a limit and not a quota. */
function enforce(skeleton, profile) {
  if (!skeleton || !Array.isArray(skeleton.weeks) || !skeleton.weeks.length) return skeleton;
  const c = classFor(profile);

  /* Never more weeks than the month has. */
  const source = skeleton.weeks.slice(0, 4);
  const n = source.length;

  const base = Math.floor(c.total / n);
  const extra = c.total % n;

  const weeks = source.map((w, i) => {
    const allowance = Math.min(c.perWeek, base + (i < extra ? 1 : 0));
    return Object.assign({}, w, {
      week: i + 1,
      actions: (w.actions || []).slice(0, allowance)
    });
  }).filter((w) => w.actions.length);

  return Object.assign({}, skeleton, { weeks, capacity: c.key });
}

/* What the plan screen says about its own size, so an advisor can tell the
   difference between "this is small" and "this is small ON PURPOSE". */
function describe(profile) {
  const c = classFor(profile);
  return {
    key: c.key,
    name: c.name,
    line: `Sized for ${c.name.toLowerCase()} capacity — about ${c.total} actions across the month, ` +
      `${c.perWeek} in a week at most.`,
    why: 'You told us what you can sustain in a normal week. A plan you finish beats a longer one you do not.'
  };
}

module.exports = { CLASSES, DEFAULT, classFor, capacityBlock, enforce, describe };
