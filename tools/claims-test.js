/* ============================================================================
   claims-test.js — the checker, and the copy it must NOT flag
   ----------------------------------------------------------------------------
     node tools/claims-test.js

   Half of these assertions are that safe copy passes cleanly, and they matter
   more than the other half. A checker that flags everything is trivially
   "safe" and completely useless: advisors would learn to click through every
   warning, and the one that mattered would go through with the rest.

   So each pass is proven twice — it catches its own category, and it leaves
   good marketing copy alone.

   Runs against content/campaign-facts.js, which is generated from the Field
   Guide. No database, no network, no keys.
   ========================================================================== */
'use strict';

const { check, FACTS } = require('../api/_lib/claims.js');

let pass = 0, fail = 0;
const ok = (n, c, d) => {
  if (c) { pass++; console.log('  ✓ ' + n); }
  else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); }
};

const flagged = (text, rung) => check(text, rung).flags.map((f) => f.pass);
const clean = (text, rung) => check(text, rung).flags.length === 0;
const blocks = (text, rung) => !check(text, rung).copyable;

console.log('\n  CLAIMS CHECKER\n  ' + '─'.repeat(60) + '\n');

/* ── The fact bank is there at all ───────────────────────────────────────── */
console.log('  The bank');
ok('properties are loaded', FACTS.properties.length > 20, String(FACTS.properties.length));
ok('every property has a hook', FACTS.properties.every((p) => p.hook));
ok('no price survived the extractor',
  !/(?:US\$|\$\d|per night)/i.test(JSON.stringify(FACTS.properties)),
  'a figure in the bank is a figure that can reach a caption');
ok('provenance is stamped', !!FACTS.provenance.fieldGuideEdition);

/* ── 1 · Health language ─────────────────────────────────────────────────
   THE PAIR THAT DEFINES THE WHOLE FEATURE. Both sentences sell the same trip;
   only one of them makes a claim about a body. */
console.log('\n  Health language');
ok('"come back rested" is fine',
  clean('Seven unhurried days on the west coast. Come back rested.'),
  JSON.stringify(flagged('Seven unhurried days on the west coast. Come back rested.')));
ok('"reduces burnout" is BLOCKED',
  blocks('A week in Saint Lucia that reduces burnout.'),
  'the sentence a model reaches for because it converts better');
ok('"clinically proven" is blocked', blocks('A clinically proven reset.'));
ok('"treats anxiety" is blocked', blocks('Somewhere that treats anxiety.'));
ok('"detox" is blocked', blocks('A five-day detox by the sea.'));

/* The false-positive that would make advisors distrust it. */
ok('"healthy" does not trip the "heal" rule',
  clean('Long walks, healthy food, and nothing in the diary.'),
  JSON.stringify(flagged('Long walks, healthy food, and nothing in the diary.')));
ok('"health" in ordinary use is fine',
  clean('Travel that is good for your relationship with the island.'));

/* ── 2 · Unsupported entities ────────────────────────────────────────────── */
console.log('\n  Places');
const real = FACTS.properties[0].name;
ok('a property from the bank passes',
  clean(`Three nights at ${real}, then the rainforest.`),
  JSON.stringify(flagged(`Three nights at ${real}.`)));
ok('a shortened real name still passes',
  clean('Two nights at Sugar Beach before heading south.'),
  JSON.stringify(flagged('Two nights at Sugar Beach before heading south.')));
ok('an INVENTED resort is blocked',
  blocks('Stay at the Azure Piton Sanctuary, our favourite hideaway.'),
  'the classic failure — a real-sounding name half-remembered from training data');
ok('and the flag names it',
  check('Stay at the Azure Piton Sanctuary.').flags
    .some((f) => f.pass === 'entity' && /Azure Piton/.test(f.match)));

/* Our own vocabulary must never be mistaken for an unapproved place. */
ok('"Saint Lucia" is not flagged as an unknown place',
  clean('Saint Lucia is closer than you think.'));
ok('a village name is not flagged',
  clean('Ocean & Restoration is where most people start.'),
  JSON.stringify(flagged('Ocean & Restoration is where most people start.')));
ok('"Discover Saint Lucia WELL" is not flagged',
  clean('Take the Journey Finder at Discover Saint Lucia WELL.'));
ok('a sentence opening is not mistaken for a resort',
  clean('This Week I am opening five planning calls.'),
  JSON.stringify(flagged('This Week I am opening five planning calls.')));

/* THE SEVERITY SPLIT, which is what stops this becoming a cry-wolf checker.
   Added after sabotage: setting every entity flag to HIGH broke nothing,
   because no assertion here produced a low-severity entity. An untested branch
   is an unprotected one, and this is the branch that decides whether advisors
   read the warnings or learn to click past them. */
const unknownNonVenue = 'I am hosting an evening with Coastal Collective this spring.';
ok('an unrecognised NON-venue phrase is flagged but does not block',
  flagged(unknownNonVenue).includes('entity') && !blocks(unknownNonVenue),
  JSON.stringify(check(unknownNonVenue).flags.map((f) => f.severity)));
ok('while an unrecognised VENUE does block',
  blocks('An evening at the Coastal Collective Resort.'),
  'severity must turn on whether it reads as somewhere to stay');

/* ── 3 · Credentials ─────────────────────────────────────────────────────── */
console.log('\n  Credentials');
const trained = 'As an advisor trained in the Well Destination method, I build these trips.';
ok('a registered advisor may NOT say "trained in"', blocks(trained, 'registered'));
ok('a Foundations advisor may', clean(trained, 'foundations'),
  JSON.stringify(flagged(trained, 'foundations')));
ok('a Foundations advisor may not claim to have visited',
  blocks('I have experienced the destination first-hand.', 'foundations'));
ok('an Immersion advisor may', clean('I have experienced Saint Lucia first-hand.', 'immersion'));
ok('network membership is fine at every rung',
  ['registered', 'foundations', 'immersion'].every((r) =>
    clean('I am part of the Saint Lucia WELL advisor network.', r)));

/* The default must be the STRICTEST rung, not the loosest — a caller who
   forgets the argument should get more checking, not less. */
ok('an omitted rung defaults to the strictest', blocks(trained),
  'forgetting the argument would otherwise silently grant every claim');

/* ── 4 · Price and guarantees ────────────────────────────────────────────── */
console.log('\n  Prices and promises');
ok('a price is blocked', blocks('Seven nights from $3,200 per person.'));
ok('so is a bare rate', blocks('Rooms from US$450 a night.'));
ok('"award-winning" is flagged, but only advisory',
  flagged('An award-winning resort on the west coast.').includes('guarantee') &&
  !blocks('An award-winning resort on the west coast.'),
  'a superlative is worth a word, not a wall');
ok('"guaranteed" is flagged', flagged('Guaranteed availability in March.').includes('guarantee'));
ok('a date with no currency is fine',
  clean('I have five planning calls open in March.'),
  JSON.stringify(flagged('I have five planning calls open in March.')));

/* ── The shape of the result ─────────────────────────────────────────────── */
console.log('\n  What the screen gets');
const r = check('A clinically proven detox at the Azure Piton Sanctuary from $900 a night.');
ok('multiple passes fire together', new Set(r.flags.map((f) => f.pass)).size >= 3,
  JSON.stringify([...new Set(r.flags.map((f) => f.pass))]));
ok('and it is not copyable', r.copyable === false);
ok('every flag explains why', r.flags.every((f) => f.why && f.why.length > 40),
  'a checker that only says no teaches nothing');
ok('high and low are counted separately', r.high > 0 && typeof r.low === 'number');

/* A whole realistic caption, which is the case that actually matters. */
const good =
  'Most people book Saint Lucia for the view. A few book it for the week afterwards, ' +
  'when they notice they slept. If that sounds like the year you have had, I have five ' +
  'planning conversations open this month. Start with the Journey Finder — link below.';
ok('a REAL caption passes clean', clean(good), JSON.stringify(flagged(good)));

console.log('\n  ' + '─'.repeat(60));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
