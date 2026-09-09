#!/usr/bin/env node
/* ============================================================================
   design-shape-test — the day plan's rules, proven offline
   ----------------------------------------------------------------------------
     node tools/design-shape-test.js

   Pure module, so every rule is a plain assertion: pinned ends, property
   placement, the intensity seed bounded by the property, edits that refuse
   what the session did not carry, the pacing flags, and what the document
   reads back.
   ========================================================================== */
'use strict';
const S = require('../api/_lib/design-shape.js');

let failed = 0, ran = 0;
function ok(label, cond, detail) {
  ran++;
  if (cond) { console.log('    PASS  ' + label); return; }
  failed++;
  console.log('    FAIL  ' + label + (detail ? '\n          ' + detail : ''));
}

const recipe = { key: 'longevity-renewal', rhythm: [
  { key: 'open', label: 'Open', text: 'Arrival decompression', intensity: 'rest' },
  { key: 'core', label: 'Core', text: 'Structured protocol days', intensity: 'high' },
  { key: 'integrate', label: 'Integrate', text: 'Gentle nature and ocean', intensity: 'low' },
  { key: 'close', label: 'Close', text: 'Protected transition home', intensity: 'rest' }
] };
const props = {
  'thelifeco-st-lucia': { intensity: { typical: ['medium', 'high'] } },
  'sugar-beach-viceroy': { intensity: { typical: ['low', 'medium'] } },
  'anse-chastanet': { intensity: { typical: ['low', 'high'] } }
};

console.log('\n  Skeleton: phases across nights');
const seven = S.skeleton({ recipe, nights: 7, chosen: ['thelifeco-st-lucia', 'sugar-beach-viceroy'], properties: props });
ok('seven nights make seven days', seven.days.length === 7);
ok('the first day is the open phase, once', seven.days[0].phase === 'open' && seven.days.filter((d) => d.phase === 'open').length === 1);
ok('the last day is the close phase, once', seven.days[6].phase === 'close' && seven.days.filter((d) => d.phase === 'close').length === 1);
ok('the middle stretches the interior phases', seven.days.slice(1, 6).every((d) => d.phase === 'core' || d.phase === 'integrate'));
ok('two properties split at the phase midpoint', seven.days.filter((d) => d.phase === 'open' || d.phase === 'core').every((d) => d.property === 'thelifeco-st-lucia')
  && seven.days.filter((d) => d.phase === 'integrate' || d.phase === 'close').every((d) => d.property === 'sugar-beach-viceroy'));
ok('rest passes through any property range', seven.days[0].intensity === 'rest');
ok('a high phase at a medium–high property stays high', seven.days.find((d) => d.phase === 'core').intensity === 'high');
const three = S.skeleton({ recipe, nights: 3, chosen: ['anse-chastanet'], properties: props });
ok('fewer nights than phases: the first phases, in order', three.days.map((d) => d.phase).join(',') === 'open,core,integrate');
ok('one property is every day', three.days.every((d) => d.property === 'anse-chastanet'));
const nine = S.skeleton({ recipe, nights: 9, chosen: ['a', 'b', 'c'] });
ok('three properties split by thirds', nine.days.map((d) => d.property).join('') === 'aaabbbccc');
ok('no nights is an empty plan, not a throw', S.skeleton({ recipe, nights: null }).days.length === 0);
ok('no recipe still lays days with null phases', S.skeleton({ recipe: null, nights: 4, chosen: ['a'] }).days.every((d) => d.phase === null && d.property === 'a' && d.intensity === null));
ok('nights are capped at 21', S.skeleton({ recipe, nights: 40 }).nights === 21);

console.log('\n  The intensity seed is bounded by the property');
ok('a high phase at a low–medium property is held to medium', S.clampBand('high', ['low', 'medium']) === 'medium');
ok('a low phase at a medium–high property is raised to medium', S.clampBand('low', ['medium', 'high']) === 'medium');
ok('rest is never clamped', S.clampBand('rest', ['medium', 'high']) === 'rest');
ok('no range leaves the phase band alone', S.clampBand('high', null) === 'high');
ok('an unknown band is null, not a guess', S.clampBand('extreme', ['low', 'high']) === null);

console.log('\n  Edits refuse what the session did not carry');
const chosen = ['thelifeco-st-lucia', 'sugar-beach-viceroy'];
let e = S.applyEdit(seven, 3, { intensity: 'rest', note: 'A quiet day after the first protocol block.' }, { chosen });
ok('a valid edit returns a new plan', e.ok && e.plan.days[2].intensity === 'rest' && e.plan.days[2].edited === true);
ok('the edited note is the advisor’s', e.plan.days[2].noteSource === 'advisor');
ok('other days are untouched', e.plan.days[1].edited === false);
ok('a property the advisor did not carry is refused', S.applyEdit(seven, 3, { property: 'ladera-resort' }, { chosen }).ok === false);
ok('an unknown band is refused', S.applyEdit(seven, 3, { intensity: 'brutal' }, { chosen }).ok === false);
ok('a missing day is refused', S.applyEdit(seven, 12, { intensity: 'low' }, { chosen }).ok === false);
ok('a note is bounded', S.applyEdit(seven, 1, { note: 'x'.repeat(2000) }, { chosen }).plan.days[0].note.length === S.NOTE_MAX);
ok('a model note is marked as such', S.applyEdit(seven, 1, { note: 'Drafted.', noteSource: 'model' }, { chosen }).plan.days[0].noteSource === 'model');

console.log('\n  Re-laying the skeleton keeps what the advisor owns');
const relaid = S.mergePlan(e.plan, S.skeleton({ recipe, nights: 7, chosen, properties: props }));
ok('the edited day keeps its rest and its note', relaid.days[2].intensity === 'rest' && /quiet day/.test(relaid.days[2].note));
ok('unedited days take the new seed', relaid.days[1].intensity === 'high' && relaid.days[1].edited === false);

console.log('\n  Pacing flags');
const flags = (plan, o) => S.pacingFlags(plan, o).map((f) => f.code);
ok('a protocol recipe’s consecutive high days are its design, not a fault', flags(seven).length === 0, JSON.stringify(flags(seven)));
ok('the same days are a fault where the recipe asks to alternate', flags(seven, { alternate: true }).indexOf('back_to_back') !== -1);
let hard = S.applyEdit(seven, 1, { intensity: 'high' }, { chosen }).plan;
hard = S.applyEdit(hard, 2, { intensity: 'high' }, { chosen }).plan;
ok('two high days back to back are named when alternating', flags(hard, { alternate: true }).indexOf('back_to_back') !== -1);
ok('a high arrival is named', flags(hard).indexOf('hard_arrival') !== -1);
let noRest = seven;
[1, 7].forEach((n) => { noRest = S.applyEdit(noRest, n, { intensity: 'low' }, { chosen }).plan; });
ok('seven nights with no rest day are named', flags(noRest).indexOf('no_rest') !== -1);
const partial = S.applyEdit(S.skeleton({ recipe: null, nights: 3, chosen }), 1, { intensity: 'low' }, { chosen }).plan;
ok('unset days are named, once', flags(partial).indexOf('unset') !== -1);
ok('an entirely unset plan is not nagged', flags(S.skeleton({ recipe: null, nights: 3 })).length === 0);

console.log('\n  What the document reads');
const spans = S.phaseSpans(seven.days);
ok('phase spans are consecutive and cover every day', spans.length === 4 && spans[0].from === 0 && spans[spans.length - 1].to === 7);
const read = S.readDays(e.plan, (slug) => ({ 'thelifeco-st-lucia': 'TheLifeCo', 'sugar-beach-viceroy': 'Sugar Beach' })[slug]);
ok('each day carries label, shape, intensity word, property name, note',
  read[2].label === 'Day 3' && read[2].shape === 'Structured protocol days' && read[2].intensity === 'rest' && read[2].property === 'TheLifeCo' && /quiet/.test(read[2].note));
ok('the fields are exactly the document’s', Object.keys(read[0]).sort().join(',') === 'intensity,label,n,note,property,shape');
ok('no seeded value or band range leaks', JSON.stringify(read).indexOf('typical') === -1 && JSON.stringify(read).indexOf('edited') === -1);

console.log('\n  ' + ran + ' checks, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
