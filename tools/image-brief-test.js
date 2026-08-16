/* ============================================================================
   image-brief-test.js — shot lists that cannot invent Saint Lucia
   ----------------------------------------------------------------------------
     node tools/image-brief-test.js

   THE THREE THINGS THIS FILE EXISTS TO HOLD.

   1. NO PICTURE IS EVER SHIPPED OR NAMED AS OURS. Not a generated one, not a
      property's, not a stock beach captioned as Saint Lucia. Each is a false
      claim about a real place or a use of somebody else's work, and the
      product must not produce a path to any of them.

   2. NO BRIEF ASKS THE ADVISOR TO PHOTOGRAPH SAINT LUCIA. Most of them have
      never been. A brief that asks for the destination gets either nothing or
      a lifted image, so every shot has to be takeable at home. This is the
      constraint that will erode first, because destination shots read better
      on paper.

   3. THE KEEP-OUT LIST IS A CONTROL. claims.js reads text and cannot read a
      photograph, so a treatment table shot like a clinic makes a health claim
      that nothing else in this codebase can catch. If that line goes, the
      product loses its only defence against an entire class of claim.
   ========================================================================== */
'use strict';

const { imageBrief, isVisual, RIGHTS_NOTE, SHOTS, FRAMES } = require('../api/_lib/image-brief.js');

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };

const act = (o) => Object.assign({ channel: 'instagram', assetKind: 'caption', week: 1, position: 1 }, o);
const prof = (o) => Object.assign({ compass_needs: ['restore', 'reconnect'], traveller_orientation: 'primary' }, o);

console.log('\n  IMAGE BRIEFS\n  ' + '─'.repeat(60) + '\n');

/* ══ Which assets get one ════════════════════════════════════════════════ */
console.log('  Only the assets a picture actually goes with');
ok('an Instagram caption gets one', imageBrief(act(), prof()) !== null);
ok('so does TikTok', imageBrief(act({ channel: 'tiktok', assetKind: 'script' }), prof()) !== null);
ok('an email does NOT', imageBrief(act({ channel: 'email', assetKind: 'email' }), prof()) === null,
  'most clients block images and a header picture is not what makes an email work');
ok('nor does an SMS', imageBrief(act({ channel: 'sms', assetKind: 'sms' }), prof()) === null);
ok('nor a "call two clients" action with no asset',
  imageBrief(act({ assetKind: 'none' }), prof()) === null);
ok('null action is survivable', imageBrief(null, prof()) === null);
ok('null profile is survivable', imageBrief(act(), null) !== null,
  'an advisor with no persona still has to post a picture');

/* ══ GUARD 1 — nothing is ever handed over ═══════════════════════════════ */
console.log('\n  It never offers a picture, only instructions');
const all = [];
['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube'].forEach((channel) => {
  [1, 2, 3, 4].forEach((week) => [1, 2, 3].forEach((position) => {
    const b = imageBrief(act({ channel, week, position }), prof({
      compass_needs: ['restore', 'reconnect', 'move', 'celebrate'] }));
    if (b) all.push(b);
  }));
});
ok('sixty briefs generated to check against', all.length === 60, String(all.length));

const text = (b) => [b.shot, b.light, b.instead].concat(b.avoid).join(' ');
const corpus = all.map(text).join('\n');

ok('no brief offers a download', !/download|\.jpg|\.png|attached|zip/i.test(corpus),
  'there is no rights-clean image to attach, so there must be no button implying there is');
ok('no brief tells anybody to generate one',
  !/midjourney|dall|stable diffusion|generate an image|AI image/i.test(corpus),
  'a generated Pitons is a photograph of a mountain that does not exist');

/* ══ GUARD 2 — shootable where the advisor actually is ═══════════════════ */
console.log('\n  Every shot is takeable at home, not in Saint Lucia');
const PLACES = /\b(Pitons?|Soufri[eè]re|Castries|Rodney Bay|Marigot|Anse|Jade Mountain|Sugar Beach|Viceroy|Ladera)\b/i;
ok('no shot names a Saint Lucia place or property',
  !all.some((b) => PLACES.test(b.shot)),
  'an advisor in Toronto cannot photograph the Pitons, so asking produces either nothing or a lifted image');

const DESTINATION = /\b(beach|ocean|sea|palm|rainforest|resort|poolside|infinity pool|sunset over)\b/i;
ok('and no shot needs a destination at all',
  !all.some((b) => DESTINATION.test(b.shot)),
  'the reason somebody books is what they want to feel, and that is photographable in a kitchen');

/* Every shot in the vocabulary, not just the ones the rotation reached. */
const everyShot = Object.keys(SHOTS).reduce((a, k) => a.concat(SHOTS[k]), []);
ok('the whole shot vocabulary is home-shootable',
  !everyShot.some((s) => PLACES.test(s) || DESTINATION.test(s)),
  'asserted against the source list, not just the ones this run happened to pick');
/* NOBODY IS RECOGNISABLE IN ANY OF THEM. A client in a marketing photograph
   is a person with a say in it, and the way a brief avoids having to ask is
   by cropping. Two separate checks, because they fail differently.

   The first version of this grepped for /\bface\b/ and flagged "A phone
   face-down on a table" — a phone, not a person. Testing for the body part
   and the crop that goes with it is the thing actually meant. */
const BODY = /\b(hands?|shoulders?|wrists?|neck|arms?|legs?|feet)\b/i;
const CROP = /cropped|no faces?\b|nobody/i;
ok('any shot naming a body part also says where to crop',
  everyShot.filter((s) => BODY.test(s)).every((s) => CROP.test(s)),
  everyShot.filter((s) => BODY.test(s) && !CROP.test(s)).join(' | '));
ok('and none asks for a recognisable person at all',
  !everyShot.some((s) => /\b(a (man|woman|person|client|couple)|models?|portrait|selfie|smiling)\b/i.test(s)),
  'the moment a brief asks for a person, it has asked the advisor for a permission they will not get');

/* ══ GUARD 3 — the keep-out list is a control ════════════════════════════ */
console.log('\n  The keep-out list, which is the only check on a picture');
const b1 = imageBrief(act(), prof());
ok('consent is named', b1.avoid.some((x) => /said yes in writing|permission/i.test(x)),
  'a client in a marketing photograph is a person with a say in it');
ok('rights are named', b1.avoid.some((x) => /you did not take|belong to whoever/i.test(x)));
ok('IMPLIED HEALTH CLAIMS are named',
  b1.avoid.some((x) => /medical|clinic|before-and-after/i.test(x)),
  'claims.js reads text; a treatment table shot like a clinic makes a claim nothing here can catch');
ok('and it says so plainly', b1.avoid.some((x) => /nothing checks it for you/i.test(x)),
  'the advisor is the only control at that point and should know it');

ok('every brief carries all three, on every channel',
  all.every((b) => b.avoid.some((x) => /permission|said yes/i.test(x)) &&
                   b.avoid.some((x) => /did not take/i.test(x)) &&
                   b.avoid.some((x) => /medical/i.test(x))),
  'a control that appears on some assets is not a control');

/* ══ Useful, not just safe ═══════════════════════════════════════════════ */
console.log('\n  It is specific enough to act on');
ok('the frame is a ratio and a pixel size', /^\d+:\d+$/.test(b1.frame.ratio) && /\d+ × \d+/.test(b1.frame.px));
ok('every visual channel has a frame',
  Object.keys(FRAMES).every((c) => imageBrief(act({ channel: c }), prof()).frame),
  'a brief with no frame is a brief somebody has to guess at');
ok('there is a light note', b1.light.length > 20);
ok('and a way out when there is no picture', /text card|one line of the caption/i.test(b1.instead),
  'the fallback has to beat not posting, which is what actually happens otherwise');

/* THE ROTATION. Four weeks asking for the same photograph is a plan that gets
   one picture taken. */
console.log('\n  It does not ask for the same photograph four times');
const p2 = prof({ compass_needs: ['restore', 'reconnect'] });
const acrossWeeks = [1, 2, 3, 4].map((week) => imageBrief(act({ week }), p2).shot);
ok('four weeks produce more than one shot', new Set(acrossWeeks).size > 1,
  JSON.stringify(acrossWeeks.map((s) => s.slice(0, 24))));
ok('two assets in the same week differ',
  imageBrief(act({ week: 2, position: 1 }), p2).shot !== imageBrief(act({ week: 2, position: 2 }), p2).shot);
ok('it is deterministic — same asset, same brief',
  imageBrief(act({ week: 3, position: 2 }), p2).shot === imageBrief(act({ week: 3, position: 2 }), p2).shot,
  'a shot list that changes on refresh is one nobody can go and shoot tomorrow');

/* The persona reaches it. */
console.log('\n  The persona changes the picture');
ok('the Compass need picks the shot',
  imageBrief(act(), prof({ compass_needs: ['celebrate'] })).shot !==
  imageBrief(act(), prof({ compass_needs: ['restore'] })).shot,
  'a plan for people who need Restore should not ask for clinking glasses');
ok('the traveller orientation sets the light',
  imageBrief(act(), prof({ traveller_orientation: 'sceptical' })).light !==
  imageBrief(act(), prof({ traveller_orientation: 'primary' })).light,
  'anything art-directed reads as an advert to somebody already braced for one');
ok('no persona still gives a usable brief',
  imageBrief(act(), {}).shot.length > 20 && imageBrief(act(), {}).need === null,
  'and says it had nothing to go on rather than inventing a need');

/* ══ The rights note ═════════════════════════════════════════════════════ */
console.log('\n  The note that explains why');
ok('it says these are shot lists, not pictures', /shot lists, not pictures/i.test(RIGHTS_NOTE));
ok('it gives the real reason', /not ours\s+to give away|properties/i.test(RIGHTS_NOTE),
  '"not available" invites a feature request; the actual reason ends the conversation');
ok('it names the legitimate route', /ask the property or the tourism board/i.test(RIGHTS_NOTE),
  'a refusal with no next step is just a wall');
ok('it does not sound like an apology', !/unfortunately|sorry|limitation|cannot offer/i.test(RIGHTS_NOTE),
  'this is a correct decision, not a shortfall');

console.log('\n  ' + '─'.repeat(60));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
