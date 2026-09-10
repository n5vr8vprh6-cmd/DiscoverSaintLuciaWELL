#!/usr/bin/env node
/* ============================================================================
   design-compare-test — the brochure card with its reasons open
   ----------------------------------------------------------------------------
   Compare is pure: everything arrives in v. Rendered here against the real
   bank and the real rate table: the rank and verdict, the four bands open,
   what to watch, the stay price and the per-person line, the toggle chips and
   the three-max, add-a-place, the summary card, and the words that must not
   appear (a score, a total, "Not known" for an axis that was asked).

   Run: node tools/design-compare-test.js
   ========================================================================== */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'api', '_lib', 'hub-screens', 'design-compare.js'));
const M = require(path.join(ROOT, 'api', '_lib', 'design-match.js'));
const N = require(path.join(ROOT, 'api', '_lib', 'need-state.js'));
const K = require(path.join(ROOT, 'api', '_lib', 'well-knowledge.js'));

let fails = 0, n = 0;
const ok = (label, cond, detail) => { n++; if (cond) console.log('  ok    ' + label); else { fails++; console.log('  FAIL  ' + label + (detail ? '\n        ' + String(detail).slice(0, 300) : '')); } };
const count = (s, re) => (s.match(re) || []).length;
const text = (s) => s.replace(/<[^>]+>/g, '');

(async () => {
  console.log('\n  COMPARE — the brochure with its reasons open');
  console.log('  ' + '-'.repeat(62));
  const need = Object.assign(await N.seedFrom({ intention: 'reflect', place: 'rainforest', companions: 'family', orientation: 'balance', pace: 'gentle' }),
    { nights: 7, adults: 2, children: 1, rooms: 1, pillars: { nature: 1, food: 1, mind: 1 } });
  const fw = await K.frameworks();
  const vocab = await N.vocabulary();
  const shortlist = await M.shortlistFor(need);
  ok('a shortlist exists to render', shortlist.length >= 3, String(shortlist.length));

  const added = await C.addedCards({ shortlist: { chosen: [], added: ['ti-kaye-resort-spa', shortlist[0].slug] } }, need, shortlist);
  ok('an added place is scored the same way; one already ranked is not added twice', added.length === 1 && added[0].added === true && added[0].bands && added[0].mismatches.length >= 1);
  const rateCells = await C.ratesFor(shortlist.concat(added), '2027-02-01');
  const directory = await C.directory(shortlist.concat(added).map((c) => c.slug));
  ok('the directory offers everything not yet on screen, alphabetically', directory.length === 30 - shortlist.length - added.length && directory.every((p, i, a) => !i || a[i - 1].name.localeCompare(p.name) <= 0));

  const chosen = [shortlist[0].slug, shortlist[1].slug];
  const v = { id: 'j-test', need, shortlist, added, rateCells, directory, session: { shortlist: { chosen } }, caps: { consultation: true }, frameworks: fw, vocab, travelFrom: '2027-02-01', firstName: 'Janice' };
  const html = C.compareStage(v);
  const plain = text(html);

  console.log('\n  The cards');
  ok('one card per ranked place plus the added one', count(html, /<li class="design-prop/g) === shortlist.length + 1);
  ok('rank on every ranked card, none on the added one', count(html, /class="design-rank"/g) === shortlist.length && /1st<small>of/.test(html) && /design-prop--added/.test(html));
  ok('a verdict sentence on every card, open, and no folded reasoning', count(html, /class="design-verdict"/g) === shortlist.length + 1 && !/design-why/.test(html));
  ok('the four bands are on every card and read as words', count(html, /class="design-bands"/g) === shortlist.length + 1 && /What matters most/.test(plain) && !/\d{1,3}\/100|\bScore\b/.test(plain));
  ok('what matters most was asked, so no card says "Not asked" for it', !/band-unknown"><span class="band-axis">What matters most/.test(html));
  ok('what to watch is a list on the card', count(html, /<h4>What to watch<\/h4>/g) >= shortlist.length);
  ok('the continuum is graded by rung', /class="rung-1/.test(html) && /class="rung-6/.test(html));
  ok('the stay price comes from the rate table, dated, with a per-person line for the party', /Stay price/.test(plain) && /From \$[\d,]+/.test(plain) && /a person a night for 3 across 1 room\./.test(plain) && /seen 2026-09-09/.test(plain));
  ok('a place without a rate says so honestly', /we’ll quote it/.test(plain));
  ok('the spa menu is a disclosure, not the price', /Treatments and menu, as published/.test(plain) && count(html, /<details class="design-menu"/g) >= 1);
  ok('the toggle chip: a checkbox with the on/off words, ticked for the chosen', count(html, /data-carry-word/g) === shortlist.length + 1 && count(html, /name="carry" value="[^"]+" checked/g) === 2 && /data-max-carry="3"/.test(html));
  ok('the count line and the set-aside menu', /2 of 3 in the journey/.test(plain) && count(html, /form="decline-/g) >= (shortlist.length + 1) * 2);
  ok('a directory entry says so on its eyebrow', /Directory entry · profile to follow/.test(plain) || !added.some((c) => c.property.collection !== 'deep'));
  ok('the added card has a Remove', /form="remove-ti-kaye-resort-spa"/.test(html));

  console.log('\n  Add a place and the summary');
  ok('add-a-place is a select grouped Profiled / Directory with an Add button', /<optgroup label="Profiled">/.test(html) && /<optgroup label="Directory">/.test(html) && /name="action" value="add_place"/.test(html));
  ok('the summary names the two chosen places with their verdicts and one gold CTA carrying the interstitial',
    count(html, /design-summary-list[\s\S]*?<li>/g) >= 1 && count(html, /<b>[^<]+<\/b><span class="design-summary-verdict">/g) === 2 && /data-prepare="Janice">Let’s shape the journey →<\/a>/.test(html));
  ok('the closing ask is on the card', /Of these, which one do you keep coming back to\?/.test(plain));
  const none = C.compareStage(Object.assign({}, v, { session: { shortlist: { chosen: [] } } }));
  ok('with nothing chosen the summary says so and the CTA is held', /Nothing in the journey yet/.test(text(none)) && /aria-disabled="true"/.test(none));

  console.log('\n  Words from bands');
  ok('strong + absent', M.verdict({ place: 'strong', direction: 'absent', depth: 'strong', ingredients: 'unknown' }) === "Strong on place and depth; your direction isn't in its offer.");
  ok('partial only', M.verdict({ place: 'partial', direction: 'partial', depth: 'unknown', ingredients: 'unknown' }) === 'Partly on place and direction.');
  ok('all absent', /aren't in its offer\.$/.test(M.verdict({ place: 'absent', direction: 'absent', depth: 'unknown', ingredients: 'unknown' })));
  ok('nothing scored', /Nothing to compare against yet/.test(M.verdict({})));
  ok('scoreOne of an unknown slug is null', (await M.scoreOne(need, 'not-a-place')) === null);

  console.log('\n  ' + n + ' checks, ' + fails + ' failed\n');
  process.exit(fails ? 1 : 0);
})();
