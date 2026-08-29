/* ============================================================================
   design-match-test.js — the shortlist, and the two bugs coverage caught
   ----------------------------------------------------------------------------
     node tools/design-match-test.js

   THE REGRESSIONS ARE THE POINT. Two scoring bugs shipped in this file's first
   hour, both invisible in any single result and both found only by running all
   270 need-states. They are pinned here so they cannot come back quietly:

     BREADTH BEAT FIT. Summing the need's weight over a property's tags rewarded
     properties tagged with more villages. All seventeen single-village
     properties were unreachable — including TheLifeCo, the island's only true
     Longevity anchor.

     CAPABILITY WAS PENALISED. Cosine on the Compass axis punished a property
     for declaring five directions instead of four, which made Balenbouche and
     Green Fig unreachable for the exact brief they answer best.

   The distinction the fix rests on: villages are POSITIONING, so breadth means
   less distinctly any of them. Compass and Pillars are CAPABILITY, so breadth
   means more capable. One axis penalises it, the others do not.

   Everything else here defends a claim the module makes about itself: no
   composite score, no number on screen, mismatch derived from the same
   arithmetic as fit, and never a clean bill of health.
   ========================================================================== */
'use strict';

const M = require('../api/_lib/design-match.js');
const N = require('../api/_lib/need-state.js');
const K = require('../api/_lib/well-knowledge.js');

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };

console.log('\n  DESIGN MATCH\n  ' + '─'.repeat(60) + '\n');

(async () => {
  const prop = (s) => K.property(s);

  /* ══ Regression: breadth must not beat fit ═══════════════════════════════ */
  console.log('  Breadth must not beat fit');

  /* A need that names exactly one village. The specialist should win it. */
  const longevity = { villages: { longevity: 1 }, compass: { restore: 1 }, pillars: {},
                      continuumFloor: null, continuumCeiling: null, constraints: [] };
  const lifeco = await M.scoreProperty(longevity, await prop('thelifeco-st-lucia'));
  const anse = await M.scoreProperty(longevity, await prop('anse-chastanet'));

  ok('a single-village specialist beats a four-village generalist on place',
    lifeco.detail.place.raw > anse.detail.place.raw,
    'TheLifeCo ' + lifeco.detail.place.raw.toFixed(3) + ' vs Anse ' + anse.detail.place.raw.toFixed(3));
  ok('and its place band is strong', lifeco.bands.place === 'strong');
  ok('while the generalist that does not carry Longevity is absent',
    anse.bands.place === 'absent');

  const short = await M.shortlistFor(longevity);
  ok('so the only true Longevity anchor actually surfaces',
    short.some((s) => s.slug === 'thelifeco-st-lucia'),
    'this was unreachable in all 270 need-states before the cosine fix');

  /* ══ Regression: capability must not be penalised ═════════════════════════ */
  console.log('\n  Capability must not be penalised');
  const reflect = { villages: { rainforest: 1 }, compass: { reflect: 1 }, pillars: {},
                    continuumFloor: null, continuumCeiling: null, constraints: [] };
  const balen = await M.scoreProperty(reflect, await prop('balenbouche-estate'));
  const sol = await M.scoreProperty(reflect, await prop('sol-sanctum-wellness-hotel-studio'));

  ok('five Compass directions score the same as four, given the same match',
    Math.abs(balen.detail.direction.raw - sol.detail.direction.raw) < 1e-9,
    'Balenbouche carries 5, Sol Sanctum 4; both answer Reflect');
  ok('both are strong on direction', balen.bands.direction === 'strong' && sol.bands.direction === 'strong');

  /* ══ No composite, no number ═════════════════════════════════════════════ */
  console.log('\n  There is no score');
  ok('four bands are reported, and they are words',
    ['place', 'direction', 'depth', 'ingredients'].every((k) =>
      typeof lifeco.bands[k] === 'string' &&
      ['strong', 'partial', 'thin', 'absent', 'unknown'].indexOf(lifeco.bands[k]) !== -1));
  ok('there is no total, score or percentage anywhere on the result',
    !['score', 'total', 'percent', 'rating', 'match'].some((k) => k in lifeco));
  ok('raw values live under detail, not beside the bands',
    lifeco.detail.place.raw !== undefined && lifeco.place === undefined);

  /* ══ Unknown is not a low band ═══════════════════════════════════════════ */
  console.log('\n  Unknown is not the same as absent');
  const aila = await M.scoreProperty(longevity, await prop('aila-resorts-villas-residences'));
  ok('a property with no depth band reports depth unknown', aila.bands.depth === 'unknown');
  ok('and ingredients is unknown when no pillars were asked for',
    aila.bands.ingredients === 'unknown',
    'a need seeded from six answers carries no pillar weights');

  const withPillars = Object.assign({}, longevity, { pillars: { recovery: 1 } });
  const scored = await M.scoreProperty(withPillars, await prop('thelifeco-st-lucia'));
  ok('and becomes a real band once the advisor sets one',
    scored.bands.ingredients !== 'unknown');

  /* ══ Depth arithmetic ════════════════════════════════════════════════════ */
  console.log('\n  Depth');
  const deepNeed = { villages: {}, compass: {}, pillars: {},
                     continuumFloor: 'recover', continuumCeiling: 'transform', constraints: [] };
  const capMaison = await M.scoreProperty(deepNeed, await prop('cap-maison'));
  ok('a property that cannot reach the asked-for depth scores zero there',
    capMaison.detail.depth.raw === 0, 'Cap Maison tops out at Reconnect');
  const lifecoDeep = await M.scoreProperty(deepNeed, await prop('thelifeco-st-lucia'));
  ok('one that covers it scores full', lifecoDeep.detail.depth.raw === 1);

  /* ══ Mismatch ════════════════════════════════════════════════════════════ */
  console.log('\n  Mismatch comes from the same arithmetic as fit');
  const mm = await M.mismatchesFor(deepNeed, await prop('cap-maison'), capMaison);
  ok('a depth gap is named, with both rungs in the sentence',
    mm.some((x) => x.rule === 'depth_gap' && /Recover/i.test(x.sentence) && /Reconnect/i.test(x.sentence)));

  const moveNeed = { villages: { ocean: 1 }, compass: { move: 1 }, pillars: {},
                     continuumFloor: null, continuumCeiling: null, constraints: [] };
  const calabash = await prop('calabash-cove');
  const cScore = await M.scoreProperty(moveNeed, calabash);
  const cMm = await M.mismatchesFor(moveNeed, calabash, cScore);
  ok('a direction they led with and the property lacks is named',
    cMm.some((x) => x.rule === 'unanswered_compass' && /Move/.test(x.sentence)));
  ok('and it comes from the same overlap that produced the fit',
    cScore.detail.direction.unmatched.indexOf('move') !== -1,
    'upside and downside can never disagree if they read one number');

  ok('a property with no dependable tariff says so',
    cMm.some((x) => x.rule === 'quote_confirm'),
    'Calabash Cove had no public Ti Spa menu at the cutoff');

  /* ══ Never a clean bill of health ════════════════════════════════════════ */
  console.log('\n  Silence is never reported as safety');
  const list = await M.shortlistFor(longevity);
  ok('every candidate carries at least one line under mismatch',
    list.every((c) => c.mismatches.length > 0));
  ok('and where no rule fired it says so, and quotes the watch note',
    list.every((c) => c.mismatches[0].rule !== 'none_fired' ||
      /not a clean bill of health/i.test(c.mismatches[0].sentence)));
  ok('every candidate carries its verification date',
    list.every((c) => Boolean(c.verified_at)));

  /* ══ Ties ════════════════════════════════════════════════════════════════ */
  console.log('\n  Ties are carried, not cut');
  const rainforest = await N.seedFrom({ intention: 'reflect', place: 'rainforest', orientation: 'led', pace: 'still' });
  const tied = await M.shortlistFor(rainforest);
  ok('a tie at the boundary extends the cut rather than dropping a candidate',
    tied.length >= M.SHORTLIST);
  ok('and the shortlist says it is a tied group',
    tied.length === M.SHORTLIST || tied.every((c) => c.tiedGroup === true),
    'the brief does not yet separate these, which is worth saying out loud');
  ok('the cut is capped so a pathological tie cannot return the island',
    tied.length <= 10);

  /* ══ What is never scored ════════════════════════════════════════════════ */
  console.log('\n  What is never scored');
  const all = await K.properties();
  ok('only the thirty scorable properties are ranked', all.length === 30);
  ok('supporting and basecamp inventory never appears in a shortlist',
    list.every((c) => all.some((p) => p.slug === c.slug)),
    'one village and one line of signal is not a vector');

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
