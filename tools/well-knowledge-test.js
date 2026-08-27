/* ============================================================================
   well-knowledge-test.js — the adapter, and the boundary it defends
   ----------------------------------------------------------------------------
     node tools/well-knowledge-test.js

   THREE THINGS, AND THE THIRD IS THE ONE THAT MATTERS.

   THE VOCABULARY RECONCILES. Three names exist for six villages — this site's
   `rainforest`, the Field Guide's `nature`, and the display names the database
   actually holds because js/journey.js posts score().map(v => v.name). If the
   adapter cannot resolve all three to one key, every stored Journey scores
   against nothing and the shortlist silently comes back empty. That failure
   looks exactly like "no good matches".

   NOTHING IS IMPUTED. Sixteen records have no depth band. The honest handling
   is a null the matcher reports as depth_unknown; the tempting one is to guess
   a band from the compass string. These assert the null survives.

   mayAssert() IS NARROW. It is the only projection allowed into a model
   payload. If a price, an inclusion or a watch note ever appears in its output,
   an advisor's client-facing prose can quote a figure nobody verified. The
   assertion is on VALUES, not field names — a field-name check passes cleanly
   the day somebody renames `price` to `rate`.
   ========================================================================== */
'use strict';

const K = require('../api/_lib/well-knowledge.js');

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };

console.log('\n  WELL KNOWLEDGE — ADAPTER\n  ' + '─'.repeat(60) + '\n');

(async () => {
  /* ══ It loaded ═══════════════════════════════════════════════════════════ */
  console.log('  The bank');
  ok('the bank is present', await K.ready(),
    'run node tools/build-well-knowledge.js');

  const v = await K.version();
  ok('it names its edition and its cutoffs', Boolean(v.bank && v.verified.core && v.verified.expanded));
  ok('it says which backend is live', v.source === 'generated-file');
  ok('the version stamp is stable and non-empty', (await K.versionStamp()).length > 5);

  /* ══ The vocabulary ══════════════════════════════════════════════════════ */
  console.log('\n  The village vocabulary — three names, one key');
  const vs = await K.villages();
  ok('six villages, keyed to this site', vs.length === 6 && vs.some((x) => x.key === 'rainforest'));
  ok('and NOT to the Field Guide', !vs.some((x) => x.key === 'nature'),
    'nature/rainforest is the one pair that differs');

  ok("this site's key resolves", await K.villageKey('rainforest') === 'rainforest');
  ok("the Field Guide's key resolves", await K.villageKey('nature') === 'rainforest');
  ok('the Field Guide display name resolves', await K.villageKey('Nature & Renewal') === 'rainforest');
  ok('the DATABASE display name resolves', await K.villageKey('Nature & Renewal Village') === 'rainforest',
    'this is what journey_shares.villages actually holds');
  ok('a qualified name resolves', await K.villageKey('Longevity (specialist layer)') === 'longevity');
  ok('an unknown name resolves to null, not a guess', await K.villageKey('Sparkling Waters') === null);

  /* Every stored Journey's villages must round-trip, or scoring silently
     misses. Assert against the real display names, built the same way. */
  const stored = vs.map((x) => x.name);
  const roundTrip = await Promise.all(stored.map((n) => K.villageKey(n)));
  ok('every stored display name round-trips', roundTrip.every(Boolean) &&
    roundTrip.length === 6 && new Set(roundTrip).size === 6,
    JSON.stringify(roundTrip));

  /* ══ What is scorable ════════════════════════════════════════════════════ */
  console.log('\n  What may be scored');
  const all = await K.properties();
  ok('thirty scorable properties', all.length === 30, String(all.length));
  ok('fifteen deep, fifteen collection',
    all.filter((p) => p.collection === 'deep').length === 15 &&
    all.filter((p) => p.collection === 'collection').length === 15);
  ok('every scorable property has a village AND a compass',
    all.every((p) => p.villages.length && p.compass.length),
    'a property with neither scores zero against everything and never appears');
  ok('filtering by village works', (await K.properties({ village: 'longevity' })).length > 0);

  const extra = await K.alsoInVillage('rainforest');
  ok('supporting and basecamp inventory is reachable',
    extra.supporting.length > 0 && extra.basecamps.length > 0);
  ok('and is not in the scorable list',
    !all.some((p) => p.name === extra.supporting[0].name),
    'one village and one line of signal is not a vector');

  /* ══ Nothing is imputed ══════════════════════════════════════════════════ */
  console.log('\n  Unknowns stay unknown');
  const noDepth = all.filter((p) => p.continuum === null);
  ok('sixteen records carry no depth band', noDepth.length === 16, String(noDepth.length));
  ok('every COLLECTION record is one of them',
    all.filter((p) => p.collection === 'collection').every((p) => p.continuum === null));
  ok("A'ILA is the deep one", noDepth.some((p) => p.slug === 'aila-resorts-villas-residences'));
  ok('and each says so rather than guessing',
    noDepth.every((p) => typeof p.continuumNote === 'string' && p.continuumNote.length > 10));

  const aila = await K.provenanceFor('aila-resorts-villas-residences');
  ok('provenance reports depth as not known', aila.depthKnown === false);

  /* ══ The prompt boundary ═════════════════════════════════════════════════ */
  console.log('\n  mayAssert() — the only thing a prompt may see');
  const full = await K.property('sugar-beach-viceroy');
  const safe = await K.mayAssert('sugar-beach-viceroy');

  ok('it returns the five permitted fields',
    Object.keys(safe).sort().join(',') === 'compass,hook,name,pillars,villages',
    Object.keys(safe).join(','));

  /* Value assertions, not field-name assertions. A field-name check passes the
     day somebody renames price to rate. */
  const blob = JSON.stringify(safe);
  ok('the price never appears', full.price && blob.indexOf(full.price.text) === -1,
    'a model handed a price will quote it');
  ok('no inclusion appears', full.included.every((f) => blob.indexOf(f.text) === -1));
  ok('no add-on appears', full.addons.every((f) => blob.indexOf(f.text) === -1));
  ok('the watch note never appears', full.watch.every((f) => blob.indexOf(f.text) === -1),
    'an unknown handed to a model becomes an invention');
  ok('no dollar figure of any kind appears', !/\$\s?\d/.test(blob));

  ok('an unknown slug returns null, not an empty shell', await K.mayAssert('no-such-place') === null);

  /* The advisor-facing accessor carries exactly what the prompt one refuses. */
  const prov = await K.provenanceFor('sugar-beach-viceroy');
  ok('provenanceFor DOES carry the watch note', prov.watch.length > 0,
    'same fact, two audiences, two call sites');
  ok('every fact carries source, date and an ordinal confidence',
    full.included.every((f) => f.source && f.verified_at && f.confidence));
  ok('confidence is a label, never a number',
    full.included.every((f) => typeof f.confidence === 'string' && !/^\d/.test(f.confidence)),
    '0.87 confidence is the same lie as 94/100 fit');

  /* ══ Planning material ═══════════════════════════════════════════════════ */
  console.log('\n  Planning material');
  ok('six journey recipes', (await K.recipes()).length === 6);
  ok('a recipe is addressable by key', Boolean(await K.recipe((await K.recipes())[0].key)));
  ok('eight intention-finder rows', (await K.finderRows()).length === 8);
  ok('recipes resolve their villages to keys',
    (await K.recipes()).every((r) => r.villages.every((x) => vs.some((y) => y.key === x))));
  ok('seven suitability rules, each addressable', (await K.suitabilityRules()).length === 7 &&
    (await K.suitabilityRules()).every((r) => r.key && r.check && r.why));

  const fw = await K.frameworks();
  ok('the continuum ladder is ordered', fw.continuumOrder.length === 6 &&
    fw.continuumOrder[0] === 'relax' && fw.continuumOrder[5] === 'sustain');
  ok('rung index is positional', await K.continuumIndex('recover') === 3);
  ok('and an unrecognised rung is -1, not 0', await K.continuumIndex('nonsense') === -1,
    'so a caller can tell "not a rung" from "the first rung"');

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
