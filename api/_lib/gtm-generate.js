/* ============================================================================
   GTM GENERATE — the prompts, the projection, and what comes back
   ----------------------------------------------------------------------------
   openai.js moves text. gtm.js handles HTTP. This is the part that decides what
   the model is told and what we do with the answer.

   ── THE ISOLATION IS STRUCTURAL, NOT PROCEDURAL ────────────────────────────
   No consumer or Journey data ever reaches the AI. That is not achieved by
   remembering not to include it — it is achieved by advisorContext() taking an
   advisor and a profile and copying named fields out of them. There is no path
   from journey_shares into a prompt, because nothing here is ever handed a
   share to filter. A filter can be written wrong; an absent parameter cannot.

   The travellers who shared a Journey consented to an introduction to an
   advisor. They did not consent to becoming raw material for that advisor's
   marketing, and the difference is not subtle.

   ── THE FACT PROJECTION DROPS `unverified` ─────────────────────────────────
   Property records carry an `unverified` note — "treatment-room counts differ
   across current materials; confirm if planning groups". That is a caution for
   a human planning a group booking. Handing it to a copywriter does the
   opposite of what it is for: it introduces treatment rooms as a topic and
   invites the exact sentence it warns against. What the model gets is the
   confirmed hook and the mappings, and nothing about our uncertainty.

   ── THE MODEL IS NEVER ASKED TO POLICE ITSELF ──────────────────────────────
   The prompts carry the claim rules because a prompt that invites invention
   produces more work for the checker. But the verdict is always claims.js,
   running plain code against the fact bank. A checker that can hallucinate is
   not a control, and "I asked it to be careful" is not a compliance position.
   ========================================================================== */
'use strict';

const { chat } = require('./openai.js');
const { check, ownNames } = require('./claims.js');
const FACTS = require('../../content/campaign-facts.js');
const PLAYBOOK = require('../../content/marketing-playbook.js');
const { personaBlock } = require('./persona.js');
const { briefBlock, citedBlock, validCitation } = require('./brief.js');

/* ── Only the relevant channel goes into a prompt ─────────────────────────
   The playbook is twelve thousand characters. Sending all of it on every asset
   call would cost more than the copy is worth and bury the one page that
   matters — a model given advice about ten channels writes for none of them.

   Channel first, then kind: a skeleton says channel `instagram` with kind
   `caption`, or channel `direct` with kind `dm`. The first is a platform, the
   second is a shape, and either can be the useful key. */
function playbookFor(channel, kind) {
  const list = PLAYBOOK.channels || [];
  const by = (name) => list.find((c) => c.channel === String(name || '').toLowerCase());
  return by(channel) || by(kind) || null;
}

/* Who the copy is for, in the depth that lets it speak to somebody rather than
   about a place. NEVER_PROMISE travels with it, always — a pain is a reason
   somebody starts looking, and the moment it reads as a promise about what a
   trip does to them, claims.js blocks the copy and the advisor has wasted a
   build. Better to say it up front than catch it at the end. */
function icpBlock() {
  const icp = PLAYBOOK.icp || {};
  const lines = (label, arr) => (arr && arr.length
    ? `${label}:\n${arr.map((s) => '  - ' + s).join('\n')}\n` : '');

  return `WHO YOU ARE WRITING FOR
${lines('What is actually wrong for them', icp.pains)}${
  lines('What makes them start looking now', icp.triggers)}${
  lines('What they will think but not say', icp.objections)}${
  lines('What they have already tried that did not hold', icp.tried)}
NEVER, WHATEVER THE PLAYBOOK SAYS:
${(icp.NEVER_PROMISE || []).map((s) => '  - ' + s).join('\n')}`;
}

/* ── Patterns ─────────────────────────────────────────────────────────────
   SELECTION BEFORE GENERATION, which is the Strategist Bible's rule and the
   right one. The skeleton picks a pattern per action from the library; the
   asset executes the one it was given. A pattern chosen after the copy exists
   is a label, not a structure — and it is why every caption in the pre-D3 plans
   came out shaped the same way.

   Grouped by job because that is how a plan selects: an action needs
   recognition, or proof, or a reframe, and the pattern is the shape that
   delivers it. */
function patternsBlock() {
  const list = PLAYBOOK.patterns || [];
  if (!list.length) return '';

  const byJob = {};
  list.forEach((p) => { (byJob[p.job] = byJob[p.job] || []).push(p); });

  return Object.keys(byJob).map((job) =>
    `${job.toUpperCase()}\n` + byJob[job]
      .map((p) => `  ${p.name} — "${p.formula}"`).join('\n')
  ).join('\n');
}

function patternByName(name) {
  const n = String(name || '').toLowerCase().trim();
  return (PLAYBOOK.patterns || []).find((p) => p.name.toLowerCase() === n) || null;
}

/* The channel's own page, rendered small. `converts` and `kills` are the two
   lists the critique pass scores against, so they are stated as rules rather
   than as prose the model can admire and ignore. */
function playbookBlock(channel, kind) {
  const p = playbookFor(channel, kind);
  if (!p) return '';

  const bullets = (arr) => (arr || []).map((s) => '  - ' + s).join('\n');
  const hooks = (p.hooks || []).map((h) =>
    `  - ${h.pattern} — ${h.why}\n      e.g. ${h.example}`).join('\n');
  /* Surfaces matter where a channel is several environments wearing one name —
     Instagram is the case the Bible makes, and a Reel and a Story want
     different writing. */
  const surfaces = (p.surfaces || []).map((s) =>
    `  - ${s.surface} (${s.job}): ${s.works}`).join('\n');

  return `HOW THIS CHANNEL ACTUALLY WORKS (${p.channel})${
  p.job ? `\nWhat this channel is FOR: ${p.job}` : ''}
Shape:
${bullets(p.anatomy)}
${surfaces ? 'Surfaces, which are not interchangeable:\n' + surfaces + '\n' : ''}${
  hooks ? 'Openings that earn the next line:\n' + hooks + '\n' : ''}Length: ${
  p.lengths ? p.lengths.ideal + ' (never past ' + p.lengths.max + ' ' + p.lengths.unit + ')' : 'short'}

WHAT MAKES IT WORK:
${bullets(p.converts)}

WHAT KILLS IT — do none of these:
${bullets(p.kills)}
${(p.cta || []).length ? '\nAsks that suit this channel:\n' + bullets(p.cta) : ''}`;
}

/* ── Angles ───────────────────────────────────────────────────────────────
   Requested per asset, never generated as a set. An advisor spends variety on
   the one caption they are unsure of rather than paying for three versions of
   all eight — which is both cheaper and a better use of a build. */
const ANGLES = {
  pain: 'Lead with what is actually wrong for them right now. Name it plainly, without self-pity and without promising to fix it.',
  aspiration: 'Lead with the specific ordinary thing they want back — a morning with nothing in it, a conversation that is not about logistics.',
  proof: 'Lead with something concrete you know: a detail about the place, a pattern across clients, a thing you got wrong and learned from.',
  practical: 'Lead with the decision they are avoiding, and make it smaller. Which month, which coast, how many days.'
};

/* ── What the model is allowed to know ───────────────────────────────────── */

/* Confirmed entries only, and only the fields that help someone write a true
   sentence. Rebuilt per call rather than cached at module load so a fact-bank
   regeneration is picked up by the next request rather than the next deploy. */
function modelFacts() {
  return {
    villages: FACTS.villages.map((v) => ({ name: v.name, short: v.short })),
    compass: FACTS.compass.map((c) => ({ name: c.name, read: c.read })),
    continuum: FACTS.continuum.map((c) => ({ name: c.name, meaning: c.meaning, plan: c.plan })),
    properties: FACTS.properties
      /* An unconfirmed property is absent entirely rather than present with a
         caveat nobody reads. Today every record is confirmed; this filter is
         what keeps that true when the Field Guide's research agent adds one
         that is not. */
      .filter((p) => p.confirmed !== false && p.placeholder !== true)
      .map((p) => ({
        name: p.name,
        villages: p.villages,
        compass: p.compass,
        hook: p.hook
        /* p.unverified is deliberately absent — see the header. */
      })),
    safeRegister: FACTS.SAFE_REGISTER,
    neverClaim: FACTS.NEVER_CLAIM
  };
}

/* THE ALLOW-LIST. Everything the model learns about who it is writing for comes
   through here. Adding a field is a deliberate act; nothing arrives by being
   attached to an object that happened to be passed in. */
const ADVISOR_FIELDS = ['first_name', 'last_name', 'business', 'host_agency', 'market'];
const PROFILE_FIELDS = [
  'positioning', 'differentiator', 'icp', 'client_examples', 'specialties', 'markets',
  'email_band', 'social_band', 'client_band'
];
/* Channels are sent as names only. The URLs stay out: we never fetch them, the
   model cannot open them, and a link in a prompt is just a token the model may
   decide to print into a caption. */
const CHANNEL_FIELDS = ['website', 'linkedin', 'instagram', 'facebook', 'tiktok', 'newsletter'];

function advisorContext(advisor, profile) {
  const a = advisor || {};
  const p = profile || {};
  const out = { channels: [] };

  ADVISOR_FIELDS.forEach((f) => { if (a[f]) out[f] = String(a[f]).slice(0, 200); });
  PROFILE_FIELDS.forEach((f) => { if (p[f]) out[f] = String(p[f]).slice(0, 900); });
  CHANNEL_FIELDS.forEach((f) => { if (String(p[f] || '').trim()) out.channels.push(f); });

  /* The advisor's WELL link is the one URL that belongs in copy, and it is
     ours. Passed as a placeholder token rather than the real link so a model
     that mangles a URL cannot produce a broken one — gtm.js substitutes the
     real value after the checker has run. */
  out.linkToken = '{{WELL_LINK}}';
  return out;
}

/* ── The rules every prompt carries ──────────────────────────────────────── */
function rulesBlock(rung) {
  const ladder = FACTS.CLAIMS_LADDER[rung] || FACTS.CLAIMS_LADDER.registered;
  return `RULES — THESE OUTRANK THE WRITING

1. HEALTH. Never say or imply that travel treats, cures, heals, reduces,
   relieves or improves any condition, symptom or measurable thing. No
   cortisol, no burnout, no anxiety, no sleep quality, no immune function.
   Write about places and time, never about effects on a body.
   This register is safe and is the register to use: ${FACTS.SAFE_REGISTER.join('; ')}.
2. CREDENTIALS. This advisor may accurately say: ${ladder.may.join('; ')}.
   They may NOT say: ${ladder.mayNot.join('; ')}. Do not imply it either.
3. FACTS. Name only places and properties from the list you were given. Do not
   add a property, a village, a treatment, a practitioner or a partner that is
   not on it. If you want a detail you do not have, write about what you do.
4. NEVER: ${FACTS.NEVER_CLAIM.join('; ')}.
5. The advisor's link is the literal token {{WELL_LINK}}. Write it exactly.
   Never invent a URL, a handle or a phone number.`;
}

/* ── Skeleton: the shape of the month ────────────────────────────────────── */

const SKELETON_SYSTEM = `You plan short, realistic marketing campaigns for independent travel
advisors. You are practical and unexcitable. You produce small actions a busy
person will actually do, not content calendars they will abandon in week two.
You return JSON and nothing else.`;

function skeletonPrompt(ctx, rung, persona, brief) {
  return `Plan a 30-day campaign for this travel advisor to promote wellness travel
to Saint Lucia and collect enquiries through their personal link.

THE ADVISOR
${JSON.stringify(ctx, null, 1)}
${persona || ''}
${brief || ''}
${icpBlock()}

${/* THE SKELETON NEEDS THIS AS MUCH AS THE ASSETS DO, and for a while it did
     not have it. The first D1 run produced captions that had visibly improved
     and a plan that still said "Post a stunning image of Saint Lucia" and
     "Post a countdown to wellness travel" — because the playbook reached the
     asset prompt and stopped there. The actions ARE the plan; copy attached to
     a worthless action is worthless copy, written well. */''}
WHAT MAKES AN ACTION WORTH DOING
An action names a specific thing to do, to specific people. "Post a stunning
image", "share a wellness tip" and "message past clients" are categories, not
actions — nobody can tell whether they did them.

Every action must survive two questions:
  1. How would I know if I had done this?
  2. Could this action appear, word for word, in another advisor's plan?
If the answer to the second is yes, it is too vague to be worth their month.

DELIBERATELY NO EXAMPLES ARE GIVEN HERE. Every example this prompt has carried
was copied into the plan verbatim rather than learned from, which produced an
action about somebody else's business.

USE WHAT THEY TOLD YOU. AT LEAST THREE of your actions must be built on a
specific detail from the advisor's own description above — the clients they
named, the cities they work in, the occasions they specialise in, the thing
they said they refuse to do. Not the category, the detail itself.

  If they mentioned two lawyers who had not taken a week off together, an
  action can be addressed to the people in their list who look like that.
  If they named three cities, an action can be about one of them.
  If they said they say no a lot, an action can be about what they turn down.

Before you return the JSON, read your own actions back. Any action that could
appear word for word in a different advisor's plan is not finished — rewrite it
using something only this advisor knows.

THE SHAPE IT MUST TAKE
Four weeks. Two to four actions per week, no more. Real actions of mixed size:
messaging a short list of past clients by name, one post, one email, one
conversation. NOT thirty social posts — that plan fails in week two and the
advisor blames themselves.

Use ONLY the channels listed in "channels". If they have no Instagram, do not
plan Instagram. If the only channel is a newsletter, plan around a newsletter.

${rulesBlock(rung)}

CHOOSE A PATTERN FOR EACH ACTION
Pick from this library by the JOB the action needs doing. Use the name exactly.
Do not use the same pattern twice in one week — a plan where every piece is
shaped the same way reads as one piece repeated.

${patternsBlock()}

RETURN EXACTLY THIS JSON, no prose, no code fence:
{
  "premise": "one sentence on the strategy, in plain language",
  "weeks": [
    {
      "week": 1,
      "theme": "three or four words",
      "actions": [
        {
          "title": "imperative, under 60 characters",
          "why": "one sentence on what this is for",
          "channel": "one of the advisor's channels, or \\"direct\\" for one-to-one messages",
          "assetKind": "caption | email | sms | dm | script | outline | none",
          "pattern": "the exact name of one pattern from the library above",
          "uses": "which brief item this is built on, e.g. CLIENTS 2 — or \\"\\" if none"
        }
      ]
    }
  ]
}`;
}

/* Models wrap JSON in code fences no matter how firmly you ask them not to. */
function parseJson(text) {
  const t = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(t);
  } catch (_) {
    /* Second chance: the first balanced object in the string. A model that
       prefaces JSON with "Here's your plan:" is common enough to handle. */
    const i = t.indexOf('{');
    const j = t.lastIndexOf('}');
    if (i >= 0 && j > i) {
      try { return JSON.parse(t.slice(i, j + 1)); } catch (_) { /* give up */ }
    }
    return null;
  }
}

const ASSET_KINDS = ['caption', 'email', 'sms', 'dm', 'script', 'outline', 'none'];

/* Whatever comes back is shaped by us before it touches the database. A model
   that returns six weeks, or nine actions, or an assetKind it invented, must
   not be able to write a plan the Hub cannot render. */
function normaliseSkeleton(raw, brief) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.weeks)) return null;

  const weeks = raw.weeks.slice(0, 4).map((w, i) => ({
    week: i + 1,
    theme: String(w && w.theme || '').slice(0, 60),
    actions: (Array.isArray(w && w.actions) ? w.actions : []).slice(0, 4).map((a) => {
      const kind = String(a && a.assetKind || 'none').toLowerCase().trim();
      /* Validated against the library, not trusted. A model asked to pick from
         a list will sometimes invent a plausible-sounding entry, and an
         invented pattern reaches the asset prompt as an instruction nobody
         wrote. Unknown becomes null, and the asset falls back to the channel's
         own hooks. */
      const named = patternByName(a && a.pattern);
      /* VALIDATED AGAINST THE ACTUAL INVENTORY. A model asked to cite will
         occasionally cite CLIENTS 7 from a list of two, and an invented
         citation is worse than none — it would look, in the plan and in every
         later measurement, exactly like the specificity we are trying to get. */
      const cite = brief ? validCitation(brief, a && a.uses) : null;
      return {
        title: String(a && a.title || '').slice(0, 120),
        why: String(a && a.why || '').slice(0, 300),
        channel: String(a && a.channel || 'direct').toLowerCase().slice(0, 20),
        assetKind: ASSET_KINDS.indexOf(kind) === -1 ? 'none' : kind,
        pattern: named ? named.name : null,
        uses: cite
      };
    }).filter((a) => a.title)
  })).filter((w) => w.actions.length);

  if (!weeks.length) return null;
  return { premise: String(raw.premise || '').slice(0, 300), weeks };
}

async function generateSkeleton(advisor, profile, rung) {
  const ctx = advisorContext(advisor, profile);
  const r = await chat({
    system: SKELETON_SYSTEM,
    user: skeletonPrompt(ctx, rung, personaBlock(profile), briefBlock(profile && profile.brief_parsed)),
    maxTokens: 1400,
    temperature: 0.5,
    stub: STUB_SKELETON
  });

  if (!r.ok) return { ok: false, reason: r.reason, payload: r.payload, ms: r.ms };

  const skeleton = normaliseSkeleton(parseJson(r.text), profile && profile.brief_parsed);
  if (!skeleton) {
    return { ok: false, reason: 'unparseable', payload: r.payload, ms: r.ms };
  }
  return { ok: true, skeleton, payload: r.payload, ms: r.ms, model: r.model, usage: r.usage };
}

/* ── One asset ───────────────────────────────────────────────────────────── */

const ASSET_SYSTEM = `You write short marketing copy for independent travel advisors in
their own voice. You are specific and plain. You never write like a brochure and
you never make claims about health. You return only the copy requested.`;

const SHAPES = {
  caption: 'A social caption. Under 80 words. One idea. A question or an invitation at the end. No hashtag wall — three at most.',
  email:   'An email. A subject line on the first line prefixed "Subject: ", then the body. Under 200 words. Written to one person, not a list.',
  sms:     'A text message. Under 40 words. Sounds like a person, not a business.',
  dm:      'A direct message to one past client. Under 60 words. Reference that you know them. No pitch in the first two sentences.',
  script:  'What to say out loud, as bullet points. Under 120 words. For a conversation, not a reading.',
  outline: 'A short outline as bullet points. Under 120 words.'
};

function assetPrompt(ctx, action, rung, weekTheme, angle, persona, cited) {
  const book = playbookBlock(action.channel, action.assetKind);
  const pat = patternByName(action.pattern);
  return `Write one piece of copy for this travel advisor.

THE ADVISOR
${JSON.stringify(ctx, null, 1)}
${persona || ''}
${icpBlock()}

THE ACTION IT IS FOR
Week ${action.week} — ${weekTheme}
${action.title}
Purpose: ${action.why}
Channel: ${action.channel}

THE SHAPE
${SHAPES[action.assetKind] || SHAPES.caption}
${pat ? `
THE PATTERN THIS PIECE MUST FOLLOW
${pat.name} — "${pat.formula}"
Its job is ${pat.job}. Build the piece on that shape; do not quote the formula.
` : ''}
${cited || ''}
${book || ''}
${angle && ANGLES[angle] ? `\nTHE ANGLE FOR THIS VERSION\n${ANGLES[angle]}\n` : ''}
WHAT YOU MAY DRAW ON
${JSON.stringify(modelFacts(), null, 1)}

${rulesBlock(rung)}

Return the copy only. No preamble, no notes, no explanation, no quotation marks
around the whole thing.`;
}

async function generateAsset(advisor, profile, rung, action, weekTheme, opts) {
  const o = opts || {};
  const ctx = advisorContext(advisor, profile);
  const r = await chat({
    system: ASSET_SYSTEM,
    user: assetPrompt(ctx, action, rung, weekTheme || '', o.angle, personaBlock(profile),
      citedBlock(profile && profile.brief_parsed, action.uses)),
    maxTokens: 700,
    temperature: 0.65,
    stub: STUB_ASSET
  });

  if (!r.ok) return { ok: false, reason: r.reason, payload: r.payload, ms: r.ms };

  let body = String(r.text || '').trim().replace(/^["“](.*)["”]$/s, '$1').trim();
  if (!body) return { ok: false, reason: 'empty', payload: r.payload, ms: r.ms };

  /* ── The critique pass ──────────────────────────────────────────────────
     A second small call that scores the draft against this channel's own
     `converts` and `kills` and rewrites it once. On by default, skippable for
     tests and for the angle button where the advisor is already iterating.

     IT CANNOT MAKE THINGS WORSE. A failed or unparseable critique returns the
     original draft untouched, so the only outcomes are "better" and "the same".
     The score is never returned to the browser — a visible score invites
     arguing with the number instead of reading the copy. */
  let critiqued = null;
  if (o.critique !== false) {
    const { improve } = require('./critique.js');
    critiqued = await improve({
      body, ctx, rung,
      channel: action.channel, kind: action.assetKind,
      playbook: playbookFor(action.channel, action.assetKind)
    });
    if (critiqued && critiqued.ok && critiqued.body) body = critiqued.body;
  }

  /* The verdict, from plain code, ALWAYS on the final text. The rewrite is more
     surface for a health claim than the draft was, and a checker that ran
     before the last edit is a checker that ran on something else. */
  const verdict = check(body, rung, ownNames(advisor));

  const usage = [r.usage, critiqued && critiqued.usage].filter(Boolean);
  return {
    ok: true,
    body,
    flags: verdict.flags,
    severity: verdict.high ? 'high' : verdict.flags.length ? 'low' : 'none',
    copyable: verdict.copyable,
    angle: o.angle || null,
    /* Internal only — never rendered. Present so tests and cost measurement
       can see whether the pass actually did anything. */
    critique: critiqued ? { score: critiqued.score, changed: critiqued.changed } : null,
    payload: r.payload,
    ms: r.ms + (critiqued ? critiqued.ms || 0 : 0),
    model: r.model,
    usage: usage.length ? usage.reduce((a, u) => ({
      prompt_tokens: (a.prompt_tokens || 0) + (u.prompt_tokens || 0),
      completion_tokens: (a.completion_tokens || 0) + (u.completion_tokens || 0),
      total_tokens: (a.total_tokens || 0) + (u.total_tokens || 0)
    }), {}) : null
  };
}

/* ── Stubs ────────────────────────────────────────────────────────────────
   Used only when OPENAI_STUB=1. They must look like real output — same shape,
   same register, deliberately including the {{WELL_LINK}} token — or the tests
   exercise a parser against a fiction and pass where production would fail. */
const STUB_SKELETON = JSON.stringify({
  premise: 'Start with the people who already trust you, then let the link do the rest.',
  weeks: [
    { week: 1, theme: 'The warm list', actions: [
      { title: 'Message 10 past clients by name', why: 'The highest-intent audience you will ever have.', channel: 'direct', assetKind: 'dm' },
      { title: 'Post once about why Saint Lucia', why: 'Signals the new focus without announcing it.', channel: 'instagram', assetKind: 'caption' }
    ] },
    { week: 2, theme: 'Widen it', actions: [
      { title: 'Email your list', why: 'Reaches the people who opted in and never hear from you.', channel: 'newsletter', assetKind: 'email' }
    ] },
    { week: 3, theme: 'Conversations', actions: [
      { title: 'Follow up everyone who replied', why: 'Replies decay fast.', channel: 'direct', assetKind: 'script' }
    ] },
    { week: 4, theme: 'Close the loop', actions: [
      { title: 'Share what you learned', why: 'Proof you are doing the work.', channel: 'instagram', assetKind: 'caption' }
    ] }
  ]
}, null, 1);

const STUB_ASSET = `Six villages, one island, and a way of choosing that actually asks what you
need. If you have been meaning to go somewhere that gives you unhurried days,
this is the one I would send you to first.

Take two minutes and see what comes back: {{WELL_LINK}}`;

module.exports = {
  advisorContext, modelFacts, rulesBlock,
  playbookFor, playbookBlock, patternsBlock, patternByName, icpBlock, ANGLES, PLAYBOOK,
  skeletonPrompt, assetPrompt, parseJson, normaliseSkeleton,
  generateSkeleton, generateAsset,
  ADVISOR_FIELDS, PROFILE_FIELDS, CHANNEL_FIELDS, ASSET_KINDS,
  STUB_SKELETON, STUB_ASSET
};
