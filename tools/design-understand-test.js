#!/usr/bin/env node
/* ============================================================================
   design-understand-test — the conversation renders what the row says
   ----------------------------------------------------------------------------
   The Understand stage is pure: everything it needs arrives in v. So it can be
   rendered here with a stored row and read back — field names hub-design.js
   posts, the fallback when 024 has not landed, the read-back sentence, the
   budget word, the answered count, and the absence of anything Present-mode.

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

(async () => {
  console.log('\n  UNDERSTAND — the conversation');
  console.log('  ' + '-'.repeat(62));
  const seeded = await N.seedFrom({ intention: 'reflect', companions: 'family', pace: 'gentle', recognition: 'yes' });
  const vocab = await N.vocabulary();
  const row = {
    current_states: seeded.current, desired_states: seeded.desired, village_weights: seeded.villages, compass_weights: seeded.compass, pillar_weights: {},
    trigger: 'life-transition', uncertainty: 'value', triggers: ['life-transition', 'accumulated-fatigue'], uncertainties: ['value', 'food'],
    readiness: 'comparing', party: 'family', orientation: seeded.orientation, budget: 'premium', budget_usd: 18000, mobility: null,
    in_their_words: 'ZZWORDS the year has emptied me out', continuum_floor: seeded.continuumFloor, continuum_ceiling: seeded.continuumCeiling,
    rhythm: seeded.rhythm, activity: seeded.activity, social: seeded.social, experience: 0.3, adults: null, children: null, nights: 7,
    constraints: ['dietary', 'dates'], travel_from: '2027-02-01', advisor_overrode: ['budgetUsd', 'triggers']
  };
  const need = D.toNeedState(row);
  const shortlist = (await K.version()).ready ? await M.shortlistFor(need) : [];
  const caps = { database: true, consultation: true, travel_from: true, conversation: true };
  const v = { id: 'j-test', need, seeded, stored: row, vocab, caps, shortlist, suggestedMonth: '2027-02-01' };
  const html = U.understandStage(v);

  console.log('\n  What the form posts');
  ok('the section carries the #consult anchor the redirects land on', /id="consult"/.test(html));
  ok('seven numbered questions', count(html, /class="design-ask"/g) === 7);
  ok('why now is a checkbox group named triggers[]', count(html, /type="checkbox" name="triggers"/g) === 7);
  ok('two triggers come back ticked', count(html, /name="triggers" value="(life-transition|accumulated-fatigue)" checked/g) === 2);
  ok('what could get in the way is a checkbox group named uncertainties[]', count(html, /type="checkbox" name="uncertainties"/g) === 10);
  ok('who is coming is a radio group with the stored party ticked', /name="party" value="family" checked/.test(html));
  ok('budget and nights constraint chips are not offered twice', !/name="constraints" value="(budget|nights)"/.test(html) && count(html, /name="constraints"/g) === 7);
  ok('the budget is a number input with the figure, and the open tick', /name="budget_usd"[^>]*value="18000"/.test(html) && /name="budget_open"/.test(html));
  ok('in their words is a textarea with the row\'s text and a 400 cap', /<textarea[^>]*name="in_their_words"[^>]*maxlength="400"[^>]*>ZZWORDS the year has emptied me out<\/textarea>/.test(html));
  ok('the privacy line sits under it, in plain words', /Never sent to the model, never on the client document/.test(html));
  ok('the month is filled from the row, not marked suggested', /name="travel_from" value="2027-02"(?![^>]*data-suggested)/.test(html));
  ok('the scales have names, not keys', /Structure/.test(html) && /Familiarity/.test(html) && !/design-scale-name[^>]*>rhythm</.test(html));
  ok('nothing on the stage is hidden for a mode that no longer exists', !/hide-in-present|data-present|Present mode/.test(html));
  ok('the read-back slot and the answered count are there', /data-fragment-slot="consult"/.test(html) && /7 of 7 answered/.test(html));
  ok('the words never appear outside their textarea and the read-back', count(html, /ZZWORDS/g) === 2);

  console.log('\n  The read-back');
  const heard = U.heard({ need, vocab, words: row.in_their_words, travelFrom: '2027-02-01' });
  ok('names the triggers first, as a sentence', /^<h3[^>]*>What I heard<\/h3>\s*<p class="design-heard-p">A life transition and accumulated fatigue\./.test(heard), heard);
  ok('then the frame in one breath', /7 nights in February 2027, with family\./.test(heard));
  ok('then the figure and its band', /Around \$18,000 all in — premium for the week\./.test(heard));
  ok('the hesitations and the things to plan around', /Hesitant about whether it is worth it and food\./.test(heard) && /Planning around dietary needs and fixed dates\./.test(heard));
  ok('and their words, marked as theirs', /“ZZWORDS the year has emptied me out”/.test(heard) && /in their words/.test(heard));
  const empty = U.heard({ need: await N.seedFrom({}), vocab, words: '', travelFrom: null });
  ok('nothing marked reads as nothing marked, not as a blank', /Nothing marked yet/.test(empty));

  console.log('\n  The budget word');
  ok('a figure and nights → the band and the arithmetic', /reads as <b>Premium<\/b> · about \$2,571 a night/.test(U.budgetWord(need)));
  ok('a figure without nights asks for the nights', /set the nights/.test(U.budgetWord(Object.assign({}, need, { nights: null, budget: null }))));
  ok('open is its own sentence', /Open, if it is right\./.test(U.budgetWord(Object.assign({}, need, { budget: 'open' }))));

  console.log('\n  Before migration 024');
  const old = U.understandStage(Object.assign({}, v, { caps: { database: true, consultation: true, travel_from: true, conversation: false } }));
  ok('why now falls back to one radio, named trigger', count(old, /type="radio" name="trigger"/g) === 7 && !/name="triggers"/.test(old));
  ok('no words field, no figure, and it says which migration', !/name="in_their_words"/.test(old) && !/name="budget_usd"/.test(old) && /migration 024/.test(old));
  ok('the band radio returns', count(old, /type="radio" name="budget"/g) === 4);

  console.log('\n  The island on the stage');
  if (shortlist.length) {
    ok('one pin per shortlisted place with a position', count(html, /class="island-pin/g) === shortlist.filter((c) => c.property && c.property.geo).length);
    ok('every pin links to its card on Compare', count(html, /href="\/hub\/journeys\/j-test\/design\?step=compare#prop-/g) >= shortlist.length);
  } else {
    ok('bank not generated — island skipped', true);
  }

  console.log('\n  ' + n + ' checks, ' + fails + ' failed\n');
  process.exit(fails ? 1 : 0);
})();
