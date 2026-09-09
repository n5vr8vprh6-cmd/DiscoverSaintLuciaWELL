#!/usr/bin/env node
/* ============================================================================
   build-rates — content/rates.observed.json  →  content/rates.js
   ----------------------------------------------------------------------------
   The raw file is what the browser saw: for one property, one check-in week,
   the room rows Expedia rendered that day (name, nightly, 7-night total, board
   supplements). This turns those observations into the lookup the estimate
   reads: one cell per property per sample week, a RANGE from the cheapest to
   the most expensive room shown, the cheapest room named, the day it was
   observed, the page it came from.

     node tools/build-rates.js          # writes content/rates.js
     node tools/build-rates.js --check  # exits 1 if rates.js is stale

   ── WHAT A CELL IS, AND IS NOT ─────────────────────────────────────────────
   OBSERVED PUBLIC RATE: what a stranger would have been quoted on Expedia on
   `observed`, for two adults, seven nights, room only unless the property is
   all-inclusive. Not the property's tariff, not a contracted rate, and never a
   quote. PUBLISHED TARIFF: a figure the property itself publishes (TheLifeCo's
   programme rates). QUOTE / CONFIRM: nothing dependable found — the estimate
   shows a dash. No interpolation between weeks, no inferred seasons: an empty
   cell is an empty cell.

   ── NEVER IN THE BANK ──────────────────────────────────────────────────────
   content/rates.js is required by api/_lib/rates.js and nothing else. Neither
   well-knowledge.js nor design-need.js nor design-generate.js loads it, so no
   `require` path exists from prompt code to a number. tools/design-privacy-test.js
   asserts that with a sentinel.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'content', 'rates.observed.json');
const OUT = path.join(ROOT, 'content', 'rates.js');
const CHECK = process.argv.includes('--check');

const raw = JSON.parse(fs.readFileSync(RAW, 'utf8'));
const K = require(path.join(ROOT, 'content', 'well-knowledge.generated.js'));
const slugs = new Set(K.properties.map((p) => p.slug));

/* Expedia property id → bank slug. Authored, because a name match is a guess. */
const H = raw.expedia || {};
Object.values(H).forEach((s) => { if (!slugs.has(s)) throw new Error('rates.observed.json names a slug the bank does not have: ' + s); });

const weekOf = (d) => d;   /* cells are keyed by the check-in Monday */
const properties = {};

/* ── Observed cells ─────────────────────────────────────────────────────── */
(raw.rows || []).forEach((r) => {
  const slug = H[r.h];
  if (!slug) throw new Error('observation for an unmapped Expedia id: ' + r.h);
  const rooms = (r.rooms || []).filter((x) => Number.isFinite(x.p) && x.p > 0);
  if (!rooms.length) return;           /* sold out or nothing rendered: no cell */
  const cheapest = rooms.slice().sort((a, b) => a.p - b.p)[0];
  const dearest = rooms.slice().sort((a, b) => b.p - a.p)[0];
  /* The second-cheapest room: with the cheapest, it brackets what "a standard
     room" costs that week. The dearest room shown at Christmas is a penthouse. */
  const sorted = rooms.slice().sort((a, b) => a.p - b.p);
  const next = sorted[1] || sorted[0];
  const p = properties[slug] || (properties[slug] = { region: null, taxRule: null, basis: null, weeks: [] });
  p.weeks.push({
    weekOf: weekOf(r.in),
    from: cheapest.p,
    to: dearest.p,
    toNext: next.p,
    roomNext: next.n,
    roomType: cheapest.n,
    rooms: rooms.length,
    observed: r.at,
    source: 'https://www.expedia.com/' + ((raw.paths || {})[r.h] || ('h' + r.h)) + '?chkin=' + r.in,
    source_kind: 'ota',
    confidence: 'OBSERVED PUBLIC RATE',
    board: r.board || null
  });
});

/* ── Published tariffs (the property's own figures) ─────────────────────── */
(raw.published || []).forEach((t) => {
  if (!slugs.has(t.slug)) throw new Error('published tariff for unknown slug ' + t.slug);
  const p = properties[t.slug] || (properties[t.slug] = { region: null, taxRule: null, basis: null, weeks: [] });
  p.published = { from: t.from, to: t.to, unit: t.unit, basis: t.basis, observed: t.observed, source: t.source,
    source_kind: 'property', confidence: 'PUBLISHED TARIFF', note: t.note || null };
});

/* ── Region, tax rule, basis: authored per property ─────────────────────── */
Object.keys(raw.meta || {}).forEach((slug) => {
  if (!slugs.has(slug)) throw new Error('meta for unknown slug ' + slug);
  const p = properties[slug] || (properties[slug] = { weeks: [] });
  Object.assign(p, raw.meta[slug]);
});

/* Every deep property has an entry, even if it is only QUOTE / CONFIRM. */
K.properties.filter((p) => p.collection === 'deep').forEach((p) => {
  if (!properties[p.slug]) properties[p.slug] = { region: null, taxRule: null, basis: null, weeks: [] };
  properties[p.slug].weeks.sort((a, b) => a.weekOf.localeCompare(b.weekOf));
});

const out = {
  currency: 'USD',
  basis: 'Two adults, seven nights from the check-in date shown, room only unless the property is all-inclusive. Cheapest to most expensive room shown that day.',
  sampled: raw.sampled || null,
  built: new Date().toISOString().slice(0, 10),
  properties,
  transfers: raw.transfers || [],
  experiences: raw.experiences || []
};

const body = `/* ==========================================================================
   PUBLIC RATE LOOKUP — GENERATED, DO NOT EDIT BY HAND
   --------------------------------------------------------------------------
   Written by tools/build-rates.js from content/rates.observed.json. To change
   a figure, change the observation (or the authored published tariff) and
   rebuild. Read ONLY by api/_lib/rates.js. Never required by anything that
   builds a prompt — see tools/design-privacy-test.js.

   OBSERVED PUBLIC RATE = what Expedia showed a stranger on \`observed\`, for two
   adults and seven nights. Not a tariff, not a quote. An empty week is an
   empty week: nothing here is interpolated.
   ======================================================================== */
'use strict';

module.exports = ${JSON.stringify(out, null, 2)};
`;

if (CHECK) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  const strip = (s) => s.replace(/\r\n/g, '\n').replace(/"built": "\d{4}-\d\d-\d\d"/, '"built": "X"');
  if (strip(cur) !== strip(body)) { console.log('  rates.js is STALE — run node tools/build-rates.js'); process.exit(1); }
  console.log('  rates.js is current with rates.observed.json'); process.exit(0);
}
fs.writeFileSync(OUT, body);
const cells = Object.values(properties).reduce((n, p) => n + p.weeks.length, 0);
const withCells = Object.values(properties).filter((p) => p.weeks.length).length;
console.log(`  wrote content/rates.js — ${Object.keys(properties).length} properties, ${withCells} with observed weeks, ${cells} cells, ${(raw.published || []).length} published tariffs, ${(raw.transfers || []).length} transfers, ${(raw.experiences || []).length} experiences`);
Object.keys(properties).sort().forEach((s) => {
  const p = properties[s];
  const w = p.weeks;
  console.log(`    ${s.padEnd(32)} ${String(w.length).padStart(2)} weeks` + (w.length ? `  ${Math.min(...w.map((x) => x.from))}–${Math.max(...w.map((x) => x.to))}` : (p.published ? `  published from ${p.published.from}` : '  QUOTE / CONFIRM')));
});
