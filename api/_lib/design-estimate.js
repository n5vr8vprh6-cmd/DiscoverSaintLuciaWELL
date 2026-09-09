/* ============================================================================
   DESIGN ESTIMATE — arithmetic over a dated lookup, plus the advisor's edits
   ----------------------------------------------------------------------------
   The Send stage shows what the week might cost. This builds that: each run of
   days at one property becomes one line, nights × the observed nightly RANGE
   for that property in that week; arrival and departure transfers by region;
   one transfer per change of property; the experiences the advisor adds. The
   total is a range. It is never a figure.

   ── NO MODEL TOUCHES THIS ──────────────────────────────────────────────────
   Every number here comes from api/_lib/rates.js (a dated observation or a
   published tariff) or from the advisor's own hand. design-generate.js does
   not import this module and this module does not import design-generate.js.
   The prompt boundary is untouched; what changed is only what the client
   document may carry.

   ── QUOTE / CONFIRM IS A DASH, NOT A ZERO ──────────────────────────────────
   A line with no dependable rate shows a dash and is EXCLUDED from the total,
   which then says it is incomplete. A zero would read as free; an average
   would read as known. The advisor fills the line or leaves the dash.

   ── EDITS ARE STORED, VALUES ARE RECOMPUTED ────────────────────────────────
   design_sessions.estimate holds { edits: { key: { from, to } }, custom: [ ...
   ], at } — the advisor's hand, not the computed table. The table is rebuilt
   from the current lookup on every read, so a rate refresh flows through, and
   an edited line stays edited (and says so). At issue, freeze() writes the
   resolved lines into the document with the dates the figures were observed.
   ========================================================================== */
'use strict';

const R = require('./rates.js');

const QUOTE = R.QUOTE;
const MAX_CUSTOM = 12;
const MAX_LABEL = 80;

const isoPlus = (iso, days) => {
  const t = Date.parse(String(iso) + 'T00:00:00Z');
  if (!Number.isFinite(t)) return null;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
};
const money = (n) => (Number.isFinite(n) ? Math.round(n) : null);

/* Consecutive days at one property → runs of { slug, start (0-based day), nights }. */
function runs(plan) {
  const days = (plan && plan.days) || [];
  const out = [];
  days.forEach((d, i) => {
    const last = out[out.length - 1];
    if (last && last.slug === (d.property || null)) { last.nights++; return; }
    out.push({ slug: d.property || null, start: i, nights: 1 });
  });
  return out;
}

/* ── Build ──────────────────────────────────────────────────────────────────
   plan: the day plan (design-shape.js). travelFrom: ISO date or null.
   names: slug → display name. Returns the unedited estimate. */
async function build(input) {
  const i = input || {};
  const plan = i.plan || { days: [] };
  const names = i.names || {};
  const name = (s) => names[s] || s;
  const lines = [];
  const observedDates = [];

  /* Stays */
  for (const r of runs(plan)) {
    if (!r.slug) {
      lines.push({ key: 'stay:none:' + r.start, kind: 'stay', label: r.nights + (r.nights === 1 ? ' night' : ' nights') + ', no place chosen yet',
        slug: null, nights: r.nights, from: null, to: null, unit: null, confidence: QUOTE, why: 'no property on these days', observed: null, source: null });
      continue;
    }
    const date = i.travelFrom ? isoPlus(i.travelFrom, r.start) : null;
    const cell = await R.nightly(r.slug, date);
    /* The upper bound is the SECOND-cheapest room shown that week, not the
       dearest: the two most accessible rooms bracket a standard stay, and the
       dearest room at Christmas is a three-bedroom penthouse. The full span
       stays in the lookup; the advisor can type any figure over this. */
    const hi = Number.isFinite(cell.toNext) ? cell.toNext : cell.to;
    const ok = Number.isFinite(cell.from) && Number.isFinite(hi);
    if (cell.observed) observedDates.push(cell.observed);
    lines.push({
      key: 'stay:' + r.slug + ':' + r.start,
      kind: 'stay',
      label: name(r.slug) + ' · ' + r.nights + (r.nights === 1 ? ' night' : ' nights'),
      slug: r.slug, nights: r.nights, date,
      from: ok ? money(cell.from * r.nights) : null,
      to: ok ? money(hi * r.nights) : null,
      unit: ok ? r.nights + ' × ' + (cell.from === hi ? fmt(cell.from) : fmt(cell.from) + '–' + fmt(hi)) + ' a night' + (cell.roomType ? ', ' + cell.roomType + (cell.roomNext && cell.roomNext !== cell.roomType ? ' to ' + cell.roomNext : '') : '') : null,
      nightly: ok ? { from: cell.from, to: hi, span: cell.to } : null,
      roomType: cell.roomType || null,
      weekOf: cell.weekOf || null,
      observed: cell.observed || null,
      source: cell.source || null,
      confidence: cell.confidence || QUOTE,
      basis: cell.basis || null,
      taxRule: cell.taxRule || null,
      why: ok ? null : (cell.why || 'no observed rate')
    });
  }

  /* Transfers: arrival to the first region, departure from the last, one per change. */
  const stays = runs(plan).filter((r) => r.slug);
  if (stays.length) {
    const regions = [];
    for (const r of stays) regions.push(await R.regionOf(r.slug));
    const all = await R.transfers(null);
    const pick = (region, wantKeyPart) => all.find((t) => t.region === region && t.key.indexOf(wantKeyPart) !== -1)
      || all.find((t) => t.region === region) || null;
    const push = (key, label, t, duration) => {
      const ok = t && Number.isFinite(t.from);
      if (t && t.observed) observedDates.push(t.observed);
      lines.push({ key, kind: 'transfer', label: t ? t.label : label, from: ok ? t.from : null, to: ok ? t.to : null,
        unit: t ? t.unit : 'per vehicle, each way', duration: (t && t.duration) || duration || null,
        observed: (t && t.observed) || null, source: (t && t.source) || null,
        confidence: ok ? t.confidence : QUOTE, why: ok ? null : 'no dependable transfer price for this leg' });
    };
    push('transfer:arrive', 'Arrival transfer from Hewanorra (UVF)', pick(regions[0], 'uvf-'), '60–90 min');
    for (let k = 1; k < stays.length; k++) {
      if (regions[k] !== regions[k - 1]) {
        push('transfer:between:' + k, 'Between ' + name(stays[k - 1].slug) + ' and ' + name(stays[k].slug),
          all.find((t) => t.key === 'between-regions') || null, '90–120 min');
      }
    }
    push('transfer:depart', 'Departure transfer to Hewanorra (UVF)', pick(regions[regions.length - 1], 'uvf-'), '60–90 min');
  }

  const observed = observedDates.sort().pop() || null;
  return finish({ v: 1, currency: 'USD', travelFrom: i.travelFrom || null, observed, lines, custom: [] });
}

/* ── The advisor's hand ────────────────────────────────────────────────────
   edits: { [key]: { from, to } }  custom: [{ label, from, to }]
   An edited line keeps its provenance but says `edited: true` and its
   confidence becomes ADVISOR. A custom line is ADVISOR by definition. */
function applyEdits(estimate, saved) {
  const s = saved || {};
  const edits = s.edits || {};
  const lines = (estimate.lines || []).map((l) => {
    const e = edits[l.key];
    if (!e) return l;
    const from = Number(e.from), to = Number(e.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < from) return l;
    return Object.assign({}, l, { from: money(from), to: money(to), edited: true, confidence: 'ADVISOR', why: null });
  });
  const custom = (Array.isArray(s.custom) ? s.custom : []).slice(0, MAX_CUSTOM).map((c, n) => {
    const from = Number(c.from), to = Number(c.to);
    const ok = Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to >= from;
    return { key: 'custom:' + n, kind: 'custom', label: String(c.label || 'Added by your advisor').slice(0, MAX_LABEL),
      from: ok ? money(from) : null, to: ok ? money(to) : null, unit: c.unit ? String(c.unit).slice(0, MAX_LABEL) : null,
      confidence: ok ? 'ADVISOR' : QUOTE, edited: true, observed: null, source: null, why: ok ? null : 'no figure entered' };
  });
  return finish(Object.assign({}, estimate, { lines, custom }));
}

/* Validate a form's worth of edits into the stored shape. */
function readEdits(form, knownKeys) {
  const f = form || {};
  const edits = {};
  (knownKeys || []).forEach((k) => {
    const from = f['from:' + k], to = f['to:' + k];
    if (from === undefined && to === undefined) return;
    const a = Number(String(from || '').replace(/[^\d.]/g, '')), b = Number(String(to || '').replace(/[^\d.]/g, ''));
    if (from === '' && to === '') return;                 /* cleared: back to the lookup */
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    edits[k] = { from: Math.min(a, b), to: Math.max(a, b) };
  });
  const custom = [];
  const labels = [].concat(f['custom_label'] || []);
  const froms = [].concat(f['custom_from'] || []);
  const tos = [].concat(f['custom_to'] || []);
  labels.forEach((label, n) => {
    const lab = String(label || '').trim().slice(0, MAX_LABEL);
    const a = Number(String(froms[n] || '').replace(/[^\d.]/g, '')), b = Number(String(tos[n] || '').replace(/[^\d.]/g, ''));
    if (!lab && !froms[n] && !tos[n]) return;
    custom.push({ label: lab || 'Added by your advisor', from: Number.isFinite(a) ? Math.min(a, b) : null, to: Number.isFinite(b) ? Math.max(a, b) : null });
  });
  return { edits, custom: custom.slice(0, MAX_CUSTOM), at: new Date().toISOString() };
}

function finish(est) {
  const all = (est.lines || []).concat(est.custom || []);
  const priced = all.filter((l) => Number.isFinite(l.from) && Number.isFinite(l.to));
  const missing = all.length - priced.length;
  est.total = {
    from: priced.reduce((n, l) => n + l.from, 0),
    to: priced.reduce((n, l) => n + l.to, 0),
    lines: all.length, priced: priced.length, missing,
    complete: missing === 0 && all.length > 0
  };
  return est;
}

/* ── What the document carries ─────────────────────────────────────────────
   Named fields, every line dated where it can be, and the header sentence
   written once here so the workspace and the document say the same thing. */
function freeze(est) {
  const e = est || finish({ lines: [], custom: [] });
  const line = (l) => ({
    kind: l.kind, label: l.label, unit: l.unit || null, from: l.from, to: l.to,
    confidence: l.confidence, observed: l.observed || null, edited: Boolean(l.edited)
  });
  return {
    currency: e.currency || 'USD',
    observed: e.observed || null,
    lines: (e.lines || []).concat(e.custom || []).map(line),
    total: e.total,
    header: header(e)
  };
}

function header(est) {
  const when = est && est.observed ? ' observed on ' + est.observed : '';
  return 'Planning estimate, not a quote. Built from public rates' + when + ' for two adults; every figure is reconfirmed before anything is booked.';
}

function fmt(n) { return Number.isFinite(n) ? '$' + Math.round(n).toLocaleString('en-US') : '—'; }
function range(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return '—';
  return from === to ? fmt(from) : fmt(from) + '–' + fmt(to);
}

module.exports = { build, applyEdits, readEdits, freeze, header, runs, fmt, range, QUOTE, MAX_CUSTOM };
