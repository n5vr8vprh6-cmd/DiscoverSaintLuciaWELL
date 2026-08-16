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

/* ── The ICP layer ────────────────────────────────────────────────────────
   Who the advisor's client actually is, at the depth that lets copy speak to
   somebody rather than about a place. This is the difference between "Saint
   Lucia is beautiful" and "you have not had a week where nobody needed you
   since 2019".

   NEVER_PROMISE is not decoration. A trigger explains why somebody starts
   looking; it must never become a claim about what they will get. Somebody
   shopping after a hard year is a fact about them, not a licence to say a
   holiday fixes hard years — and claims.js will block the copy if the
   generator forgets, which is the belt to this file's braces. */
const ICP = {
  source: 'seed',

  pains: [
    'Has not had a stretch of days where nobody needed them in years.',
    'Takes holidays and comes home more tired than they left.',
    'Cannot face researching another destination; the choosing is its own work.',
    'Feels guilty being unreachable, and so is never actually away.',
    'Disagrees with their partner about what a good break even looks like — one wants to do everything, one wants to do nothing.',
    'Suspects "wellness travel" means juice fasts, silence and being told what to do.',
    'Has the money and not the time, so a wasted trip costs more than it costs.'
  ],

  triggers: [
    'A milestone — a fortieth, a twenty-fifth anniversary, a last year before the kids leave.',
    'A job change, a sale, a redundancy: a gap that will not stay open.',
    'A friend came back from somewhere and would not stop talking about it.',
    'A year that took more than it gave, and a decision not to repeat it.',
    'Booking their own trip last time and spending it managing logistics.'
  ],

  objections: [
    '"I can book this myself." — They can. They will spend nine hours doing it and get the third-best option.',
    '"It is expensive." — Usually means "I cannot tell what I am getting for it."',
    '"Wellness sounds joyless." — They are picturing a boot camp or a silent retreat.',
    '"Will there be anything to do?" — Usually the partner asking, and a real question.',
    '"I do not have time to plan it." — The actual reason an advisor exists, and rarely said out loud.'
  ],

  tried: [
    'An all-inclusive that was loud, crowded and served the same food for a week.',
    'A spa weekend that was over before they had stopped thinking about work.',
    'Booking it themselves and arriving exhausted from the arranging.',
    'A "digital detox" they abandoned on day two because nobody had planned for it.'
  ],

  NEVER_PROMISE: [
    'That a trip repairs, restores, heals, treats or fixes anything about a person.',
    'That time away improves sleep, stress, burnout, energy or any measurable thing.',
    'Anything a reader could take as a health outcome, however gently phrased.',
    'A pain above is a reason somebody starts looking. It is never a promise about what they get.'
  ]
};

/* ── Channels ─────────────────────────────────────────────────────────────
   `anatomy` is the shape. `hooks` are openings with the reason they work,
   because a pattern without its reason gets copied badly. `converts` and
   `kills` are the two lists the generator is actually scored against in the
   critique pass. */
const CHANNELS = [
  {
    channel: 'instagram',
    source: 'seed',
    anatomy: [
      'First line is the whole hook — only about 125 characters show before "more", and most people never tap it.',
      'One idea. Not three.',
      'One concrete, specific detail that proves you have actually been paying attention.',
      'One small ask.'
    ],
    hooks: [
      { pattern: 'Name the reader\'s situation before naming the place',
        why: 'They recognise themselves before they have to care about a destination.',
        example: 'Most people book a beach. A few book the week afterwards, when they notice they slept.' },
      { pattern: 'The quiet contradiction',
        why: 'A sentence that argues with the expected one earns the next sentence.',
        example: 'The best thing about this island is not the view.' },
      { pattern: 'A specific detail, stated flatly',
        why: 'Specificity is the cheapest possible proof you know what you are talking about.',
        example: 'There are 43 steps between the room and the water at Anse Chastanet. People stop counting by day three.' },
      { pattern: 'The admission',
        why: 'A small honest concession buys credibility for the claim that follows.',
        example: 'I send almost nobody here in August. February is a different island.' }
    ],
    lengths: { ideal: '60-80 words', max: 125, unit: 'words' },
    converts: [
      'Writing to one person, not to an audience.',
      'A concrete sensory detail instead of an adjective.',
      'An ask small enough to answer in four words.',
      'Saying who it is NOT for — it makes the "for" believable.'
    ],
    kills: [
      'Opening with the destination name. Nobody is searching for it in their feed.',
      'Stacked adjectives — stunning, breathtaking, unforgettable. They cancel each other out.',
      'A wall of hashtags. Three, at most, and only real ones.',
      'Asking for a booking in a post from somebody who has never heard of you.',
      'Anything that sounds like a brochure wrote it.'
    ],
    cta: [
      'Which of those two sounds more like the year you have had?',
      'Tell me the month you are thinking about and I will tell you what it is like then.',
      'Two minutes, and it will tell you more than an hour of scrolling — link below.'
    ]
  },

  {
    channel: 'email',
    source: 'seed',
    anatomy: [
      'Subject line says one small specific thing. Under 50 characters.',
      'First line is not a greeting and not "hope this finds you well".',
      'One idea, one ask, one link.',
      'Sign off like a person, not a business.'
    ],
    hooks: [
      { pattern: 'A question about a specific month',
        why: 'Small, answerable, and implies you have already been thinking about them.',
        example: 'Subject: A question about February' },
      { pattern: 'Reference the last real thing that happened between you',
        why: 'Proves it is not a blast, in the first six words.',
        example: 'You mentioned wanting somewhere quiet, back when you booked Lisbon.' },
      { pattern: 'The short useful observation',
        why: 'Gives before it asks, and earns the next email as well as this one.',
        example: 'Quick one: the difference between the two coasts here decides most trips, and nobody mentions it.' }
    ],
    lengths: { ideal: 'under 200 words', max: 250, unit: 'words' },
    converts: [
      'Written to one person, in the second person, throughout.',
      'One link. Two links halve the clicks on both.',
      'A question that can be answered with one line, so replying is not a task.',
      'Plain text. It looks like a person wrote it because a person did.'
    ],
    kills: [
      '"I hope this email finds you well."',
      'Three calls to action, so the reader picks none.',
      'A newsletter round-up when what you wanted was a reply.',
      'Image headers that break in Outlook and land in Promotions.',
      'Anything that reads like it went to four hundred people, because it did.'
    ],
    cta: [
      'Worth a fifteen-minute call, or shall I just send you two options?',
      'Reply with a month and I will tell you honestly whether it is the right one.'
    ]
  },

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
    channel: 'linkedin',
    source: 'seed',
    anatomy: [
      'A hook line, then a line break. The preview cuts at roughly two lines.',
      'A short observation or a small true story.',
      'One thing the reader can take away.',
      'A light ask, or none.'
    ],
    hooks: [
      { pattern: 'The professional frame on a personal subject',
        why: 'Gives a serious reader permission to care about rest.',
        example: 'The most expensive thing in most of my clients\' calendars is the week they keep not taking.' },
      { pattern: 'A number from your own work',
        why: 'First-hand data is the only kind nobody scrolls past.',
        example: 'Of the trips I planned last year, the ones people talked about afterwards had one thing in common.' }
    ],
    lengths: { ideal: '100-150 words', max: 200, unit: 'words' },
    converts: ['A real story with a real detail.', 'White space.', 'Being useful before being available.'],
    kills: [
      '"I am humbled to announce."',
      'Engagement bait — "thoughts?", "agree?".',
      'Hashtag stacks.',
      'Writing like a press release about yourself.'
    ],
    cta: ['If this is your year for it, my inbox is open.', 'Happy to send the two-minute version to anyone curious.']
  },

  {
    channel: 'facebook',
    source: 'seed',
    anatomy: ['A hook that works without an image.', 'A short story.', 'One ask.'],
    hooks: [
      { pattern: 'The story you would tell a friend',
        why: 'Facebook rewards the conversational register more than any other channel.',
        example: 'A client asked me last week what the difference actually is between the two coasts.' }
    ],
    lengths: { ideal: '80-150 words', max: 200, unit: 'words' },
    converts: ['Story over pitch.', 'Replying to every comment.', 'Local specificity when the audience is local.'],
    kills: ['Cross-posting an Instagram caption verbatim.', 'Link-only posts.', 'Obvious advertising voice.'],
    cta: ['Ask me anything about it in the comments.']
  },

  {
    channel: 'tiktok',
    source: 'seed',
    anatomy: [
      'The hook is the first two seconds and it is visual.',
      'One idea, said out loud, to camera.',
      'No slow intro. No "hey guys".'
    ],
    hooks: [
      { pattern: 'Open on the thing itself',
        why: 'Two seconds is the whole budget; a title card spends it.',
        example: 'Open on the water, talking already: "Nobody tells you the two coasts are different holidays."' }
    ],
    lengths: { ideal: '20-40 seconds', max: 60, unit: 'seconds' },
    converts: ['Talking like a person.', 'One idea per video.', 'Saying the useful part first, not last.'],
    kills: ['A logo intro.', '"Hey guys, welcome back."', 'Text-heavy slideshows.', 'Saving the point for the end.'],
    cta: ['Link in bio if you want the two-minute version.']
  },

  {
    channel: 'newsletter',
    source: 'seed',
    anatomy: ['One idea per issue.', 'A subject that describes it honestly.', 'A voice that sounds the same every time.'],
    hooks: [
      { pattern: 'The thing you learned this month',
        why: 'A newsletter people keep is one that gives before it asks.',
        example: 'Something I got wrong about February, and what I now tell people instead.' }
    ],
    lengths: { ideal: '300-500 words', max: 700, unit: 'words' },
    converts: ['Consistency of voice.', 'One idea.', 'A postscript with the actual ask.'],
    kills: ['A round-up of links.', 'Sounding corporate in issue three after sounding human in issue one.', 'Publishing when you have nothing to say.'],
    cta: ['P.S. — two planning conversations open this month if you want one.']
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

if (fs.existsSync(path.join(GUIDE, 'playbook.js'))) {
  const guide = require(path.join(GUIDE, 'playbook.js'));
  edition = guide.edition || null;
  if (Array.isArray(guide.patterns)) patterns = guide.patterns;
  if (Array.isArray(guide.channelJobs)) channelJobs = guide.channelJobs;
  if (Array.isArray(guide.expressionProfiles)) expressionProfiles = guide.expressionProfiles;
  if (Array.isArray(guide.expressionBlends)) expressionBlends = guide.expressionBlends;
  if (Array.isArray(guide.travellerOrientations)) travellerOrientations = guide.travellerOrientations;

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
