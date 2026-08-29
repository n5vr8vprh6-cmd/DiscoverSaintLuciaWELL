/* ============================================================================
   DESIGN MATCH — four axes, scored separately, never summed
   ----------------------------------------------------------------------------
   Given a need-state and the knowledge bank, this returns a shortlist an
   advisor can defend out loud. It is plain arithmetic over vectors that already
   exist. No model is involved and none is needed: the reasoning is the product,
   and a reason a model wrote is a reason nobody can check.

   ── THERE IS NO SCORE ─────────────────────────────────────────────────────
   Four axes — PLACE, DIRECTION, DEPTH, INGREDIENTS — computed independently and
   reported independently, as words. They are never added, never averaged, and
   never rendered as a number. An apparently objective 94/100 is the failure the
   brief names as confidence theater, and the reason it is a failure is that the
   advisor cannot argue with it: a band with its matched terms printed underneath
   invites the conversation a number closes.

   Raw values exist, in `detail`, for two purposes only: reproducing an order,
   and letting tools/design-coverage.js find a scoring bug across all 270
   need-states. They are not for display.

   ── MISMATCH COMES FROM THE SAME ARITHMETIC AS FIT ────────────────────────
   Every reason a property might be wrong is derived from the numbers that made
   it right, or quoted verbatim from the bank. Nothing here asks a model for a
   downside, because a model asked for a downside invents a plausible one, and a
   plausible invented downside is worse than none — it sounds like judgement.

   ── THE TIE-BREAK IS EXPLICIT, AND THAT IS NOT FUSSINESS ──────────────────
   content/journey.js records what happens otherwise: at equal weights, 18 of 30
   combinations tied and ARRAY ORDER silently decided them, sending everyone to
   Longevity for no reason a traveller would recognise. It took a coverage
   matrix to find. So ordering here is lexicographic across the four raw axes
   and then, deliberately, by Field Guide canonical order — a stated rule rather
   than whatever the bank happened to emit.

   ── WHAT IS NOT SCORED ────────────────────────────────────────────────────
   SUPPORTING and BASECAMPS carry a village and one line of signal. That is not
   a vector. They are listed beside a shortlist, never ranked against it.
   ========================================================================== */
'use strict';

const K = require('./well-knowledge.js');

/* Words, not numbers, and the thresholds that produce them. `unknown` is a
   fifth band and not a low one: it means the bank has no mapping, which is a
   different statement from "this does not fit". */
const BANDS = [
  { at: 0.5, band: 'strong' },
  { at: 0.25, band: 'partial' },
  { at: 0.0001, band: 'thin' }
];
const BAND_RANK = { strong: 4, partial: 3, thin: 2, absent: 1, unknown: 1 };
const bandFor = (raw) => {
  for (let i = 0; i < BANDS.length; i++) if (raw >= BANDS[i].at) return BANDS[i].band;
  return 'absent';
};

/* Weights are advisor emphasis, not measurement. Normalising to sum 1 makes two
   need-states comparable regardless of how heavily the advisor leaned on the
   sliders — otherwise an advisor who marks everything 1 outranks one who
   marked one thing 1 and meant it. */
function normalise(bag) {
  const keys = Object.keys(bag || {});
  const total = keys.reduce((n, k) => n + (Number(bag[k]) || 0), 0);
  if (!total) return {};
  const out = {};
  keys.forEach((k) => { out[k] = (Number(bag[k]) || 0) / total; });
  return out;
}

/* How well the property's tags ALIGN with what was asked for — not how much of
   the ask it happens to touch.

   ── THE BUG THIS REPLACES, BECAUSE IT WILL BE TEMPTING TO UNDO ────────────
   The first version summed the need's weight for every term the property
   carried. It read as obviously correct and was structurally wrong: a property
   tagged with four villages can collect more of the need's weight than one
   tagged with a single village, whatever the client actually asked for. So it
   rewarded BREADTH rather than FIT.

   tools/design-coverage.js found it across 270 need-states, and the correlation
   was perfect: all seventeen single-village properties never surfaced ANYWHERE,
   and the three four-village properties surfaced in 59-68% of runs. Among the
   excluded was TheLifeCo — the island's only true Longevity anchor, and by the
   Field Guide's own account its scarcest and most distinctive supply. A
   shortlist that can never show it is worse than no shortlist.

   Cosine similarity is the fix: it compares direction rather than magnitude, so
   a single-village property perfectly aligned with a single-village need scores
   1.0. The sqrt penalty on breadth is real but proportionate — the tags are
   binary and we have no evidence of how strongly a property serves each of its
   villages, so a middle ground between "no penalty" and "divide by n" is the
   honest choice. */
function overlap(weights, has, penaliseBreadth) {
  const carried = [].concat(has || []);
  const matched = [], unmatched = [];
  let dot = 0;
  Object.keys(weights).forEach((k) => {
    if (carried.indexOf(k) !== -1) { dot += weights[k]; matched.push(k); }
    else unmatched.push(k);
  });

  /* ── BREADTH MEANS DIFFERENT THINGS ON DIFFERENT AXES ──────────────────
     VILLAGES ARE POSITIONING. A property tagged with four of six is less
     distinctly any one of them, so cosine's breadth penalty is doing real work:
     it is what stops a broadly-tagged resort outranking the specialist a client
     actually described.

     COMPASS AND PILLARS ARE CAPABILITY. "This property can support Reflect" is
     a claim about what it can do, and carrying five such claims is more capable,
     not vaguer. Penalising it is the same structural bias in miniature, and it
     did the same damage: Balenbouche and Green Fig — a historic estate with
     yoga, meditation and retreat use, and a treehouse spa over the Pitons —
     were unreachable in ALL 270 need-states, purely for declaring five Compass
     directions instead of four. 0.447 against 0.500. Both support Reflect. Both
     are strong. One of them is arguably the best answer to a
     rainforest-and-reflection brief, and it could not be shown.

     So capability axes measure coverage of what was ASKED for, and are bounded
     by the need rather than by the property. */
  const needMag = Math.sqrt(Object.keys(weights).reduce((n, k) => n + weights[k] * weights[k], 0));
  const propMag = penaliseBreadth ? Math.sqrt(carried.length) : 1;
  const raw = (needMag && propMag) ? dot / (needMag * propMag) : 0;

  /* Heaviest first: the advisor's own emphasis decides what gets named. */
  const byWeight = (a, b) => weights[b] - weights[a];
  return { raw, dot, matched: matched.sort(byWeight), unmatched: unmatched.sort(byWeight) };
}

/* ── Depth ────────────────────────────────────────────────────────────────
   How much of the band the client asked for can this property actually hold?
   Sixteen records carry no band at all — every COLLECTION entry, plus A'ILA,
   whose band is deliberately null upstream because its operating offer is one
   phase of a phased development. Those return `unknown` rather than a guess.
   Imputing a band from the compass string is exactly the smoothing a model does
   and code should refuse to. */
function depthOverlap(order, floor, ceiling, band) {
  if (!band || !band.length) return { raw: 0, known: false, need: null, has: null };
  const fi = order.indexOf(floor), ci = order.indexOf(ceiling);
  const idx = band.map((k) => order.indexOf(k)).filter((i) => i >= 0);
  if (!idx.length) return { raw: 0, known: false, need: null, has: null };

  const has = [Math.min.apply(null, idx), Math.max.apply(null, idx)];
  if (fi < 0 || ci < 0) {
    /* No band asked for. Everything is equally admissible; say so rather than
       scoring zero, which would read as a mismatch nobody stated. */
    return { raw: 0, known: true, need: null, has };
  }
  const need = [Math.min(fi, ci), Math.max(fi, ci)];
  const lo = Math.max(need[0], has[0]);
  const hi = Math.min(need[1], has[1]);
  const covered = Math.max(0, hi - lo + 1);
  return { raw: covered / (need[1] - need[0] + 1), known: true, need, has };
}

/* ── One property ────────────────────────────────────────────────────────── */
async function scoreProperty(need, property) {
  const fw = await K.frameworks();
  const order = fw.continuumOrder || [];

  const place = overlap(normalise(need.villages), property.villages, true);
  const direction = overlap(normalise(need.compass), property.compass, false);
  const ingredients = overlap(normalise(need.pillars), property.pillars, false);
  const depth = depthOverlap(order, need.continuumFloor, need.continuumCeiling, property.continuum);

  /* INGREDIENTS IS `unknown` UNTIL AN ADVISOR SAYS OTHERWISE.
     A need-state seeded from six Finder answers carries no pillar weights, and
     the honest report of that is "not asked", not "does not match". Deriving
     pillars from the Compass was considered and refused: the only table
     available would be inferred from fifteen properties, which is doctrine
     invented from a sample. If that mapping is ever wanted it belongs in the
     Field Guide, authored, like every other vocabulary here. */
  const askedIngredients = Object.keys(need.pillars || {}).length > 0;

  return {
    slug: property.slug,
    name: property.name,
    collection: property.collection,
    tier: property.tier,
    bands: {
      place: bandFor(place.raw),
      direction: bandFor(direction.raw),
      depth: depth.known ? (depth.need ? bandFor(depth.raw) : 'unknown') : 'unknown',
      ingredients: askedIngredients ? bandFor(ingredients.raw) : 'unknown'
    },
    detail: {
      place, direction, ingredients,
      depth: { raw: depth.raw, known: depth.known, need: depth.need, has: depth.has }
    },
    /* Lexicographic. Canonical Field Guide order is the stated last term rather
       than whatever the bank happened to emit — content/journey.js records what
       happens otherwise. COLLECTION has no number and sorts after the deep
       profiles at equal standing, because we know more about a deep profile. */
    order: [place.raw, direction.raw, depth.raw, askedIngredients ? ingredients.raw : 0,
            -(property.n == null ? 999 : property.n)]
  };
}

/* ── Mismatch ─────────────────────────────────────────────────────────────
   Fixed sentences. Each carries its evidence, and where the evidence is a fact
   from the bank it is quoted rather than paraphrased. `severity` orders what an
   advisor reads first; it does not gate anything.

   These read `watch`, `priceTag` and `tier` — the exact material
   build-campaign-facts.js refuses to hand a model, on the grounds that "an
   unknown handed to a language model becomes an invention". Here it goes to a
   person, on screen, quoted, and never into a prompt. That asymmetry is the
   design, not an oversight. */
const RUNG_LABEL = {};

async function mismatchesFor(need, property, scored) {
  const fw = await K.frameworks();
  const order = fw.continuumOrder || [];
  (fw.continuum || []).forEach((c) => { RUNG_LABEL[c.key] = c.name; });
  const label = (i) => RUNG_LABEL[order[i]] || order[i];

  const out = [];
  const add = (rule, sentence, evidence, severity) => out.push({ rule, sentence, evidence, severity });

  const d = scored.detail.depth;

  if (!d.known) {
    add('depth_unknown',
      'The expanded scan carries no depth mapping for this property. Treat it as a basecamp until the depth is confirmed.',
      property.continuumNote || null, 'medium');
  } else if (d.need && d.has) {
    if (d.has[1] < d.need[0]) {
      add('depth_gap',
        'They are asking for ' + label(d.need[0]) + '; this place typically reaches ' + label(d.has[1]) +
        '. Going deeper means importing it — a practitioner, a programme, or a second property.',
        null, 'high');
    } else if (d.has[0] > d.need[1]) {
      add('depth_over',
        'This is built for ' + label(d.has[0]) + ' and they asked for a holiday with wellness woven in.',
        null, 'medium');
    }
  }

  /* The direction they led with, that this property does not answer. Read off
     the same overlap that produced the fit, so the upside and the downside can
     never disagree. */
  const un = scored.detail.direction.unmatched;
  if (un.length) {
    const w = normalise(need.compass);
    const top = un[0];
    if ((w[top] || 0) >= 0.25) {
      const name = (fw.compass || []).filter((c) => c.key === top).map((c) => c.name)[0] || top;
      add('unanswered_compass',
        'They led with ' + name + '. This place does not carry ' + name + '.', null, 'high');
    }
  }

  if (scored.detail.place.raw === 0 && Object.keys(need.villages || {}).length) {
    add('village_absent', 'This is not the Saint Lucia they pictured.', null, 'high');
  }

  /* Suitability, quoted from the guide's own row rather than restated. */
  const rules = await K.suitabilityRules();
  const terrainRule = rules.filter((r) => /mobility|terrain/i.test(r.check))[0];
  const constraints = [].concat(need.constraints || []);
  if (constraints.indexOf('mobility') !== -1 && terrainRule &&
      new RegExp(property.name.split(',')[0].split(' ').slice(0, 2).join('|'), 'i').test(terrainRule.why)) {
    add('terrain', terrainRule.why, terrainRule.check, 'high');
  }

  const inclusionRule = rules.filter((r) => /included/i.test(r.check))[0];
  if (need.budget === 'low' && /à la carte|a la carte/i.test(property.model || '') && inclusionRule) {
    add('inclusion_model', inclusionRule.why, inclusionRule.check, 'medium');
  }

  if (property.priceTag === 'QUOTE / CONFIRM') {
    add('quote_confirm',
      'No dependable current tariff. Request the menu in writing before you quote anything.',
      property.price ? property.price.text : null, 'high');
  }

  if (property.watchLevel === 'high') {
    add('staffing', (property.watch[0] && property.watch[0].text) || 'Read the watch note before selling this.',
      property.watch[0] ? property.watch[0].source : null, 'high');
  }

  if (property.tier === 'P') {
    add('pipeline', 'Announced, not verified operating at the cutoff. Use only what is open now.', null, 'high');
  }

  return out;
}

/* ── A shortlist ──────────────────────────────────────────────────────────
   Returns five, unordered in the copy that renders them, so an advisor cuts to
   two or three rather than reading a ranking. The rank exists in the array and
   in `order`; it is never a word on the screen, and the screen never says
   "best match". */
const SHORTLIST = 5;

async function shortlistFor(need, opts) {
  const o = opts || {};
  const all = await K.properties(o.collection ? { collection: o.collection } : undefined);

  const scored = [];
  for (let i = 0; i < all.length; i++) scored.push(await scoreProperty(need, all[i]));

  scored.sort((a, b) => {
    for (let i = 0; i < a.order.length; i++) {
      if (b.order[i] !== a.order[i]) return b.order[i] - a.order[i];
    }
    return 0;
  });

  /* ── TIES ARE CARRIED, NOT CUT ──────────────────────────────────────────
     Cutting at five when six are identical hides inventory on a coin toss, and
     the advisor has no way to know it happened. Worse, it makes the shortlist
     look more decided than the evidence is.

     This surfaced immediately in coverage: for a rainforest-led need, EIGHT
     single-village properties tie exactly on place, because they are all
     equally rainforest and the client has not yet said anything that separates
     them. Two of them — Balenbouche and Green Fig — fell outside the cut in all
     270 need-states and were reported as unreachable. They were not unreachable.
     They were tied and unlucky.

     So the cut extends through anything matching the last included candidate on
     all four axes, and `tied` says how many that was. A tie is not a defect to
     hide: it is the system saying the brief does not yet separate these, which
     is a useful thing to tell somebody mid-consultation and the exact moment to
     ask another question. The hard cap stops a pathological all-tie returning
     the whole island. */
  const limit = o.limit || SHORTLIST;
  const HARD_CAP = 10;
  const sameRank = (a, b) => a.order.slice(0, 4).join(',') === b.order.slice(0, 4).join(',');

  let cut = Math.min(limit, scored.length);
  while (cut < scored.length && cut < HARD_CAP && sameRank(scored[cut - 1], scored[cut])) cut++;

  const top = scored.slice(0, cut);
  const tied = cut > limit ? cut - limit : 0;
  top.forEach((x) => { x.tiedGroup = tied > 0; });
  const byName = {};
  all.forEach((p) => { byName[p.slug] = p; });

  for (let i = 0; i < top.length; i++) {
    const p = byName[top[i].slug];
    top[i].mismatches = await mismatchesFor(need, p, top[i]);
    top[i].verified_at = p.provenance.verified_at;
    top[i].watch = p.watch;
    /* EVERY CANDIDATE CARRIES A LINE UNDER MISMATCH. Where no rule fires, the
       property's own watch note stands in. The absence of a warning must never
       render as a clean bill of health — that is how "nothing flagged" becomes
       "nothing to check". */
    if (!top[i].mismatches.length) {
      top[i].mismatches = [{
        rule: 'none_fired',
        sentence: 'No rule fired against this need-state. That is not a clean bill of health — read the watch note.',
        evidence: (p.watch[0] && p.watch[0].text) || null,
        severity: 'low'
      }];
    }
  }
  return top;
}

module.exports = { scoreProperty, mismatchesFor, shortlistFor, normalise, bandFor, SHORTLIST };
