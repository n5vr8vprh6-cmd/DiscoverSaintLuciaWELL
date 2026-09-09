#!/usr/bin/env node
/* ============================================================================
   rates-test — the public-rate lookup, checked before the estimate reads it
   ----------------------------------------------------------------------------
     node tools/rates-test.js

   Every cell must say when it was seen and where; every key must be a slug
   the bank knows; from <= to; nothing more than 400 days out; and the lookup
   must refuse to guess between observed weeks. Also proves the structural
   firewall: requiring the prompt modules does not load content/rates.js.
   ========================================================================== */
'use strict';
const path = require('path');

let failed = 0, ran = 0;
function ok(label, cond, detail) {
  ran++;
  if (cond) { console.log('    PASS  ' + label); return; }
  failed++;
  console.log('    FAIL  ' + label + (detail ? '\n          ' + detail : ''));
}

(async () => {
  /* ── The firewall first, before anything here touches the table ─────────── */
  console.log('\n  No prompt module loads the rate table');
  require('../api/_lib/well-knowledge.js');
  require('../api/_lib/design-need.js');
  require('../api/_lib/design-generate.js');
  require('../api/_lib/design-match.js');
  require('../api/_lib/design-itinerary.js');
  const ratesPath = path.join(__dirname, '..', 'content', 'rates.js');
  ok('content/rates.js is not in require.cache after loading the prompt modules',
    !Object.keys(require.cache).some((k) => path.normalize(k) === path.normalize(ratesPath)));

  const R = require('../api/_lib/rates.js');
  const T = require('../content/rates.js');
  const K = require('../content/well-knowledge.generated.js');
  const slugs = new Set(K.properties.map((p) => p.slug));
  const deep = K.properties.filter((p) => p.collection === 'deep').map((p) => p.slug);

  console.log('\n  The table');
  ok('currency is USD', T.currency === 'USD');
  ok('every property key is a bank slug', Object.keys(T.properties).every((s) => slugs.has(s)), Object.keys(T.properties).filter((s) => !slugs.has(s)).join(','));
  ok('every deep property has an entry (even an empty one)', deep.every((s) => T.properties[s]), deep.filter((s) => !T.properties[s]).join(','));
  const cells = [];
  Object.keys(T.properties).forEach((s) => (T.properties[s].weeks || []).forEach((w) => cells.push(Object.assign({ slug: s }, w))));
  ok('there are observed cells', cells.length > 0);
  ok('every cell is dated and sourced', cells.every((c) => /^\d{4}-\d\d-\d\d$/.test(c.observed) && /^https?:\/\//.test(c.source)));
  ok('every cell names the cheapest room', cells.every((c) => c.roomType && c.roomType.length > 2));
  ok('from <= to everywhere', cells.every((c) => Number.isFinite(c.from) && Number.isFinite(c.to) && c.from <= c.to && c.from > 0));
  const far = 400 * 86400000;
  ok('no cell more than 400 days out', cells.every((c) => Date.parse(c.weekOf) - Date.parse(c.observed) <= far));
  ok('every cell says what it is', cells.every((c) => c.confidence === 'OBSERVED PUBLIC RATE' && c.source_kind === 'ota'));
  ok('weeks are sorted and unique per property', Object.values(T.properties).every((p) => {
    const ws = (p.weeks || []).map((w) => w.weekOf); return ws.every((w, i) => i === 0 || ws[i - 1] < w); }));
  const pubs = Object.values(T.properties).filter((p) => p.published);
  ok('published tariffs are dated, sourced and marked', pubs.every((p) => p.published.observed && /^https?:/.test(p.published.source) && p.published.confidence === 'PUBLISHED TARIFF' && p.published.source_kind === 'property'));
  ok('transfers and experiences: every priced line is dated and sourced; every unpriced one says QUOTE / CONFIRM',
    T.transfers.concat(T.experiences).every((x) => (x.from == null ? x.confidence === R.QUOTE : (x.observed && x.source && x.from <= x.to))));

  console.log('\n  The lookup');
  const feb = await R.nightly('anse-chastanet', '2027-02-10');
  ok('a date inside an observed week resolves to it', feb.confidence === 'OBSERVED PUBLIC RATE' && feb.weekOf === '2027-02-08' && feb.from === 1169, JSON.stringify(feb));
  const jun = await R.nightly('anse-chastanet', '2027-06-20');
  ok('the season shows: June is cheaper than February', jun.from < feb.from, jun.from + ' vs ' + feb.from);
  ok('the cell carries the day it was seen and the page it came from', /^\d{4}-\d\d-\d\d$/.test(feb.observed) && /expedia\.com/.test(feb.source));
  const gap = await R.nightly('anse-chastanet', '2028-06-01');
  ok('a date far from every observed week is QUOTE / CONFIRM, not a guess', gap.confidence === R.QUOTE && gap.from === null, JSON.stringify(gap));
  const unknown = await R.nightly('not-a-property', '2027-02-10');
  ok('an unknown property is QUOTE / CONFIRM, not a throw', unknown.confidence === R.QUOTE);
  const pub = await R.nightly('thelifeco-st-lucia', '2027-02-10');
  ok('a property with only a published tariff answers with it, marked', pub.confidence === 'PUBLISHED TARIFF' && pub.from === 600);
  const nodate = await R.nightly('anse-chastanet', null);
  ok('no date gives the observed span, not a single number', nodate.from < nodate.to && nodate.confidence === 'OBSERVED PUBLIC RATE');
  const sw = await R.transfers('south-west');
  ok('transfers filter by region and keep the region-less lines', sw.length >= 4 && sw.every((t) => t.region === 'south-west' || t.region === null));
  const v = await R.version();
  ok('version reports the build date and the cell count', v.built && v.cells === cells.length);

  console.log('\n  ' + ran + ' checks, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
})();
