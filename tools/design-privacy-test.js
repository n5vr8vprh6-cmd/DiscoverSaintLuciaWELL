/* ============================================================================
   design-privacy-test.js — does any consumer value reach the model?
   ----------------------------------------------------------------------------
     node tools/design-privacy-test.js

   Runs entirely stubbed. No key, no network, no token, no database. What it
   inspects is the COMPOSED PAYLOAD — the exact object openai.js would have
   sent — which is why openai.js returns `payload` on every path including the
   stub one. A safety property nobody can afford to check is a safety property
   nobody checks.

   ── WHY IT DOES NOT ASSERT ON FIELD NAMES ──────────────────────────────────
   Asserting that the projection has no `context` key is necessary and nowhere
   near sufficient. It passes cleanly the day somebody pipes `context` into a
   field called `background`, or `notes`, or `detail` — and that is not a
   hypothetical failure mode, it is the ordinary way a helpful refactor breaks
   a privacy boundary. A name check tests the name.

   So every field of the fixture carries a distinctive SENTINEL VALUE, and the
   test sweeps the whole serialised payload for every sentinel. It does not
   matter what the field ends up called or how many hops it takes: if the
   string arrives, it is found.

   ── THE FIXTURE IS DELIBERATELY HOSTILE ────────────────────────────────────
   The poisoned share is not just passed alongside the need-state. It is passed
   AS the need-state, AS the advisor, and AS the extra parameters — every slot
   the projection accepts, at once. That is the test of copy-named-fields: a
   projection that copies named fields is unmoved by being handed the wrong
   object, and a projection that filters or spreads is not. If someone replaces
   travellerFor()'s field list with Object.assign, this file fails loudly and
   immediately rather than at some later point in production.

   ── THERE ARE TWO BOUNDARIES, AND THIS SHOWS BOTH ──────────────────────────
   Verified by breaking the projection on purpose and watching which checks go
   red. Replacing travellerFor()'s field list with Object.assign, or adding a
   `background: n.context` line to it, fails the projection sweeps immediately
   — while the two "hostile input" PROMPT sweeps stay green.

   That is not a gap. travellerBlock() in design-generate.js also reads named
   fields, so a broken projection still does not compose a leaking prompt. The
   projection is the boundary that is tested; the prompt builder is the one that
   would have to fail at the same time for anything to actually go out. Worth
   knowing when reading a partial failure here: green prompt sweeps beside a red
   projection sweep mean the leak was caught one layer before it mattered, not
   that the prompts are fine.

   ── WHAT A FAILURE HERE MEANS ──────────────────────────────────────────────
   It means a traveller's own words are on their way to a third-party model.
   They consented to an introduction to an advisor. This is not that.
   ========================================================================== */
'use strict';

process.env.OPENAI_STUB = '1';
delete process.env.OPENAI_API_KEY;

const G = require('../api/_lib/design-generate.js');
const P = require('../api/_lib/design-need.js');
const N = require('../api/_lib/need-state.js');

/* ── The sentinels ─────────────────────────────────────────────────────────
   Every value is a nonsense string that cannot occur in Saint Lucia copy by
   accident, so a hit is always a leak and never a coincidence. The keys are
   every column of journey_shares plus the consultation's own, so adding a
   column to either table and forgetting this file shows up as an untested
   field rather than as a silent pass. */
const SENTINELS = {
  id: 'ZZSENTINEL-share-uuid',
  advisor_id: 'ZZSENTINEL-advisor-uuid',
  consumer_first: 'ZZSENTINELFirstname',
  consumer_last: 'ZZSENTINELLastname',
  consumer_email: 'zzsentinel@example.invalid',
  consumer_phone: 'ZZSENTINEL-555-0100',
  timing: 'ZZSENTINEL sometime in the spring if the surgery goes well',
  context: 'ZZSENTINEL my marriage is ending and I need to be somewhere quiet',
  consent_text: 'ZZSENTINEL consent wording',
  source: 'ZZSENTINEL-utm-source',
  session_id: 'ZZSENTINEL-session',
  ip_hash: 'ZZSENTINEL-iphash',
  sweepstakes_id: 'ZZSENTINEL-draw',
  travel_window: 'ZZSENTINEL-window',
  stage: 'ZZSENTINEL-stage',
  advisor_notes: 'ZZSENTINEL she cried on the first call',
  declined_reason: 'ZZSENTINEL too expensive for them',
  share_token_hash: 'ZZSENTINEL-token-hash',
  /* The advisor's own private fields. Their name and business are theirs to
     give and are expected in the payload; these are not. */
  email: 'zzsentinel-advisor@example.invalid',
  phone: 'ZZSENTINEL-advisor-phone',
  /* SHORT ON PURPOSE. Every sentinel above is longer than the 40 characters
     the projection used to truncate at, so any of them could pass this sweep by
     being SHORTENED rather than dropped — a weaker property wearing the same
     green tick. This one fits well inside any truncation, so the only way it
     stays out of the payload is if the value was rejected outright. */
  short: 'ZZQ7'
};

/* Values the payload SHOULD contain. Listed explicitly so that a projection
   which leaks nothing because it produces nothing cannot pass: an empty prompt
   is not a privacy win, it is a broken feature that happens to be quiet. */
const EXPECTED = ['Marguerite', 'Okonkwo Travel', 'Anse Chastanet'];

let failures = 0;
let checks = 0;

function sweep(label, payload) {
  const hay = JSON.stringify(payload);
  const hits = Object.keys(SENTINELS).filter((k) => hay.indexOf(SENTINELS[k]) !== -1);
  checks++;
  if (hits.length) {
    failures++;
    console.log('    x ' + label);
    hits.forEach((k) => {
      console.log('        LEAKED ' + k + ' = ' + JSON.stringify(SENTINELS[k]));
    });
  } else {
    console.log('    ok ' + label + '  (' + hay.length + ' chars swept)');
  }
  return hits.length === 0;
}

function expect(label, payload) {
  const hay = JSON.stringify(payload);
  const missing = EXPECTED.filter((v) => hay.indexOf(v) === -1);
  checks++;
  if (missing.length) {
    failures++;
    console.log('    x ' + label + ' — payload is missing ' + missing.join(', '));
    console.log('        An empty prompt leaks nothing and is not a pass.');
  } else {
    console.log('    ok ' + label);
  }
}

(async () => {
  console.log('\n  ASK WELL — PRIVACY SWEEP');
  console.log('  ' + '─'.repeat(64));
  console.log('  ' + Object.keys(SENTINELS).length + ' sentinel values, stubbed, no network.\n');

  /* The poisoned share, with every field set. */
  const share = {};
  Object.keys(SENTINELS).forEach((k) => { share[k] = SENTINELS[k]; });
  share.answers = {
    intention: 'reflect', companions: 'family', pace: 'gentle', recognition: 'yes',
    /* A sentinel INSIDE the answers blob. answers is a jsonb column an advisor
       never types into, but the Finder could grow a free-text question and the
       need-state seeder reads this object by key. */
    context: SENTINELS.context
  };
  share.villages = ['Nature & Renewal Village', SENTINELS.context];

  /* The advisor: two fields that belong in the payload, and two that do not,
     on the same object. */
  const advisor = {
    first_name: 'Marguerite', last_name: 'Okonkwo',
    business: 'Okonkwo Travel', host_agency: 'Wren Collective',
    id: SENTINELS.advisor_id, email: SENTINELS.email, phone: SENTINELS.phone,
    notes: SENTINELS.advisor_notes
  };

  const need = await N.seedFrom(share.answers);
  const slugs = ['anse-chastanet', 'ladera-resort'];
  const base = { need, advisor, slugs, recipeKey: 'longevity-renewal', rung: 'registered' };

  /* ── 1. The projection itself ─────────────────────────────────────────── */
  console.log('  The projection');
  sweep('project() over a poisoned share', await P.project(base));
  expect('project() still carries what it should', await P.project(base));

  /* ── 2. Both prompts, composed ────────────────────────────────────────── */
  console.log('\n  The composed payloads');
  const day = { key: 'day1', label: 'Day 1', text: 'Arrive and restore' };
  const note = await G.generateDayNote(Object.assign({ day }, base));
  const narr = await G.generateNarrative(base);

  sweep('day_note payload', note.payload);
  sweep('narrative payload', narr.payload);
  expect('day_note payload carries the real context', note.payload);
  expect('narrative payload carries the real context', narr.payload);

  /* ── 3. The hostile case ──────────────────────────────────────────────── */
  console.log('\n  Handed the wrong object in every slot');
  console.log('  (copy-named-fields is unmoved by this; a filter or a spread is not)');

  const hostile = {
    /* The whole share, where a need-state belongs. */
    need: Object.assign({}, share, need),
    /* The whole share, where an advisor belongs. */
    advisor: Object.assign({}, share, advisor),
    slugs: slugs.concat([SENTINELS.context, SENTINELS.consumer_first]),
    recipeKey: SENTINELS.context,
    rung: 'registered'
  };

  sweep('project() with the share in every slot', await P.project(hostile));
  sweep('day_note, hostile input',
    (await G.generateDayNote(Object.assign({ day }, hostile))).payload);
  sweep('narrative, hostile input',
    (await G.generateNarrative(hostile)).payload);

  /* ── 4. The nested case ───────────────────────────────────────────────── */
  console.log('\n  Sentinels nested inside the values the projection does copy');
  const nested = Object.assign({}, base, {
    need: Object.assign({}, need, {
      /* A weight bag whose KEY is a sentinel. weights() slices keys to 40
         characters, which truncates but does not remove — so this asserts the
         key is dropped for being unknown, not merely shortened. */
      villages: Object.assign({}, need.villages, { [SENTINELS.context]: 1, [SENTINELS.short]: 1 }),
      constraints: [SENTINELS.advisor_notes],
      party: SENTINELS.short,
      budget: SENTINELS.short,
      trigger: SENTINELS.short,
      orientation: SENTINELS.short,
      /* Mobility has no vocabulary list, so it is checked by SHAPE. A code-shaped
         string is the case that must still be caught by a real list one day; a
         prose string is the case the shape check exists to stop today. */
      mobility: SENTINELS.advisor_notes
    })
  });
  const nestedOut = await P.project(nested);
  sweep('project() with sentinels as weight keys and codes', nestedOut);

  /* ── The verdict ──────────────────────────────────────────────────────── */
  console.log('\n  ' + '─'.repeat(64));
  if (failures) {
    console.log('  ' + failures + ' of ' + checks + ' checks FAILED.');
    console.log('  A traveller\'s own words are on their way to a third-party model.');
    console.log('  They consented to an introduction to an advisor. This is not that.\n');
    process.exit(1);
  }
  console.log('  All ' + checks + ' checks passed. No consumer value reaches either prompt,');
  console.log('  including when the share is handed in as every parameter at once.\n');
})().catch((e) => {
  console.error('\n  design-privacy-test threw: ' + (e && e.message) + '\n');
  process.exit(1);
});
