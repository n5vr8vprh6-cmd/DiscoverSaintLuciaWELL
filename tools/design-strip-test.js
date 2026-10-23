/* ============================================================================
   design-strip-test.js — derived properties are shown apart, never ranked in
   ----------------------------------------------------------------------------
     node tools/design-strip-test.js

   The catalogue (well-data/) can promote Tier A, B and C properties into the
   bank with vectors it derived from evidenced amenities and settings. Ranked
   together with the Field Guide's hand-authored profiles they crowd them out
   (design-coverage: thirteen properties never surfaced, eight of them existing
   Collection profiles). So the Designer keeps two pools and a screen strip.

   This test does not need such a bank to exist on disk: it injects a fixture
   (the live bank plus three synthetic derived records) before the modules load.
   What it defends:
     · the main shortlist is byte-for-byte what it is without any derived record;
     · the strip holds derived properties only, and never a profile;
     · a derived record that is unusually broad still cannot enter the main list;
     · a bank with no derived record gives an empty strip (today's behaviour).
   ========================================================================== */
'use strict';

const path = require('path');
const bankPath = require.resolve('../content/well-knowledge.generated.js');
const live = require(bankPath);

/* Three derived records modelled on the real ones: one very broad (the kind that
   crowded the shortlist), one narrow, one light. Fake slugs, fake names. */
const derived = (slug, over) => Object.assign({
  slug, n: null, name: slug.toUpperCase(), folder: null, collection: 'supporting', tier: 'B', scorable: true,
  villages: ['ocean'], compass: ['restore', 'reflect'], continuum: ['relax'], continuumNote: null,
  pillars: ['stay'], model: null, modelTag: null, hook: null, included: [], addons: [], price: null, priceTag: null,
  bestFor: null, role: null, watch: [], watchLevel: null, image: null,
  provenance: { source: 'catalogue', verified_at: '16 Oct 2026', confidence: 'VERIFIED OFFER', tier: 'B' },
  vectorSource: 'derived', vectorBasis: { stay: { basis: 'amenity', strength: 'moderate' } },
  fitBasis: 'amenity', fitWord: 'Amenity-based fit: a pool.', vectorStrength: 'moderate', vectorStrengthRank: 2
}, over || {});

/* The bank as it would be with nothing derived in it, then the same plus the fakes. */
const plain = Object.assign({}, live, { properties: live.properties.filter((p) => p.vectorSource !== 'derived') });
const fixture = Object.assign({}, plain, {
  properties: plain.properties.concat([
    derived('zz-broad', { villages: ['longevity', 'rainforest', 'ocean', 'movement'], compass: ['restore', 'reconnect', 'move', 'nourish', 'explore', 'reflect', 'celebrate', 'return'], tier: 'A' }),
    derived('zz-narrow'),
    derived('zz-light', { vectorStrength: 'light', vectorStrengthRank: 1 })
  ])
});

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };
console.log('\n  DESIGN STRIP\n  ' + '─'.repeat(60) + '\n');

(async () => {
  /* First with no derived record at all, as the baseline. */
  require.cache[bankPath].exports = plain;
  const M0 = require('../api/_lib/design-match.js');
  const K0 = require('../api/_lib/well-knowledge.js');
  const needs = [
    { villages: { longevity: 1 }, compass: { restore: 1 }, pillars: {}, continuumFloor: null, continuumCeiling: null, constraints: [] },
    { villages: { ocean: 2, rainforest: 1 }, compass: { restore: 1, reflect: 1 }, pillars: { stay: 1 }, continuumFloor: null, continuumCeiling: null, constraints: [] },
    { villages: { movement: 1 }, compass: { move: 1 }, pillars: { movement: 1 }, continuumFloor: 'relax', continuumCeiling: 'restore', constraints: [] }
  ];
  const base = [];
  for (const n of needs) base.push(JSON.stringify((await M0.shortlistFor(n)).map((c) => [c.slug, c.order])));
  ok('a bank with no derived record has an empty strip', (await M0.shortlistFor(needs[0], { derived: true })).length === 0);

  /* Now swap the bank in the module cache and reload the two modules. */
  const kPath = require.resolve('../api/_lib/well-knowledge.js');
  const mPath = require.resolve('../api/_lib/design-match.js');
  require.cache[bankPath].exports = fixture;
  delete require.cache[kPath]; delete require.cache[mPath];
  const K = require('../api/_lib/well-knowledge.js');
  const M = require('../api/_lib/design-match.js');

  ok('the fixture is in force', (await K.properties({ derived: true })).length === 3);
  ok('the default pool is the profiles and nothing else',
    (await K.properties()).every((p) => p.vectorSource !== 'derived') && (await K.properties()).length === plain.properties.filter((p) => p.scorable).length);

  let same = true, stripOnly = true, nonEmpty = 0;
  for (let i = 0; i < needs.length; i++) {
    const main = await M.shortlistFor(needs[i]);
    const strip = await M.shortlistFor(needs[i], { derived: true });
    if (JSON.stringify(main.map((c) => [c.slug, c.order])) !== base[i]) same = false;
    if (strip.some((c) => c.property.vectorSource !== 'derived') || main.some((c) => c.property.vectorSource === 'derived')) stripOnly = false;
    if (strip.length) nonEmpty++;
  }
  ok('the main shortlist is identical with derived records present', same, 'a derived record leaked into, or reordered, the profiles');
  ok('the strip holds derived properties only, and the shortlist none', stripOnly);
  ok('the strip is populated', nonEmpty === needs.length);

  /* The broad record is the one that crowded the shortlist in the real bank. */
  const wide = { villages: { ocean: 1 }, compass: { restore: 1, reflect: 1, move: 1, nourish: 1 }, pillars: {}, continuumFloor: null, continuumCeiling: null, constraints: [] };
  const mainWide = await M.shortlistFor(wide);
  ok('a very broad derived record cannot enter the main shortlist', !mainWide.some((c) => c.slug === 'zz-broad'));

  /* Equal fit: the stronger evidence goes first. */
  const stripNarrow = await M.shortlistFor({ villages: { ocean: 1 }, compass: { restore: 1 }, pillars: {}, continuumFloor: null, continuumCeiling: null, constraints: [] }, { derived: true });
  const iN = stripNarrow.findIndex((c) => c.slug === 'zz-narrow'), iL = stripNarrow.findIndex((c) => c.slug === 'zz-light');
  ok('at equal fit, stronger evidence sorts before lighter', iN !== -1 && iL !== -1 && iN < iL);
  ok('every strip candidate still carries a mismatch line', stripNarrow.every((c) => c.mismatches.length > 0));

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
