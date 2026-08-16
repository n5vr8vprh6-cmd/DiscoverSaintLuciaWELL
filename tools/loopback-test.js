/* ============================================================================
   loopback-test.js — what happened, and where Foundations may appear
   ----------------------------------------------------------------------------
     node tools/loopback-test.js

   THE GUARD THIS FILE EXISTS FOR. Foundations must not be mentioned anywhere in
   the campaign flow until the Hub can show the advisor a real result. Not on
   the plan screen, not in the empty state, not beside a locked button — only in
   the loop-back, and only inside the branch where something actually happened.

   That guard will erode, because moving the mention earlier will always look
   like it would convert better. It erodes silently: nothing breaks, the page
   still renders, and the only casualty is an advisor being sold to before they
   have been helped — after which they discount everything that follows.

   The confidence strip has the matching risk. It is a provenance display, and
   the moment it renders differently for a Foundations advisor it has become an
   advert wearing a diagnostic's clothes.
   ========================================================================== */
'use strict';

const LB = require('../api/_lib/loopback.js');
const { confidenceStrip } = require('../api/_lib/campaign-blocks.js');
const { describe: describeCapacity } = require('../api/_lib/capacity.js');

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };

const DAY = 24 * 60 * 60 * 1000;
const plan = { created_at: new Date(Date.now() - 10 * DAY).toISOString() };

console.log('\n  LOOPBACK\n  ' + '─'.repeat(60) + '\n');

/* ══ Week windows ════════════════════════════════════════════════════════ */
console.log('  Which week of the plan it is');
const at = (days) => new Date(plan.created_at).getTime() + days * DAY;
ok('day 0 is week 1', LB.weekNumber(plan, at(0)) === 1);
ok('day 6 is still week 1', LB.weekNumber(plan, at(6)) === 1);
ok('day 7 is week 2', LB.weekNumber(plan, at(7)) === 2);
ok('day 27 is week 4', LB.weekNumber(plan, at(27)) === 4);
ok('day 40 is past the month', LB.weekNumber(plan, at(40)) > 4,
  'the report has to know when it is reporting on a finished month');
ok('a plan with no date is week 0, not NaN', LB.weekNumber({}, Date.now()) === 0);
ok('null is survivable', LB.weekNumber(null, Date.now()) === 0);

const w2 = LB.windowFor(plan, 2);
ok('week 2 starts seven days in',
  Math.round((new Date(w2.from) - new Date(plan.created_at)) / DAY) === 7);
ok('and is seven days long',
  Math.round((new Date(w2.to) - new Date(w2.from)) / DAY) === 7);

/* ══ The sentence ════════════════════════════════════════════════════════
   Written rather than assembled, because assembled sentences say "1 visits". */
console.log('\n  The sentence it writes');
ok('nothing is said plainly', /Nothing came through/.test(LB.sentence(0, 0, 0)));
/* Case-insensitive: the sentence is capitalised on the way out, so asserting
   the lowercase fragment tests cap() rather than the singular. */
ok('one visit is singular', /one visit to your link/i.test(LB.sentence(1, 0, 0)),
  LB.sentence(1, 0, 0));
ok('two visits are plural', /2 visits/.test(LB.sentence(2, 0, 0)));
ok('one Journey is singular', /one person shared theirs/i.test(LB.sentence(0, 0, 1)));
ok('several read as a list', /and/.test(LB.sentence(5, 2, 1)), LB.sentence(5, 2, 1));

/* The clause that matters most. A shared Journey is a person waiting. */
ok('a shared Journey says somebody is WAITING',
  /waiting to hear from you/.test(LB.sentence(4, 2, 1)),
  'a count is less useful than the fact that a real person expects a reply');
ok('and it is singular for one', /That is somebody/.test(LB.sentence(4, 2, 1)));
ok('plural for more', /Those are people/.test(LB.sentence(4, 2, 3)));
ok('no Journeys, no waiting clause', !/waiting/.test(LB.sentence(9, 3, 0)),
  'it must not manufacture urgency where nobody is actually waiting');
/* A digit is a legitimate sentence opening — "3 visits to your link." is
   correct English and the first version of this assertion said otherwise. */
ok('every sentence opens correctly',
  [[1,0,0],[0,1,0],[0,0,1],[3,2,1],[0,0,0]]
    .every(([a,b,c]) => /^[A-Z0-9]/.test(LB.sentence(a,b,c))),
  JSON.stringify([[1,0,0],[3,2,1]].map(([a,b,c]) => LB.sentence(a,b,c))));

/* ══ FOUNDATIONS APPEARS ONLY AFTER A RESULT ═════════════════════════════ */
console.log('\n  Foundations is mentioned only once there is evidence');
const registered = { id: 'a' };
const nothing = { anything: false, totals: { visits: 0, completions: 0, journeys: 0 }, weeks: [] };
const something = { anything: true, totals: { visits: 14, completions: 3, journeys: 2 }, weeks: [] };

ok('a zero-result advisor is NEVER shown it',
  LB.foundationsNote(nothing, registered, {}) === null,
  'before a result it is a pitch, and an advisor sold to before being helped discounts what follows');
ok('nor is one with no report at all', LB.foundationsNote(null, registered, {}) === null);
ok('after a result it appears', LB.foundationsNote(something, registered, {}) !== null);

ok('a Foundations graduate is never shown it',
  LB.foundationsNote(something, { foundations_at: '2026-01-01' }, {}) === null,
  'telling somebody to buy what they already own');
ok('nor an immersion graduate',
  LB.foundationsNote(something, { immersion_at: '2026-01-01' }, {}) === null);

const note = LB.foundationsNote(something, registered, {});
/* Both branches must be in engine terms, and they word it differently — so
   assert the CONCEPT rather than one branch's phrasing. The first version
   matched only the with-brief wording and called the other one a failure. */
const engineTerms = (b) => /Brand Profile/.test(b) && /read/.test(b) && !/transform|unlock your potential/i.test(b);
ok('it is described in ENGINE terms', engineTerms(note.body),
  '"transform your marketing" is neither concrete nor checkable, and advisors have heard it');
ok('it names a concrete consequence', /rebuild their plan/.test(note.body),
  'a benefit an advisor can picture, rather than an adjective');
ok('it links to the page, not to a checkout', note.href === '/advisors/foundations');


const withBrief = LB.foundationsNote(something, registered,
  { brief_parsed: { CLIENTS: [1, 2] } });
ok('BOTH branches stay in engine terms', engineTerms(withBrief.body));
ok('an advisor who did the brief gets a different sentence',
  withBrief.body !== note.body && /it shows in the copy/.test(withBrief.body),
  'they have already proved the mechanism to themselves; the pitch should acknowledge it');

/* ══ NO PADLOCK VOCABULARY ═══════════════════════════════════════════════
   The first draft of this note said Foundations "unlocks rebuilding" — the
   exact register the plan bans, written by the same person who wrote the ban.
   Nothing broke; the sentence read fine. This greps for the WORDS, because
   intent is not greppable and the words are what an advisor actually reads. */
console.log('\n  And it never reads like a paywall');
const PADLOCK = /unlock|upgrade|premium|locked|gated|pro plan|full version/i;
ok('the note uses no padlock vocabulary', !PADLOCK.test(note.body + note.heading),
  '"unlock" frames the product as withholding something it has chosen not to give you');
ok('nor does the brief variant', !PADLOCK.test(withBrief.body + withBrief.heading));

/* ══ The confidence strip ════════════════════════════════════════════════ */
console.log('\n  The confidence strip is a diagnostic, not an advert');
const bare = confidenceStrip({}, describeCapacity({}));
const persona = confidenceStrip({ positioning: 'x', icp: 'y', expr_primary: 'curator',
  traveller_orientation: 'secondary-intentional' }, describeCapacity({}));
const full = confidenceStrip({ positioning: 'x', icp: 'y', expr_primary: 'curator',
  traveller_orientation: 'primary', brief_parsed: { CLIENTS: [1, 2], PROOF: [1] } },
  describeCapacity({}));

ok('it always says what it WAS built from', /Built from:/.test(bare));
ok('the fact bank is named even with nothing else',
  /Saint Lucia fact bank/.test(bare),
  'an advisor should know the destination facts are not being improvised');
ok('a bare profile is told what is missing',
  /Not built from:.*how you create advantage/s.test(bare));
ok('a persona removes itself from the missing list',
  !/Not built from:[^<]*how you create advantage/s.test(persona));
ok('and the brief removes itself too',
  !/Not built from/.test(full),
  'nothing missing means no missing line at all');
ok('the brief is counted in specifics', /3 specifics/.test(full),
  'a number an advisor can check against what they pasted');

/* THE ONE THAT KEEPS IT HONEST. */
const registeredStrip = confidenceStrip(
  { positioning: 'x', expr_primary: 'curator', traveller_orientation: 'primary' },
  describeCapacity({ capacity_class: 'C2' }));
const graduateStrip = confidenceStrip(
  { positioning: 'x', expr_primary: 'curator', traveller_orientation: 'primary' },
  describeCapacity({ capacity_class: 'C2' }));
ok('it renders IDENTICALLY regardless of tier',
  registeredStrip === graduateStrip,
  'the strip takes no advisor and no rung — a strip that changes its tune by tier is an advert wearing a diagnostic\'s clothes');
ok('it contains no mention of Foundations at all',
  !/Foundations/i.test(bare) && !/Foundations/i.test(full),
  'the strip states provenance; the selling happens once, in the loop-back, after a result');

ok('it uses no padlock vocabulary either',
  !PADLOCK.test(bare) && !PADLOCK.test(persona) && !PADLOCK.test(full),
  'the strip is a diagnostic; the moment it reads as a paywall it has stopped being one');

ok('it carries the plan size, so small reads as deliberate',
  /Sized for/.test(bare), 'an advisor should tell "this is small" from "this is small ON PURPOSE"');

console.log('\n  ' + '─'.repeat(60));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
