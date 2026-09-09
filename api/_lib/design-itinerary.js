/* ============================================================================
   DESIGN ITINERARY — assemble, freeze, version
   ----------------------------------------------------------------------------
   Turns a design session into the one artifact that leaves the building. Every
   other screen in ASK WELL is ours, behind a sign-in, read by somebody who
   knows how it was made. This is read by a client, alone, possibly months
   later, possibly forwarded to someone who was never on the call.

   ── IT WRITES NO SENTENCES ─────────────────────────────────────────────────
   The two paragraphs come from design-generate.js and arrive already checked.
   Everything else is assembled: day headings from the recipe, place names and
   hooks from the bank, verification dates from provenance. If a line of prose
   appears in the output it was either generated and checked, or typed by the
   advisor. Nothing here composes copy.

   ── WHAT IS DELIBERATELY LEFT OUT, AND WHY ─────────────────────────────────
   These are product decisions, not policy, and each one is the reason this
   cannot quietly become a self-serve booking tool:

     NO BANK PRICE, EVER. `price` and `priceTag` are dropped at the projection,
     so no property's public price signal can reach this document. What CAN,
     since 2026-09-09 and on Duncan's decision, is the ESTIMATE: a range built
     by design-estimate.js from dated public-rate observations plus the
     advisor's own edits, labelled not a quote. No model has ever seen a
     price and none does now — the prompt rule is unchanged; only what the
     document may carry changed.

     NO OPTION TREE, NO AVAILABILITY, NO BOOKING ACTION. A reader cannot
     configure anything. There is one path forward and it is a conversation.

     NO MISMATCH AND NO WATCH-OUT. Those sentences are written for an advisor
     who will talk around them. In front of a client, without that voice, they
     stop being craft and become an argument against the trip they are reading.

     PHOTOGRAPHS ONLY WHEN CLEARED. Every frame in the bank carries the
     property's own `cleared` flag, false until Duncan confirms reuse rights.
     The workspace shows everything, marked; this document filters at assemble
     time, so a frozen copy can never carry an uncleared image even if the flag
     is later flipped back. One frame per place, the hero first.

     LAST VERIFIED DOES APPEAR. It is honest, and it is also the line that makes
     the advisor structurally necessary: a dated fact invites the question only
     a person can answer.

     ONE CTA, AND IT IS A PERSON. Named, with the advisor's own contact.

   ── FREEZING ───────────────────────────────────────────────────────────────
   `document` is a complete snapshot, not a set of ids to re-resolve. A property
   renamed next year must not silently rename itself inside a document somebody
   is already holding, and a knowledge bank rebuild must not change what a
   client was sent. Same reasoning as design_sessions.knowledge_version and the
   rung_at_generation precedent: deriving it live would quietly change the
   answer to a question about the past.

   `brand` is frozen for the sharper version of that: an advisor who changes
   agencies must not re-brand a document a client already has.

   The database enforces this with a trigger — see itinerary_frozen() in
   022. RLS protects against `authenticated`, but our own code IS the service
   role and bypasses it, so the guarantee has to live below us.

   ── VERSIONING ─────────────────────────────────────────────────────────────
   Issuing again makes version n+1 rather than editing n. The old one keeps
   working until it is revoked, because the alternative is a link going dead in
   somebody's inbox with no explanation.
   ========================================================================== */
'use strict';

const K = require('./well-knowledge.js');
const S = require('./design-shape.js');

/* ── What a day looks like ────────────────────────────────────────────────
   The recipe supplies the shape and the advisor supplies the nights, so a
   6-night trip has to be laid over a 4-day rhythm somehow.

   THE LAST RHYTHM ENTRY IS TERMINAL AND MUST OCCUR ONCE, AT THE END. This
   first did the obvious thing — clamp the index, repeating the final entry to
   fill — and the rendered page said "Protected transition home" on days 4, 5
   and 6. To an advisor that reads as a stretched recipe. To the client holding
   the document it says they are going home three days running, which is not a
   shape, it is a mistake with their trip in it.

   So the ends are pinned and the MIDDLE stretches. Interior entries like
   "Structured protocol days" are plural by construction and repeat honestly;
   arrival and departure happen once each because that is what they are. With
   two or fewer rhythm entries there is no interior to stretch, so the surplus
   days carry no shape at all — a blank day an advisor can fill is better than
   a confident wrong one, which is the same rule the workspace applies to the
   fields six Finder answers cannot know. */
function days(recipe, nights, dayNotes) {
  const rhythm = (recipe && recipe.rhythm) || [];
  const n = Number(nights);
  const count = Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 21) : rhythm.length;
  if (!count) return [];

  const notes = dayNotes || {};
  const last = rhythm.length - 1;

  const shapeFor = (i) => {
    if (!rhythm.length) return null;
    if (i < rhythm.length && count <= rhythm.length) return rhythm[i];
    if (i === 0) return rhythm[0];
    if (i === count - 1) return rhythm[last];
    /* The interior, spread across whatever sits between the first and last. */
    const interior = rhythm.slice(1, last);
    if (!interior.length) return null;
    const pos = Math.floor(((i - 1) * interior.length) / Math.max(count - 2, 1));
    return interior[Math.min(pos, interior.length - 1)];
  };

  const out = [];
  for (let i = 0; i < count; i++) {
    const shape = shapeFor(i);
    out.push({
      n: i + 1,
      label: 'Day ' + (i + 1),
      shape: shape ? shape.text : null,
      note: notes[shape ? shape.key : ''] || notes['day' + (i + 1)] || null
    });
  }
  return out;
}

/* ── The places, as the client reads them ─────────────────────────────────
   mayAssert() again — the same boundary the prompts use. It returns name,
   hook, villages, compass, pillars and nothing else, so a watch note or a
   price cannot reach this document even by accident. The verification date is
   added separately from provenance, because it is the one caveat that belongs
   in front of a client. */
/* The one frame a place shows the client. Cleared frames only — hero first,
   or the frame of the asked-for kind when the day plan puts a spa or an
   activity day here. Returns null rather than an uncleared frame. */
function clearedImage(img, kind) {
  const list = ((img && img.images) || []).filter((i) => i && i.cleared === true && i.base && i.widths);
  if (!list.length) return null;
  const pick = (kind && list.find((i) => i.kind === kind)) || list.find((i) => i.kind === 'hero') || list[0];
  return { kind: pick.kind, base: pick.base, widths: pick.widths.slice(), alt: pick.alt || '', credit: pick.credit || '' };
}

async function places(slugs, kind) {
  const out = [];
  for (const slug of (slugs || []).slice(0, 6)) {
    const p = await K.mayAssert(String(slug));
    if (!p) continue;
    const prov = await K.provenanceFor(String(slug));
    /* The image is read from the full record, not mayAssert(): a photograph
       is not an assertion about the traveller, and it never reaches a prompt.
       Named fields again — no source URL, no rights note, just what a <picture>
       needs and the credit the property is owed. */
    const full = await K.property(String(slug));
    out.push({
      slug: String(slug),
      name: p.name,
      hook: p.hook,
      villages: p.villages || [],
      verified_at: (prov && prov.verified_at) || null,
      image: clearedImage(full && full.image, kind)
    });
  }
  return out;
}

/* ── The brand, snapshotted ───────────────────────────────────────────────
   Named fields, like everywhere else. An advisor's email and phone DO belong
   here — this is their document and the whole point of the closing paragraph
   is that a reader can reach them. Their id does not. */
const BRAND_FIELDS = ['first_name', 'last_name', 'business', 'host_agency', 'email', 'phone'];

function brandOf(advisor) {
  const a = advisor || {};
  const out = {};
  BRAND_FIELDS.forEach((f) => { if (a[f]) out[f] = String(a[f]).slice(0, 200); });
  return out;
}

/* ── Assemble ─────────────────────────────────────────────────────────────
   Takes what it needs by name. It is never handed a share, so — as with
   design-need.js — there is no consumer record here to forget to strip. The
   traveller's name is not in this document at all: the advisor addresses them
   when they send the link, and a name baked into a frozen artifact is a name
   that outlives every erasure request.

   `title` is deliberately not personalised for the same reason. */
async function assemble(input) {
  const i = input || {};
  const recipe = i.recipeKey ? await K.recipe(String(i.recipeKey)) : null;
  const bank = await K.version();
  const placeList = await places(i.slugs);

  return {
    /* Schema version, so a reader added in two years can tell what it is
       looking at without guessing from the shape. */
    v: 1,
    title: 'A Saint Lucia WELL journey',
    recipe: recipe ? { key: recipe.key, name: recipe.name, sub: recipe.sub || null } : null,
    nights: Number.isFinite(Number(i.nights)) ? Number(i.nights) : null,
    open: str(i.open),
    close: str(i.close),
    /* The Shape stage builds day_plan; when it exists it IS the days —
       phase, intensity word, property, the advisor's note. Without one the
       recipe is laid over the nights as before, so an older session still
       issues. Property names are resolved from `places`, which is already
       the frozen, named list; readDays() never sees a bank record. */
    days: (i.dayPlan && Array.isArray(i.dayPlan.days) && i.dayPlan.days.length)
      ? S.readDays(i.dayPlan, (slug) => { const p = placeList.find((x) => x.slug === slug); return p ? p.name : null; })
      : days(recipe, i.nights, i.dayNotes),
    places: placeList,
    /* The advisor's own words, if they wrote any. Optional and unstyled — this
       is the slot for what only they know. */
    advisorNote: str(i.advisorNote),
    /* When they travel, and what it might cost. Both optional; both frozen
       here so the document keeps the dates its figures were observed on. */
    travel_from: /^\d{4}-\d\d-\d\d$/.test(String(i.travelFrom || '')) ? String(i.travelFrom) : null,
    estimate: i.estimate && Array.isArray(i.estimate.lines) ? i.estimate : null,
    verified: {
      core: bank.verified.core || null,
      expanded: bank.verified.expanded || null
    },
    knowledge_version: bank.bank || null
  };
}

function str(v) {
  const s = String(v == null ? '' : v).trim();
  return s ? s.slice(0, 4000) : null;
}

/* ── What the document must have before it may be issued ──────────────────
   Returned as sentences an advisor can act on, not booleans. "Not ready" with
   no reason is the kind of message that makes somebody click again harder. */
function readiness(doc) {
  const missing = [];
  if (!doc.places.length) missing.push('at least one place');
  if (!doc.days.length) missing.push('a shape — set the nights on Understand, then lay the days on Shape');
  if (!doc.open) missing.push('an opening paragraph');
  if (!doc.close) missing.push('a closing paragraph');
  return missing;
}

module.exports = { assemble, readiness, days, places, clearedImage, brandOf, BRAND_FIELDS };
