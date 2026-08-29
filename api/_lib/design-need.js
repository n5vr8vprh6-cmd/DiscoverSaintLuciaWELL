/* ============================================================================
   DESIGN NEED — what the model is allowed to know about a traveller
   ----------------------------------------------------------------------------
   Every prompt in design-generate.js is built from the return value of this
   file and from nothing else. It is the whole privacy boundary, and it is one
   screen of code so that it can be read in one sitting.

   ── IT COPIES NAMED FIELDS. IT DOES NOT FILTER ─────────────────────────────
   Same rule as gtm-generate.js:7-16, for the same reason: a filter can be
   written wrong, an absent parameter cannot. There is no denylist here, no
   Object.assign, no spread, no delete. Every value in the output was named in
   this file by somebody who had to type it out.

   The difference matters more here than it did there. gtm-generate.js is never
   handed a share at all — there is no path from journey_shares into a campaign
   prompt. This file IS handed the traveller's record, because designing their
   journey is the entire point. So the guarantee cannot come from the data not
   being nearby. It comes from the shape of the projection.

   ── WHY THE DATABASE MAKES THIS EASY ───────────────────────────────────────
   journey_consultations has NO free-text column. Not a discouraged one — none.
   So "does prose reach the model?" is answerable by reading a column list
   rather than by auditing a filter, and the day somebody wants to write about
   the person, the only place to put it is journey_shares.advisor_notes, which
   this file never opens.

   ── WHAT IT SEES ───────────────────────────────────────────────────────────
   Compass, village and pillar KEYS with their weights. Two continuum rung
   codes. Orientation, rhythm, why-now, readiness, budget and constraint codes.
   Party as counts plus a mobility code. Nights. The chosen properties through
   K.mayAssert(), which returns five fields and no prices. Rhythm day keys. The
   advisor's own name and business — theirs to give.

   ── WHAT IT NEVER SEES ─────────────────────────────────────────────────────
   Any consumer name, email or phone. `context` — the free-text box on the
   Finder, the single most personal field in the system. `timing` as the
   traveller typed it. Any advisor note. Any uuid, share id or token. The raw
   `answers` object. And from the property records: `watch`, `verify`,
   `priceTag`, `price` — the last three because cost is advisor-entered and a
   model that has seen a number will eventually print one.

   ── THE SIDE BENEFIT WORTH NAMING ──────────────────────────────────────────
   Because the projection identifies nobody, staff in view-as can debug a
   shortlist without unmasking anything. The privacy property and the support
   property are the same property.

   ── TESTING IT ─────────────────────────────────────────────────────────────
   tools/design-privacy-test.js does NOT assert on field names. Field-name
   assertions are necessary and not sufficient: a denylist passes cleanly the
   day someone pipes `context` into a field called `background`. So the fixture
   puts a distinctive sentinel VALUE in every share field and sweeps the whole
   composed payload for every sentinel, on every prompt.
   ========================================================================== */
'use strict';

const K = require('./well-knowledge.js');
const N = require('./need-state.js');

/* Numbers are rounded rather than passed through. Two decimal places is more
   than the prose needs, and a long float is a fingerprint: 0.6173913043 is
   effectively an id for one particular combination of answers. */
const w = (n) => Math.round(Number(n) * 100) / 100;

/* ── Nothing leaves here that is not in the vocabulary ────────────────────
   TRUNCATING IS NOT VALIDATING, and the difference is the whole boundary.
   These helpers used to slice a value to 40 characters and pass it on, which
   let free text through in any field typed as a code: the privacy sweep found
   it by putting an advisor's private note in `constraints` and a consumer's
   name in `party`, and watching both arrive in the prompt.

   need-state.js already forbids prose in a need-state — but it forbids it on
   SAVE, and it exempts mobility and orientation. A boundary that depends on
   an upstream validator having run is not a boundary. So every code is checked
   against the vocabulary here, at the point it would leave, and anything not
   in the list becomes null.

   Dropping an unrecognised value is the safe direction for this to fail. The
   cost is a prompt that knows one thing less about a traveller; the cost of
   the other direction is their words in a third-party log. */
function keysOf(vocab, dim) {
  const seen = Object.create(null);
  (vocab[dim] || []).forEach((o) => { seen[o.key] = true; });
  return seen;
}

function weights(bag, allowed) {
  const out = {};
  Object.keys(bag || {}).forEach((k) => {
    if (!allowed[k]) return;
    const v = w(bag[k]);
    if (v > 0) out[k] = v;
  });
  return out;
}

const code = (v, allowed) => {
  if (v == null) return null;
  const s = String(v);
  return allowed[s] ? s : null;
};

const codes = (a, allowed) => (Array.isArray(a)
  ? a.slice(0, 12).map((v) => code(v, allowed)).filter(Boolean)
  : []);

/* Mobility is the one code with no vocabulary list yet — it is a column in 022
   and a field in need-state.js, but nobody has written the options. Until
   somebody does, it is constrained by SHAPE rather than by membership: a code
   is lowercase, unspaced and short, and prose is none of those. This is weaker
   than a list and it is labelled as such, so that adding the vocabulary is an
   obvious improvement rather than an invisible one. */
const CODE_SHAPE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const shapedCode = (v) => {
  if (v == null) return null;
  const s = String(v);
  return CODE_SHAPE.test(s) ? s : null;
};
/* The null check comes FIRST and is not decoration: Number(null) is 0, so
   without it an unanswered party size reaches the model as a confident
   "0 adults, 0 children" — a fact, invented, about who is travelling. Unknown
   has to stay unknown all the way down. */
const count = (n) => {
  if (n == null || n === '') return null;
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), 99) : null;
};

/* The four scales are 0-1 positions between two named poles, not codes.
   code() stringified them into "0.5", which is not a value any prompt can do
   anything with. They stay numeric here and design-generate.js names the poles,
   because the poles are vocabulary and this file does not write sentences. */
const scale = (n) => {
  if (n == null || n === '') return null;
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(Math.max(w(v), 0), 1) : null;
};

/* ── The traveller ─────────────────────────────────────────────────────────
   Every line names its field. Adding one is a deliberate act with a diff. */
function travellerFor(need, vocab) {
  const n = need || {};
  const v = vocab || {};
  const ok = (dim) => keysOf(v, dim);
  return {
    current: weights(n.current, ok('current')),
    desired: weights(n.desired, ok('desired')),
    villages: weights(n.villages, ok('villages')),
    compass: weights(n.compass, ok('compass')),
    pillars: weights(n.pillars, ok('pillars')),

    depthFloor: code(n.continuumFloor, ok('continuum')),
    depthCeiling: code(n.continuumCeiling, ok('continuum')),

    trigger: code(n.trigger, ok('trigger')),
    uncertainty: code(n.uncertainty, ok('uncertainty')),
    readiness: code(n.readiness, ok('readiness')),
    orientation: code(n.orientation, ok('orientation')),
    budget: code(n.budget, ok('budget')),

    party: code(n.party, ok('party')),
    adults: count(n.adults),
    children: count(n.children),
    mobility: shapedCode(n.mobility),
    nights: count(n.nights),

    rhythm: scale(n.rhythm),
    activity: scale(n.activity),
    social: scale(n.social),
    experience: scale(n.experience),
    constraints: codes(n.constraints, ok('constraints'))
  };
}

/* ── The advisor ───────────────────────────────────────────────────────────
   Theirs to give, and the itinerary is co-branded, so the model needs to know
   whose voice it is writing in. Nothing else about them travels: not their
   email, not their id, not their other clients. */
const ADVISOR_FIELDS = ['first_name', 'last_name', 'business', 'host_agency'];

function advisorFor(advisor) {
  const a = advisor || {};
  const out = {};
  ADVISOR_FIELDS.forEach((f) => { if (a[f]) out[f] = String(a[f]).slice(0, 120); });
  return out;
}

/* ── The places ────────────────────────────────────────────────────────────
   K.mayAssert() is the boundary, not a convenience. It returns exactly
   { name, hook, villages, compass, pillars } — so a property's watch note, its
   verification caveats and every price it carries cannot reach a prompt even
   if this file asked for the whole record. The names of the chosen places are
   the only free text in the entire projection, and they are ours.

   MISMATCHES ARE NOT SENT. They are a rule engine's output, written for an
   advisor, and a model handed a downside will rewrite it into something softer
   or worse invent a second one. The sentences ship exactly as design-match.js
   composed them or not at all. */
async function placesFor(slugs) {
  const out = [];
  for (const s of (slugs || []).slice(0, 6)) {
    const p = await K.mayAssert(String(s));
    if (p) out.push(p);
  }
  return out;
}

/* ── The recipe ────────────────────────────────────────────────────────────
   Day keys and their one-line shape. The recipe is ours, it is published, and
   it says nothing about the traveller. */
async function recipeFor(key) {
  if (!key) return null;
  const r = await K.recipe(String(key));
  if (!r) return null;
  return {
    key: r.key,
    name: r.name,
    sub: r.sub || null,
    rhythm: (r.rhythm || []).map((d) => ({ key: d.key, label: d.label, text: d.text }))
  };
}

/* ── The one call ──────────────────────────────────────────────────────────
   Deliberately takes need / advisor / slugs / recipeKey as four SEPARATE
   parameters rather than a session or a share. There is no object here holding
   a consumer's name, so there is nothing to forget to strip. */
async function project(input) {
  const i = input || {};
  return {
    traveller: travellerFor(i.need, await N.vocabulary()),
    advisor: advisorFor(i.advisor),
    places: await placesFor(i.slugs),
    recipe: await recipeFor(i.recipeKey)
  };
}

module.exports = {
  project, travellerFor, advisorFor, placesFor, recipeFor,
  ADVISOR_FIELDS
};
