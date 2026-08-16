/* ============================================================================
   brief-test.js — the parser, the inventory, and the citation contract
   ----------------------------------------------------------------------------
     node tools/brief-test.js

   THE FINDING THIS FILE PROTECTS. Six approaches were tried to make generated
   copy use an advisor's own details. Five failed: three prompt variants, a
   stronger model, a structured persona, and an explicit instruction. The sixth
   worked — an addressable brief, a citation per action, and the cited item
   handed to the asset in full.

   The proof was a contrast in one run: an asset citing CLIENTS 1 opened "how
   long it's been since you both had a week off together — 2019 feels like a
   lifetime ago", while an uncited asset in the same run opened "wellness travel
   means slowing down and savoring the journey".

   So the things asserted here are the load-bearing ones: that a partial brief
   is refused rather than half-accepted, that an invented citation cannot pass,
   and that a cited item reaches the asset prompt in full. If the last one
   breaks, generation silently returns to the generic output of five failed
   attempts, and every structural measure would still look right.
   ========================================================================== */
'use strict';

process.env.OPENAI_STUB = '1';

const B = require('../api/_lib/brief.js');
const G = require('../api/_lib/gtm-generate.js');
const { intakePrompt } = require('../api/_lib/gtm.js');

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };

const GOOD = [
  '## VOICE',
  'tone: warm, direct, unhurried',
  'avoid: exclamation marks, the word amazing',
  'signature: opens with the client situation, never the destination',
  '',
  '## CLIENTS',
  '- who: Two lawyers, both partners at the same firm',
  '  situation: had not taken a week off together since 2019',
  '  wanted: somewhere neither of them had to organise anything',
  '- who: A surgeon and a teacher, married 25 years',
  '  situation: youngest just left for university',
  '  wanted: to find out what they still talk about',
  '',
  '## MARKETS',
  '- Toronto — most clients within a 40-minute drive',
  '- Hamilton',
  '',
  '## OBJECTIONS',
  '- We can book this ourselves → they will lose a Saturday to it',
  '- Worth it for five days? → a readiness question dressed as a value one',
  '',
  '## PROOF',
  '- Been to Saint Lucia twice; walked the Tet Paul trail'
].join('\n');

console.log('\n  CAMPAIGN BRIEF\n  ' + '─'.repeat(60) + '\n');

/* ══ Parsing what an advisor pastes ══════════════════════════════════════ */
console.log('  A well-formed brief');
const good = B.parse(GOOD);
ok('parses', good.ok, JSON.stringify(good.missing || good.thin));
ok('voice comes back as fields', good.brief.VOICE.tone === 'warm, direct, unhurried');
ok('clients come back as items with their parts',
  good.brief.CLIENTS.length === 2 &&
  /Two lawyers/.test(good.brief.CLIENTS[0].who) &&
  /2019/.test(good.brief.CLIENTS[0].situation));
ok('lists come back as lists', good.brief.MARKETS.length === 2 && good.brief.PROOF.length === 1);
ok('an optional section may be absent', !good.brief.ANGLES);

console.log('\n  What a chat window does to text');
ok('a code fence around the whole thing is stripped',
  B.parse('```\n' + GOOD + '\n```').ok);
ok('smart quotes survive', B.parse(GOOD.replace(/"/g, '“')).ok);
ok('bullet characters survive', B.parse(GOOD.replace(/^- /gm, '• ')).ok);
ok('reordered sections survive', B.parse(GOOD.split('\n\n').reverse().join('\n\n')).ok,
  'an advisor pasting in a different order has done nothing wrong');
ok('extra indentation survives', B.parse(GOOD.replace(/^/gm, '  ')).ok);

/* ══ IT FAILS LOUDLY ═════════════════════════════════════════════════════
   The half-accepted brief is the dangerous one: it produces a campaign nobody
   can explain, and nothing about it looks broken. */
console.log('\n  A partial brief is refused, and says what is wrong');

const truncated = B.parse(GOOD.split('## OBJECTIONS')[0]);
ok('a truncated paste is refused', !truncated.ok);
ok('and names BOTH missing sections',
  truncated.missing.indexOf('OBJECTIONS') !== -1 && truncated.missing.indexOf('PROOF') !== -1,
  JSON.stringify(truncated.missing));
ok('the message tells an advisor what to go and ask for',
  /OBJECTIONS and PROOF/.test(B.explain(truncated)), B.explain(truncated));

const oneClient = B.parse(GOOD.replace(
  '- who: A surgeon and a teacher, married 25 years\n  situation: youngest just left for university\n  wanted: to find out what they still talk about', ''));
ok('one client vignette is too thin', !oneClient.ok);
ok('and it says how short', /CLIENTS \(1 of 2\)/.test(JSON.stringify(oneClient.thin)),
  'one is a coincidence; two is a pattern a plan can write toward');

ok('empty input is refused', !B.parse('').ok);
ok('and says so plainly', B.explain(B.parse('')) === 'Nothing was pasted.');
ok('prose instead of the format is refused',
  !B.parse('Mira is a warm advisor in Toronto who works with couples.').ok,
  'this is the failure the whole format exists to prevent');

/* ══ The inventory ═══════════════════════════════════════════════════════ */
console.log('\n  The inventory the generator sees');
const block = B.briefBlock(good.brief);
ok('items are numbered', /CLIENTS 1: Two lawyers/.test(block));
ok('a client item is rendered whole', /2019/.test(block) && /organise anything/.test(block));
ok('it tells the generator to cite by number', /USE THESE BY NUMBER/.test(block));
/* \s+ rather than a literal space: the sentence wraps in the source, and an
   assertion that breaks on a line break tests the formatting, not the text. */
ok('and says why it matters', /could\s+appear in anyone/.test(block));
ok('no brief produces no block', B.briefBlock(null) === '',
  'an empty heading invites a model to fill it in');

console.log('\n  Citations');
ok('every item is citable',
  B.citations(good.brief).length === 2 + 2 + 2 + 1, B.citations(good.brief).join(', '));

/* Tolerant on the way in — a model writes CLIENT 2 when it means one of the
   CLIENTS — strict about whether the item exists. */
[['CLIENTS 2', 'CLIENTS 2'], ['CLIENT 2', 'CLIENTS 2'], ['client 2', 'CLIENTS 2'],
 ['Client #2', 'CLIENTS 2'], ['CLIENTS2', 'CLIENTS 2'], ['MARKET 1', 'MARKETS 1']]
  .forEach(([given, want]) => {
    ok(`"${given}" resolves to ${want}`, B.validCitation(good.brief, given) === want);
  });

ok('an INVENTED citation is rejected', B.validCitation(good.brief, 'CLIENTS 9') === null,
  'a fabricated citation would look exactly like the specificity we are trying to measure');
ok('so is nonsense', B.validCitation(good.brief, 'the second one') === null);
ok('and so is nothing', B.validCitation(good.brief, '') === null);

/* ══ It has to reach the asset ═══════════════════════════════════════════
   THE ONE THAT MATTERS. The skeleton citing an item changes nothing on its
   own; the specificity appears because the ASSET is handed the cited item in
   full. Break this and generation silently returns to generic copy. */
(async () => {
  console.log('\n  The cited item reaches the copy writer');
  const advisor = { first_name: 'Mira', business: 'Hall & Co', public_code: 'X' };
  const profile = { instagram: '@x', expr_primary: 'curator', brief_parsed: good.brief };
  const action = { week: 1, position: 0, title: 't', why: 'w', channel: 'direct', assetKind: 'dm' };

  const cited = await G.generateAsset(advisor, profile, 'registered',
    Object.assign({}, action, { uses: 'CLIENTS 1' }), 'T', { critique: false });
  const wire = JSON.stringify(cited.payload);

  ok('the asset prompt carries the cited person IN FULL',
    /Two lawyers, both partners/.test(wire) && /2019/.test(wire),
    'a label with no content reproduces the original failure one layer down');
  ok('and tells it to write to them', /Write it to THEM/.test(wire));
  ok('and not to generalise it back', /Do not generalise it back/.test(wire));

  const uncited = await G.generateAsset(advisor, profile, 'registered', action, 'T', { critique: false });
  ok('an uncited asset gets no such block',
    !/THIS PIECE IS FOR A SPECIFIC/.test(JSON.stringify(uncited.payload)));

  const bogus = await G.generateAsset(advisor, profile, 'registered',
    Object.assign({}, action, { uses: 'CLIENTS 9' }), 'T', { critique: false });
  ok('an invented citation gets no block either',
    !/THIS PIECE IS FOR A SPECIFIC/.test(JSON.stringify(bogus.payload)),
    'better no specifics than fabricated ones');

  console.log('\n  The skeleton asks for citations and validates them');
  const sk = await G.generateSkeleton(advisor, profile, 'registered');
  const prompt = sk.payload.messages[1].content;
  ok('the prompt carries the inventory', /THINGS ONLY THIS ADVISOR KNOWS/.test(prompt));
  ok('and asks for a uses field', /"uses"/.test(prompt));

  const shaped = G.normaliseSkeleton({ weeks: [{ week: 1, actions: [
    { title: 'a', assetKind: 'caption', uses: 'CLIENTS 2' },
    { title: 'b', assetKind: 'caption', uses: 'CLIENTS 9' },
    { title: 'c', assetKind: 'caption', uses: 'client 1' },
    { title: 'd', assetKind: 'caption' }
  ] }] }, good.brief);
  const uses = shaped.weeks[0].actions.map((a) => a.uses);
  ok('a real citation survives', uses[0] === 'CLIENTS 2');
  ok('an invented one becomes null', uses[1] === null);
  ok('a singular one is accepted and normalised', uses[2] === 'CLIENTS 1');
  ok('a missing one is null rather than undefined', uses[3] === null);
  ok('with no brief, nothing is cited',
    G.normaliseSkeleton({ weeks: [{ week: 1, actions: [{ title: 'a', uses: 'CLIENTS 1' }] }] })
      .weeks[0].actions[0].uses === null,
    'a citation against a brief that does not exist is not a citation');

  /* ══ The prompt asks for the shape the parser reads ════════════════════ */
  console.log('\n  The prompt and the parser agree');
  const p = intakePrompt({ first_name: 'Mira', business: 'Hall & Co' }, {});
  B.SECTIONS.filter((s) => s.required).forEach((s) => {
    ok(`the prompt asks for ## ${s.key}`, new RegExp('##\\s*' + s.key).test(p),
      'a section the parser requires and the prompt never mentions is a guaranteed rejection');
  });
  ok('it demands two client examples', /TWO CLIENT EXAMPLES IS THE MINIMUM/.test(p),
    'the parser refuses one, so the prompt has to say so');
  ok('it explains why the shape matters', /gets read as background/.test(p));
  ok('it still forbids inventing', /Do not invent anything/i.test(p));
  ok('and still bans health claims', /No health or medical claims/i.test(p));

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
