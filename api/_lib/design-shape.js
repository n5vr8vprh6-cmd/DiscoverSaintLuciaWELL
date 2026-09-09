/* ============================================================================
   DESIGN SHAPE — the day plan: skeleton, edits, pacing, and what the document reads
   ----------------------------------------------------------------------------
   A shape is a recipe (which phases, in what order) laid across N nights, with
   a property on each day, an intensity on each day, and rest where the pacing
   rule demands it. This module builds that plan and checks it. It is pure —
   no database, no model, no request — so tools/design-shape-test.js can prove
   every rule offline.

   ── SEEDED, THEN OWNED BY THE ADVISOR ──────────────────────────────────────
   skeleton() lays the recipe's phases across the nights (ends pinned, middle
   stretched — the rule that used to live in design-itinerary.js), places the
   chosen properties by phase, and seeds each day's intensity from the phase's
   authored band bounded by the property's typical range. Everything the
   advisor then touches is theirs: applyEdit() marks the day `edited`, and
   mergePlan() keeps edited days when a new skeleton is laid.

   ── INTENSITY IS INFERRED UNTIL CONFIRMED ──────────────────────────────────
   The bands come from the bank, where every value carries inferred: true (see
   tools/build-well-knowledge.js). The workspace shows the marker; the client
   document shows the word for the day and never a property's band.

   ── NO COLOUR CARRIES MEANING ALONE ────────────────────────────────────────
   Nothing here is a colour. The arc's fill heights and village accents are the
   screen's business; the plan carries words.
   ========================================================================== */
'use strict';

const BANDS = ['rest', 'low', 'medium', 'high'];
const MAX_NIGHTS = 21;
const NOTE_MAX = 300;

const idx = (b) => BANDS.indexOf(String(b || ''));
const isBand = (b) => idx(b) !== -1;

/* ── Phases across nights ──────────────────────────────────────────────────
   THE LAST RHYTHM ENTRY IS TERMINAL AND MUST OCCUR ONCE, AT THE END. Clamping
   the index repeated "Protected transition home" on days 4, 5 and 6, which to
   a client reads as going home three days running. So the ends are pinned and
   the MIDDLE stretches: interior phases like "Structured protocol days" are
   plural by construction and repeat honestly. With two or fewer phases there is
   no interior, and the surplus days carry no phase at all — a blank day an
   advisor can fill beats a confident wrong one. */
function phaseFor(rhythm, i, count) {
  const r = rhythm || [];
  if (!r.length) return null;
  if (count <= r.length) return r[i] || null;
  const last = r.length - 1;
  if (i === 0) return r[0];
  if (i === count - 1) return r[last];
  const interior = r.slice(1, last);
  if (!interior.length) return null;
  const pos = Math.floor(((i - 1) * interior.length) / Math.max(count - 2, 1));
  return interior[Math.min(pos, interior.length - 1)];
}

/* ── Properties across days ────────────────────────────────────────────────
   One → every day. Two → the first half of the phases at the first, the rest
   at the second (open/core, then integrate/close on a four-phase recipe).
   Three → thirds by day. Without a recipe the split is by day count. */
function propertyFor(chosen, i, count, phaseIndex, phaseCount) {
  const c = (chosen || []).filter(Boolean).slice(0, 3);
  if (!c.length) return null;
  if (c.length === 1) return c[0];
  if (c.length === 2) {
    const half = phaseCount ? Math.ceil(phaseCount / 2) : Math.ceil(count / 2);
    const pos = phaseCount ? phaseIndex : i;
    return pos < half ? c[0] : c[1];
  }
  return c[Math.min(2, Math.floor((i * 3) / Math.max(count, 1)))];
}

/* Rest is always allowed — an unbooked day asks nothing of the property. Any
   other band is held inside the property's typical range when it has one. */
function clampBand(band, range) {
  if (!isBand(band)) return null;
  if (band === 'rest' || !Array.isArray(range) || range.length !== 2 || !isBand(range[0]) || !isBand(range[1])) return band;
  const lo = Math.max(idx(range[0]), 1), hi = Math.max(idx(range[1]), lo);
  return BANDS[Math.min(Math.max(idx(band), lo), hi)];
}

function nightsOf(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.min(Math.round(v), MAX_NIGHTS) : null;
}

/* ── The skeleton ──────────────────────────────────────────────────────────
   recipe: a bank recipe (key, rhythm[{key,label,text,intensity}]) or null.
   nights: integer. chosen: up to three slugs. properties: { slug: record }
   for the typical intensity range and nothing else. */
function skeleton(input) {
  const i = input || {};
  const recipe = i.recipe || null;
  const rhythm = (recipe && recipe.rhythm) || [];
  const nights = nightsOf(i.nights);
  const count = nights || 0;
  const props = i.properties || {};
  const days = [];
  for (let d = 0; d < count; d++) {
    const ph = phaseFor(rhythm, d, count);
    const phaseIndex = ph ? rhythm.indexOf(ph) : -1;
    const slug = propertyFor(i.chosen, d, count, phaseIndex, rhythm.length);
    const prop = slug ? props[slug] : null;
    const range = prop && prop.intensity && prop.intensity.typical;
    const band = ph && ph.intensity ? clampBand(ph.intensity, range) : null;
    days.push({
      n: d + 1,
      phase: ph ? ph.key : null,
      phaseLabel: ph ? ph.label : null,
      phaseText: ph ? ph.text : null,
      property: slug,
      intensity: band,
      note: null,
      noteSource: null,
      edited: false
    });
  }
  return { recipe: recipe ? recipe.key : null, nights, days, at: new Date().toISOString() };
}

/* Lay a new skeleton but keep what the advisor already owns: an edited day's
   property, intensity and note survive when the day still exists. */
function mergePlan(oldPlan, newPlan) {
  const prev = (oldPlan && oldPlan.days) || [];
  const out = Object.assign({}, newPlan, { days: newPlan.days.map((d) => {
    const was = prev.find((p) => p && p.n === d.n);
    if (!was || !was.edited) return d;
    return Object.assign({}, d, {
      property: was.property || d.property,
      intensity: isBand(was.intensity) ? was.intensity : d.intensity,
      note: was.note || null,
      noteSource: was.note ? (was.noteSource || 'advisor') : null,
      edited: true
    });
  }) });
  return out;
}

/* ── One day, edited ───────────────────────────────────────────────────────
   Validates against the session, not the form: the property must be one the
   advisor carried, the band one of four words, the note bounded. Returns the
   whole plan so the caller saves one value. */
function applyEdit(plan, n, patch, opts) {
  const o = opts || {};
  const problems = [];
  const p = plan && Array.isArray(plan.days) ? plan : null;
  if (!p) return { ok: false, problems: ['no plan to edit'] };
  const dayN = Number(n);
  const day = p.days.find((d) => d.n === dayN);
  if (!day) return { ok: false, problems: ['no such day'] };

  const next = Object.assign({}, day);
  const q = patch || {};
  if (q.property !== undefined) {
    const slug = q.property === '' || q.property == null ? null : String(q.property);
    const allowed = (o.chosen || []).indexOf(slug) !== -1 || slug === null;
    if (!allowed) problems.push('property not carried');
    else next.property = slug;
  }
  if (q.intensity !== undefined) {
    const b = q.intensity === '' || q.intensity == null ? null : String(q.intensity);
    if (b !== null && !isBand(b)) problems.push('unknown intensity');
    else next.intensity = b;
  }
  if (q.note !== undefined) {
    const note = String(q.note == null ? '' : q.note).trim().slice(0, NOTE_MAX);
    next.note = note || null;
    next.noteSource = note ? (q.noteSource === 'model' ? 'model' : 'advisor') : null;
  }
  if (problems.length) return { ok: false, problems };
  next.edited = true;
  return { ok: true, plan: Object.assign({}, p, { days: p.days.map((d) => (d.n === dayN ? next : d)), at: new Date().toISOString() }) };
}

/* ── The pacing check ──────────────────────────────────────────────────────
   A rule engine over the plan as built, like the mismatches over a property.
   Each flag names the days and says why, in the advisor's language. Nothing
   here blocks a save — the advisor may have a reason — it is shown beside
   the arc, advisor-only. */
function pacingFlags(plan, opts) {
  const o = opts || {};
  const days = (plan && plan.days) || [];
  const flags = [];
  /* Back-to-back high days are a fault ONLY where the recipe asks to alternate
     (Active Recovery: "Alternate. Never place two high-exertion days back to
     back"). A structured protocol is high on consecutive days by design, and
     flagging the recipe's own seed would teach the advisor to ignore flags. */
  for (let i = 1; o.alternate && i < days.length; i++) {
    if (days[i - 1].intensity === 'high' && days[i].intensity === 'high') {
      flags.push({ code: 'back_to_back', days: [days[i - 1].n, days[i].n],
        text: 'Two high days back to back (days ' + days[i - 1].n + ' and ' + days[i].n + '). The guide’s rule: alternate exertion and recovery.' });
    }
  }
  if (days.length >= 7 && !days.some((d) => d.intensity === 'rest')) {
    flags.push({ code: 'no_rest', days: [],
      text: 'Seven nights or more with no day left completely unbooked. Couples most often name the unstructured day as the one that mattered.' });
  }
  if (days.length && days[0].intensity === 'high') {
    flags.push({ code: 'hard_arrival', days: [1],
      text: 'A high day straight after the flight. The most common way a structured journey underdelivers.' });
  }
  if (days.length > 1 && days[days.length - 1].intensity === 'high') {
    flags.push({ code: 'hard_departure', days: [days[days.length - 1].n],
      text: 'A high day straight before the flight home. Protect the day either side of the protocol.' });
  }
  const unset = days.filter((d) => !d.intensity).map((d) => d.n);
  if (unset.length && unset.length < days.length) {
    flags.push({ code: 'unset', days: unset, text: 'Intensity not set on day ' + unset.join(', ') + '.' });
  }
  return flags;
}

/* Consecutive days sharing a phase, for the header row above the arc. */
function phaseSpans(days) {
  const out = [];
  (days || []).forEach((d, i) => {
    const last = out[out.length - 1];
    if (last && last.key === (d.phase || null) && last.to === i) { last.to = i + 1; return; }
    out.push({ key: d.phase || null, label: d.phaseLabel || null, from: i, to: i + 1 });
  });
  return out;
}

/* ── What the document reads ───────────────────────────────────────────────
   Named fields, in the shape design-itinerary.js days() always produced, plus
   the intensity WORD and the property. Never a property's band or the seeded
   value — a client sees the day as the advisor left it. */
function readDays(plan, nameOf) {
  const days = (plan && plan.days) || [];
  const name = typeof nameOf === 'function' ? nameOf : (s) => s;
  return days.map((d) => ({
    n: d.n,
    label: 'Day ' + d.n,
    shape: d.phaseText || null,
    intensity: isBand(d.intensity) ? d.intensity : null,
    property: d.property ? (name(d.property) || null) : null,
    note: d.note || null
  }));
}

module.exports = { BANDS, MAX_NIGHTS, NOTE_MAX, skeleton, mergePlan, applyEdit, pacingFlags, phaseSpans, readDays, phaseFor, clampBand, isBand };
