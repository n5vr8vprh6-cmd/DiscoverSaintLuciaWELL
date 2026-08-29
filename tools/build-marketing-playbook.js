/* ============================================================================
   build-marketing-playbook.js — what actually converts, per channel
   ----------------------------------------------------------------------------
     node tools/build-marketing-playbook.js          write content/marketing-playbook.js
     node tools/build-marketing-playbook.js --check  fail if it is out of date

   ── WHY THIS EXISTS ────────────────────────────────────────────────────────
   The generator knows Saint Lucia and it knows the claims ladder. It knows
   nothing about what a converting Instagram caption looks like, so it writes
   from general priors — which is, by definition, average. That is the single
   largest cause of the "competent and generic" output this release exists to
   fix.

   ── SEED NOW, DUNCAN'S RESEARCH LATER ──────────────────────────────────────
   This ships with a seed written from general direct-response and social
   practice. It is real and useful, and it is NOT the finished article: Duncan
   is researching a proper marketing field guide.

   When ../marketing-field-guide/content/ appears beside this repo, it wins and
   the seed becomes a fallback — the same arrangement as campaign-facts.js and
   the Field Guide, and for the same reason. The extract is generated rather
   than required at runtime, so Vercel never needs the source, and REGENERATING
   PRODUCES A DIFF THAT A HUMAN READS. That diff is the confirmation step for
   anything a research agent later adds, because the path from research to an
   advisor's Instagram post to a traveller's expectations is short.

   ── PROVENANCE IS RECORDED PER SECTION ─────────────────────────────────────
   Every channel carries `source: 'seed' | 'field-guide'`, so it is always
   visible which advice came from Duncan's research and which is still the
   placeholder. A seed silently masquerading as researched material is the
   failure mode worth engineering against.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
/* Overridable so the merge can be tested against a fixture. Without this the
   only way to prove "Duncan's research wins" is to create a folder beside the
   repo, which makes it the kind of test nobody runs. */
const GUIDE = process.env.MARKETING_GUIDE || path.join(ROOT, '..', 'marketing-field-guide', 'content');
const OUT = process.env.MARKETING_PLAYBOOK_OUT || path.join(ROOT, 'content', 'marketing-playbook.js');
const CHECK = process.argv.includes('--check');

/* ── The rail ───────────────────────────────────────────────────
   This is ALL that remains of the seed's ICP, and it is the only part that
   ever reached production. Everything else — pains, triggers, objections,
   tried — was overwritten wholesale by the field guide on every run, so the
   copy here was a second version of the same sentences that nobody read and
   nobody could change the output by editing. It is gone.

   NEVER_PROMISE survives because it is UNIONED with the guide rather than
   replaced (see the merge below). A trigger explains why somebody starts
   looking; it must never become a claim about what they will get. claims.js
   blocks the copy either way — this keeps the instruction and the block
   agreeing with each other.

   If the field guide is ever absent, playbook-test.js fails on
   icp.source === 'field-guide' rather than quietly emitting a rails-only
   bank. That assertion is the guard, not this file. */
const ICP = {
  source: 'seed',

  NEVER_PROMISE: [
    'That a trip repairs, restores, heals, treats or fixes anything about a person.',
    'That time away improves sleep, stress, burnout, energy or any measurable thing.',
    'Anything a reader could take as a health outcome, however gently phrased.',
    'A pain is a reason somebody starts looking. It is never a promise about what they get.'
  ]
};

/* ── Channels ──────────────────────────────────────────────────────────────────
   `anatomy` is the shape. `hooks` are openings with the reason they work,
   because a pattern without its reason gets copied badly. `converts` and
   `kills` are the two lists the generator is actually scored against in the
   critique pass.

   ONLY THE FOUR CHANNELS THE BIBLE DOES NOT COVER LIVE HERE.

   This list used to hold ten. Six of them — instagram, email, linkedin,
   facebook, tiktok, newsletter — were overwritten key-for-key by the field
   guide on every single run, so nothing written here reached a prompt, a
   diff, or an advisor. They were a second corpus that looked live and was
   not, and they had drifted: the same hook under a different name, the same
   ICP sentence with a word changed.

   The material worth keeping was lifted into the field guide first — 43
   items, mostly concrete examples the Bible states only as principle — and
   then the six were deleted. dm, sms, script and outline stay because the
   Bible genuinely does not treat them as channels, and a seeded channel is
   honest so long as `source` says so. */
const CHANNELS = [
{
    channel: 'dm',
    source: 'seed',
    anatomy: [
      'Reference something real and specific about them.',
      'No pitch in the first two sentences. None.',
      'One small ask, or no ask at all the first time.'
    ],
    hooks: [
      { pattern: 'The thing you actually remembered',
        why: 'It is the only thing that separates a message from a template.',
        example: 'You said you were done with big resorts after Cancún.' }
    ],
    lengths: { ideal: 'under 60 words', max: 80, unit: 'words' },
    converts: [
      'Something only you would know about them.',
      'No link in the first message.',
      'Sounding like the last conversation, not like a campaign.'
    ],
    kills: [
      'Anything that could have been sent to anybody.',
      'Leading with the offer.',
      'A link before a reply.',
      'Length. Nobody reads a paragraph in a DM from a business.'
    ],
    cta: ['Want me to send you the two-minute version?', 'Is February still the plan?']
  },

  {
    channel: 'sms',
    source: 'seed',
    anatomy: ['Say who you are immediately.', 'One thing.', 'An easy out.'],
    hooks: [
      { pattern: 'Name, context, one line',
        why: 'An unknown number gets three seconds and no more.',
        example: 'Mira here (Hall & Co) — you asked me to nudge you in January.' }
    ],
    lengths: { ideal: 'under 40 words', max: 50, unit: 'words' },
    converts: ['Being expected.', 'One question.', 'A genuine way to opt out.'],
    kills: ['Anonymity.', 'A link with no context.', 'Sending it at all without consent.'],
    cta: ['Still thinking about February?']
  },

{
    channel: 'script',
    source: 'seed',
    anatomy: [
      'Say why you are calling in the first sentence.',
      'Ask before telling. Two questions before anything about a destination.',
      'One question that surfaces the real constraint — money, time, or a person who has to agree.'
    ],
    hooks: [
      { pattern: 'The permission opener',
        why: 'Removes the pressure that makes people end calls.',
        example: '"Two minutes — I am not selling you anything today, I just want to know if February is real or theoretical."' }
    ],
    lengths: { ideal: 'under 120 words of notes', max: 160, unit: 'words' },
    converts: ['Questions before pitches.', 'Silence after a question.', 'Naming the objection before they have to.'],
    kills: ['Reading it aloud.', 'Talking about the destination before you know what they want.', 'Three options when they wanted one.'],
    cta: ['Shall I put two options together and send them over?']
  },

  {
    channel: 'outline',
    source: 'seed',
    anatomy: ['A promise in the title.', 'Three to five beats.', 'One takeaway per beat.'],
    hooks: [
      { pattern: 'The question they are actually googling',
        why: 'An outline that answers a real search is worth writing.',
        example: 'Is Saint Lucia worth it if you only have five days?' }
    ],
    lengths: { ideal: 'under 120 words', max: 160, unit: 'words' },
    converts: ['Answering the title in the first beat.', 'Specific beats, not headings.'],
    kills: ['A listicle with nothing in it.', 'Beats that are just topics.'],
    cta: ['End on the one question the reader should ask themselves.']
  }
];

/* ── Duncan's research wins when it exists ────────────────────────────────
   Merged per channel rather than wholesale, so a partial field guide upgrades
   the channels it covers and leaves the rest seeded — and `source` says which
   is which on every record. */
let channels = CHANNELS;
let icp = ICP;
let edition = null;
/* Present only once a field guide supplies them — the seed has neither, and an
   empty array is honest about that rather than inventing a house pattern set. */
let patterns = [];
let channelJobs = [];
/* The six expression profiles, their blends, and the four traveller
   orientations. Absent from the seed because they are pure research — there is
   no sensible placeholder for "how does this advisor create advantage", and an
   invented one would be worse than none. */
let expressionProfiles = [];
let expressionBlends = [];
let travellerOrientations = [];
/* Section 8 §5, and the fourth extract of this Bible. api/_lib/capacity.js
   keeps its own copy as the fallback and merges per class over it, so the
   numbers are tunable in research without a code change and a partial edit
   upgrades only what it covers. Empty here: the seed has no opinion about
   how much an advisor can sustain, and inventing one would be worse. */
let capacityClasses = {};

/* The traveller need-state vocabulary. Empty on the seed for the same reason
   the expression profiles are: there is no honest placeholder for how a
   traveller feels, and an invented one would be worse than none. */
let needStates = {};

if (fs.existsSync(path.join(GUIDE, 'playbook.js'))) {
  const guide = require(path.join(GUIDE, 'playbook.js'));
  edition = guide.edition || null;
  if (Array.isArray(guide.patterns)) patterns = guide.patterns;
  if (Array.isArray(guide.channelJobs)) channelJobs = guide.channelJobs;
  if (Array.isArray(guide.expressionProfiles)) expressionProfiles = guide.expressionProfiles;
  if (Array.isArray(guide.expressionBlends)) expressionBlends = guide.expressionBlends;
  if (Array.isArray(guide.travellerOrientations)) travellerOrientations = guide.travellerOrientations;
  if (guide.capacityClasses) capacityClasses = guide.capacityClasses;
  if (guide.needStates) needStates = guide.needStates;

  if (Array.isArray(guide.channels)) {
    const byName = {};
    guide.channels.forEach((c) => { if (c && c.channel) byName[c.channel] = c; });

    channels = CHANNELS.map((seed) => (byName[seed.channel]
      ? Object.assign({}, seed, byName[seed.channel], { source: 'field-guide' })
      : seed));

    /* A researched channel the seed does not have gets APPENDED, not dropped.
       The first version mapped over the seed only, so `youtube` — present in
       the field guide, absent from the seed — vanished without a word. A merge
       that silently discards research is worse than one that fails: the counts
       still looked right, and the only symptom was a channel that never
       appeared in a prompt. */
    const known = {};
    CHANNELS.forEach((c) => { known[c.channel] = true; });
    guide.channels.forEach((c) => {
      if (c && c.channel && !known[c.channel]) {
        channels.push(Object.assign({}, c, { source: 'field-guide' }));
      }
    });
  }
  if (guide.icp) {
    icp = Object.assign({}, ICP, guide.icp, { source: 'field-guide' });
    /* NEVER_PROMISE is a UNION, never a replacement. Everything else in this
       file is advice and research may overrule it; that list is the rail that
       stops a buyer's pain becoming a health promise. A research file with the
       key missing — or set to [] by accident — would otherwise delete it
       silently, and the deletion would look exactly like a normal update in
       the diff. claims.js still blocks the copy either way; this keeps the
       instruction and the block agreeing with each other. */
    icp.NEVER_PROMISE = [...new Set(ICP.NEVER_PROMISE.concat(guide.icp.NEVER_PROMISE || []))];
  }
}

const seeded = channels.filter((c) => c.source === 'seed').length;

const banner = `/* ============================================================================
   MARKETING PLAYBOOK — GENERATED. Do not edit by hand.
   ----------------------------------------------------------------------------
   Written by tools/build-marketing-playbook.js.

   Source   : ${edition ? 'marketing field guide — ' + edition : 'seed (no marketing field guide beside this repo yet)'}
   Seeded   : ${seeded} of ${channels.length} channels still on the seed
   Generated: ${new Date().toISOString().slice(0, 10)}

   \`source\` on every channel says whether the advice is researched or seeded.
   The critique pass scores generated copy against \`converts\` and \`kills\`;
   claims.js remains the only thing that can block copy, and it is unaffected
   by anything in here.
   ========================================================================== */
`;

const body = banner + '\nmodule.exports = ' +
  JSON.stringify({
    provenance: {
      edition,
      seededChannels: seeded,
      patternCount: patterns.length,
      profileCount: expressionProfiles.length,
      generated: new Date().toISOString().slice(0, 10)
    },
    icp,
    channelJobs,
    patterns,
    expressionProfiles,
    expressionBlends,
    travellerOrientations,
    needStates,
    capacityClasses,
    channels
  }, null, 2) + ';\n';

if (CHECK) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  const strip = (s) => s.replace(/Generated:.*\n/, '').replace(/"generated":\s*"[^"]*"/, '');
  if (strip(current) !== strip(body)) {
    console.error('\n  content/marketing-playbook.js is out of date.');
    console.error('  Run: node tools/build-marketing-playbook.js — then READ THE DIFF.\n');
    process.exit(1);
  }
  console.log('  marketing-playbook.js is current.');
  process.exit(0);
}

fs.writeFileSync(OUT, body);
console.log('');
console.log('  content/marketing-playbook.js written');
console.log('    channels        ' + channels.length);
console.log('    from research   ' + (channels.length - seeded));
console.log('    still seeded    ' + seeded + (seeded === channels.length
  ? '   ← all of it. Duncan\'s field guide replaces this.' : ''));
console.log('    patterns        ' + patterns.length + (patterns.length ? '' : '   ← none; the seed has no pattern library'));
console.log('    channel jobs    ' + channelJobs.length);
console.log('    expression      ' + expressionProfiles.length + ' profiles, ' + expressionBlends.length + ' blends');
console.log('    orientations    ' + travellerOrientations.length);
console.log('    ICP source      ' + icp.source);
console.log('    edition         ' + (edition || 'none — put one at ../marketing-field-guide/content/playbook.js'));
console.log('');
console.log('  READ THE DIFF before committing. It is the confirmation step.');
console.log('');
