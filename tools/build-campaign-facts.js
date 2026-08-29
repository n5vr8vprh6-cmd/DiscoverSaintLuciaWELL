/* ============================================================================
   build-campaign-facts.js — the only facts an advisor's campaign may assert
   ----------------------------------------------------------------------------
     node tools/build-campaign-facts.js          write content/campaign-facts.js
     node tools/build-campaign-facts.js --check  fail if the file is out of date

   WHY THIS IS GENERATED RATHER THAN REQUIRED.
   The Field Guide lives in a sibling directory, outside this repository, so
   Vercel never sees it — a runtime require would work on this laptop and fail
   in production. Same reason and same shape as tools/build-property-images.py,
   which writes content/properties-media.js and keeps `source` and `retrieved`
   per image "so provenance travels with it".

   ── THE DIFF IS THE CONFIRMATION STEP ─────────────────────────────────────
   The Field Guide will eventually be maintained by a research agent. That
   creates a path with a real person at the end of it:

     agent researches → Field Guide → this extract → an advisor's Instagram
     post → a traveller books expecting something to be there

   If the research was wrong, the harm lands on that traveller and on two
   brands. Regenerating this file produces a DIFF SOMEBODY READS, so nothing an
   agent discovered reaches a caption without a human having seen it. That is
   the same rule the brochure already follows: removing a `confirmed:false`
   flag is a factual claim, and only Duncan makes it.

   ── WHAT THE FIELD GUIDE ALREADY TELLS US NOT TO SAY ──────────────────────
   Every property record carries `verify` and `watch` — explicit notes about
   what has NOT been confirmed. All fifteen mention treatment pricing,
   practitioner rosters or schedules. So this extractor does not try to parse
   that prose into categories; it encodes the rule those notes imply:

     MAY be said     the property exists, the village and Compass it answers,
                     its editorial role, the landscape it sits in
     MAY NOT         prices, treatment specifics, practitioner names,
                     availability, programme schedules, capacity

   `price` is dropped on the floor here rather than carried and filtered later.
   A number that never enters the bank cannot leave it in a caption.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GUIDE = path.join(ROOT, '..', 'field-guide', 'content');
const OUT = path.join(ROOT, 'content', 'campaign-facts.js');
const CHECK = process.argv.includes('--check');

/* An author-time tool. It must fail loudly rather than silently emit a thinner
   bank — a campaign generated against half a fact bank is worse than one that
   refused to build. */
if (!fs.existsSync(path.join(GUIDE, 'properties.js'))) {
  console.error('\n  The Field Guide is not beside this repo.');
  console.error('  Expected: ' + GUIDE);
  console.error('  This tool runs on a machine that has both; it is not part of the deploy.\n');
  process.exit(1);
}

const guideProps = require(path.join(GUIDE, 'properties.js'));
const guideFw = require(path.join(GUIDE, 'frameworks.js'));
const { VILLAGES } = require(path.join(ROOT, 'content', 'villages.js'));

const trim = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).replace(/[ ,;:—-]+$/, '') + '…' : t;
};

/* ── Properties ──────────────────────────────────────────────────────────
   DEEP carries the fullest record; COLLECTION carries `verify` and a one-line
   `signal`. Joined on name, because the two lists are the same fifteen places
   described at different depths. A property present in only one is still
   included — the join enriches, it does not gate. */
const byName = {};
(guideProps.COLLECTION || []).forEach((c) => { byName[c.name] = { collection: c }; });
(guideProps.DEEP || []).forEach((d) => {
  byName[d.name] = Object.assign(byName[d.name] || {}, { deep: d });
});

const properties = Object.keys(byName).sort().map((name) => {
  const { deep = {}, collection = {} } = byName[name];

  /* Villages arrive as an array on DEEP and a single string on COLLECTION. */
  const villages = deep.villages ||
    (collection.village ? [collection.village] : []);

  /* The one line an advisor may build a post around: what this place IS, not
     what it will do for you. `role` is the editorial characterisation and is
     the safest of the three; `signal` and `lead` follow. */
  const hook = trim(collection.role || collection.signal || deep.lead, 180);

  return {
    name,
    slug: deep.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    villages,
    compass: deep.compass || (collection.compass ? collection.compass.split(' · ') : []),
    pillars: deep.pillars || (collection.pillars ? collection.pillars.split(' · ') : []),
    hook,
    /* Carried so an advisor can see what still needs checking before they say
       anything specific — and so the checker can name it in a flag rather than
       just refusing. NOT for the generator: it is a list of unknowns, and an
       unknown handed to a language model becomes an invention. */
    unverified: trim(collection.verify || deep.watch, 220) || null
  };
});

/* ── What may never be asserted about any property ───────────────────────
   Derived from the fact that all fifteen `verify` notes name these. Encoded
   once, here, rather than re-derived by every reader. */
const NEVER_CLAIM = [
  'prices, rates or package costs',
  'specific treatments, therapies or their effects',
  'named practitioners, therapists or clinicians',
  'availability, dates or capacity',
  'programme schedules or itinerary specifics',
  'awards, rankings or superlatives'
];

/* ── The claims ladder ───────────────────────────────────────────────────
   V2 spec §10 forbids inventing advisor credentials. An advisor is only ever
   given the phrases for the rung they have actually reached, so the generator
   cannot promote them by accident and neither can they. */
const CLAIMS_LADDER = {
  registered: {
    may: ['part of the Saint Lucia WELL advisor network',
          'works with Discover Saint Lucia WELL'],
    mayNot: ['trained in', 'certified', 'accredited', 'specialist in the method']
  },
  foundations: {
    may: ['trained in the Well Destination method',
          'completed Well Destination Foundations',
          'part of the Saint Lucia WELL advisor network'],
    mayNot: ['has visited', 'experienced the destination first-hand']
  },
  immersion: {
    may: ['trained in the Well Destination method',
          'has experienced Saint Lucia first-hand',
          'completed the Saint Lucia WELL Immersion',
          'part of the Saint Lucia WELL advisor network'],
    mayNot: []
  }
};

/* ── Health language ─────────────────────────────────────────────────────
   The line is drawn by consumer perception, not intent, and IMPLIED claims
   count. So this is not a list of medical words — it is a list of the ways
   good marketing copy accidentally becomes a health claim.

   The safe register is on the right: describe the place and the experience,
   never the effect on a body. */
/* EVERY VARIANT IS LISTED, because the checker matches whole words exactly.
   An earlier version matched prefixes so that "heal" would also catch
   "healing" — and it caught "healthy" too, flagging "healthy food, and nothing
   in the diary" as a medical claim. A checker that cries wolf teaches advisors
   to click through the warning that mattered, so the list is long and the
   matching is precise rather than the other way round. */
const HEALTH_PATTERNS = [
  'cure', 'cures', 'cured', 'curing',
  'heal', 'heals', 'healed', 'healing',
  'treat', 'treats', 'treated', 'treating', 'treatment for', 'therapy for',
  'therapeutic', 'clinical', 'clinically', 'medical', 'medically',
  'proven to', 'scientifically', 'evidence-based',
  'diagnose', 'diagnosed', 'diagnosis', 'diagnostic',
  'symptom', 'symptoms', 'condition', 'conditions', 'disorder', 'disorders',
  'illness', 'anxiety', 'depression', 'depressed', 'insomnia', 'burnout',
  'burnt out', 'burned out', 'chronic', 'inflammation', 'cortisol', 'immune',
  'immunity', 'detox', 'detoxify', 'toxins', 'boost your', 'reverse',
  'reduces', 'reduce your', 'relieves', 'relieve your', 'alleviate', 'remedy',
  'wellness benefits', 'health benefits', 'lower your'
];

/* ── Our own vocabulary ──────────────────────────────────────────────────
   Brand, product and framework terms, so the unsupported-entity pass does not
   report our own names back to us as unknown places. Generated from the same
   source as everything else rather than hardcoded in the checker, because a
   second copy would drift the first time a village is renamed. */
const VOCABULARY = [
  'saint lucia', 'st lucia', 'saint lucia well', 'discover saint lucia well',
  'well destination', 'well destination foundations', 'well journey',
  'journey finder', 'well journey finder', 'wellness village',
  'the pitons', 'gros piton', 'petit piton', 'sulphur springs', 'soufriere',
  'eclipse', 'well compass', 'the compass', 'advisor hub', 'travel advisor hub',
  'saint lucia well immersion', 'intro briefing'
]
  .concat(VILLAGES.map((v) => v.name.toLowerCase()))
  .concat(VILLAGES.map((v) => (v.short || v.name).toLowerCase()))
  /* `name`, not `label` — the compass records have never had a `label`, so this
     produced eight literal "[object Object]" entries that protected nothing.
     Invisible for as long as it existed: a vocabulary entry that matches no
     real text just fails to suppress a warning, and a warning that should not
     have fired looks exactly like a warning that should have.
     The final `|| c` keeps a plain string working if the shape ever changes. */
  .concat((guideFw.compass && guideFw.compass.map
    ? guideFw.compass.map((c) => String((c && (c.name || c.label)) || c).toLowerCase()) : []))
  .concat((guideFw.continuum && guideFw.continuum.map
    ? guideFw.continuum.map((c) => String((c && (c.name || c.label)) || c).toLowerCase()) : []))
  /* Nothing that stringified badly, and nothing empty. A guard rather than a
     comment, because the bug above was exactly this and went unnoticed. */
  .filter((v) => v && v.indexOf('[object') === -1);

/* A capitalised run only reads as a VENUE when it says so. "Azure Piton
   Sanctuary" is a resort that does not exist; "This Week" is a sentence
   opening. The difference decides severity — an unknown venue blocks, an
   unknown capitalised phrase is worth mentioning and nothing more. */
const VENUE_WORDS = [
  'resort', 'hotel', 'villa', 'villas', 'spa', 'estate', 'sanctuary', 'retreat',
  'lodge', 'inn', 'beach', 'bay', 'cove', 'residences', 'club', 'house',
  'plantation', 'gardens', 'suites', 'hideaway', 'camp', 'ranch'
];

/* Capitalised because they start a sentence, not because they name anything.
   Filtered before the entity pass so ordinary prose does not generate noise. */
const SENTENCE_WORDS = [
  'this', 'that', 'these', 'those', 'here', 'there', 'what', 'when', 'where',
  'who', 'why', 'how', 'most', 'many', 'some', 'few', 'every', 'each', 'both',
  'week', 'month', 'year', 'day', 'days', 'weeks', 'months', 'time', 'times',
  'people', 'person', 'someone', 'somebody', 'anyone', 'everyone',
  'start', 'begin', 'take', 'book', 'find', 'come', 'send', 'ask', 'tell',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'i', 'we', 'you', 'your', 'my', 'me', 'us', 'it', 'they', 'them', 'the',
  'a', 'an', 'and', 'or', 'but', 'if', 'so', 'for', 'to', 'of', 'in', 'on',
  'at', 'by', 'with', 'from', 'about', 'am', 'is', 'are', 'was', 'were',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could',

  /* ── Ordinary marketing and letter-writing words ────────────────────────
     Added after reading real generated copy, where a subject line reading
     "Discover Wellness Retreats in Saint Lucia" was reported as an unrecognised
     place. It is title case, which is all the pattern can see.

     This is safe because the suppression requires EVERY word in the candidate
     to be on this list, so it silences "Discover Wellness Retreats" while
     leaving "Azure Piton Retreats" flagged — "azure" and "piton" are not here.
     Nothing on this list is a venue word, which is the other half of why it is
     safe: severity is decided separately and a real venue never reaches here.

     The point is not tidiness. An advisor who sees four warnings on clean copy
     learns that warnings are noise, and then clicks past the health claim. */
  'discover', 'discovering', 'explore', 'exploring', 'wellness', 'well',
  'travel', 'travels', 'traveller', 'journey', 'journeys', 'trip', 'trips',
  'getaway', 'escape', 'holiday', 'holidays', 'vacation', 'break',
  'experience', 'experiences', 'moment', 'moments', 'story', 'stories',
  'plan', 'plans', 'planning', 'guide', 'guides', 'idea', 'ideas',
  'welcome', 'hi', 'hello', 'hey', 'dear', 'best', 'warmly', 'regards',
  'thanks', 'thank', 'cheers', 'subject', 'ps',
  'island', 'islands', 'caribbean', 'sun', 'sea', 'ocean', 'water',
  'rest', 'rested', 'slow', 'slower', 'quiet', 'calm', 'space', 'room',
  'first', 'next', 'last', 'new', 'more', 'less', 'ready', 'let', 'lets',
  'why', 'imagine', 'picture', 'consider', 'looking', 'thinking'
];

const SAFE_REGISTER = [
  'come back rested', 'space to think', 'unhurried days', 'time that is yours',
  'a slower rhythm', 'room to breathe', 'somewhere that asks nothing of you'
];

/* ── Our own approved register, unpacked into words ──────────────────────
   SAFE_REGISTER is the phrasing we explicitly bless — "unhurried days", "room
   to breathe", "come back rested". A model told to use it then had the result
   flagged as an unrecognised place, because "Discover Unhurried Days" in a
   subject line is title case and "unhurried" appeared in no list.

   Blessing a phrase and then warning about it is the worst of both worlds: the
   advisor is taught to distrust the exact copy we asked for. Derived from the
   list rather than typed out again, so the two cannot drift — and placed here,
   after SAFE_REGISTER exists, because `const` in the temporal dead zone throws
   rather than reading as empty. */
SAFE_REGISTER.join(' ').toLowerCase().split(/[^a-z]+/).filter(Boolean)
  .forEach((w) => { if (SENTENCE_WORDS.indexOf(w) === -1) SENTENCE_WORDS.push(w); });

const GUARANTEE_PATTERNS = [
  'guarantee', 'guaranteed', 'risk-free', 'no.1', '#1', 'number one', 'the best',
  'award-winning', 'world-class', 'unrivalled', 'unrivaled', 'exclusive access',
  'limited time', 'act now', 'once in a lifetime'
];

/* ── Emit ────────────────────────────────────────────────────────────────── */
const banner = `/* ==========================================================================
   CAMPAIGN FACTS — GENERATED, DO NOT EDIT BY HAND
   --------------------------------------------------------------------------
   Written by tools/build-campaign-facts.js from the Field Guide (a sibling
   directory, not part of this deployment) and this site's own content.

   THIS IS THE ONLY THING AN ADVISOR'S CAMPAIGN MAY ASSERT. api/_lib/claims.js
   checks generated copy against it, and anything naming a place, a programme
   or a credential that is not in here is flagged before an advisor can copy it.

   To change what may be said, change the Field Guide or this extractor and
   re-run it. Editing this file by hand puts a claim into advisors' marketing
   that nobody reviewed — which is the one thing the generated-file pattern
   exists to prevent. THE DIFF ON REGENERATION IS THE HUMAN CONFIRMATION STEP.

   Field Guide edition : ${guideFw.edition || 'unknown'}
   Frameworks verified : ${JSON.stringify(guideFw.verified || {})}
   Generated           : ${new Date().toISOString().slice(0, 10)}
   ======================================================================== */
'use strict';
`;

const body =
  banner +
  '\nmodule.exports = ' +
  JSON.stringify({
    provenance: {
      fieldGuideEdition: guideFw.edition || null,
      frameworksVerified: guideFw.verified || null,
      generated: new Date().toISOString().slice(0, 10)
    },
    villages: VILLAGES.map((v) => ({
      key: v.key, name: v.name, short: v.short || v.name
    })),
    compass: guideFw.compass || null,
    continuum: guideFw.continuum || null,
    properties,
    NEVER_CLAIM,
    CLAIMS_LADDER,
    HEALTH_PATTERNS,
    SAFE_REGISTER,
    GUARANTEE_PATTERNS,
    VOCABULARY,
    VENUE_WORDS,
    SENTENCE_WORDS
  }, null, 2) + ';\n';

if (CHECK) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  /* The generated date changes every run, so compare everything else. */
  /* LINE ENDINGS ARE NORMALISED FIRST, AND THE ORDER IS THE WHOLE FIX.
     git checks these banks out with CRLF on Windows while the generator writes
     LF. That alone would make a byte comparison fail, but the subtler half is
     that `.` in a JavaScript regex does not match \r — so on a CRLF file
     /Generated\s+:.*\n/ never matches, the date line survives the strip, and the
     check reports "out of date" against a bank nobody has touched.

     Normalising afterwards does not help: by then the date is still in both
     strings and still different. It has to happen before anything else looks at
     the text. A drift guard that cries wolf on a fresh clone is one people learn
     to skip, which is worse than not having one. */
  const strip = (s) => s.replace(/\r\n/g, '\n')
    .replace(/Generated\s+:.*\n/, '')
    .replace(/"generated":\s*"[^"]*"/, '');
  if (strip(current) !== strip(body)) {
    console.error('\n  content/campaign-facts.js is out of date with the Field Guide.');
    console.error('  Run: node tools/build-campaign-facts.js — then READ THE DIFF.\n');
    process.exit(1);
  }
  console.log('  campaign-facts.js is current with the Field Guide.');
  process.exit(0);
}

fs.writeFileSync(OUT, body);
console.log('');
console.log('  content/campaign-facts.js written');
console.log('    properties       ' + properties.length + '  (prices dropped, not filtered)');
console.log('    with a verify note ' + properties.filter((p) => p.unverified).length);
console.log('    villages         ' + VILLAGES.length);
console.log('    edition          ' + (guideFw.edition || 'unknown'));
console.log('');
console.log('  READ THE DIFF before committing. It is the confirmation step.');
console.log('');
