/* ============================================================================
   need-state-test.js — one vocabulary, and the seam it closes
   ----------------------------------------------------------------------------
     node tools/need-state-test.js

   FOUR THINGS, AND THE FIRST IS THE REASON THE FILE EXISTS.

   THE TWO ORIENTATION SCALES RECONCILE. A traveller's Journey Finder answer is
   vacation / balance / led. An advisor's persona answer is primary /
   secondary-intentional / secondary-casual / sceptical. Same dimension, two
   scales. If these stop mapping, WELL Campaign silently loses the ability to
   target the need-states an advisor actually converts — and it loses it
   quietly, because both halves keep storing valid-looking values.

   SEEDING IS A MAPPING, NOT AN INFERENCE. Six answers cannot know why somebody
   is travelling now. `trigger` must come back null and stay null, because a
   guess an advisor has to notice and undo is worse than a blank they fill.

   RECOGNITION SCORES NOTHING. content/journey.js already draws this line and it
   is the one worth a test: answering "yes, some of this sounds familiar" must
   not add a gram of weight to Longevity. Nobody is told they are burned out by
   a website, and nobody is recommended a clinic because of it either.

   A NEED-STATE CARRIES NO PROSE. It is codes and numbers. The moment a free
   text field is allowed in, the projection that reaches a model stops being a
   column list and starts being a filter somebody has to maintain.
   ========================================================================== */
'use strict';

const N = require('../api/_lib/need-state.js');
const K = require('../api/_lib/well-knowledge.js');

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };

const FULL = { intention: 'restore', place: 'ocean', companions: 'partner',
               orientation: 'balance', pace: 'still', recognition: 'no' };

console.log('\n  NEED STATE — ONE VOCABULARY\n  ' + '─'.repeat(60) + '\n');

(async () => {
  /* ══ The vocabulary ══════════════════════════════════════════════════════ */
  console.log('  The vocabulary');
  const v = await N.vocabulary();
  ok('every dimension is populated',
    ['current', 'desired', 'trigger', 'uncertainty', 'readiness', 'party', 'constraints', 'scales']
      .every((d) => v[d].length > 0),
    'run node tools/build-marketing-playbook.js');
  ok('the planning vectors come from the destination bank, not a second copy',
    v.compass.length === 8 && v.continuum.length === 6 && v.pillars.length === 8 && v.villages.length === 6);
  ok('villages are keyed to this site', v.villages.some((x) => x.key === 'rainforest'));
  ok('every option is a key and a label, never prose',
    Object.keys(v).every((d) => v[d].every((o) => o.key !== undefined || o.low !== undefined)));

  /* ══ The two scales ══════════════════════════════════════════════════════ */
  console.log('\n  The two orientation scales');
  ok('the Finder\'s "led" is the advisor\'s "primary"', N.orientationKey('led') === 'primary');
  ok('"balance" is "secondary-intentional"', N.orientationKey('balance') === 'secondary-intentional');
  ok('"vacation" is "secondary-casual"', N.orientationKey('vacation') === 'secondary-casual');
  ok('an advisor-scale value passes through unchanged', N.orientationKey('sceptical') === 'sceptical');
  ok('and a value from neither scale is null, not a guess', N.orientationKey('curious') === null);
  ok('every Finder answer maps to a real advisor key',
    Object.values(N.FINDER_ORIENTATION).every((k) => v.orientation.some((o) => o.key === k)),
    'a mapping to a key the bank does not define is worse than no mapping');
  ok('sceptical is deliberately unreachable from the Finder',
    Object.values(N.FINDER_ORIENTATION).indexOf('sceptical') === -1,
    'somebody who would never call it wellness does not finish a wellness quiz');

  /* ══ Seeding ═════════════════════════════════════════════════════════════ */
  console.log('\n  Seeding from six answers');
  const s = await N.seedFrom(FULL);
  ok('it validates', (await N.validate(s)).length === 0, JSON.stringify(await N.validate(s)));
  ok('village weights arrive, normalised into 0-1',
    Object.keys(s.villages).length > 0 &&
    Object.values(s.villages).every((w) => w > 0 && w <= 1));
  ok('the intention becomes a Compass direction', s.compass.restore === 1);
  ok('and a current AND desired state', Object.keys(s.current).length > 0 && Object.keys(s.desired).length > 0);
  ok('pace sets a depth band', s.continuumFloor === 'relax' && s.continuumCeiling === 'restore');
  ok('companions set the party and the social scale', s.party === 'partner' && s.social < 0.5);
  ok('orientation is stored on the advisor scale', s.orientation === 'secondary-intentional');

  ok('TRIGGER COMES BACK NULL', s.trigger === null,
    'six answers cannot know why somebody is travelling now');
  ok('so do uncertainty and readiness', s.uncertainty === null && s.readiness === null);
  ok('and every hard constraint', s.constraints.length === 0 && s.nights === null && s.budget === null);

  const empty = await N.seedFrom({});
  ok('no answers seeds an empty state rather than a default person',
    Object.keys(empty.villages).length === 0 && empty.party === null && empty.orientation === null);
  ok('and it still validates', (await N.validate(empty)).length === 0);

  /* ══ Recognition ═════════════════════════════════════════════════════════ */
  console.log('\n  What recognition does, and does not, do');
  const noR = await N.seedFrom(Object.assign({}, FULL, { recognition: 'no' }));
  const yesR = await N.seedFrom(Object.assign({}, FULL, { recognition: 'yes' }));
  ok('answering yes changes NOTHING in the need-state',
    JSON.stringify(noR) === JSON.stringify(yesR),
    'it gates Eclipse and nothing else');
  ok('and adds no Longevity weight in particular',
    (yesR.villages.longevity || 0) === (noR.villages.longevity || 0));

  /* ══ Question identity ═══════════════════════════════════════════════════ */
  console.log('\n  Keyed on identity, not position');
  const scrambled = { pace: 'active', intention: 'move', place: 'adventure' };
  const sc = await N.seedFrom(scrambled);
  ok('answers are read by question id, in any order',
    sc.compass.move === 1 && sc.continuumCeiling === 'reconnect' &&
    (sc.villages.movement || 0) > 0,
    'the Finder question order is editorial and has changed before');

  /* ══ Validation ══════════════════════════════════════════════════════════ */
  console.log('\n  Validation rejects what would score wrong');
  const bad = (o) => N.validate(Object.assign({}, s, o));
  ok('an unknown village key is rejected',
    (await bad({ villages: { atlantis: 1 } })).some((p) => /unknown key "atlantis"/.test(p)));
  ok('an unknown compass key is rejected',
    (await bad({ compass: { teleport: 1 } })).some((p) => /unknown key "teleport"/.test(p)));
  ok('a weight above 1 is rejected', (await bad({ compass: { restore: 4 } })).some((p) => /between 0 and 1/.test(p)));
  ok('an unknown trigger is rejected', (await bad({ trigger: 'vibes' })).some((p) => /unknown value "vibes"/.test(p)));
  ok('an unknown constraint is rejected', (await bad({ constraints: ['weather'] })).some((p) => /unknown value "weather"/.test(p)));
  ok('a floor deeper than its ceiling is rejected',
    (await bad({ continuumFloor: 'transform', continuumCeiling: 'relax' })).some((p) => /deeper than/.test(p)));
  ok('a fractional number of nights is rejected', (await bad({ nights: 3.5 })).some((p) => /whole number/.test(p)));

  ok('FREE TEXT IS REJECTED OUTRIGHT',
    (await bad({ note: 'they mentioned their father is unwell' })).some((p) => /free text is not allowed/.test(p)),
    'the one field that would turn a column list back into a filter');

  ok('validation reports every problem, not the first',
    (await bad({ villages: { atlantis: 1 }, trigger: 'vibes' })).length >= 2,
    'a screen should be able to render them all at once');

  /* ══ Overrides ═══════════════════════════════════════════════════════════ */
  console.log('\n  What the advisor changed');
  const edited = Object.assign({}, s, { trigger: 'work-cycle', nights: 5 });
  const diff = N.overridden(s, edited);
  ok('a completed field counts as an override', diff.indexOf('trigger') !== -1 && diff.indexOf('nights') !== -1);
  ok('an untouched field does not', diff.indexOf('party') === -1);
  ok('an unedited state reports no overrides', N.overridden(s, s).length === 0,
    'otherwise every advisor looks corrected and the signal is worthless');

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
