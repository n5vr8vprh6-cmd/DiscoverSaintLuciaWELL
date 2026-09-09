#!/usr/bin/env node
/* ============================================================================
   design-estimate-test — the arithmetic, the dashes, the advisor's hand
   ----------------------------------------------------------------------------
     node tools/design-estimate-test.js

   Runs against the real rate table (content/rates.js), so the numbers here
   move when the observations do; what is asserted is the shape of the
   reasoning — runs become lines, nights multiply a range, a missing week is a
   dash excluded from the total, edits are marked, the frozen document carries
   dates and never a bank record.
   ========================================================================== */
'use strict';
const E = require('../api/_lib/design-estimate.js');
const S = require('../api/_lib/design-shape.js');

let failed = 0, ran = 0;
function ok(label, cond, detail) {
  ran++;
  if (cond) { console.log('    PASS  ' + label); return; }
  failed++;
  console.log('    FAIL  ' + label + (detail ? '\n          ' + detail : ''));
}

(async () => {
  const recipe = { key: 'r', rhythm: [{ key: 'open', label: 'Open', text: 'Arrive', intensity: 'rest' }, { key: 'core', label: 'Core', text: 'Core', intensity: 'medium' },
    { key: 'integrate', label: 'Integrate', text: 'Sea', intensity: 'low' }, { key: 'close', label: 'Close', text: 'Home', intensity: 'rest' }] };
  const names = { 'anse-chastanet': 'Anse Chastanet', 'the-landings': 'The Landings Resort & Spa', 'jade-mountain': 'Jade Mountain' };

  console.log('\n  Runs become lines, nights multiply a range');
  const plan = S.skeleton({ recipe, nights: 7, chosen: ['anse-chastanet', 'the-landings'] });
  const est = await E.build({ plan, travelFrom: '2027-02-08', names });
  const stays = est.lines.filter((l) => l.kind === 'stay');
  ok('two properties across seven nights make two stay lines', stays.length === 2, JSON.stringify(stays.map((l) => l.label)));
  ok('the nights add up to the week', stays.reduce((n, l) => n + l.nights, 0) === 7);
  const ac = stays.find((l) => l.slug === 'anse-chastanet');
  ok('the Anse Chastanet line resolves to the February week', ac.weekOf === '2027-02-08' && ac.confidence === 'OBSERVED PUBLIC RATE', JSON.stringify(ac));
  ok('nights × nightly range = the line range', ac.from === ac.nightly.from * ac.nights && ac.to === ac.nightly.to * ac.nights);
  ok('the line names the cheapest room and the day it was seen', ac.roomType && /^\d{4}-\d\d-\d\d$/.test(ac.observed));
  ok('the second run resolves to a later date', stays[1].date > stays[0].date);
  const transfers = est.lines.filter((l) => l.kind === 'transfer');
  ok('arrival, one change of region, departure', transfers.length === 3, transfers.map((t) => t.key).join(','));
  ok('the arrival transfer to the south-west is the published sedan price', transfers[0].confidence === 'PUBLISHED TARIFF' && transfers[0].from === 120);
  ok('the departure from the north is QUOTE / CONFIRM, not a guess', transfers[2].confidence === E.QUOTE && transfers[2].from === null);
  ok('the total is a range and says it is incomplete', est.total.from < est.total.to && est.total.complete === false && est.total.missing >= 1);
  ok('the estimate carries the latest observed date', /^\d{4}-\d\d-\d\d$/.test(est.observed));

  console.log('\n  Missing weeks are dashes, not zeros');
  const far = await E.build({ plan: S.skeleton({ recipe, nights: 3, chosen: ['anse-chastanet'] }), travelFrom: '2028-08-01', names });
  const line = far.lines.find((l) => l.kind === 'stay');
  ok('a date far from every observed week is a dash', line.from === null && line.confidence === E.QUOTE, JSON.stringify(line));
  ok('and the dash is excluded from the total, which says so', far.total.priced < far.total.lines && !far.total.complete);
  const nodate = await E.build({ plan: S.skeleton({ recipe, nights: 2, chosen: ['anse-chastanet'] }), travelFrom: null, names });
  ok('no travel date gives the year’s span, still dated', nodate.lines[0].from < nodate.lines[0].to && nodate.lines[0].observed);
  const empty = await E.build({ plan: S.skeleton({ recipe, nights: 3, chosen: [] }), travelFrom: '2027-02-08', names });
  ok('days with no place are one honest line and no transfers', empty.lines.length === 1 && empty.lines[0].confidence === E.QUOTE);

  console.log('\n  The advisor’s hand');
  const form = { ['from:' + ac.key]: '5,000', ['to:' + ac.key]: '6,000', ['from:' + transfers[2].key]: '150', ['to:' + transfers[2].key]: '150',
    custom_label: ['Gros Piton guide', ''], custom_from: ['180', ''], custom_to: ['180', ''] };
  const saved = E.readEdits(form, est.lines.map((l) => l.key));
  ok('edits are read by key and figures cleaned', saved.edits[ac.key].from === 5000 && saved.edits[ac.key].to === 6000);
  ok('an empty custom row is dropped', saved.custom.length === 1);
  const edited = E.applyEdits(est, saved);
  const acE = edited.lines.find((l) => l.key === ac.key);
  ok('an edited line says so and becomes ADVISOR', acE.edited === true && acE.confidence === 'ADVISOR' && acE.from === 5000);
  ok('an edited line keeps where its original came from', acE.observed === ac.observed && acE.source === ac.source);
  const depE = edited.lines.find((l) => l.key === transfers[2].key);
  ok('a filled dash joins the total', depE.from === 150 && edited.total.missing === est.total.missing - 1, JSON.stringify(edited.total));
  ok('the between-regions transfer is still to confirm until the advisor fills it', edited.lines.find((l) => l.key.indexOf('transfer:between') === 0).confidence === E.QUOTE);
  ok('a custom line is ADVISOR and counted', edited.custom.length === 1 && edited.custom[0].confidence === 'ADVISOR' && edited.total.lines === est.lines.length + 1);
  ok('a nonsense edit is ignored, not applied', E.applyEdits(est, { edits: { [ac.key]: { from: 'x', to: 9 } } }).lines.find((l) => l.key === ac.key).edited !== true);
  ok('swapped bounds are put in order', E.readEdits({ ['from:' + ac.key]: '900', ['to:' + ac.key]: '100' }, [ac.key]).edits[ac.key].from === 100);

  console.log('\n  What the document carries');
  const frozen = E.freeze(edited);
  ok('every frozen line has label, from/to, confidence, observed, edited', frozen.lines.every((l) => 'label' in l && 'from' in l && 'confidence' in l && 'observed' in l && 'edited' in l));
  ok('no bank record, slug, source URL or room type leaks into the document', frozen.lines.every((l) => !('slug' in l) && !('source' in l) && !('roomType' in l) && !('nightly' in l)));
  ok('the header sentence names the date and says not a quote', /Planning estimate, not a quote/.test(frozen.header) && frozen.header.indexOf(edited.observed) !== -1);
  ok('the total travels as a range', frozen.total.from <= frozen.total.to);
  ok('range() prints a dash for nothing and one figure for a point', E.range(null, null) === '—' && E.range(120, 120) === '$120' && E.range(100, 250) === '$100–$250');

  console.log('\n  ' + ran + ' checks, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
