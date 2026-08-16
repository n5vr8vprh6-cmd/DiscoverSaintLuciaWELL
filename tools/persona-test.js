/* ============================================================================
   persona-test.js — the five questions, and the rules that make them worth asking
   ----------------------------------------------------------------------------
     node tools/persona-test.js

   Three things carry D2a, and each has a way of quietly failing:

     NO QUESTION MAY ASK WHAT AN ADVISOR IS. The Bible ranks typology labels as
     the weakest evidence class available. "Which of these are you?" is more fun
     to build and more fun to answer than "which of these have you done?", so
     this is the constraint that erodes first, and it erodes without breaking
     anything visible.

     THE PERSONA MUST NOT BE INVENTED. With no answers there is no persona — a
     default would render with the same confidence as a real one and quietly
     shape a campaign.

     THE CORRECTION MUST OUTRANK THE DERIVATION. If an advisor changes the read,
     that is better evidence than the five answers behind it.
   ========================================================================== */
'use strict';

const P = require('../api/_lib/persona.js');
const PLAYBOOK = require('../content/marketing-playbook.js');
const FACTS = require('../content/campaign-facts.js');

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };

const Q = (id) => P.QUESTIONS.find((q) => q.id === id);

console.log('\n  PERSONA\n  ' + '─'.repeat(60) + '\n');

/* ══ The shape ═══════════════════════════════════════════════════════════ */
console.log('  Five questions, and no more');
ok('there are exactly five', P.QUESTIONS.length === 5, String(P.QUESTIONS.length));
ok('every one says why it is asking',
  P.QUESTIONS.every((q) => q.why && q.why.length > 20),
  'the Bible\'s rule is that questions are a cost; the least one can do is say what it is for');
ok('every one has options — nothing is free text',
  P.QUESTIONS.every((q) => Array.isArray(q.options) && q.options.length >= 4),
  'free text is what made the last intake abandonable');
ok('the needs question caps at two', Q('needs').max === 2);

/* ══ EVIDENCE, NOT IDENTITY ══════════════════════════════════════════════
   The assertion this whole design rests on. */
console.log('\n  No question asks the advisor what they are');

const IDENTITY = /\bare you\b|which are you|your (style|personality|type|archetype)|describe yourself|what kind of .* are you|best describes you/i;
P.QUESTIONS.forEach((q) => {
  ok(`"${q.id}" is not phrased as an identity question`, !IDENTITY.test(q.ask),
    JSON.stringify(q.ask));
});

/* The sharper structural version: an option must never BE a profile name. If
   somebody adds "Storyteller" as a choice, the design has quietly become a
   personality quiz and this fails. */
const PROFILE_NAMES = (PLAYBOOK.expressionProfiles || []).map((p) => p.name);
const scoringOptions = Q('acts').options.concat(Q('thanks').options);
ok('no option is a profile name',
  scoringOptions.every((o) => !PROFILE_NAMES.some((n) =>
    new RegExp('\\b' + n + '\\b', 'i').test(o.label))),
  JSON.stringify(scoringOptions.filter((o) => PROFILE_NAMES.some((n) =>
    new RegExp('\\b' + n + '\\b', 'i').test(o.label))).map((o) => o.label)));

ok('the acts question asks about the past', /have you .*done|in the last twelve months/i.test(Q('acts').ask),
  Q('acts').ask);
ok('the thanks question asks what OTHERS said', /clients thank you/i.test(Q('thanks').ask),
  'repeated audience response is the second-strongest class and this is how we buy it');
ok('every scoring option maps to a real profile',
  scoringOptions.every((o) => P.profileFor(o.profile)),
  JSON.stringify(scoringOptions.filter((o) => !P.profileFor(o.profile)).map((o) => o.value)));
ok('all six profiles are reachable from the acts question',
  new Set(Q('acts').options.map((o) => o.profile)).size === 6);
ok('and from the thanks question',
  new Set(Q('thanks').options.map((o) => o.profile)).size === 6,
  'a profile nobody can be assigned is a profile that does not exist');

/* ══ The Compass is reused, not reinvented ═══════════════════════════════ */
console.log('\n  The audience axis reuses the WELL Compass');
ok('the needs options ARE the Compass',
  Q('needs').options.length === FACTS.compass.length &&
  Q('needs').options.every((o, i) => o.value === FACTS.compass[i].key),
  'a second taxonomy could not be checked against real Journey results');
ok('there are eight of them', Q('needs').options.length === 8);
ok('the orientations come from the field guide',
  Q('orientation').options.length === (PLAYBOOK.travellerOrientations || []).length);

/* ══ Scoring ═════════════════════════════════════════════════════════════ */
console.log('\n  Scoring, and what outranks what');
ok('audience response is weighted above self-report',
  P.WEIGHT.thanks > P.WEIGHT.acts, JSON.stringify(P.WEIGHT));

const curatorHost = P.derive({
  acts: ['shortlist', 'said-no', 'hosted', 'brought-together'], thanks: 'right-place'
});
ok('a clear pair derives a primary and a secondary',
  curatorHost.primary === 'curator' && curatorHost.secondary === 'host',
  JSON.stringify(curatorHost));

/* The case the weighting exists for. */
const overruled = P.derive({
  acts: ['explained-fit', 'shortlist', 'told-moment', 'introduced'], thanks: 'new-angle'
});
ok('one clear audience signal beats four scattered self-reports',
  overruled.primary === 'commentator',
  JSON.stringify(overruled.scores) + ' — this is the whole point of the weighting');

const tied = P.derive({ acts: ['explained-fit', 'shortlist'], thanks: 'right-place' });
ok('a tie breaks toward what the audience said, not alphabetically',
  tied.primary === 'curator', JSON.stringify(tied.scores));

/* THE CASE THAT ISOLATES THE WEIGHTING, and the reason it exists.
   The assertions above do not: the tie-break ALSO favours the thanks answer, so
   dropping thanks to 1 point leaves both of them green. Sabotage found that.

   Here, two acts point at Guide and the audience points at Curator. At the real
   weighting Curator reaches 2 and ties, and the tie-break carries it. At equal
   weighting Curator reaches only 1 and loses outright, which nothing else can
   rescue. Change WEIGHT and this is the assertion that goes red. */
const isolatesWeight = P.derive({
  acts: ['explained-fit', 'built-framework'], thanks: 'right-place'
});
ok('the extra weight ALONE decides it when the tie-break cannot',
  isolatesWeight.primary === 'curator',
  JSON.stringify(isolatesWeight.scores) +
  ' — two self-reported acts against one audience signal');

const weakRunner = P.derive({
  acts: ['explained-fit', 'built-framework', 'shortlist'], thanks: 'understood'
});
ok('a runner-up scoring 1 against 4 is dropped',
  weakRunner.primary === 'guide' && weakRunner.secondary === null,
  'presenting noise as half an identity would be a fiction');

ok('no answers means NO persona, not a default',
  P.derive({}) === null,
  'an invented persona renders with the same confidence as a real one');
ok('null in, null out', P.derive(null) === null);
ok('an unknown option is ignored rather than scored',
  P.derive({ acts: ['not-a-real-option'] }) === null);

console.log('\n  The other three answers');
const full = P.derive({ acts: ['shortlist'], thanks: 'right-place',
  orientation: 'secondary-intentional', needs: ['restore', 'reconnect'], capacity: 'C2' });
ok('a valid orientation is kept', full.orientation === 'secondary-intentional');
ok('an invalid one is dropped',
  P.derive({ thanks: 'right-place', orientation: 'made-up' }).orientation === null);
ok('two needs are kept', full.needs.length === 2);
ok('a third is trimmed',
  P.derive({ thanks: 'right-place', needs: ['restore', 'reconnect', 'move'] }).needs.length === 2);
ok('an invalid need is dropped',
  P.derive({ thanks: 'right-place', needs: ['restore', 'telepathy'] }).needs.length === 1);
ok('a valid capacity is kept', full.capacity === 'C2');
ok('an invalid one is dropped',
  P.derive({ thanks: 'right-place', capacity: 'C9' }).capacity === null);

/* ══ The reveal ══════════════════════════════════════════════════════════ */
console.log('\n  The reveal is a read, not a verdict');
const desc = P.describe(curatorHost);
ok('it names the pair', /Curator/.test(desc.headline) && /Host/.test(desc.headline),
  desc.headline);
ok('it carries what to watch for, not only the flattery', Boolean(desc.watchFor),
  'every profile has a characteristic failure and it is the shadow of its strength');
ok('and a growth edge', Boolean(desc.growthEdge));
ok('a named blend is used when one exists',
  Boolean(P.blendFor('connector', 'host')));
ok('and order does not matter', Boolean(P.blendFor('host', 'connector')));
ok('an unnamed pair does NOT get an invented blend',
  P.blendFor('guide', 'host') === null,
  'a seventh blend made up here would carry the same authority without the same basis');
ok('no persona means no description', P.describe(null) === null);

/* ══ The correction outranks the derivation ══════════════════════════════ */
console.log('\n  A correction outranks the derivation');
const derived = { expr_primary: 'curator', expr_secondary: 'host' };
ok('with no correction, the derived pair is used',
  P.effective(derived).primary === 'curator' && P.effective(derived).corrected === false);

const corrected = Object.assign({}, derived, { expr_confirmed: 'guide + commentator' });
ok('a correction wins outright',
  P.effective(corrected).primary === 'guide' &&
  P.effective(corrected).secondary === 'commentator',
  'the change is better evidence than the answers that produced the original');
ok('and is flagged as a correction', P.effective(corrected).corrected === true,
  'stored separately so the fact that a correction happened is not discarded');
ok('a single-profile correction works too',
  P.effective(Object.assign({}, derived, { expr_confirmed: 'storyteller' })).secondary === null);

/* ══ What reaches the prompt ═════════════════════════════════════════════ */
console.log('\n  What reaches the prompt');
const block = P.personaBlock({
  expr_primary: 'curator', expr_secondary: 'host',
  traveller_orientation: 'secondary-intentional', compass_needs: ['restore', 'reconnect']
});
ok('it names the advantage', /taste, selection/.test(block));
ok('it gives the register to write in', /Write in this register/.test(block));
ok('it names what this profile gets WRONG',
  /characteristically gets WRONG/.test(block) && /moodboard/.test(block),
  'the generator should be told the failure, not only the strength');
ok('it carries the traveller register',
  /REGISTER:/.test(block) && /let the wellbeing be how it is designed/.test(block),
  'this is the field that changes the language of the whole campaign');
ok('it names the two Compass needs',
  /Restore/.test(block) && /Reconnect/.test(block));
ok('a corrected persona reaches the prompt, not the derived one',
  /Guide/.test(P.personaBlock({ expr_primary: 'curator', expr_confirmed: 'guide' })),
  'the correction has to survive all the way to generation or storing it was theatre');
ok('no persona produces NO block, not an empty heading',
  P.personaBlock({}) === '' && P.personaBlock(null) === '',
  'an empty heading invites a model to fill it in');

/* ══ It has to reach the generator ═══════════════════════════════════════
   THE FAILURE MODE THIS SECTION EXISTS FOR: a persona that is captured,
   stored, rendered on a pleasant reveal screen, and then quietly ignored when
   the campaign is written. That looks like success from every angle except the
   copy, which is the only angle that matters.

   These assertions run stubbed, so they check the composed request. Whether
   the persona changes the WORDS is a question only a live model can answer, and
   tools/persona-live.js asks it. */
(async () => {
  process.env.OPENAI_STUB = '1';
  const G = require('../api/_lib/gtm-generate.js');

  console.log('\n  It reaches the generator');
  const advisor = { first_name: 'Mira', business: 'Hall & Co', public_code: 'X' };
  const base = { positioning: 'Slow trips', icp: 'Couples', instagram: '@x' };
  const curator = Object.assign({}, base, {
    expr_primary: 'curator', expr_secondary: 'host',
    traveller_orientation: 'secondary-intentional', compass_needs: ['restore', 'reconnect']
  });

  const withP = JSON.stringify((await G.generateSkeleton(advisor, curator, 'registered')).payload);
  const without = JSON.stringify((await G.generateSkeleton(advisor, base, 'registered')).payload);

  ok('the skeleton prompt carries the persona', /HOW THIS ADVISOR CREATES ADVANTAGE/.test(withP));
  ok('and does not when there is none', !/HOW THIS ADVISOR CREATES ADVANTAGE/.test(without),
    'an empty heading invites a model to fill it in');
  ok('it carries the register that changes the whole campaign', /REGISTER:/.test(withP),
    'primary vs secondary wellness is the field that decides the language');
  ok('it carries the two Compass needs', /Restore/.test(withP) && /Reconnect/.test(withP));
  ok('it carries what this profile gets WRONG',
    /characteristically gets WRONG/.test(withP),
    'the generator should be told the failure, not only the strength');

  const asset = await G.generateAsset(advisor, curator, 'registered',
    { week: 1, position: 0, title: 't', why: 'w', channel: 'instagram', assetKind: 'caption' },
    'T', { critique: false });
  ok('the asset prompt carries it too',
    /HOW THIS ADVISOR CREATES ADVANTAGE/.test(JSON.stringify(asset.payload)),
    'a persona that reaches the plan but not the copy is half-wired');

  /* Two advisors identical but for the profile must not receive the same
     brief. This is the payload half; the output half is in persona-live.js. */
  const storyteller = Object.assign({}, curator, {
    expr_primary: 'storyteller', expr_secondary: null
  });
  const other = JSON.stringify((await G.generateSkeleton(advisor, storyteller, 'registered')).payload);
  ok('two advisors differing ONLY in profile get different briefs',
    withP !== other, 'if these match, the persona is decorative');
  ok('and the difference is the profile, not noise',
    /taste, selection/.test(withP) && /narrative, lived moments/.test(other),
    'each brief should carry its own advantage, not a generic one');

  /* The correction has to survive all the way here or storing it was theatre. */
  const corrected = Object.assign({}, curator, { expr_confirmed: 'commentator' });
  const fixed = JSON.stringify((await G.generateSkeleton(advisor, corrected, 'registered')).payload);
  ok('a correction reaches the generator',
    /perspective, interpretation/.test(fixed),
    'the confirmed profile, not the derived one');
  ok('and the superseded read does NOT',
    !/They are a Curator/.test(fixed),
    'showing a campaign built on a read the advisor rejected would be a lie about what it stands on');

  ok('no consumer data slipped in with the new fields',
    !/consumer_|journey_share/.test(withP),
    'the payload assertion has to survive every new field');

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
