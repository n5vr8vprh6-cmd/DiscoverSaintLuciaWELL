/* ============================================================================
   CLAIMS — what an advisor is allowed to say, checked by code
   ----------------------------------------------------------------------------
   Every caption this product generates gets published by a real advisor, under
   their own name, about Saint Lucia, with a link to our site at the end of it.
   V2 spec §10: "Do not invent property facts, programs, prices, availability,
   practitioners, destination claims or advisor credentials."

   THAT IS AN INSTRUCTION TO A LANGUAGE MODEL, WHICH IS NOT A CONTROL. This
   file is the control.

   ── WHY IT IS PLAIN CODE AND NOT A SECOND AI PASS ─────────────────────────
   A checker that can hallucinate is not a checker. Asking a model to review
   its own output produces something that looks like assurance and provides
   none — it will pass a claim it just wrote, for the same reasons it wrote it.
   Every rule below is a string comparison against content/campaign-facts.js,
   which is generated from the Field Guide and reviewed as a diff.

   ── SEVERITY IS THE WHOLE DESIGN ──────────────────────────────────────────
   HIGH blocks the copy button until the advisor edits. A health claim in this
   brand's voice is not something to ship behind a warning label — and the
   advisor is the one who carries it, so stopping them is a kindness.

   LOW is advisory and copies fine. Most flags are low: an over-enthusiastic
   adjective is worth a word, not a wall.

   Every flag carries `why`. A checker that only says no teaches nothing, and
   this surface is where Foundations is actually sold.
   ========================================================================== */
'use strict';

const FACTS = require('../../content/campaign-facts.js');

const HIGH = 'high';
const LOW = 'low';

/* WHOLE WORDS, NO SUFFIX MATCHING. The first version allowed a trailing \w* so
   "heal" would also catch "healing" — and it caught "healthy" with it, flagging
   "healthy food, and nothing in the diary" as a medical claim. Every variant is
   listed in the fact bank instead: longer to read, impossible to be surprised
   by, and a checker that cries wolf teaches advisors to click through the one
   warning that mattered. */
function hits(text, needle) {
  const norm = (s) => ' ' + String(s).toLowerCase().replace(/[^a-z0-9$£€#]+/g, ' ').trim() + ' ';
  return norm(text).includes(norm(needle));
}

/* ── 1 · Health language ─────────────────────────────────────────────────
   The regulatory line is drawn by CONSUMER PERCEPTION, not intent, and implied
   claims count. So this does not look for medical vocabulary — it looks for
   the shapes good marketing copy takes when it accidentally becomes a health
   claim. "Come back rested" describes a stay. "Reduces burnout" describes a
   clinical outcome, and no amount of hedging around it helps. */
function healthPass(text) {
  const flags = [];
  FACTS.HEALTH_PATTERNS.forEach((p) => {
    if (!hits(text, p)) return;
    flags.push({
      pass: 'health',
      severity: HIGH,
      match: p,
      why: `"${p}" reads as a claim about a health outcome. Regulators judge that by how a ` +
           `reader takes it, not by what was meant, and implied claims count. Describe the ` +
           `place and the days — not what they will do to somebody's body or mind.`,
      instead: FACTS.SAFE_REGISTER.slice(0, 3)
    });
  });
  return flags;
}

/* ── 2 · Unsupported entities ────────────────────────────────────────────
   A property named in copy must be one the Field Guide has actually described.
   This is the pass that catches the classic failure: a model reaching for a
   real-sounding resort it half-remembers from training data.

   Matching is deliberately loose on the input side — "Sugar Beach" should
   resolve to "Sugar Beach, A Viceroy Resort" — because the goal is to find
   names that are NOT ours, not to police punctuation. */
const KNOWN = FACTS.properties.map((p) => ({
  name: p.name,
  needles: [p.name.toLowerCase()].concat(
    p.name.split(/[,(]/)[0].trim().toLowerCase()
  )
}));

/* Our own vocabulary comes from the fact bank rather than a second list here —
   a copy would drift the first time a village is renamed. */
const VOCAB = new Set((FACTS.VOCABULARY || []).map((v) => v.toLowerCase()));
const SENTENCE = new Set((FACTS.SENTENCE_WORDS || []).map((v) => v.toLowerCase()));
const VENUE = (FACTS.VENUE_WORDS || []).map((v) => v.toLowerCase());

/* A capitalised run, for the purposes of "is this a place we do not know".

   TWO BUGS LIVED IN THE OLD PATTERN, and both were found by reading real
   generated copy rather than by reading the regex:

     \s+ MATCHES NEWLINES. "…in Saint Lucia\n\nHi there" was read as the single
     candidate "Saint Lucia\n\nHi" — a name welded to the first word of the next
     paragraph, which then matched nothing in the fact bank and was duly
     reported as an unknown place.

     de|du|la|le HAD NO TRAILING BOUNDARY, so the `de` alternative matched the
     first two letters of "deserve" and produced the candidate "You de".

   Neither could be caught by a test asserting that real place names are found;
   both needed a test asserting that ordinary prose is left alone. */
const CANDIDATE = /\b[A-Z][a-zA-Z’']+(?:[ \t]+(?:[A-Z][a-zA-Z’']+|&|(?:de|du|la|le)\b))+/g;

/* Placeholders are not claims. "[Client's Name]" is an instruction to the
   advisor and {{WELL_LINK}} is ours; blanked to spaces so the surrounding text
   still reads as separate runs rather than being joined across the gap.

   A SUBJECT LINE IS TITLE CASE BY CONVENTION, so almost every one produces a
   capitalised run: "Discover Unhurried Days", "A Different Kind of Getaway".
   None of them name a place, and all of them were being reported as unknown
   ones. Its severity is downgraded rather than skipped — a genuinely invented
   resort in a subject line is still a resort, so the venue rule below still
   blocks it. Only the advisory tier is silenced, because that tier on a
   subject line is pure noise. */
const SUBJECT_LINE = /^\s*subject:.*$/gim;

function withoutPlaceholders(text) {
  return String(text || '')
    .replace(/\[[^\]\n]{0,80}\]/g, (m) => ' '.repeat(m.length))
    .replace(/\{\{[^}\n]{0,80}\}\}/g, (m) => ' '.repeat(m.length));
}

/* The candidates that appear ONLY inside a subject line. */
function subjectOnly(text) {
  const subjects = String(text || '').match(SUBJECT_LINE);
  if (!subjects) return new Set();
  const inSubjects = new Set();
  subjects.forEach((line) => {
    (withoutPlaceholders(line).match(CANDIDATE) || [])
      .forEach((c) => inSubjects.add(c.toLowerCase().trim()));
  });
  /* Anything that ALSO appears in the body is not subject-line-only, and gets
     judged normally — a property named in both places is named in the body. */
  const body = String(text || '').replace(SUBJECT_LINE, ' ');
  (withoutPlaceholders(body).match(CANDIDATE) || [])
    .forEach((c) => inSubjects.delete(c.toLowerCase().trim()));
  return inSubjects;
}

/* `own` is the advisor's own identity — their name, business and host agency.
   Flagging an advisor's own signature as an unrecognised place is the single
   most obviously wrong thing this checker could do, and it did it. */
function entityPass(text, own) {
  const flags = [];
  const mine = new Set((own || []).map((v) => String(v || '').toLowerCase().trim()).filter(Boolean));
  const candidates = withoutPlaceholders(text).match(CANDIDATE) || [];
  const subjects = subjectOnly(text);

  [...new Set(candidates)].forEach((c) => {
    const low = c.toLowerCase().trim();
    const words = low.split(/\s+/);

    if (VOCAB.has(low)) return;
    /* Their own name, or any part of it standing alone. */
    if (mine.has(low)) return;
    if ([...mine].some((m) => m.includes(low) || low.includes(m))) return;
    /* Anything we DO know about is fine, at either granularity. */
    if (KNOWN.some((k) => k.needles.some((n) => n.includes(low) || low.includes(n)))) return;
    /* Capitalised because a sentence started, not because it names anything:
       "This Week I am opening five calls" is prose, not a resort. */
    if (words.every((w) => SENTENCE.has(w))) return;

    /* SEVERITY TURNS ON TWO THINGS TOGETHER, and it needs both.

       A venue word alone is not enough. "Discover Wellness Retreats" is a
       subject line, and blocking the copy button on it teaches an advisor that
       the warnings are wrong — after which the one that matters gets clicked
       past too. So HIGH also requires something that reads as a NAME: a word
       that is neither ordinary English nor the venue word itself.

         Discover Wellness Retreats  venue, no proper noun   → low
         Azure Piton Retreats        venue + "azure","piton" → HIGH
         The Retreat                 venue, no proper noun   → low

       Plurals count as their singular. Without that, an invented property
       escaped the block simply by ending in an s — "Azure Piton Retreat" was
       high and "Azure Piton Retreats" was low, which is not a distinction
       anyone intended. */
    const singular = (w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
    const isVenueWord = (w) => VENUE.indexOf(w) !== -1 || VENUE.indexOf(singular(w)) !== -1;

    const isVenue = words.some(isVenueWord);
    const namesSomething = words.some((w) => !SENTENCE.has(w) && !isVenueWord(w));

    /* A subject-line-only run that does not read as a venue is title case, not
       a place. Dropped rather than downgraded — it is already the lowest tier,
       and the alternative is a warning on almost every email we generate. */
    if (subjects.has(low) && !(isVenue && namesSomething)) return;

    flags.push({
      pass: 'entity',
      severity: (isVenue && namesSomething) ? HIGH : LOW,
      match: c,
      why: (isVenue && namesSomething)
        ? `"${c}" reads as somewhere to stay and is not in the approved Saint Lucia fact ` +
          `bank. If it is real but unconfirmed it cannot be named yet; if the AI invented ` +
          `it, naming it would send a traveller somewhere that does not exist.`
        : `"${c}" is not something we recognise. Probably fine — but if it names a place, ` +
          `a programme or a property, check it before this goes out.`
    });
  });
  return flags;
}

/* ── 3 · Credentials ─────────────────────────────────────────────────────
   Spec §10 forbids inventing advisor credentials, and the ladder is the
   mechanism: an advisor is only ever handed the phrases for the rung they have
   actually reached. This catches the copy that promotes them anyway. */
function credentialPass(text, rung) {
  const ladder = FACTS.CLAIMS_LADDER[rung] || FACTS.CLAIMS_LADDER.registered;
  return (ladder.mayNot || []).filter((p) => hits(text, p)).map((p) => ({
    pass: 'credential',
    severity: HIGH,
    match: p,
    why: `"${p}" claims more than this advisor has completed. It is not a matter of tone — ` +
         `saying it makes a factual statement about a qualification.`,
    instead: ladder.may
  }));
}

/* ── 4 · Price, availability and guarantees ──────────────────────────────
   Every one of the thirty Field Guide records carries a `verify` note about
   pricing, treatments or capacity — so none of it may be asserted. Currency
   never enters the fact bank at all (the extractor drops it), which means any
   figure appearing here was invented between the model and the page. */
const MONEY = /(?:US\$|\$|£|€)\s?\d|(?:\d[\d,]*\s?(?:USD|EUR|GBP|dollars?|per night|a night|pp|per person))/i;

function guaranteePass(text) {
  const flags = [];

  if (MONEY.test(text)) {
    flags.push({
      pass: 'price',
      severity: HIGH,
      match: (text.match(MONEY) || [''])[0].trim(),
      why: 'No price is in the fact bank — the extractor drops them — so any figure here was ' +
           'invented. Rates change and a wrong one is a promise somebody plans around.'
    });
  }

  FACTS.GUARANTEE_PATTERNS.forEach((p) => {
    if (!hits(text, p)) return;
    flags.push({
      pass: 'guarantee',
      severity: LOW,
      match: p,
      why: `"${p}" is a superlative or a promise we cannot stand behind. It also reads as ` +
           `advertising rather than as somebody who knows the island.`
    });
  });

  return flags;
}

/* ── The whole check ─────────────────────────────────────────────────────
   `rung` is the advisor's earned position on the claims ladder. It defaults to
   the LOWEST rung rather than the highest, because a caller who forgets to
   pass it should get the strictest check, not the loosest. */
/* `own` is optional and defaults to knowing nothing, so every existing caller
   keeps working — it only ever removes false positives, never adds a miss. */
function check(text, rung, own) {
  const t = String(text || '');
  const flags = [].concat(
    healthPass(t),
    entityPass(t, own),
    credentialPass(t, rung || 'registered'),
    guaranteePass(t)
  );

  const high = flags.filter((f) => f.severity === HIGH);
  return {
    flags,
    high: high.length,
    low: flags.length - high.length,
    /* The copy button reads this. High means edit first. */
    copyable: high.length === 0
  };
}

/* The advisor's own identity, in the shape entityPass wants. One place builds
   it so the endpoint and the generator cannot disagree about whose name is
   allowed to appear in their own signature. */
function ownNames(advisor) {
  const a = advisor || {};
  return [
    a.business, a.host_agency,
    `${a.first_name || ''} ${a.last_name || ''}`.trim(),
    a.first_name, a.last_name
  ].filter((v) => String(v || '').trim().length > 1);
}

module.exports = { check, ownNames, HIGH, LOW, FACTS };
