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

function entityPass(text) {
  const flags = [];
  const candidates = text.match(/\b[A-Z][a-zA-Z’']+(?:\s+(?:[A-Z][a-zA-Z’']+|&|de|du|la|le))+/g) || [];

  [...new Set(candidates)].forEach((c) => {
    const low = c.toLowerCase().trim();
    const words = low.split(/\s+/);

    if (VOCAB.has(low)) return;
    /* Anything we DO know about is fine, at either granularity. */
    if (KNOWN.some((k) => k.needles.some((n) => n.includes(low) || low.includes(n)))) return;
    /* Capitalised because a sentence started, not because it names anything:
       "This Week I am opening five calls" is prose, not a resort. */
    if (words.every((w) => SENTENCE.has(w))) return;

    /* SEVERITY TURNS ON WHETHER IT READS AS A VENUE. "Azure Piton Sanctuary" is
       a resort that does not exist and must not be published. "Most People" is
       a capitalised phrase we simply do not recognise. Blocking the second
       would train advisors to click straight through the first. */
    const isVenue = words.some((w) => VENUE.indexOf(w) !== -1);

    flags.push({
      pass: 'entity',
      severity: isVenue ? HIGH : LOW,
      match: c,
      why: isVenue
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
function check(text, rung) {
  const t = String(text || '');
  const flags = [].concat(
    healthPass(t),
    entityPass(t),
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

module.exports = { check, HIGH, LOW, FACTS };
