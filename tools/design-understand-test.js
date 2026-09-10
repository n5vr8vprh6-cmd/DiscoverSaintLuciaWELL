#!/usr/bin/env node
/* ============================================================================
   design-understand-test — the conversation renders what the row says
   ----------------------------------------------------------------------------
   The Understand stage is pure: everything it needs arrives in v. So it can be
   rendered here with a stored row and read back — the three bands, the client's
   own words quoted first, the field names hub-design.js posts, the notes, the
   floor, the whisper, the read-back, the fallbacks before 024 and 025, and the
   absence of anything Present-mode or third-person.

   Run: node tools/design-understand-test.js
   ========================================================================== */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const U = require(path.join(ROOT, 'api', '_lib', 'hub-screens', 'design-understand.js'));
const N = require(path.join(ROOT, 'api', '_lib', 'need-state.js'));
const D = require(path.join(ROOT, 'api', '_lib', 'design-data.js'));
const M = require(path.join(ROOT, 'api', '_lib', 'design-match.js'));
const K = require(path.join(ROOT, 'api', '_lib', 'well-knowledge.js'));

let fails = 0, n = 0;
const ok = (label, cond, detail) => { n++; if (cond) console.log('  ok    ' + label); else { fails++; console.log('  FAIL  ' + label + (detail ? '\n        ' + String(detail).slice(0, 300) : '')); } };
const count = (s, re) => (s.match(re) || []).length;
const text = (s) => s.replace(/<[^>]+>/g, '');

(async () => {
  console.log('\n  UNDERSTAND — the conversation');
  console.log('  ' + '-'.repeat(62));
  const answers = { intention: 'reflect', place: 'rainforest', companions: 'family', orientation: 'balance', pace: 'gentle', recognition: 'yes' };
  const seeded = await N.seedFrom(answers);
  const vocab = await N.vocabulary();
  const row = {
    current_states: seeded.current, desired_states: seeded.desired, village_weights: seeded.villages, compass_weights: seeded.compass,
    trigger: 'life-transition', uncertainty: 'value', triggers: ['life-transition', 'accumulated-fatigue'], uncertainties: ['value', 'food', 'other'],
    readiness: 'comparing', party: 'family', orientation: seeded.orientation, budget: 'premium', budget_usd: 18000, mobility: null,
    in_their_words: 'ZZLEGACY', notes: { told: 'ZZTOLD mornings are the worst', why: 'ZZWHY the year has emptied me out', hesitate: 'ZZHES her husband', around: 'ZZAROUND coeliac' },
    continuum_floor: seeded.continuumFloor, continuum_ceiling: seeded.continuumCeiling,
    rhythm: seeded.rhythm, activity: 0.2, social: seeded.social, experience: 0.3, adults: 2, children: 1, rooms: 1, nights: 7,
    pillar_weights: { nature: 1, food: 1, mind: 1 },
    constraints: ['dietary', 'dates', 'other'], travel_from: '2027-02-01', advisor_overrode: ['budgetUsd', 'triggers'], heard_sent_at: null
  };
  const need = D.toNeedState(row);
  const notes = D.notesOf(row);
  const ready = (await K.version()).ready;
  const shortlist = ready ? await M.shortlistFor(need) : [];
  const floor = await U.floor({ shortlist, travelFrom: '2027-02-01', nights: 7 });
  const caps = { database: true, consultation: true, travel_from: true, conversation: true, notes: true, placeNotes: true, eclipse: true, rooms: true };
  const v = { id: 'j-test', need, seeded, stored: row, vocab, caps, shortlist, suggestedMonth: '2027-02-01', notes, answers,
    floor, placeNotes: shortlist.length ? { [shortlist[0].slug]: 'ZZSTORY stayed here in 2024' } : {}, clientEmail: 'j•••@example.invalid', firstName: 'Janice', brand: {} };
  const html = U.understandStage(v);
  const plain = text(html);

  console.log('\n  Three bands, the client first');
  ok('four bands for a client who recognised the description: told · island (white) · Eclipse · details', count(html, /class="design-band /g) === 4 && /design-band--white design-band--island/.test(html));
  ok('the stage opens with her own Finder words, quoted, in a card behind a quotation mark', /<div class="design-quote-card">\s*<span class="design-quote-mark"[^>]*>“<\/span>\s*<p class="design-quote">You said you need <q>space to think clearly<\/q>, and <q>the rainforest<\/q> called you first\. With family, at a gentle pace, <q>a balance of exploring and restoring<\/q>\.<\/p>/.test(html), html.match(/<p class="design-quote">.*?<\/p>/) && html.match(/<p class="design-quote">.*?<\/p>/)[0]);
  ok('away → toward speaks the spoken form, not the label, and toward is the coloured column', /running hot/.test(plain) && !/>Overstimulated</.test(html) && /chips chips--toward/.test(html));
  ok('the cue is the question itself, in the second person, behind "Ask:"', /<span class="design-cue-ask">Ask:<\/span> “What does <b>running hot<\/b> look like for you right now\?”/.test(html));
  ok('a note under the first band, in its own small form, with a gold Save', /name="note_told"/.test(html) && /class="design-told-form"[^>]*data-live/.test(html) && /name="partial" value="1"/.test(html) && /design-told-form[\s\S]*?btn--gold/.test(html));
  ok('the override note is gone', !/from what the answers suggested/.test(plain));
  ok('no third person on the page: no "they are", no "their words"', !/\bWhere they are\b|\bIn their words\b|\bWhat brought this on\b|\bThe frame\b/.test(plain));
  ok('warm words: no "shortlist", "Finder" or "properties" in the page text', !/shortlist|Finder|propert(y|ies)/.test(plain), plain.match(/.{30}(shortlist|Finder|propert(y|ies)).{30}/g));
  ok('nothing hidden for a mode that no longer exists', !/hide-in-present|data-present|Present mode/.test(html));

  console.log('\n  The island band');
  ok('the band\'s inside is a fragment slot, so the map answers as the answers change', /<section class="design-band design-band--white design-band--island">\s*<div data-fragment-slot="island">/.test(html));
  ok('islandInner() renders the same inside on its own', U.islandInner(v).indexOf('<h2>Where the island answers it</h2>') === 0);
  ok('the sentence counts the places and names the move', /place[s]? on the island answer/.test(plain) && /moving from <b>running hot<\/b>/.test(html));
  ok('no caption under the map; the credit lives in the stage footer', !/class="island-caption"/.test(html));
  ok('no story prompts on the page — the training carries them for now', !/place_note|ZZSTORY|Your story|Your note/.test(html));
  if (shortlist.length) {
    ok('every pin links to its card on Compare', count(html, /href="\/hub\/journeys\/j-test\/design\?step=compare#prop-/g) >= 1);
  } else ok('bank not generated — island skipped', true);

  console.log('\n  Eclipse — only when they recognised the description');
  ok('the band sits between the island and the details, in Eclipse\'s own palette', /design-band--island[\s\S]*?design-band--eclipse[\s\S]*?design-band--details/.test(html) && /class="design-eclipse"/.test(html));
  ok('it speaks of a state they saw themselves in, not a diagnosis', /You recognised something\./.test(plain) && /not a diagnosis/.test(plain) && !/burn/i.test(plain));
  ok('the programme facts come from content/eclipse.js: from $7,500 a person, five days, programme and stays, before flights',
    /From \$7,500/.test(plain) && /five days/.test(plain) && /programme and stays, before flights/.test(plain) && /confirmed before anything is booked/.test(plain));
  const eclipseText = text((html.match(/<div class="design-eclipse">[\s\S]*?<\/select>/) || [''])[0]);
  ok('the advisor records yes or no, nothing sells', /name="interest" value="yes"/.test(html) && /name="interest" value="no"/.test(html) && !/\bBook\b|Upgrade|Choose Eclipse|Buy/.test(eclipseText));
  ok('the cues are listening questions', /Does that description still feel true today\?/.test(plain) && /how Eclipse would shape this\?/.test(plain));
  ok('Signature Wellness Programs is a placeholder shelf: Eclipse selected, "Coming soon" disabled, posts nothing',
    /<select id="signature-programs"(?![^>]*name=)/.test(html) && /<option selected>Eclipse — five days<\/option>/.test(html) && /<option disabled>Coming soon<\/option>/.test(html));
  ok('the band is a fragment slot so the recorded state swaps in', /data-fragment-slot="eclipse"/.test(html));
  const no = U.understandStage(Object.assign({}, v, { answers: Object.assign({}, answers, { recognition: 'no' }) }));
  ok('a client who did not recognise the description is shown no Eclipse band', !/design-eclipse/.test(no) && !/Eclipse/.test(text(no)));
  const yes = U.understandStage(Object.assign({}, v, { need: Object.assign({}, need, { eclipseInterest: true }) }));
  ok('recorded interest ticks yes, says Shape will start from Eclipse, and reaches the read-back',
    /value="yes" checked/.test(yes) && /Shape will start from Eclipse/.test(yes) && /Curious how Eclipse would shape it\./.test(text(yes)));
  const pre = U.understandStage(Object.assign({}, v, { caps: Object.assign({}, caps, { eclipse: false }) }));
  ok('before 026 the band shows without the ticks and says which migration', /design-eclipse/.test(pre) && !/name="interest"/.test(pre) && /migration 026/.test(pre));

  console.log('\n  The details');
  ok('#consult anchor on the details band', /id="consult"/.test(html));
  ok('eight questions, every heading a question you could say aloud', count(html, /class="design-ask"/g) === 8 && count(html, /class="design-ask-h">[^<]*\?<\/span>/g) === 8);
  ok('what matters most: the eight pillars as chips, up to three, with the stored three ticked',
    count(html, /name="pillars"/g) === 8 && count(html, /name="pillars" value="[a-z]+" checked/g) === 3 && /data-max="3"/.test(html) && /What matters most on a trip like this\?/.test(plain));
  ok('how many: adults, children and rooms as counters in the frame', /name="adults"[^>]*value="2"/.test(html) && /name="children"[^>]*value="1"/.test(html) && /name="rooms"[^>]*value="1"/.test(html));
  ok('the headings Duncan asked for', /When are you thinking, for how long, and who’s coming\?/.test(plain) && /Why are you travelling — and why now\?/.test(plain) && /What would make you hesitate\?/.test(plain) && /Where are we in the decision\?/.test(plain));
  ok('why now is a checkbox group named triggers[] with Extra notes', count(html, /type="checkbox" name="triggers"/g) === 7 && /name="note_why"/.test(html) && /Extra notes/.test(plain));
  ok('hesitations: nine boxes, "something else" among them, no "too much, or too little"', count(html, /type="checkbox" name="uncertainties"/g) === 10 && /name="uncertainties" value="other" checked/.test(html) && !/Too much, or too little/.test(plain));
  ok('plan-around: "something else" and a Details note', /name="constraints" value="other" checked/.test(html) && /name="note_around"/.test(html));
  ok('the four notes carry their text, and each says where it stays', count(html, /Never sent to the model, never on the client document/g) === 4 && /ZZTOLD/.test(html) && /ZZWHY/.test(html) && /ZZHES/.test(html) && /ZZAROUND/.test(html));
  ok('the legacy in_their_words is not shown when notes.why exists', !/ZZLEGACY/.test(html));
  ok('the scales have names, and Energy carries a whisper slot', /Structure/.test(plain) && /data-fragment-slot="whisper-energy"/.test(html));
  ok('the budget is a number input with the figure; the open tick sits beside it, once; the floor line beneath', /name="budget_usd"[^>]*value="18000"/.test(html) && count(html, /name="budget_open"/g) === 1 && /design-budget-row">[\s\S]*?name="budget_open"[\s\S]*?<\/div>\s*<span class="design-field-hint"/.test(html) && /data-fragment-slot="floor"/.test(html));
  ok('the open tick carries the advisor\'s question', /If the right week cost more than that, would you want to see it\?/.test(plain));
  ok('the month cannot be in the past', /name="travel_from" min="\d{4}-\d{2}"/.test(html));
  ok('the read-back slot and the answered count; the send button has left for the Send stage', /data-fragment-slot="consult"/.test(html) && /8 of 8 answered/.test(html) && !/heard_send/.test(html) && !/Send what I heard/.test(plain));
  ok('the gold Save', /btn btn--gold btn--sm" type="submit"[^>]*>Save what we know/.test(html));
  ok('the crown jewel: an ink card with the closing prompt and the one CTA carrying the interstitial', /class="design-heard-card"/.test(html) && /Anything you feel is missing before we lay this out\?/.test(plain) && /<a class="btn btn--gold" href="\/hub\/journeys\/j-test\/design\?step=compare" data-prepare="Janice">Let’s compare the places →<\/a>/.test(html));

  console.log('\n  The floor');
  if (floor) {
    ok('a floor from the cheapest place, before flights', floor.from > 0 && floor.to >= floor.from && floor.nights === 7 && floor.month === 'February 2027' && floor.cheapestName);
    ok('the line says start from, the place, and before flights', /start from about <b>\$[\d,]+<\/b> for 7 nights in February 2027/.test(U.floorLine(floor)) && /before flights/.test(U.floorLine(floor)));
    ok('a figure under the floor is called out beside the band word', /below where these places start/.test(U.budgetWord(Object.assign({}, need, { budgetUsd: Math.max(1, floor.from - 1000) }), floor)));
    ok('a figure above it is not', !/below where/.test(U.budgetWord(Object.assign({}, need, { budgetUsd: floor.from + 5000 }), floor)));
  } else ok('no floor without priced places (bank not generated)', true);
  ok('no month → no floor; no nights → no floor', (await U.floor({ shortlist, travelFrom: null, nights: 7 })) === null && (await U.floor({ shortlist, travelFrom: '2027-02-01', nights: null })) === null);
  ok('the empty floor line asks for a month and nights', /once there is a month and a night count/.test(U.floorLine(null)));
  const past = await U.floor({ shortlist, travelFrom: '2026-04-01', nights: 5 });
  ok('a month outside the rate table says which months the lookup covers, not nothing',
    ready ? (past && past.none && /No public rates for April 2026 — the lookup covers \w+ \d{4} to \w+ \d{4}\./.test(U.floorLine(past))) : true, past && U.floorLine(past));
  ok('"open" reads as a guide, not a ceiling, beside the figure', /a guide, not a ceiling/.test(U.budgetWord(Object.assign({}, need, { budget: 'open' }), floor)));

  console.log('\n  The whisper');
  const wr = U.whisper(Object.assign({}, need, { activity: 0.2 }), shortlist);
  const wa = U.whisper(Object.assign({}, need, { activity: 0.9 }), shortlist);
  ok('the middle third whispers nothing', U.whisper(Object.assign({}, need, { activity: 0.5 }), shortlist) === '');
  ok('restorative and active each name places or stay silent, and say inferred on their own line when they speak',
    (wr === '' || (/Restorative points to/.test(wr) && /<p class="design-inferred">/.test(wr))) && (wa === '' || (/Active points to/.test(wa) && /<p class="design-inferred">/.test(wa))));
  ok('a scale with no data behind it has no whisper function at all', typeof U.whisper === 'function' && !/social|rhythm|experience/.test(U.whisper.toString().split('const x')[1] || ''));

  console.log('\n  The read-back');
  const heard = U.heard({ need, vocab, notes, travelFrom: '2027-02-01', floor });
  ok('names the triggers first, as a sentence', /<p class="design-heard-p">A life transition and accumulated fatigue\./.test(heard), heard);
  ok('then the frame in one breath', /7 nights in February 2027, with family\./.test(heard));
  ok('then the move, in spoken words', /Moving from running hot, toward/.test(heard));
  ok('then the figure and its band', /Around \$18,000 all in — premium for the week/.test(heard));
  ok('hesitations skip "something else"; constraints too', /Hesitant about whether it is worth it and food\./.test(heard) && /Planning around dietary needs and fixed dates\./.test(heard));
  ok('every note is quoted with its label', count(heard, /design-heard-words/g) === 4 && /On how they feel:<\/span> “ZZTOLD/.test(heard) && /Things to plan around:<\/span> “ZZAROUND/.test(heard));
  ok('heardText() is the paragraph alone; heardNotes() the four notes', !/</.test(U.heardText({ need, vocab, notes, travelFrom: '2027-02-01' })) && U.heardNotes({ need, vocab, notes }).length === 4);
  const empty = U.heard({ need: await N.seedFrom({}), vocab, notes: {}, travelFrom: null });
  ok('nothing marked reads as nothing marked, not as a blank', /Nothing marked yet/.test(empty));

  console.log('\n  Before the migrations');
  const old24 = U.understandStage(Object.assign({}, v, { caps: { database: true, consultation: true, travel_from: true, conversation: true, notes: false, placeNotes: false } }));
  ok('024 only: the why note still has a home, the other three do not appear', /name="note_why"/.test(old24) && !/name="note_told"|name="note_hesitate"|name="note_around"/.test(old24));
  const old23 = U.understandStage(Object.assign({}, v, { caps: { database: true, consultation: true, travel_from: true, conversation: false, notes: false, placeNotes: false } }));
  ok('023 only: one radio per question, the band radio, and it says which migration', count(old23, /type="radio" name="trigger"/g) === 7 && count(old23, /type="radio" name="budget"/g) === 4 && /migration 024/.test(old23));

  console.log('\n  ' + n + ' checks, ' + fails + ' failed\n');
  process.exit(fails ? 1 : 0);
})();
