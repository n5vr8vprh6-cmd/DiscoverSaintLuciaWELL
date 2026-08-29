/* ============================================================================
   GTM — what we know about an advisor's business, and what it is missing
   ----------------------------------------------------------------------------
   The inputs to the 30-day campaign plan. No AI here: this file reads and
   writes the profile, works out where an advisor sits on the claims ladder,
   names the gaps, and builds the prompt they run in their own AI to fill the
   form in.

   ── WHY THE PROMPT EXISTS ─────────────────────────────────────────────────
   A blank textarea labelled "describe your positioning" is where intake forms
   go to die. So the screen hands the advisor a prompt built from what we
   already have, they run it in Claude or ChatGPT on a free plan, and they
   paste the answers back.

   IT IS ALSO WHY WE FETCH NOTHING. Instagram, LinkedIn and TikTok block our
   server; they do not block a person's own browser. Letting the advisor's own
   AI do the looking sidesteps the login walls and the SSRF surface at once,
   costs us no tokens, and produces something they can correct — which a
   scraper never gives them.
   ========================================================================== */
'use strict';

const { db } = require('./core.js');
const { mayBuild } = require('./builds.js');
const FACTS = require('../../content/campaign-facts.js');

/* Bands rather than counts — see 011-gtm.sql for why. The labels are what an
   advisor picks from; the keys are what the generator branches on. */
const BANDS = {
  email: [
    ['none', 'I do not have a list'],
    ['under500', 'Under 500'],
    ['500to2k', '500 to 2,000'],
    ['2kto10k', '2,000 to 10,000'],
    ['over10k', 'More than 10,000']
  ],
  social: [
    ['none', 'Barely any following'],
    ['under500', 'Under 500'],
    ['500to2k', '500 to 2,000'],
    ['2kto10k', '2,000 to 10,000'],
    ['over10k', 'More than 10,000']
  ],
  client: [
    ['none', 'I am starting out'],
    ['under25', 'Under 25'],
    ['25to100', '25 to 100'],
    ['100to500', '100 to 500'],
    ['over500', 'More than 500']
  ]
};

/* The fields the intake writes. An allow-list, following account.js:100 — a
   hand-edited request must not be able to set columns this form does not own,
   and the two training dates are the ones that matter. */
const FIELDS = [
  'positioning', 'differentiator', 'icp', 'client_examples', 'specialties',
  'markets', 'website', 'linkedin', 'instagram', 'facebook', 'tiktok',
  'newsletter', 'email_band', 'social_band', 'client_band'
];

/* ── Where they stand on the claims ladder ────────────────────────────────
   Derived, never stored, so it cannot drift from the dates it describes.
   Defaults DOWN: an advisor with no dates is `registered` and may claim the
   least. A bug here should under-claim, never over-claim. */
function rung(advisor) {
  if (!advisor) return 'registered';
  if (advisor.immersion_at) return 'immersion';
  if (advisor.foundations_at) return 'foundations';
  return 'registered';
}

/* Unlimited past Foundations; a balance of builds before it. The gate and the
   ladder read the same dates, which is the point — there is one fact about an
   advisor here, not two systems that can disagree.

   THE THIRD ANSWER IS "I CANNOT TELL". builds.mayBuild returns null when
   migration 017 has not been applied, and this falls back to exactly what
   shipped before it: one plan, no rebuild. A payment gate whose failure mode
   is "everything is free" is worse than one that fails back to the old rules,
   and the code reaches production before the migration does. */
function mayRefresh(advisor) {
  const metered = mayBuild(advisor);
  if (metered !== null) return metered;
  return rung(advisor) !== 'registered';
}

/* ── Read and write ───────────────────────────────────────────────────────── */
async function profileFor(advisorId) {
  const supabase = db();
  if (!supabase || !advisorId) return null;
  const { data, error } = await supabase
    .from('gtm_profile').select('*').eq('advisor_id', advisorId).maybeSingle();
  if (error) {
    /* The table does not exist until migration 011 is applied, and until then
       every visit to /hub/campaign would log. TWO codes, because Postgres and
       PostgREST report it differently — 42P01 comes from the database, PGRST205
       from the schema cache in front of it, and only the second one actually
       appears in practice. Checking one and assuming it covered both is how the
       log fills up anyway. */
    const missing = ['42P01', 'PGRST205', 'PGRST204'];
    if (missing.indexOf(String(error.code)) === -1) console.error('profileFor', error);
    return null;
  }
  return data || null;
}

async function saveProfile(advisorId, patch) {
  const supabase = db();
  if (!supabase || !advisorId) return { ok: false, error: 'not_configured' };

  const row = { advisor_id: advisorId, updated_at: new Date().toISOString() };
  FIELDS.forEach((f) => {
    if (typeof patch[f] === 'string') row[f] = patch[f].trim() || null;
  });

  const { error } = await supabase
    .from('gtm_profile').upsert(row, { onConflict: 'advisor_id' });
  if (error) {
    console.error('saveProfile — is migration 011 applied?', error);
    return { ok: false, error: 'failed' };
  }
  return { ok: true };
}

/* ── The priority traveller ───────────────────────────────────────────────
   A THIRD ALLOW-LIST, for the reason the persona block below states for the
   second: merging these into FIELDS would let a hand-edited intake POST set an
   advisor's ICP, and merging them into PERSONA_FIELDS would let the persona
   capture do the same. Three surfaces write three disjoint sets of columns.

   WITHOUT THIS THE WRITE SILENTLY DID NOTHING. saveProfile() copies only what
   is in FIELDS, so the Playbook form posted eight values, got a 303 and a
   "Saved" flash, and stored none of them — the exact shape of failure that is
   invisible until somebody checks the row. Caught by reading FIELDS rather
   than by trusting the function name.

   icp_at is a timestamp this function sets, never something a form supplies. */
const ICP_COLUMNS = ['icp_current_states', 'icp_desired_states', 'icp_trigger',
  'icp_uncertainty', 'icp_readiness', 'icp_party', 'icp_budget'];

async function saveIcp(advisorId, patch) {
  const supabase = db();
  if (!supabase || !advisorId) return { ok: false, error: 'not_configured' };

  const row = {
    advisor_id: advisorId,
    updated_at: new Date().toISOString(),
    icp_at: new Date().toISOString()
  };
  ICP_COLUMNS.forEach((f) => {
    if (Object.prototype.hasOwnProperty.call(patch, f)) row[f] = patch[f];
  });

  const { error } = await supabase
    .from('gtm_profile').upsert(row, { onConflict: 'advisor_id' });
  if (error) {
    /* Absent until migration 022. Degrades to "the form does not save" rather
       than to a stack trace, same as savePersona below. */
    const missing = ['42703', 'PGRST204', 'PGRST205', '42P01'];
    if (missing.indexOf(String(error.code)) !== -1) {
      console.warn('saveIcp — is migration 022 applied?', error.code);
      return { ok: false, error: 'needs_migration' };
    }
    console.error('saveIcp', error);
    return { ok: false, error: 'failed' };
  }
  return { ok: true };
}

/* ── The persona ──────────────────────────────────────────────────────────
   A SECOND ALLOW-LIST, not a wider first one. The intake form and the persona
   capture are different surfaces writing different columns, and merging their
   field lists would let a hand-edited intake POST set an advisor's expression
   profile — which is exactly the class of thing account.js:100 established the
   allow-list pattern to prevent.

   `expr_confirmed` is here because the advisor sets it deliberately at the
   reveal. `expr_primary` and `expr_secondary` are here because savePersona is
   the only caller and it derives them itself; nothing user-supplied reaches
   them. */
const PERSONA_FIELDS = [
  'persona_answers', 'expr_primary', 'expr_secondary', 'expr_confirmed',
  'traveller_orientation', 'compass_needs', 'capacity_class', 'persona_at',
  /* The brief belongs to the same surface — /hub/campaign/profile captures
     both — so it shares the allow-list rather than getting a third one. The
     rule the list enforces is "the intake form cannot write these", and that
     is as true of a pasted brief as it is of an expression profile. */
  'brief_raw', 'brief_parsed', 'brief_at'
];

async function savePersona(advisorId, patch) {
  const supabase = db();
  if (!supabase || !advisorId) return { ok: false, error: 'not_configured' };

  const row = { advisor_id: advisorId, updated_at: new Date().toISOString() };
  PERSONA_FIELDS.forEach((f) => {
    if (Object.prototype.hasOwnProperty.call(patch, f)) row[f] = patch[f];
  });

  const { error } = await supabase
    .from('gtm_profile').upsert(row, { onConflict: 'advisor_id' });
  if (error) {
    /* Absent until migration 014. Degrades to "the capture does not save"
       rather than to a stack trace on a screen an advisor is halfway through. */
    const missing = ['42703', 'PGRST204', 'PGRST205', '42P01'];
    if (missing.indexOf(String(error.code)) !== -1) {
      console.warn('savePersona — is migration 014 applied?', error.code);
      return { ok: false, error: 'needs_migration' };
    }
    console.error('savePersona', error);
    return { ok: false, error: 'failed' };
  }
  return { ok: true };
}

/* ── The advisor's link ───────────────────────────────────────────────────
   Copy is STORED with the literal token {{WELL_LINK}} and the real URL is put
   in on the way out. Two reasons: the model never sees a URL it might mangle,
   and an advisor whose public_code ever changes does not end up with a month
   of copy pointing at a dead link.

   IT LIVES HERE BECAUSE TWO PLACES RENDER COPY. api/gtm.js returns assets as
   JSON and campaign-blocks.js renders them into the page, and when only the
   first one substituted, a reload showed every advisor the raw {{WELL_LINK}}
   token where their link should be. One function, both callers. */
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.discoversaintluciawell.com';

function wellLink(advisor) {
  const code = advisor && advisor.public_code;
  return code ? `${SITE_ORIGIN}/well/${code}` : SITE_ORIGIN;
}

function substitute(text, advisor) {
  return String(text == null ? '' : text).replace(/\{\{WELL_LINK\}\}/g, wellLink(advisor));
}

/* ── Reading a plan back ──────────────────────────────────────────────────
   The newest ready plan and its assets. "Current" is simply the most recent
   row rather than a flag on one of them: a flag is a second fact that can
   disagree with the timestamps, and there would be nothing to arbitrate it. */
async function currentPlan(advisorId) {
  const supabase = db();
  if (!supabase || !advisorId) return null;

  const { data: plan, error } = await supabase
    .from('gtm_plan').select('*')
    .eq('advisor_id', advisorId).eq('status', 'ready')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (error) {
    /* Absent until migration 012. Same two codes as profileFor — see there. */
    if (['42P01', 'PGRST205', 'PGRST204'].indexOf(String(error.code)) === -1) {
      console.error('currentPlan', error);
    }
    return null;
  }
  if (!plan) return null;

  const { data: assets } = await supabase
    .from('gtm_asset').select('*')
    .eq('plan_id', plan.id).order('week').order('position');

  return { plan, assets: assets || [] };
}

/* Every action in the skeleton, paired with the asset that belongs to it (or
   null). Built here rather than in the browser because the shape of a plan is
   a server concern — a client that derived it would have to be updated in step
   with the generator, and the two would drift on the first change. */
function planRows(plan, assets) {
  const byKey = {};
  (assets || []).forEach((a) => { byKey[a.week + ':' + a.position] = a; });

  return ((plan && plan.skeleton && plan.skeleton.weeks) || []).map((w) => ({
    week: w.week,
    theme: w.theme,
    actions: (w.actions || []).map((a, i) => ({
      position: i,
      title: a.title,
      why: a.why,
      channel: a.channel,
      assetKind: a.assetKind,
      asset: byKey[w.week + ':' + i] || null
    }))
  }));
}

/* ── The gap report ───────────────────────────────────────────────────────
   Honest diagnostic, not a crippled tool. The plan is always as good as the
   inputs allow; this says what is missing and what it costs, which is a better
   Foundations sell than a deliberately worse plan would be.

   Ordered by consequence, not by form order — the first gap named should be
   the one that most changes what a plan can recommend. */
const GAPS = [
  { field: 'icp', weight: 3,
    label: 'Who you are for',
    costs: 'Without it a plan has to write for everybody, which reads as written for nobody.' },
  { field: 'positioning', weight: 3,
    label: 'What you actually sell',
    costs: 'Copy falls back on describing Saint Lucia rather than describing you.' },
  { field: 'differentiator', weight: 2,
    label: 'Why you rather than anybody else',
    costs: 'Every post sounds like every other advisor posting about the same island.' },
  { field: 'markets', weight: 2,
    label: 'Where your clients are',
    costs: 'No local hooks, no events worth attending, no partner suggestions.' },
  { field: 'client_examples', weight: 1,
    label: 'The kind of client you already have',
    costs: 'Nothing concrete to write toward, so the copy stays abstract.' },
  { field: 'specialties', weight: 1,
    label: 'What you are known for',
    costs: 'Channel choice gets less confident.' }
];

/* ── The six questions, in one place ──────────────────────────────────────
   The form used to hand-write these six labels and hints, and the prompt used
   to describe the same six questions in its own words. Two descriptions of one
   question drift, and the drift is invisible: nothing breaks, the assistant is
   just answering something slightly different from what the box asks for.

   So the screen renders from this, and the prompts are built from this.
   `costs` is not repeated here — it already exists per field in GAPS above,
   and fieldPrompt() reads it from there. */
const BUSINESS_FIELDS = [
  { field: 'positioning',     label: 'What you sell, and to whom',
    hint: 'e.g. Slow, well-designed trips for couples in their forties who have not taken a proper break in years.' },
  { field: 'differentiator',  label: 'Why you rather than anybody else',
    hint: 'What you do that another advisor does not.' },
  { field: 'icp',             label: 'Your ideal client',
    hint: 'Who they are, what stage of life, what they actually care about.' },
  { field: 'client_examples', label: 'The clients you already have',
    hint: 'The kinds of people who already book with you.' },
  { field: 'specialties',     label: 'What you are known for',
    hint: 'Destinations, trip types, occasions.' },
  { field: 'markets',         label: 'Where your clients live',
    hint: 'Cities or regions. This decides which local hooks and events a plan can suggest.' }
];

function gapReport(profile) {
  const p = profile || {};
  const missing = GAPS.filter((g) => !String(p[g.field] || '').trim());
  const channels = ['website', 'linkedin', 'instagram', 'facebook', 'tiktok', 'newsletter']
    .filter((c) => String(p[c] || '').trim());

  const weight = missing.reduce((n, g) => n + g.weight, 0);
  const total = GAPS.reduce((n, g) => n + g.weight, 0);

  return {
    missing,
    channels,
    /* A readiness figure, not a score out of ten with a colour. It exists to
       answer "is this worth generating yet", and it is honest about the fact
       that no channels means no plan can route anywhere. */
    ready: Math.round(((total - weight) / total) * 100),
    enoughToGenerate: missing.filter((g) => g.weight === 3).length === 0 && channels.length > 0,
    blockers: []
      .concat(missing.filter((g) => g.weight === 3).map((g) => g.label))
      .concat(channels.length ? [] : ['At least one channel you actually use'])
  };
}

/* ── What every prompt says before it asks anything ───────────────────────
   Two prompts are built from this: the whole brief on /hub/campaign/profile,
   and one per question on /hub/campaign. Extracted rather than copied, because
   two copies of a claims rule is one copy that goes stale — and this text is
   the only thing standing between an assistant and an invented credential that
   an advisor then publishes under their own name.

   Built from what we already hold, so it sharpens as the profile fills in. */
function promptPreamble(advisor, profile) {
  const p = profile || {};
  const a = advisor || {};
  const known = [];

  const add = (label, value) => { if (String(value || '').trim()) known.push(`- ${label}: ${value}`); };
  add('My name', `${a.first_name || ''} ${a.last_name || ''}`.trim());
  add('My business', a.business);
  add('My host agency', a.host_agency);
  add('The market I work in', a.market || p.markets);
  add('My website', p.website || a.website);
  add('LinkedIn', p.linkedin);
  add('Instagram', p.instagram);
  add('Facebook', p.facebook);
  add('TikTok', p.tiktok);
  add('My newsletter', p.newsletter);

  const claims = FACTS.CLAIMS_LADDER[rung(a)] || FACTS.CLAIMS_LADDER.registered;

  return `WHAT YOU ALREADY KNOW ABOUT ME
${known.length ? known.join('\n') : '- (nothing yet — ask me instead of guessing)'}

RULES — THESE MATTER MORE THAN THE WRITING
1. Do not invent anything. If you cannot find something, say so plainly rather
   than filling the gap. Mark anything you inferred with [guess].
2. Do not describe me as certified, trained, accredited or a specialist unless
   one of my links actually says so. Right now I may accurately say: ${claims.may.join('; ')}.
3. No health or medical claims anywhere. Travel makes days feel different; it
   does not treat, cure, heal, reduce or improve any condition. Write about
   places and time, never about effects on a body.
4. No prices, no availability, no awards, no superlatives.
5. Short and specific beats long and impressive.`;
}

/* ── One question, on its own ─────────────────────────────────────────────
   What /hub/campaign needed and did not have. intakePrompt() below returns
   ## VOICE / CLIENTS / MARKETS, which is right for the Brand Profile screen
   and wrong above six textareas asking six different things — so an advisor
   either pasted a brief into a box wanting one sentence, or did what Duncan
   did and rebuilt the questions by hand, one at a time.

   ONE FIELD PER PROMPT IS THE POINT, not a limitation. Six answers arriving
   together get reviewed together and the weak ones travel with the strong;
   the whole claims discipline in this system exists because AI writes
   plausible things. A prompt that asks one question, and is told to say "I
   cannot find that", leaves an advisor a decision rather than a paragraph —
   and lets them fill this form over several sittings instead of one. */
function fieldPrompt(advisor, profile, field) {
  const spec = BUSINESS_FIELDS.find((f) => f.field === field);
  if (!spec) return '';
  const gap = GAPS.find((g) => g.field === field);

  return `I am a travel advisor. I am filling in one field of my own marketing
profile, and I want your help with this one question only.

${promptPreamble(advisor, profile)}

THE QUESTION
${spec.label}

What the box says underneath it: ${spec.hint}${gap ? `
Why it matters: ${gap.costs}` : ''}

WHAT I WANT BACK
One or two sentences I could paste straight into that box, in my voice, in
plain language. Nothing else — no preamble, no headings, no alternatives.

IF YOU CANNOT ANSWER IT from what you can actually see of my business, say so
and tell me what you would need from me. I would rather leave this field empty
today and come back to it than fill it with something that sounds right and is
not mine.`;
}

/* ── The whole brief ──────────────────────────────────────────────────────
   Used by /hub/campaign/profile, where brief.js parses what comes back —
   which is why the headings and dashes below are stated so strictly.

   It was ALSO used on /hub/campaign, above a form it did not fit, and the
   comment here claimed "OUTPUT IN OUR FIELD ORDER, so pasting back is
   mechanical". That was true of one screen and false of the other, and the
   false half is what sent an advisor away to rebuild the questions himself.
   fieldPrompt() above is how the other screen gets what it was promised. */
function intakePrompt(advisor, profile) {
  return `I am a travel advisor. Help me describe my own business clearly so I can
plan a marketing campaign. I will paste your answer into a system that reads it.

${promptPreamble(advisor, profile)}

WHAT TO DO
Read any links above that you can open. Then fill in the brief below, in my
voice. Where you cannot find something write [not found] rather than guessing.

ANSWER IN EXACTLY THIS FORMAT, and nothing else. The headings and the dashes
matter — this gets pasted into a system that reads them.

## VOICE
tone: (how I sound in three or four words)
avoid: (words, punctuation or habits I should never use)
signature: (the move I make that others do not — how I open, what I lead with)

## CLIENTS
- who: (a real client of mine, described in a phrase — no names)
  situation: (what was actually going on for them)
  wanted: (what they were really after, in their words if you can)
- who: (a second, different one)
  situation:
  wanted:

## MARKETS
- (a city or region my clients actually live in, and one thing about it)
- (another)

## OBJECTIONS
- (something people say to me) → (how I answer it)
- (another)

## PROOF
- (something I can legitimately claim — somewhere I have been, a number I can
  stand behind, an experience I actually had)

## ANGLES
- (a positioning angle you think is genuinely mine)
- (another)

WHY THE SHAPE MATTERS
Each item becomes something my campaign can point at individually. A paragraph
about me gets read as background and changes nothing. "Two lawyers, both
partners, who had not taken a week off together since 2019" becomes a message
written to those people. Specific beats polished, every time.

TWO CLIENT EXAMPLES IS THE MINIMUM. One is a coincidence. If you can only find
one from my public material, ask me for another rather than inventing it.

BEFORE YOU GIVE IT TO ME
Read your own answer back and ask: could this brief describe a different travel
advisor? If yes, it is not finished — go and find what is actually particular
to me. Then tell me honestly what is missing or unclear in my public presence
that would make marketing harder. Be blunt. I would rather know.`;
}

module.exports = {
  BANDS, FIELDS, GAPS,
  rung, mayRefresh,
  profileFor, saveProfile, savePersona, PERSONA_FIELDS, currentPlan, planRows,
  saveIcp, ICP_COLUMNS,
  wellLink, substitute,
  gapReport, intakePrompt,
  BUSINESS_FIELDS, promptPreamble, fieldPrompt
};
