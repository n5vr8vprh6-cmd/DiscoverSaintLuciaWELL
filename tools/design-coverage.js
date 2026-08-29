/* ============================================================================
   design-coverage.js — every need-state the Finder can produce, scored
   ----------------------------------------------------------------------------
     node tools/design-coverage.js            summary + failures
     node tools/design-coverage.js --matrix   print all 270 rows

   WHY THIS EXISTS, IN ONE STORY.

   content/journey.js carries a comment about the Finder's own scoring: at equal
   weights, 18 of 30 combinations tied, and ARRAY ORDER silently decided them —
   sending everyone to Longevity for no reason a traveller would recognise. Every
   individual answer was defensible. The bug only existed in the aggregate, and
   it took a matrix to see.

   A shortlist has exactly the same failure mode and a worse consequence: a
   property that never surfaces is inventory the advisor is never shown, and
   nothing about the screen would ever look wrong.

   So this enumerates every need-state the Finder can produce — intention ×
   place × orientation × pace, 270 of them — and scores all thirty scorable
   properties against each.

   ── ONE OF THESE IS A DEFECT. THE OTHER IS A THING TO READ. ───────────────
   NEVER SURFACES is provable and FAILS. A property in no shortlist anywhere is
   inventory an advisor can never be shown, and nothing on the screen would look
   wrong. It has already caught two real scoring bugs — see design-match.js.

   DOMINATES only WARNS, and prints the band profile with it. A property in half
   of all shortlists might be a weight doing too much work, or might be a
   genuinely broad property fitting genuinely many briefs. The band profile is
   what separates those: a property surfacing on STRONG bands earned its place,
   one surfacing on THIN bands is riding ties. Anse Chastanet currently sits at
   about half, and every single appearance is strong — which is the Field Guide
   agreeing with itself, since it calls that property "one of the island's
   broadest build-your-own wellness environments".

   Failing on dominance would mean tuning a threshold until the truth passed.

   Neither number is a target. Read the matrix.
   ========================================================================== */
'use strict';

const N = require('../api/_lib/need-state.js');
const M = require('../api/_lib/design-match.js');
const K = require('../api/_lib/well-knowledge.js');
const FINDER = require('../content/journey.js').finderData;

const MATRIX = process.argv.indexOf('--matrix') !== -1;
const CEILING = 0.40;

const optionsFor = (id) => {
  const q = (FINDER.questions || []).filter((x) => x.id === id)[0];
  return q ? q.options.map((o) => o.value) : [];
};

(async () => {
  const props = await K.properties();
  const intention = optionsFor('intention');
  const place = optionsFor('place');
  const orientation = optionsFor('orientation');
  const pace = optionsFor('pace');

  const combos = [];
  intention.forEach((i) => place.forEach((p) => orientation.forEach((o) => pace.forEach((c) => {
    combos.push({ intention: i, place: p, orientation: o, pace: c });
  }))));

  console.log('\n  DESIGN COVERAGE');
  console.log('  ' + '─'.repeat(72));
  console.log('  ' + combos.length + ' need-states × ' + props.length + ' properties, top ' + M.SHORTLIST + ' each\n');

  const appearances = {};
  const firsts = {};
  const bandsWhenSurfacing = {};
  props.forEach((p) => {
    appearances[p.slug] = 0; firsts[p.slug] = 0;
    bandsWhenSurfacing[p.slug] = { strong: 0, partial: 0, thin: 0, absent: 0, unknown: 0 };
  });

  let ties = 0;
  const rows = [];

  for (let i = 0; i < combos.length; i++) {
    const need = await N.seedFrom(combos[i]);
    const top = await M.shortlistFor(need);
    top.forEach((t) => { appearances[t.slug]++; bandsWhenSurfacing[t.slug][t.bands.place]++; });
    if (top[0]) firsts[top[0].slug]++;

    /* A tie at the head is not a bug — the Field Guide's own top four tied on
       the prototype — but a lot of them means the axes are not discriminating
       and the tie-break is doing the real work. */
    if (top[1] && top[0].order.slice(0, 4).join(',') === top[1].order.slice(0, 4).join(',')) ties++;

    rows.push({
      need: [combos[i].intention, combos[i].place, combos[i].orientation, combos[i].pace].join('/'),
      top: top.map((t) => t.slug)
    });
  }

  if (MATRIX) {
    rows.forEach((r) => console.log('  ' + r.need.padEnd(34) + r.top.join(' · ')));
    console.log('');
  }

  const never = props.filter((p) => appearances[p.slug] === 0);
  const always = props.filter((p) => appearances[p.slug] / combos.length > CEILING);

  const ranked = props.slice().sort((a, b) => appearances[b.slug] - appearances[a.slug]);
  console.log('  Most surfaced');
  ranked.slice(0, 8).forEach((p) => {
    const pct = Math.round(appearances[p.slug] / combos.length * 100);
    console.log('    ' + String(pct + '%').padStart(4) + '  ' + String(firsts[p.slug]).padStart(4) + ' first  ' +
      p.name.slice(0, 38).padEnd(40) + p.collection);
  });
  console.log('\n  Least surfaced');
  ranked.slice(-8).forEach((p) => {
    const pct = Math.round(appearances[p.slug] / combos.length * 100);
    console.log('    ' + String(pct + '%').padStart(4) + '  ' + String(firsts[p.slug]).padStart(4) + ' first  ' +
      p.name.slice(0, 38).padEnd(40) + p.collection);
  });

  console.log('\n  ' + '─'.repeat(72));
  console.log('  head ties (first two identical on all four axes): ' + ties + ' of ' + combos.length);

  let bad = 0;
  if (never.length) {
    bad++;
    console.log('\n  ✗ NEVER SURFACES — ' + never.length + ' propert' + (never.length === 1 ? 'y' : 'ies'));
    never.forEach((p) => console.log('      ' + p.name + '  [' + p.collection + ']  villages=' +
      p.villages.join('|') + '  compass=' + p.compass.join('|')));
    console.log('      Either the vectors are mis-mapped or the scoring cannot reach them.');
  }
  if (always.length) {
    /* WARNS, never fails. Failing here would mean tuning a threshold until the
       truth passed — see the header. The band profile is the evidence a reader
       needs to tell a broad property from a broken weight. */
    console.log('\n  !  DOMINATES — above ' + Math.round(CEILING * 100) + '%. Read the band profile.');
    always.forEach((p) => {
      const b = bandsWhenSurfacing[p.slug];
      console.log('      ' + p.name.slice(0, 32).padEnd(34) +
        String(Math.round(appearances[p.slug] / combos.length * 100) + '%').padStart(4) +
        '   place band when it surfaces:  strong ' + b.strong +
        ' · partial ' + b.partial + ' · thin ' + b.thin + ' · absent ' + b.absent);
    });
    console.log('      Strong throughout is a broad property fitting broad briefs.');
    console.log('      Thin or absent means it is riding ties, and the weights need work.');
  }
  if (!bad) console.log('\n  ✓ every property surfaces');
  console.log('');
  process.exit(bad ? 1 : 0);
})();
