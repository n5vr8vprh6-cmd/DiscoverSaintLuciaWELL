/* ============================================================================
   BUILD WELL KNOWLEDGE — the destination bank ASK WELL reasons over
   ----------------------------------------------------------------------------
   Run:  node tools/build-well-knowledge.js          write content/well-knowledge.generated.js
         node tools/build-well-knowledge.js --check  fail if the file is out of date

   ── WHY GENERATED RATHER THAN REQUIRED ────────────────────────────────────
   The Field Guide lives in a sibling directory, outside this repository, so
   Vercel never sees it — a runtime require would work on this laptop and fail
   in production. Same reasoning, same shape, as build-campaign-facts.js.

   ── HOW THIS DIFFERS FROM campaign-facts.js ───────────────────────────────
   They read the same source and they are NOT the same bank, deliberately.

   campaign-facts.js is the CLAIMS ALLOW-LIST. It answers "what may an advisor
   assert in public marketing", and it drops price, continuum, included, addons
   and watch on the floor — "a number that never enters the bank cannot leave
   it in a caption."

   This bank answers a different question: "what should an advisor know while
   sitting with a client." It therefore carries exactly the fields the other
   one refuses to. That asymmetry is the point, and it is why widening
   campaign-facts.js to serve ASK WELL would have been the wrong move: it would
   silently widen what an advisor may publish.

   Nothing here may reach a model prompt except through K.mayAssert() in
   api/_lib/well-knowledge.js, which projects a record down to the same narrow
   shape campaign-facts.js allows.

   ── THE VILLAGE VOCABULARY IS RECONCILED HERE, AND ONLY HERE ──────────────
   Three vocabularies exist for six villages:

     this site      longevity · rainforest · ocean · heritage · movement · connection
     Field Guide    longevity · nature     · ocean · heritage · movement · connection
     the database   "Nature & Renewal Village" — DISPLAY NAMES, because
                    js/journey.js posts score().map(v => v.name)

   The site's keys win. Not arbitrarily: content/villages.js documents that its
   key also addresses a page anchor, an asset set, a media manifest and the
   Finder's own weights, so renaming it breaks four things to change a string
   nobody reads. Every alias travels on the village record and resolves through
   K.villageKey().

   ── WHAT IS SCORABLE AND WHAT IS NOT ──────────────────────────────────────
   DEEP and COLLECTION carry Village/Compass/Pillar vectors and are scored.
   SUPPORTING and BASECAMPS carry a village and one line of signal — no vectors
   — so they are carried for display and NEVER scored. Inventing a vector for
   them would be exactly the smoothing this system exists to refuse.

   Sixteen records have no continuum band at all (all fifteen of COLLECTION,
   plus A'ILA, whose band is deliberately null in the Field Guide). They carry
   continuum: null and the matcher reports depth_unknown — a named unknown
   rather than an imputed band.

   THE DIFF ON REGENERATION IS THE HUMAN CONFIRMATION STEP.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* Env-overridable so the extraction can be fixture-tested. Without this the
   only way to prove the Field Guide wins is to create a folder beside the
   repo, which makes it the kind of test nobody runs. */
const GUIDE = process.env.WELL_GUIDE || path.join(ROOT, '..', 'field-guide', 'content');
const OUT = process.env.WELL_KNOWLEDGE_OUT || path.join(ROOT, 'content', 'well-knowledge.generated.js');
const CHECK = process.argv.includes('--check');

/* An author-time tool. It must fail loudly rather than silently emit a thinner
   bank — a consultation run against half a knowledge bank is worse than one
   that refused to build. */
if (!fs.existsSync(path.join(GUIDE, 'properties.js'))) {
  console.error('\n  The Field Guide is not beside this repo.');
  console.error('  Expected: ' + GUIDE);
  console.error('  This tool runs on a machine that has both; it is not part of the deploy.\n');
  process.exit(1);
}

const guideProps = require(path.join(GUIDE, 'properties.js'));
const guideFw = require(path.join(GUIDE, 'frameworks.js'));
const guideCopy = require(path.join(GUIDE, 'copy.js'));
const { VILLAGES } = require(path.join(ROOT, 'content', 'villages.js'));
const MEDIA = require(path.join(ROOT, 'content', 'properties-media.js'));

/* ── Normalisation ───────────────────────────────────────────────────────── */
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const trim = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/* Field Guide village key -> this site's key. The only pair that differs is
   nature/rainforest, but the map is written in full so a future rename is a
   one-line edit here rather than a hunt. */
const FG_TO_SITE = {
  longevity: 'longevity',
  nature: 'rainforest',
  ocean: 'ocean',
  heritage: 'heritage',
  movement: 'movement',
  connection: 'connection'
};

/* Every string that should resolve to a village key, built from both sources
   rather than typed out — a hand-written alias list is a list that goes stale
   the first time a name changes. */
const VILLAGE_ALIAS = {};
function alias(str, key) {
  const n = norm(str);
  if (n) VILLAGE_ALIAS[n] = key;
}
VILLAGES.forEach((v) => {
  alias(v.key, v.key);
  alias(v.name, v.key);                                   /* "Longevity Village"      */
  alias(String(v.name).replace(/\s*Village\s*$/i, ''), v.key); /* "Longevity"         */
  if (v.short) alias(v.short, v.key);
});
(guideFw.villages || []).forEach((v) => {
  const key = FG_TO_SITE[v.key];
  if (!key) return;
  alias(v.key, key);                                      /* "nature"                 */
  alias(v.name, key);                                     /* "Nature & Renewal"       */
});

/* DEEP carries qualified names such as "Longevity (specialist layer)". Resolve
   on the longest alias that prefixes the string, so a qualifier never creates
   a silent miss. */
function villageKey(any) {
  const n = norm(any);
  if (!n) return null;
  if (VILLAGE_ALIAS[n]) return VILLAGE_ALIAS[n];
  let best = null;
  Object.keys(VILLAGE_ALIAS).forEach((a) => {
    if (n.indexOf(a) === 0 && (!best || a.length > best.length)) best = a;
  });
  return best ? VILLAGE_ALIAS[best] : null;
}

const COMPASS_ALIAS = {};
(guideFw.compass || []).forEach((c) => { COMPASS_ALIAS[norm(c.key)] = c.key; COMPASS_ALIAS[norm(c.name)] = c.key; });
const compassKey = (any) => COMPASS_ALIAS[norm(any)] || null;

const PILLAR_ALIAS = {};
(guideFw.pillars || []).forEach((p) => { PILLAR_ALIAS[norm(p.key)] = p.key; PILLAR_ALIAS[norm(p.name)] = p.key; });
const pillarKey = (any) => PILLAR_ALIAS[norm(any)] || null;

const CONTINUUM_ORDER = (guideFw.continuum || []).map((c) => c.key);
const continuumKey = (any) => {
  const n = norm(any);
  const hit = (guideFw.continuum || []).find((c) => norm(c.key) === n || norm(c.name) === n);
  return hit ? hit.key : null;
};

/* COLLECTION stores compass and pillars as ' · '-joined prose. Split, resolve,
   and drop what does not resolve rather than passing an unrecognised token
   through — an unresolved key downstream looks exactly like a real one. */
function splitKeys(str, resolve) {
  return String(str || '').split('·')
    .map((s) => resolve(s.replace(/\bpotential\b/i, '')))
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
}
const keysFrom = (arr, resolve) =>
  [].concat(arr || []).map(resolve).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

/* ── Facts ───────────────────────────────────────────────────────────────── */
/* Every fact carries its own provenance. `confidence` is one of the Field
   Guide's five evidence codes — an ordinal label with a documented meaning,
   never a number. A 0.87 confidence is the same lie as a 94/100 fit. */
const CORE_VERIFIED = (guideFw.verified && guideFw.verified.core) || null;
const EXPANDED_VERIFIED = (guideFw.verified && guideFw.verified.expanded) || null;

function fact(text, source, verifiedAt, confidence) {
  const t = trim(text);
  if (!t) return null;
  return { text: t, source, verified_at: verifiedAt, confidence };
}
const facts = (arr, source, verifiedAt, confidence) =>
  [].concat(arr || []).map((t) => fact(t, source, verifiedAt, confidence)).filter(Boolean);

function image(folder) {
  const m = MEDIA.properties && MEDIA.properties[folder];
  if (!m) return null;
  return { src: m.src, base: m.base, widths: m.widths, w: m.w, h: m.h, alt: m.alt, source: m.source, retrieved: m.retrieved };
}

/* ── The fifteen deep profiles ─────────────────────────────────────────────
   TIER IS NULL HERE, AND THAT IS THE ACCURATE VALUE. The A-B-C-D scale is a
   property of the EXPANDED scan: the source declares tier A for the Collection
   and carries an explicit `tier` field on Supporting and Basecamps. The fifteen
   deep profiles predate that scan and carry no tier field at all — they are the
   core set, verified in their own right on 10 Aug 2026.

   Defaulting the absent value to 'D' — which this file did until it was caught
   on screen — does not read as "unclassified". FW.tiers defines D as "No verified
   formal WELL offer found", so the workspace was asserting exactly that about the
   fifteen most-researched properties in the guide, to an advisor, in front of a
   client. An absent classification has to stay absent; the renderer shows nothing
   rather than a letter, because a letter is a claim. */
const deep = (guideProps.DEEP || []).map((p) => {
  const folder = String(p.n).padStart(2, '0') + '-' + p.slug;
  return {
    slug: p.slug,
    n: p.n,
    name: p.name,
    folder,
    collection: 'deep',
    tier: null,
    scorable: true,

    villages: keysFrom(p.villages, villageKey),
    compass: keysFrom(p.compass, compassKey),
    /* null, never imputed. A'ILA's band is deliberately absent upstream. */
    continuum: p.continuum ? keysFrom(p.continuum, continuumKey) : null,
    continuumNote: trim(p.continuumNote) || null,
    pillars: keysFrom(p.pillars, pillarKey),

    model: trim(p.model),
    modelTag: trim(p.modelTag),
    hook: trim(p.lead),

    included: facts(p.included, 'property_official', CORE_VERIFIED, 'VERIFIED OFFER'),
    addons: facts(p.addons, 'property_official', CORE_VERIFIED, 'VERIFIED OFFER'),
    price: fact(p.price, 'property_official', CORE_VERIFIED, p.priceTag || 'PUBLIC PRICE'),
    priceTag: p.priceTag || null,

    bestFor: trim(p.bestFor),
    role: trim(p.role),
    watch: facts([p.watch], 'guide_editorial', CORE_VERIFIED, 'GUEST SIGNAL'),
    watchLevel: p.watchLevel || null,

    image: image(folder),
    provenance: { source: 'field-guide-deep', verified_at: CORE_VERIFIED, confidence: 'VERIFIED OFFER', tier: null }
  };
});

/* ── The expanded collection — tier A, scorable, no depth band ───────────── */
const collection = (guideProps.COLLECTION || []).map((c) => ({
  /* Kebab, to match the deep profiles' own slugs. These become URL fragments,
     database values and test fixtures; 'balenboucheestate' is none of those
     things readable, and a slug is read far more often than it is written. */
  slug: String(c.name).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || null,
  n: null,
  name: c.name,
  folder: null,
  collection: 'collection',
  tier: 'A',
  scorable: true,

  villages: keysFrom([c.village], villageKey),
  compass: splitKeys(c.compass, compassKey),
  continuum: null,
  continuumNote: 'The expanded scan carries no depth mapping for this property.',
  pillars: splitKeys(c.pillars, pillarKey),

  model: null,
  modelTag: null,
  hook: trim(c.signal),

  included: [],
  addons: [],
  price: null,
  priceTag: null,

  bestFor: null,
  role: trim(c.role),
  watch: facts([c.verify], 'guide_editorial', EXPANDED_VERIFIED, 'QUOTE / CONFIRM'),
  watchLevel: null,

  image: null,
  provenance: { source: 'field-guide-expanded', verified_at: EXPANDED_VERIFIED, confidence: 'GUEST SIGNAL', tier: 'A' }
}));

/* ── Supporting and basecamps — carried, never scored ─────────────────────
   One village and one line of signal is not a vector. These surface as a list
   beside a shortlist so an advisor can see the rest of the village, and the
   matcher never touches them. */
const supporting = (guideProps.SUPPORTING || []).map((s) => ({
  name: s.name, village: villageKey(s.village), tier: 'B', scorable: false,
  signal: trim(s.signal),
  provenance: { source: 'field-guide-expanded', verified_at: EXPANDED_VERIFIED, confidence: 'GUEST SIGNAL', tier: 'B' }
}));

const basecamps = (guideProps.BASECAMPS || []).map((b) => ({
  name: b.name, village: villageKey(b.village), tier: b.tier, scorable: false,
  signal: trim(b.role),
  provenance: { source: 'field-guide-expanded', verified_at: EXPANDED_VERIFIED, confidence: 'QUOTE / CONFIRM', tier: b.tier }
}));

/* ── Frameworks, recipes and the intention finder ─────────────────────────
   Villages are re-keyed to this site's vocabulary on the way through, so a
   consumer of this bank never meets the Field Guide's own key. */
const villages = VILLAGES.map((v) => {
  const fg = (guideFw.villages || []).find((g) => FG_TO_SITE[g.key] === v.key) || {};
  return {
    key: v.key,
    name: v.name,
    short: v.short || fg.short || null,
    headline: trim(fg.headline) || null,
    question: trim(fg.question) || null,
    aliases: Object.keys(VILLAGE_ALIAS).filter((a) => VILLAGE_ALIAS[a] === v.key)
  };
});

const recipes = (guideCopy.COPY && guideCopy.COPY.recipes ? guideCopy.COPY.recipes : []).map((r) => ({
  key: norm(r.name).slice(0, 40),
  name: r.name,
  sub: trim(r.sub),
  compass: splitKeys(String(r.compass).replace(/\+/g, '·'), compassKey),
  depth: keysFrom(r.depth, continuumKey),
  villages: splitKeys(r.villages, villageKey),
  rhythm: (r.rhythm || []).map((d) => ({ key: norm(d[0]), label: d[0], text: trim(d[1]) })),
  start: trim(r.start),
  ask: trim(r.ask),
  pacing: trim(r.pacing) || null
}));

const finderRows = (guideCopy.COPY && guideCopy.COPY.finder ? guideCopy.COPY.finder.rows : []).map((r) => ({
  says: trim(r[0]),
  compass: splitKeys(String(r[1]).replace(/\+/g, '·'), compassKey),
  depth: keysFrom(r[2], continuumKey),
  villages: splitKeys(r[3], villageKey),
  properties: trim(r[4])
}));

const suitability = (guideCopy.COPY && guideCopy.COPY.suitability ? guideCopy.COPY.suitability.rows : [])
  .map((r) => ({ key: norm(r[0]).slice(0, 40), check: trim(r[0]), why: trim(r[1]) }));

/* ── Emit ────────────────────────────────────────────────────────────────── */
const generated = new Date().toISOString().slice(0, 10);

const banner = `/* ==========================================================================
   WELL KNOWLEDGE — GENERATED, DO NOT EDIT BY HAND
   --------------------------------------------------------------------------
   Written by tools/build-well-knowledge.js from the Field Guide (a sibling
   directory, not part of this deployment) and this site's own content.

   This is what ASK WELL reasons over: property intelligence deep enough to
   plan a consultation, carrying the fields campaign-facts.js deliberately
   refuses — price, depth band, inclusions, add-ons and watch-outs.

   NOTHING HERE MAY REACH A MODEL PROMPT except through K.mayAssert() in
   api/_lib/well-knowledge.js. Read that file before widening anything.

   Village keys are THIS SITE'S (rainforest, not nature). Every alias that
   should resolve to one travels on the village record.

   To change what an advisor is shown, change the Field Guide or this
   extractor and re-run it. THE DIFF ON REGENERATION IS THE CONFIRMATION STEP.

   Field Guide edition : ${guideFw.edition || 'unknown'}
   Verified            : core ${CORE_VERIFIED || '?'} · expanded ${EXPANDED_VERIFIED || '?'}
   Generated           : ${generated}
   ======================================================================== */
'use strict';
`;

const body =
  banner +
  '\nmodule.exports = ' +
  JSON.stringify({
    provenance: {
      fieldGuideEdition: guideFw.edition || null,
      verified: { core: CORE_VERIFIED, expanded: EXPANDED_VERIFIED },
      generated
    },
    frameworks: {
      compass: guideFw.compass || [],
      continuum: guideFw.continuum || [],
      continuumOrder: CONTINUUM_ORDER,
      pillars: guideFw.pillars || [],
      evidence: guideFw.evidence || [],
      tiers: guideFw.tiers || [],
      models: guideFw.models || []
    },
    villages,
    properties: deep.concat(collection),
    supporting,
    basecamps,
    recipes,
    finderRows,
    suitability
  }, null, 2) + ';\n';

if (CHECK) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  /* The generated date changes every run, so compare everything else. */
  const strip = (s) => s.replace(/Generated\s+:.*\n/, '').replace(/"generated":\s*"[^"]*"/, '');
  if (strip(current) !== strip(body)) {
    console.error('\n  content/well-knowledge.generated.js is out of date with the Field Guide.');
    console.error('  Run: node tools/build-well-knowledge.js — then READ THE DIFF.\n');
    process.exit(1);
  }
  console.log('  well-knowledge.generated.js is current with the Field Guide.');
  process.exit(0);
}

/* An unresolved key is a silent mis-map, so report the counts rather than
   trusting them. A property with no villages scores zero against every
   need-state and simply never appears — the worst kind of bug to find later. */
const noVillage = deep.concat(collection).filter((p) => !p.villages.length);
const noCompass = deep.concat(collection).filter((p) => !p.compass.length);
const noDepth = deep.concat(collection).filter((p) => !p.continuum);

fs.writeFileSync(OUT, body);
console.log('');
console.log('  content/well-knowledge.generated.js written');
console.log('    scorable properties  ' + (deep.length + collection.length) + '  (deep ' + deep.length + ' · collection ' + collection.length + ')');
console.log('    carried, not scored  ' + (supporting.length + basecamps.length) + '  (supporting ' + supporting.length + ' · basecamps ' + basecamps.length + ')');
console.log('    no depth band        ' + noDepth.length + '  -> matcher reports depth_unknown');
console.log('    villages             ' + villages.length + '  keyed to this site (rainforest, not nature)');
console.log('    recipes              ' + recipes.length + ' · finder rows ' + finderRows.length + ' · suitability ' + suitability.length);
console.log('    edition              ' + (guideFw.edition || 'unknown'));
if (noVillage.length) console.log('  !  ' + noVillage.length + ' properties resolved NO village: ' + noVillage.map((p) => p.name).join(', '));
if (noCompass.length) console.log('  !  ' + noCompass.length + ' properties resolved NO compass: ' + noCompass.map((p) => p.name).join(', '));
console.log('');
console.log('  READ THE DIFF before committing. It is the confirmation step.');
console.log('');
