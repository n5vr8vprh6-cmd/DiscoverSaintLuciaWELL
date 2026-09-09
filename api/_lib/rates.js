/* ============================================================================
   RATES — the public-rate lookup, read for the estimate and nothing else
   ----------------------------------------------------------------------------
   Async, never throws, returns shapes the Send stage can print. The table it
   reads (content/rates.js) is generated from browser observations of public
   booking pages plus a few figures the properties publish themselves; every
   cell carries the day it was seen and the page it came from.

   ── THE ONE REQUIRE PATH ───────────────────────────────────────────────────
   This module is the only thing that loads content/rates.js. well-knowledge.js
   does not, design-need.js does not, design-generate.js does not — so there is
   no path from a prompt to a number, structurally rather than by discipline.
   tools/design-privacy-test.js asserts it with a sentinel.

   ── WHAT A LOOKUP MEANS ────────────────────────────────────────────────────
   nightly(slug, dateISO) finds the sample week that contains the date. It does
   NOT interpolate: a date between two observed Mondays takes the week whose
   Monday is on or before it, only if that Monday is within SPAN days; otherwise
   it answers QUOTE / CONFIRM. An estimate built on a rate nobody saw is a guess
   wearing a number, which is exactly what this exists to prevent.
   ========================================================================== */
'use strict';

let _table = null;
function table() {
  if (_table) return _table;
  try { _table = require('../../content/rates.js'); }
  catch (e) { _table = { currency: 'USD', properties: {}, transfers: [], experiences: [], built: null }; }
  return _table;
}

const SPAN_DAYS = 45;        /* a monthly sample stands for the weeks around it, no further */
const QUOTE = 'QUOTE / CONFIRM';

const day = (iso) => { const t = Date.parse(String(iso) + 'T00:00:00Z'); return Number.isFinite(t) ? t : null; };

function empty(slug, why) {
  return { slug, from: null, to: null, roomType: null, observed: null, source: null, confidence: QUOTE, why: why || 'no observed rate for this date' };
}

/* The cell for one property on one date. */
async function nightly(slug, dateISO) {
  const t = table();
  const p = t.properties && t.properties[String(slug)];
  if (!p) return empty(slug, 'property not in the rate table');
  const want = day(dateISO);
  if (want == null) {
    /* No date: the property's published tariff if it has one, else the span of everything observed. */
    if (p.published) return Object.assign({ slug }, p.published);
    if (p.weeks && p.weeks.length) {
      return { slug, from: Math.min(...p.weeks.map((w) => w.from)), to: Math.max(...p.weeks.map((w) => w.to)), roomType: null,
        observed: p.weeks[p.weeks.length - 1].observed, source: p.weeks[0].source, confidence: 'OBSERVED PUBLIC RATE', why: 'no travel date — the year’s observed span' };
    }
    return empty(slug, 'no date and nothing observed');
  }
  const weeks = (p.weeks || []).filter((w) => day(w.weekOf) != null);
  const before = weeks.filter((w) => day(w.weekOf) <= want).sort((a, b) => day(b.weekOf) - day(a.weekOf))[0];
  const after = weeks.filter((w) => day(w.weekOf) > want).sort((a, b) => day(a.weekOf) - day(b.weekOf))[0];
  const pick = [before, after].filter(Boolean).sort((a, b) => Math.abs(day(a.weekOf) - want) - Math.abs(day(b.weekOf) - want))[0];
  if (pick && Math.abs(day(pick.weekOf) - want) <= SPAN_DAYS * 86400000) {
    return { slug, from: pick.from, to: pick.to, toNext: pick.toNext || pick.to, roomNext: pick.roomNext || null, roomType: pick.roomType, weekOf: pick.weekOf, observed: pick.observed,
      source: pick.source, source_kind: pick.source_kind, confidence: pick.confidence, rooms: pick.rooms, basis: p.basis || null, taxRule: p.taxRule || null };
  }
  if (p.published) return Object.assign({ slug, why: 'no observed week near this date; the operator’s published rate' }, p.published);
  return empty(slug, weeks.length ? 'nearest observed week is more than ' + SPAN_DAYS + ' days away' : 'nothing observed for this property');
}

async function transfers(region) {
  const t = table();
  return (t.transfers || []).filter((x) => !region || x.region === region || x.region === null);
}

async function experiences() { return (table().experiences || []).slice(); }

async function regionOf(slug) {
  const p = table().properties && table().properties[String(slug)];
  return (p && p.region) || null;
}

async function version() {
  const t = table();
  const cells = Object.values(t.properties || {}).reduce((n, p) => n + ((p.weeks || []).length), 0);
  return { built: t.built || null, currency: t.currency || 'USD', properties: Object.keys(t.properties || {}).length, cells, basis: t.basis || null };
}

module.exports = { nightly, transfers, experiences, regionOf, version, QUOTE, SPAN_DAYS };
