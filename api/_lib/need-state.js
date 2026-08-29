/* ============================================================================
   NEED STATE — one vocabulary, two instances
   ----------------------------------------------------------------------------
   A need-state says what a traveller is moving away from, what they are moving
   toward, why now, and what could stop them. Two things in this system hold
   one:

     journey_consultations   THIS traveller, on this call
     gtm_profile             the advisor's PRIORITY traveller — the archetype
                             they serve, and therefore market to

   They are the same shape on purpose. Before this file existed they were not
   even the same language: the Journey Finder stores wellness orientation as
   vacation / balance / led, while the advisor's persona quiz stores it as
   primary / secondary-intentional / secondary-casual / sceptical. Same
   dimension, two scales, nothing in between them — so WELL Campaign could not
   target the need-states an advisor actually converts, because it could not
   tell that it was looking at the same axis twice.

   This file owns that reconciliation, the way well-knowledge.js owns the
   village one.

   ── CODES AND NUMBERS. NO PROSE. EVER. ───────────────────────────────────
   Every value here is a key from the bank or a number between 0 and 1. There
   is no free-text field, and that is not a style preference — it is the
   privacy boundary made structural. Because there is nothing to redact, the
   projection that reaches a model is a column list rather than a filter, and
   `a filter can be written wrong; an absent parameter cannot`.

   Where an advisor needs to write about a person in their own words, that goes
   in advisor_notes, which already exists, already cascades on share delete and
   is already in the subject-rights export.

   ── WEIGHTS ORDER A SHORTLIST. THEY DO NOT MEASURE ANYONE. ───────────────
   The brief is explicit: weights `may support ranking and reasoning, but must
   not imply scientific measurement precision`. They are floats because the
   matcher needs to sort; they are never rendered as a number, never summed
   into a score, and never shown to a traveller.

   ── SEEDING IS A FIXED MAPPING, NOT AN INFERENCE ─────────────────────────
   seedFrom() turns six Finder answers into a starting need-state. It is a
   lookup table, keyed to what the person actually selected — the same
   discipline hub-brief.js applies: `nothing is generated, inferred, or
   softened into a claim they did not make`. Six answers cannot know why
   somebody is travelling now, so `trigger` comes back null and the advisor
   fills it in. A null the advisor completes is worth more than a guess they
   have to notice and undo.

   IT NEVER THROWS. A bank that has not been generated yields empty vocabulary
   lists and validate() rejecting everything, which is a state the Hub renders.
   ========================================================================== */
'use strict';

const PLAYBOOK = require('../../content/marketing-playbook.js');
const K = require('./well-knowledge.js');
const FINDER = require('../../content/journey.js').finderData;

const V = () => PLAYBOOK.needStates || {};
const keysOf = (dim) => (V()[dim] || []).map((o) => o.key);

/* ── The vocabulary ──────────────────────────────────────────────────────── */

/* Everything a form needs to render, and everything validate() checks against.
   Compass, villages and pillars come from the destination bank rather than
   being restated here — one list, one owner. */
async function vocabulary() {
  const fw = await K.frameworks();
  const villages = await K.villages();
  return {
    current: V().current || [],
    desired: V().desired || [],
    trigger: V().trigger || [],
    uncertainty: V().uncertainty || [],
    readiness: V().readiness || [],
    party: V().party || [],
    constraints: V().constraints || [],
    scales: V().scales || [],
    orientation: (PLAYBOOK.travellerOrientations || []).map((o) => ({
      key: o.key, label: o.label || o.name || o.key
    })),
    compass: (fw.compass || []).map((c) => ({ key: c.key, label: c.name })),
    continuum: (fw.continuum || []).map((c) => ({ key: c.key, label: c.name })),
    pillars: (fw.pillars || []).map((p) => ({ key: p.key, label: p.name })),
    villages: villages.map((v) => ({ key: v.key, label: v.name }))
  };
}

/* ── The two orientation scales ──────────────────────────────────────────
   The Finder asks a traveller how deep they want to go and stores one of three
   answers. The persona quiz asks an advisor the same thing about their ideal
   client and stores one of four. Three map cleanly; `sceptical` has no Finder
   equivalent, because somebody who would never call it wellness does not
   finish a wellness quiz — and that absence is information, not a gap to fill.

   Canonical is the FOUR-value scale, because it is the one already written
   into advisor rows and validated by campaign-profile.js against the bank. */
const FINDER_ORIENTATION = {
  led: 'primary',
  balance: 'secondary-intentional',
  vacation: 'secondary-casual'
};

function orientationKey(any) {
  const v = String(any || '').trim();
  if (!v) return null;
  if (FINDER_ORIENTATION[v]) return FINDER_ORIENTATION[v];
  const known = (PLAYBOOK.travellerOrientations || []).some((o) => o.key === v);
  return known ? v : null;
}

/* ── Seeding from the Finder ─────────────────────────────────────────────
   Six answers in, a starting need-state out. Every mapping below is a
   statement about what the person selected, never about what it implies about
   them.

   `intention` and `place` carry village weights already — they are the Finder's
   own scoring table — so they are read from the bank rather than restated. What
   is added here is the translation into current/desired state and Compass, and
   that translation is the part a human should argue with, which is why the
   advisor sees it pre-filled and editable rather than applied silently. */
const INTENTION = {
  restore: { desired: ['rested', 'spacious'], current: ['under-rested'], compass: ['restore'] },
  reflect: { desired: ['grounded', 'present'], current: ['overstimulated'], compass: ['reflect'] },
  move:    { desired: ['energized'],           current: ['under-rested'],  compass: ['move'] },
  nourish: { desired: ['cared-for', 'curious'],current: ['craving-care'],  compass: ['nourish'] },
  connect: { desired: ['connected'],           current: ['disconnected'],  compass: ['reconnect'] }
};

const PACE = {
  still:  { rhythm: 0.25, activity: 0.15, continuum: ['relax', 'restore'] },
  gentle: { rhythm: 0.5,  activity: 0.4,  continuum: ['relax', 'restore', 'reconnect'] },
  active: { rhythm: 0.6,  activity: 0.85, continuum: ['relax', 'reconnect'] }
};

const COMPANIONS = {
  solo:    { party: 'solo',    social: 0.2 },
  partner: { party: 'partner', social: 0.25 },
  friends: { party: 'friends', social: 0.7 },
  family:  { party: 'family',  social: 0.65 }
};

/* Nothing here reads `recognition`. It decides whether Eclipse is surfaced and
   nothing else — content/journey.js already draws that line and it is the
   right one: `nobody is told they are burned out by a website`. Letting it add
   weight to Longevity would make a recommendation out of a feeling somebody
   half-admitted to a quiz. */
async function seedFrom(answers) {
  const a = answers || {};
  const villages = {};
  const compass = {};
  const current = {};
  const desired = {};

  const bump = (bag, key, by) => { if (key) bag[key] = Math.min(1, (bag[key] || 0) + by); };

  /* Village weights come from the Finder's own table, normalised to 0-1 so a
     need-state assembled here and one typed by an advisor are comparable.

     Keyed on q.id and o.value, never on position. The Finder's question order
     is editorial and has changed before; a positional read would keep working,
     score the wrong dimension, and look exactly like a person with unusual
     taste. */
  ((FINDER && FINDER.questions) || []).forEach((q) => {
    const chosen = a[q.id];
    if (!chosen) return;
    const opt = (q.options || []).filter((o) => o.value === chosen)[0];
    if (!opt || !opt.weights) return;
    /* The Finder's heaviest single weight is 4 (place). Dividing by it puts
       every dimension on the same 0-1 scale without flattening the ordering
       the Finder's own research established. */
    Object.keys(opt.weights).forEach((v) => bump(villages, v, opt.weights[v] / 4));
  });

  const intent = INTENTION[a.intention];
  if (intent) {
    intent.compass.forEach((c) => bump(compass, c, 1));
    intent.desired.forEach((d) => bump(desired, d, 0.8));
    intent.current.forEach((c) => bump(current, c, 0.6));
  }

  const pace = PACE[a.pace] || null;
  const comp = COMPANIONS[a.companions] || null;

  return {
    current, desired, villages, compass,
    pillars: {},
    /* The advisor's job, not the quiz's. Six answers cannot know why now. */
    trigger: null,
    uncertainty: null,
    readiness: null,
    orientation: orientationKey(a.orientation),
    party: comp ? comp.party : null,
    adults: null, children: null, mobility: null,
    nights: null, budget: null,
    constraints: [],
    rhythm: pace ? pace.rhythm : null,
    activity: pace ? pace.activity : null,
    social: comp ? comp.social : null,
    experience: null,
    continuumFloor: pace ? pace.continuum[0] : null,
    continuumCeiling: pace ? pace.continuum[pace.continuum.length - 1] : null
  };
}

/* ── Validation ──────────────────────────────────────────────────────────
   Returns the problems rather than throwing, so a screen can render every one
   of them at once instead of the first. An unknown key is always a problem: it
   means a form posted something the bank does not define, and silently
   dropping it would make a need-state that scores differently from the one the
   advisor thought they saved. */
const WEIGHTED = ['current', 'desired', 'villages', 'compass', 'pillars'];
const SINGLE = { trigger: 'trigger', uncertainty: 'uncertainty', readiness: 'readiness', party: 'party' };
const SCALES = ['rhythm', 'activity', 'social', 'experience'];

async function validate(state) {
  const s = state || {};
  const problems = [];
  const fw = await K.frameworks();
  const villages = await K.villages();

  const allowed = {
    current: keysOf('current'),
    desired: keysOf('desired'),
    villages: villages.map((v) => v.key),
    compass: (fw.compass || []).map((c) => c.key),
    pillars: (fw.pillars || []).map((p) => p.key)
  };

  WEIGHTED.forEach((dim) => {
    const bag = s[dim];
    if (bag == null) return;
    if (typeof bag !== 'object' || Array.isArray(bag)) { problems.push(dim + ' must be a map of key to weight'); return; }
    Object.keys(bag).forEach((k) => {
      if (allowed[dim].indexOf(k) === -1) problems.push(dim + ': unknown key "' + k + '"');
      const w = bag[k];
      if (typeof w !== 'number' || w < 0 || w > 1) problems.push(dim + '.' + k + ': weight must be between 0 and 1');
    });
  });

  Object.keys(SINGLE).forEach((field) => {
    const v = s[field];
    if (v == null) return;
    if (keysOf(SINGLE[field]).indexOf(v) === -1) problems.push(field + ': unknown value "' + v + '"');
  });

  if (s.orientation != null && orientationKey(s.orientation) === null) {
    problems.push('orientation: unknown value "' + s.orientation + '"');
  }

  [].concat(s.constraints || []).forEach((c) => {
    if (keysOf('constraints').indexOf(c) === -1) problems.push('constraints: unknown value "' + c + '"');
  });

  SCALES.forEach((k) => {
    const v = s[k];
    if (v == null) return;
    if (typeof v !== 'number' || v < 0 || v > 1) problems.push(k + ': must be between 0 and 1');
  });

  const order = fw.continuumOrder || [];
  ['continuumFloor', 'continuumCeiling'].forEach((k) => {
    if (s[k] != null && order.indexOf(s[k]) === -1) problems.push(k + ': not a continuum rung');
  });
  if (s.continuumFloor && s.continuumCeiling &&
      order.indexOf(s.continuumFloor) > order.indexOf(s.continuumCeiling)) {
    problems.push('continuumFloor sits deeper than continuumCeiling');
  }

  ['adults', 'children', 'nights'].forEach((k) => {
    if (s[k] == null) return;
    if (!Number.isInteger(s[k]) || s[k] < 0) problems.push(k + ': must be a whole number');
  });

  /* The one shape rule worth enforcing here rather than at the database: a
     need-state carrying prose is a need-state that will eventually reach a
     prompt. Catch it where it is written, not where it leaks. */
  Object.keys(s).forEach((k) => {
    if (typeof s[k] === 'string' && SINGLE[k] === undefined && k !== 'orientation' &&
        k !== 'mobility' && k !== 'budget' && k !== 'continuumFloor' && k !== 'continuumCeiling') {
      problems.push(k + ': free text is not allowed in a need-state');
    }
  });

  return problems;
}

/* Which fields the advisor changed from what the Finder proposed. Two columns
   in the schema, and the only thing that will ever say whether the Finder is
   reading people correctly. */
function overridden(seeded, edited) {
  const a = seeded || {}, b = edited || {};
  const same = (x, y) => JSON.stringify(x === undefined ? null : x) === JSON.stringify(y === undefined ? null : y);
  return Object.keys(b).filter((k) => !same(a[k], b[k])).sort();
}

module.exports = { vocabulary, seedFrom, validate, orientationKey, overridden, FINDER_ORIENTATION };
