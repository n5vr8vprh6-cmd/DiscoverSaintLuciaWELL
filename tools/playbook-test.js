/* ============================================================================
   playbook-test.js — the marketing playbook, the critique pass, the angles
   ----------------------------------------------------------------------------
     node tools/playbook-test.js

   Stubbed, so it costs nothing. Three things carry D1:

     THE PLAYBOOK REACHES THE PROMPT. Not the whole playbook — the one channel
     that matters, because a model given advice about ten channels writes for
     none of them.

     THE CRITIQUE PASS CANNOT MAKE THINGS WORSE. Every failure path has to
     return the original draft. A pass that can silently damage copy is worse
     than no pass, because the damage arrives looking like an improvement.

     NEVER_PROMISE SURVIVES EVERYTHING. It is the one list in the playbook that
     research must not be able to delete, because it is what stops a buyer's
     pain becoming a health promise.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

process.env.OPENAI_STUB = '1';

const P = require('../content/marketing-playbook.js');
const G = require('../api/_lib/gtm-generate.js');
const { improve, MAX_GROWTH } = require('../api/_lib/critique.js');
const { check } = require('../api/_lib/claims.js');

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };

const ADVISOR = { first_name: 'Mira', last_name: 'Hall', business: 'Hall & Co Travel', public_code: 'TESTCODE' };
const PROFILE = { positioning: 'Slow trips', icp: 'Couples in their forties', instagram: '@hallco' };
const ACTION = { week: 1, position: 0, title: 'Post once', why: 'signal the focus', channel: 'instagram', assetKind: 'caption' };

(async () => {
  console.log('\n  MARKETING PLAYBOOK\n  ' + '─'.repeat(60) + '\n');

  /* ══ The bank itself ═══════════════════════════════════════════════════ */
  console.log('  The playbook');
  ok('channels are loaded', P.channels.length >= 9, String(P.channels.length));
  ok('every channel has the fields the prompt renders',
    P.channels.every((c) => c.channel && Array.isArray(c.anatomy) &&
      Array.isArray(c.converts) && Array.isArray(c.kills)),
    JSON.stringify(P.channels.filter((c) => !c.converts || !c.kills).map((c) => c.channel)));
  ok('every channel says where it came from',
    P.channels.every((c) => c.source === 'seed' || c.source === 'field-guide'),
    'a seed masquerading as research is the failure worth engineering against');
  ok('every hook explains itself',
    P.channels.every((c) => (c.hooks || []).every((h) => h.pattern && h.why)),
    'a pattern without its reason gets copied badly');
  ok('lengths are numbers, not prose',
    P.channels.every((c) => !c.lengths || typeof c.lengths.max === 'number'));

  console.log('\n  The ICP layer');
  ['pains', 'triggers', 'objections', 'tried'].forEach((k) => {
    ok(`${k} is populated`, Array.isArray(P.icp[k]) && P.icp[k].length > 0);
  });
  ok('NEVER_PROMISE exists and is not empty', (P.icp.NEVER_PROMISE || []).length > 0,
    'the rail that stops a pain becoming a health promise');
  ok('and it forbids the health register explicitly',
    /heal|treat|restore|repair/i.test(P.icp.NEVER_PROMISE.join(' ')));

  /* ══ Lookup ════════════════════════════════════════════════════════════ */
  console.log('\n  Finding the right page');
  ok('channel wins when it exists', G.playbookFor('instagram', 'caption').channel === 'instagram');
  ok('kind is the fallback', G.playbookFor('direct', 'dm').channel === 'dm',
    'a skeleton says channel "direct" with kind "dm" — the shape is the useful key there');
  ok('newsletter beats email when both could match',
    G.playbookFor('newsletter', 'email').channel === 'newsletter');
  ok('neither matching returns null, not a default',
    G.playbookFor('carrier-pigeon', 'semaphore') === null,
    'a wrong page is worse than no page');

  /* ══ What reaches the model ════════════════════════════════════════════ */
  console.log('\n  What reaches the model');
  const block = G.playbookBlock('instagram', 'caption');
  ok('the block names the channel', /instagram/.test(block));
  ok('it carries what converts', /WHAT MAKES IT WORK/.test(block));
  ok('and what kills it', /WHAT KILLS IT/.test(block));
  ok('it is a fraction of the whole playbook',
    block.length < JSON.stringify(P).length / 3,
    block.length + ' vs ' + JSON.stringify(P).length);
  ok('an unknown channel sends nothing rather than everything',
    G.playbookBlock('carrier-pigeon', 'semaphore') === '');

  const icp = G.icpBlock();
  ok('the ICP block carries the pains', /What is actually wrong for them/.test(icp));
  ok('and carries NEVER_PROMISE with them, always',
    /NEVER, WHATEVER THE PLAYBOOK SAYS/.test(icp),
    'the pains and the rail must travel together or the pains are an invitation');

  const asset = await G.generateAsset(ADVISOR, PROFILE, 'registered', ACTION, 'The warm list');
  const wire = JSON.stringify(asset.payload);
  ok('the composed prompt carries the channel playbook', /WHAT KILLS IT/.test(wire));
  ok('and the ICP', /WHO YOU ARE WRITING FOR/.test(wire));
  ok('and still carries the claim rules', /RULES — THESE OUTRANK/.test(wire));
  ok('and still no consumer data could reach it',
    !/consumer_|journey_share/.test(wire),
    'the payload assertion must survive every new field');

  /* ══ The Bible extract ═════════════════════════════════════════════════ */
  console.log('\n  The Strategist Bible extract');
  ok('the edition is recorded', /Strategist Bible/.test(P.provenance.edition || ''),
    String(P.provenance.edition));
  ok('the 48 micro-patterns are loaded', P.patterns.length === 48, String(P.patterns.length));
  ok('every pattern has a name, a formula and a job',
    P.patterns.every((p) => p.name && p.formula && p.job),
    JSON.stringify(P.patterns.filter((p) => !p.name || !p.formula || !p.job)));
  ok('pattern names are unique',
    new Set(P.patterns.map((p) => p.name.toLowerCase())).size === P.patterns.length,
    'a duplicate name makes patternByName ambiguous');
  ok('the six channel jobs are loaded', (P.channelJobs || []).length === 6);
  ok('the ICP came from the field guide, not the seed', P.icp.source === 'field-guide');
  ok('the need-state dimensions came with it', (P.icp.needStateDimensions || []).length >= 8);
  ok('and the safer-language pairs', (P.icp.saferLanguage || []).length > 0,
    'a rule that only forbids produces copy that says nothing');
  ok('every safer-language pair gives the sentence that IS allowed',
    (P.icp.saferLanguage || []).every((s) => s.instead && s.say));

  /* THE MERGE BUG. A channel researched but absent from the seed was silently
     dropped — `youtube` vanished and the counts still looked right. The only
     symptom was a channel that never appeared in a prompt. */
  ok('a researched channel with no seed entry survives the merge',
    P.channels.some((c) => c.channel === 'youtube'),
    'youtube is in the field guide and not in the seed — it was being discarded');
  ok('and the seed-only channels are still there',
    ['dm', 'sms', 'script', 'outline'].every((n) => P.channels.some((c) => c.channel === n)),
    'partial research must upgrade what it covers and leave the rest');
  ok('researched channels carry their job', P.channels
    .filter((c) => c.source === 'field-guide').every((c) => c.job),
    'a channel without a defined job does not belong in a campaign');

  /* ══ Pattern selection ═════════════════════════════════════════════════
     Selection before generation. The skeleton picks, the asset executes. */
  console.log('\n  Pattern selection happens before generation');
  ok('a name resolves', G.patternByName('Common mistake').job === 'risk');
  ok('case does not matter', G.patternByName('COMMON MISTAKE') !== null);
  ok('an invented name resolves to null, not to the first entry',
    G.patternByName('The Amazing Hook Formula') === null,
    'a model asked to pick from a list will sometimes invent a plausible entry');

  const shaped = G.normaliseSkeleton({ weeks: [{ week: 1, actions: [
    { title: 'a', assetKind: 'caption', pattern: 'Common mistake' },
    { title: 'b', assetKind: 'caption', pattern: 'Totally Invented' },
    { title: 'c', assetKind: 'caption' }
  ] }] });
  ok('a real pattern survives normalisation',
    shaped.weeks[0].actions[0].pattern === 'Common mistake');
  ok('an invented one is dropped to null',
    shaped.weeks[0].actions[1].pattern === null,
    'an invented pattern reaches the asset prompt as an instruction nobody wrote');
  ok('a missing one is null rather than undefined',
    shaped.weeks[0].actions[2].pattern === null);

  const skel = await G.generateSkeleton(ADVISOR, PROFILE, 'registered');
  const skelWire = JSON.stringify(skel.payload);
  ok('the skeleton prompt carries the pattern library', /RECOGNITION/.test(skelWire) &&
    /Common mistake/.test(skelWire));
  ok('and tells it not to repeat a pattern within a week',
    /not to use the same pattern twice|same pattern twice/i.test(skelWire));

  const withPattern = await G.generateAsset(ADVISOR, PROFILE, 'registered',
    Object.assign({}, ACTION, { pattern: 'Common mistake' }), 'T', { critique: false });
  ok('the asset prompt carries the chosen pattern and its formula',
    /THE PATTERN THIS PIECE MUST FOLLOW/.test(JSON.stringify(withPattern.payload)) &&
    /The mistake I see/.test(JSON.stringify(withPattern.payload)));
  ok('and tells it not to quote the formula back',
    /do not quote the formula/i.test(JSON.stringify(withPattern.payload)));

  const noPattern = await G.generateAsset(ADVISOR, PROFILE, 'registered', ACTION, 'T', { critique: false });
  ok('an action with no pattern gets no pattern section',
    !/THE PATTERN THIS PIECE MUST FOLLOW/.test(JSON.stringify(noPattern.payload)),
    'it falls back to the channel hooks rather than inventing a shape');

  /* ══ Angles ════════════════════════════════════════════════════════════ */
  console.log('\n  Angles');
  ok('four are defined', Object.keys(G.ANGLES).length === 4);
  const withAngle = await G.generateAsset(ADVISOR, PROFILE, 'registered', ACTION, 'T', { angle: 'pain' });
  ok('an angle reaches the prompt',
    /Lead with what is actually wrong/.test(JSON.stringify(withAngle.payload)));
  ok('and comes back on the asset', withAngle.angle === 'pain');
  const noAngle = await G.generateAsset(ADVISOR, PROFILE, 'registered', ACTION, 'T');
  ok('no angle means no angle instruction',
    !/THE ANGLE FOR THIS VERSION/.test(JSON.stringify(noAngle.payload)),
    'a first generation has no angle because nobody has seen it yet');
  ok('and the asset says so', noAngle.angle === null);

  /* ══ The critique pass ═════════════════════════════════════════════════
     Every assertion here is about a way it could quietly damage copy. */
  console.log('\n  The critique pass cannot make things worse');
  const draft = 'Come and see Saint Lucia. It is lovely. {{WELL_LINK}}';

  const clean = await improve({ body: draft, channel: 'instagram', kind: 'caption',
    playbook: G.playbookFor('instagram', 'caption') });
  ok('a normal pass returns copy', clean.ok && clean.body.length > 0, clean.reason);
  ok('it reports whether it changed anything', typeof clean.changed === 'boolean');
  ok('the score is a number and is never rendered anywhere',
    typeof clean.score === 'number' || clean.score === null);

  ok('empty input is refused rather than "improved"',
    (await improve({ body: '   ' })).ok === false);

  /* The guards, driven directly rather than through a model.

     `from` matters. An empty rewrite against a draft that HAS a link token is
     caught by the LINK guard, not the empty guard — so testing the empty guard
     with the default draft silently proves the wrong thing. Sabotage found
     exactly that: removing the empty check left the suite green. */
  const stubbed = async (rewrite, from) => {
    const saved = process.env.OPENAI_STUB;
    /* Force a specific rewrite by overriding the stub the module would use. */
    const openai = require('../api/_lib/openai.js');
    const realChat = openai.chat;
    openai.chat = async () => ({ ok: true, text: JSON.stringify({ score: 9, worst: 'x', rewrite }), ms: 1, usage: null, payload: {} });
    /* critique.js resolves `chat` at require time, so re-require it fresh. */
    delete require.cache[require.resolve('../api/_lib/critique.js')];
    const fresh = require('../api/_lib/critique.js');
    const out = await fresh.improve({ body: from || draft, channel: 'instagram', kind: 'caption' });
    openai.chat = realChat;
    delete require.cache[require.resolve('../api/_lib/critique.js')];
    process.env.OPENAI_STUB = saved;
    return out;
  };

  ok('a rewrite that LOSES the link token is rejected',
    (await stubbed('Come and see Saint Lucia. It is lovely.')).ok === false,
    'a caption with no link is the one thing every asset exists to carry');
  ok('a rewrite that ADDS a link token is rejected',
    (await stubbed('See it. {{WELL_LINK}} And again {{WELL_LINK}}')).ok === false,
    'it would put a link somewhere the plan never intended');
  ok('a rewrite that balloons is rejected',
    (await stubbed('x '.repeat(200) + '{{WELL_LINK}}')).ok === false,
    'past ' + MAX_GROWTH + '× it is a different piece of copy, not an edit');
  const NO_TOKEN = 'Come and see Saint Lucia. It is lovely.';
  const emptied = await stubbed('   ', NO_TOKEN);
  ok('an empty rewrite is rejected — on its own merits',
    emptied.ok === false && emptied.reason === 'empty_rewrite',
    'reason was "' + emptied.reason + '"; link_token_changed means the wrong guard fired');
  ok('but a genuine improvement is accepted',
    (await stubbed('Saint Lucia, slowly. {{WELL_LINK}}')).ok === true,
    'if every path rejected, the four assertions above would pass for the wrong reason');

  /* ══ The checker still runs on the FINAL text ══════════════════════════ */
  console.log('\n  The checker runs after the rewrite, not before');
  const bad = await stubbed('Ten days here reduces burnout. {{WELL_LINK}}');
  ok('the critique pass itself does not judge claims', bad.ok === true,
    'it is an editor, not the control');
  const verdict = check(bad.body, 'registered');
  ok('but claims.js catches what it let through', verdict.copyable === false,
    'the rewrite is more surface for a health claim than the draft was');

  /* THE ASSERTION THAT WAS MISSING ENTIRELY. Nothing tested that generateAsset
     runs the checker on what a model produced — "it carries a verdict" and "the
     stub copy is clean" both survive a checker replaced with something
     permissive, which sabotage duly demonstrated by doing precisely that.
     So: make the model emit a health claim and require the block. */
  const openai = require('../api/_lib/openai.js');
  const realChat = openai.chat;
  openai.chat = async () => ({
    ok: true, ms: 1, usage: null, payload: {},
    text: 'Ten days in Saint Lucia reduces burnout and lowers your cortisol. {{WELL_LINK}}'
  });
  delete require.cache[require.resolve('../api/_lib/gtm-generate.js')];
  const G2 = require('../api/_lib/gtm-generate.js');
  const poisoned = await G2.generateAsset(ADVISOR, PROFILE, 'registered', ACTION, 'T', { critique: false });
  openai.chat = realChat;
  delete require.cache[require.resolve('../api/_lib/gtm-generate.js')];

  ok('GENERATED copy carrying a health claim comes back high',
    poisoned.severity === 'high', String(poisoned.severity));
  ok('and is not copyable', poisoned.copyable === false,
    'a checker that only runs on edits is a checker that does not run');

  /* ══ The generated file is current ═════════════════════════════════════ */
  console.log('\n  The extract is current');
  let checkOk = true;
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'build-marketing-playbook.js'), '--check'],
      { stdio: 'pipe' });
  } catch (e) { checkOk = false; }
  ok('marketing-playbook.js matches its source', checkOk,
    'run: node tools/build-marketing-playbook.js — then read the diff');

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('\n  CRASHED — ' + (e && e.message || e) + '\n');
  process.exit(1);
});
