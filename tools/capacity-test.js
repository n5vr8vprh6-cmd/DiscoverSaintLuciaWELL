/* ============================================================================
   capacity-test.js — plan size, and the card fields worth having
   ----------------------------------------------------------------------------
     node tools/capacity-test.js

   TWO THINGS, BOTH OF WHICH FAIL QUIETLY.

   CAPACITY. The Bible's critique of what we built: "the system should not
   promise a fixed count such as '30 social posts' because that creates asset
   volume as the objective." A plan an advisor abandons in week two is worse
   than a smaller one they finish, and they blame themselves rather than the
   plan. The ceiling is enforced rather than requested, because across this
   release the model has returned six weeks when told four and nine actions when
   told four.

   THE ASSET CARD TAIL. The copy has to survive a malformed tail. Asking for
   JSON would put publishable text behind a parse that can fail; a trailing
   block cannot take the copy down with it — but only if the split is written
   to fail that way, which is what these assert.
   ========================================================================== */
'use strict';

process.env.OPENAI_STUB = '1';

const C = require('../api/_lib/capacity.js');
const G = require('../api/_lib/gtm-generate.js');

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };

const KEYS = ['C1', 'C2', 'C3', 'C4'];
const fat = { weeks: [1, 2, 3, 4, 5, 6].map((n) => ({
  week: n, theme: 'T', actions: [1, 2, 3, 4, 5].map((i) => ({ title: 'a' + i })) })) };
const total = (s) => s.weeks.reduce((n, w) => n + w.actions.length, 0);

console.log('\n  CAPACITY AND THE ASSET CARD\n  ' + '─'.repeat(60) + '\n');

/* ══ The classes ═════════════════════════════════════════════════════════ */
console.log('  The four classes');
ok('all four exist', KEYS.every((k) => C.CLASSES[k]));

/* ── Where the numbers come from ─────────────────────────────────────────
   C1-C4 used to be hardcoded here and nowhere else. They now come from the
   marketing field guide through the generated bank, with this file's own copy
   as the fallback. Both halves need proving: that the research is actually
   read, and that a guide which says nothing about a class does not blank it. */
const PLAYBOOK = require('../content/marketing-playbook.js');
ok('the bank carries the four classes',
  KEYS.every((k) => PLAYBOOK.capacityClasses && PLAYBOOK.capacityClasses[k]),
  'if this fails the merge is silently falling back for every class');
ok('and the live numbers match the researched ones',
  KEYS.every((k) => C.CLASSES[k].total === PLAYBOOK.capacityClasses[k].total &&
                    C.CLASSES[k].perWeek === PLAYBOOK.capacityClasses[k].perWeek));
ok('every class still carries a key, so nothing invented a C5',
  Object.keys(C.CLASSES).join(',') === 'C1,C2,C3,C4',
  'the keys are a CHECK constraint in migration 014 — research may retune a class, not add one');
ok('each says what reality it describes',
  KEYS.every((k) => C.CLASSES[k].reality && C.CLASSES[k].shape && C.CLASSES[k].rule));
ok('they increase in size', KEYS.every((k, i) =>
  i === 0 || C.CLASSES[k].total >= C.CLASSES[KEYS[i - 1]].total));
ok('and in source assets, which is the real effort',
  KEYS.every((k, i) => i === 0 || C.CLASSES[k].sourceAssets >= C.CLASSES[KEYS[i - 1]].sourceAssets),
  'derivatives are cheap; original pieces are not');

console.log('\n  Choosing one');
ok('an answered class is used', C.classFor({ capacity_class: 'C1' }).key === 'C1');
ok('an UNANSWERED advisor gets C2, not the largest',
  C.classFor({}).key === 'C2',
  'guessing high produces a plan they abandon, which is the failure this file exists to prevent');
ok('an invalid class falls back rather than throwing',
  C.classFor({ capacity_class: 'C9' }).key === 'C2');
ok('a null profile is survivable', C.classFor(null).key === 'C2');

/* ══ Stated as a ceiling ═════════════════════════════════════════════════ */
console.log('\n  What the prompt is told');
KEYS.forEach((k) => {
  const block = C.capacityBlock({ capacity_class: k });
  const m = block.match(/Never more than (\d+) actions in a week, and\s+around (\d+)/);
  ok(`${k} states its ceiling`, Boolean(m) &&
    Number(m[1]) === C.CLASSES[k].perWeek && Number(m[2]) === C.CLASSES[k].total,
    m ? m[0] : 'no ceiling stated');
});
ok('it is phrased as a limit, not a target',
  /Never more than/.test(C.capacityBlock({})),
  '"aim for" has been read as a floor all release');
ok('and says why a smaller plan is better',
  /abandon in week two/.test(C.capacityBlock({})));

/* ══ ENFORCED, not requested ═════════════════════════════════════════════ */
console.log('\n  The ceiling is enforced');
KEYS.forEach((k) => {
  const e = C.enforce(fat, { capacity_class: k });
  ok(`${k} trims 30 actions to ${C.CLASSES[k].total}`, total(e) === C.CLASSES[k].total,
    total(e) + ' — ' + e.weeks.map((w) => w.actions.length).join('+'));
});
ok('no week ever exceeds its per-week cap',
  KEYS.every((k) => C.enforce(fat, { capacity_class: k }).weeks
    .every((w) => w.actions.length <= C.CLASSES[k].perWeek)));

/* THE BUG THIS CAUGHT. Filling weeks in order until the budget ran out gave a
   C1 advisor a THREE-week plan — six actions at two a week is exhausted by
   week three and week four vanished. A thirty-day plan that stops on day
   twenty-one is not a small plan, it is a broken one. */
console.log('\n  Every class still gets a whole month');
KEYS.forEach((k) => {
  ok(`${k} keeps all four weeks`, C.enforce(fat, { capacity_class: k }).weeks.length === 4,
    C.enforce(fat, { capacity_class: k }).weeks.map((w) => w.actions.length).join('+'));
});
ok('the budget is front-loaded, not back-loaded',
  (() => { const w = C.enforce(fat, { capacity_class: 'C1' }).weeks.map((x) => x.actions.length);
    return w[0] >= w[w.length - 1]; })(),
  'a campaign wants its momentum at the front, and the last week gets interrupted');
ok('weeks are renumbered from one',
  C.enforce(fat, { capacity_class: 'C1' }).weeks.every((w, i) => w.week === i + 1),
  'a plan starting at week 3 after trimming would be nonsense');

console.log('\n  It trims, it never pads');
const small = { weeks: [{ week: 1, actions: [{ title: 'a' }] }, { week: 2, actions: [{ title: 'b' }] }] };
ok('a small plan is left small even at C4', total(C.enforce(small, { capacity_class: 'C4' })) === 2,
  'the ceiling is a limit, not a quota');
ok('an empty plan survives', C.enforce({ weeks: [] }, {}).weeks.length === 0);
ok('null survives', C.enforce(null, {}) === null);
ok('the class is recorded on the result', C.enforce(fat, { capacity_class: 'C3' }).capacity === 'C3');

console.log('\n  What the advisor is told about the size');
const d = C.describe({ capacity_class: 'C1' });
ok('it names the size', /about 6 actions/.test(d.line), d.line);
ok('and says it is deliberate', /finish/.test(d.why),
  'an advisor should be able to tell "this is small" from "this is small ON PURPOSE"');

/* ══ The asset card tail ═════════════════════════════════════════════════ */
console.log('\n  The copy survives whatever the tail does');
const tails = [
  ['a well-formed tail', 'Copy here. {{WELL_LINK}}\n\n---\nFALLBACK: send a text instead\nYOURS: add your own view',
    'Copy here. {{WELL_LINK}}', 'send a text instead', 'add your own view'],
  ['no tail at all', 'Copy here. {{WELL_LINK}}', 'Copy here. {{WELL_LINK}}', null, null],
  ['only one note', 'Copy here.\n---\nFALLBACK: smaller', 'Copy here.', 'smaller', null],
  ['notes reordered', 'Copy here.\n---\nYOURS: yours\nFALLBACK: smaller', 'Copy here.', 'smaller', 'yours'],
  ['five dashes', 'Copy here.\n-----\nFALLBACK: smaller', 'Copy here.', 'smaller', null],
  ['an em dash inside the copy', 'A—B copy.', 'A—B copy.', null, null],
  ['quoted copy', '"Wrapped."\n---\nFALLBACK: x', 'Wrapped.', 'x', null]
];
tails.forEach(([name, input, body, fb, yours]) => {
  const r = G.splitTail(input);
  ok(name + ' — copy intact', r.body === body, JSON.stringify(r.body));
  ok(name + ' — notes read correctly', r.fallback === fb && r.personalization === yours,
    JSON.stringify([r.fallback, r.personalization]));
});

/* ══ Derived, not generated ══════════════════════════════════════════════ */
(async () => {
  console.log('\n  Most of the card is derived, and costs nothing');
  const advisor = { first_name: 'M', public_code: 'X' };
  const profile = { instagram: '@x', expr_primary: 'curator',
    traveller_orientation: 'secondary-intentional' };
  const action = { week: 1, position: 0, title: 't', why: 'w',
    channel: 'instagram', assetKind: 'caption', pattern: 'Common mistake' };

  const r = await G.generateAsset(advisor, profile, 'registered', action, 'T', { critique: false });
  ok('job comes from the pattern the skeleton chose', r.card.job === 'risk',
    'the pattern already carries a job; generating one again would be paying twice to disagree');
  ok('audience state comes from the traveller orientation',
    /real holiday/.test(r.card.audienceState || ''));
  ok('the success signal comes from the channel', /non-follower reach/.test(r.card.successSignal || ''),
    'the channel knows what success looks like on it, and it is not likes');

  const cited = await G.generateAsset(advisor, profile, 'registered',
    Object.assign({}, action, { uses: 'PROOF 1' }), 'T', { critique: false });
  ok('a PROOF citation becomes the proof source', cited.card.proofSource === 'PROOF 1');
  ok('a CLIENTS citation does NOT', (await G.generateAsset(advisor, profile, 'registered',
    Object.assign({}, action, { uses: 'CLIENTS 1' }), 'T', { critique: false })).card.proofSource === null,
    'a client vignette is who it is for, not what proves it');

  ok('the prompt asks for the tail', /FALLBACK:/.test(JSON.stringify(r.payload)) &&
    /YOURS:/.test(JSON.stringify(r.payload)));
  ok('and tells it not to write the personalisation for them',
    /do not write it for them/i.test(JSON.stringify(r.payload)),
    'the one thing the generator can point at but never supply');

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
