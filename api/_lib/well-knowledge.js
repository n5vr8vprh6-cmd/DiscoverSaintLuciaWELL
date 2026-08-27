/* ============================================================================
   WELL KNOWLEDGE — the adapter, and the only thing that knows where
   destination intelligence comes from
   ----------------------------------------------------------------------------
   Today it reads content/well-knowledge.generated.js. Tomorrow, when Radar is
   writing property facts continuously, it reads Supabase instead. Nothing above
   this file changes on that day, which is the whole reason it exists.

   ── EVERY ACCESSOR IS ASYNC, AND THAT IS DELIBERATE ───────────────────────
   V0 resolves synchronously from a required file. Returning promises anyway
   costs one `await` per call site now and saves rewriting every call site when
   the backend becomes a query. This is the cheapest decision in the feature and
   the one most likely to look pointless until the day it isn't.

   ── mayAssert() IS THE PROMPT BOUNDARY ────────────────────────────────────
   Everything else here is for advisor eyes. mayAssert() is the ONLY projection
   that may be composed into a model payload, and it deliberately mirrors what
   content/campaign-facts.js allows: name, hook, and the three key vectors.

   No price. No inclusions. No add-ons. No watch note. No verify note. Not
   because a prompt would leak them — because a model handed an unknown turns
   it into an invention, and a model handed a price will quote it.

   The exclusion is structural, not a filter: mayAssert builds its return value
   by naming the five fields it copies. A filter can be written wrong; a field
   that is never read cannot be returned.

   ── NO CALLER SEES A PATH OR A TABLE NAME ─────────────────────────────────
   If you find yourself requiring content/well-knowledge.generated.js anywhere
   else, the abstraction has already failed. Add an accessor here instead.

   ── IT NEVER THROWS ───────────────────────────────────────────────────────
   Same contract as openai.js and core.js. A missing bank is a state the Hub
   renders in — "the knowledge bank has not been generated on this deployment"
   — not an exception. `ready()` reports it; every accessor degrades to empty.
   ========================================================================== */
'use strict';

/* ── Backend selection ───────────────────────────────────────────────────
   One env var, checked at call time rather than captured at require, so a
   test can flip it inside one process. `supabase` is not implemented yet and
   falls through to the file — see the note on V1 at the bottom. */
const backend = () => process.env.WELL_KNOWLEDGE === 'supabase' ? 'supabase' : 'generated-file';

/* REQUIRED AT MODULE TOP LEVEL, ON PURPOSE.

   Vercel's bundler traces string-literal requires to decide which files ship
   inside a function. content/campaign-facts.js and content/marketing-playbook.js
   are already traced this way and land in the deployed bundle; matching their
   shape exactly is cheaper than discovering in production that a require buried
   in a lazy getter was not followed.

   The try/catch stays because a fresh clone has no bank until somebody runs the
   extractor, and that is a state the Hub should render in rather than crash on. */
let _bank = null;
try {
  _bank = require('../../content/well-knowledge.generated.js');
} catch (err) {
  console.error('well-knowledge bank missing — run node tools/build-well-knowledge.js');
  _bank = null;
}

function bank() { return _bank; }

const EMPTY = {
  provenance: { fieldGuideEdition: null, verified: { core: null, expanded: null }, generated: null },
  frameworks: { compass: [], continuum: [], continuumOrder: [], pillars: [], evidence: [], tiers: [], models: [] },
  villages: [], properties: [], supporting: [], basecamps: [], recipes: [], finderRows: [], suitability: []
};

const B = () => bank() || EMPTY;

/* ── Provenance ──────────────────────────────────────────────────────────── */

/* Which bank is live, and how old its facts are. Rendered in the workspace
   footer so "which source am I looking at" is never a guess. */
async function version() {
  const b = B();
  return {
    bank: b.provenance.fieldGuideEdition,
    verified: b.provenance.verified,
    generated: b.provenance.generated,
    source: backend(),
    ready: Boolean(bank())
  };
}

async function ready() { return Boolean(bank()); }

/* A stable string identifying the knowledge in force, frozen onto a design
   session at creation. An itinerary issued in August must stay explainable
   against the facts that were true in August; deriving this live would quietly
   change the answer to a question about the past. Same argument as
   gtm_plan.rung_at_generation. */
async function versionStamp() {
  const b = B();
  return [b.provenance.fieldGuideEdition, b.provenance.generated].filter(Boolean).join(' · ') || 'unknown';
}

/* ── Frameworks ──────────────────────────────────────────────────────────── */
async function frameworks() { return B().frameworks; }

async function villages() { return B().villages; }

/* Resolves anything that has ever named a village to this site's key:
   'rainforest', 'nature', 'Nature & Renewal', 'Nature & Renewal Village', and
   the qualified forms the Field Guide uses such as
   'Longevity (specialist layer)'.

   This matters more than it looks. journey_shares.villages holds DISPLAY NAMES
   — js/journey.js posts score().map(v => v.name) — so anything reading a
   stored Journey has to come through here. Score from `answers`, not from
   `villages`; this exists for the times you have only the name. */
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

async function villageKey(any) {
  const n = norm(any);
  if (!n) return null;
  const vs = B().villages;
  for (let i = 0; i < vs.length; i++) {
    if (vs[i].aliases.indexOf(n) !== -1) return vs[i].key;
  }
  /* Longest-prefix fallback, so a qualifier never becomes a silent miss. */
  let best = null, key = null;
  vs.forEach((v) => v.aliases.forEach((a) => {
    if (n.indexOf(a) === 0 && (!best || a.length > best.length)) { best = a; key = v.key; }
  }));
  return key;
}

/* Rung index on the six-step ladder, for the depth arithmetic in design-match.
   Returns -1 for anything unrecognised so a caller can tell "not a rung" from
   "the first rung". */
async function continuumIndex(key) {
  return B().frameworks.continuumOrder.indexOf(String(key || ''));
}

/* ── Properties ──────────────────────────────────────────────────────────── */

/* Everything the matcher may score. DEEP and COLLECTION only — SUPPORTING and
   BASECAMPS carry a village and one line of signal, which is not a vector, and
   inventing one for them is exactly the smoothing this system refuses. */
async function properties(filter) {
  const f = filter || {};
  let list = B().properties.filter((p) => p.scorable);
  if (f.village) list = list.filter((p) => p.villages.indexOf(f.village) !== -1);
  if (f.collection) list = list.filter((p) => p.collection === f.collection);
  if (f.tier) list = list.filter((p) => p.tier === f.tier);
  return list;
}

async function property(slug) {
  return B().properties.filter((p) => p.slug === String(slug || ''))[0] || null;
}

/* The rest of the village: real inventory an advisor can reach for, presented
   with its tier, and never ranked against a need-state. */
async function alsoInVillage(villageKeyIn) {
  const k = String(villageKeyIn || '');
  const b = B();
  return {
    supporting: b.supporting.filter((s) => s.village === k),
    basecamps: b.basecamps.filter((s) => s.village === k)
  };
}

/* ── The prompt boundary ─────────────────────────────────────────────────── */

/* THE ONLY SHAPE A MODEL PAYLOAD MAY CONTAIN.

   Five fields, copied by name. Adding a sixth is a decision about what an
   advisor's client-facing prose may assert, not a convenience — read the file
   header before you do it, and add a case to tools/design-privacy-test.js in
   the same commit. */
async function mayAssert(slug) {
  const p = await property(slug);
  if (!p) return null;
  return {
    name: p.name,
    hook: p.hook,
    villages: p.villages.slice(),
    compass: p.compass.slice(),
    pillars: p.pillars.slice()
  };
}

/* What an advisor is shown beneath a recommendation, and what must never be
   composed into a prompt. Kept as its own accessor so the two audiences are
   two call sites rather than one object somebody filters. */
async function provenanceFor(slug) {
  const p = await property(slug);
  if (!p) return null;
  return {
    source: p.provenance.source,
    verified_at: p.provenance.verified_at,
    confidence: p.provenance.confidence,
    tier: p.tier,
    priceTag: p.priceTag,
    watch: p.watch,
    depthKnown: Boolean(p.continuum),
    depthNote: p.continuumNote
  };
}

/* ── Planning material ───────────────────────────────────────────────────── */
async function recipes() { return B().recipes; }
async function recipe(key) { return B().recipes.filter((r) => r.key === String(key || ''))[0] || null; }

/* "My client says…" — the eight sentences and what they imply. A lookup table,
   read as a lookup table. A model asked to do this would paraphrase it. */
async function finderRows() { return B().finderRows; }

/* Suitability checks, as machine-addressable rules rather than prose, so the
   mismatch engine can cite one by key. */
async function suitabilityRules() { return B().suitability; }

module.exports = {
  version, versionStamp, ready,
  frameworks, villages, villageKey, continuumIndex,
  properties, property, alsoInVillage,
  mayAssert, provenanceFor,
  recipes, recipe, finderRows, suitabilityRules
};

/* ── V1, when Radar exists ────────────────────────────────────────────────
   Tables well_property / well_property_fact / well_framework, seeded from this
   same generated file by tools/seed-well-knowledge.js so the two can be
   diffed. Cutover is WELL_KNOWLEDGE=supabase, with automatic fallback to the
   file on 42P01 — the same degradation rule as every other table here.

   One thing V1 needs that V0 does not: a module-level cache keyed on
   versionStamp(). A function that queries thirty properties on every
   interaction of a live consultation is unusable in front of a prospect. */
