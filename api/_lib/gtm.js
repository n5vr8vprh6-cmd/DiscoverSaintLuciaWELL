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

/* Unlimited refreshes past Foundations; one plan before it. The gate and the
   ladder read the same dates, which is the point — there is one fact about an
   advisor here, not two systems that can disagree. */
function mayRefresh(advisor) {
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

/* ── The prompt ───────────────────────────────────────────────────────────
   Run by the advisor in their own AI. Three things it has to do, or it makes
   the intake worse than the blank page it replaced:

     1. ASK FOR HONESTY. A language model will invent a brand story and an
        award without being asked. It is told to leave gaps rather than fill
        them, and to mark anything inferred.
     2. OUTPUT IN OUR FIELD ORDER, so pasting back is mechanical.
     3. CARRY THE CLAIM RULES. Whatever comes back becomes the seed for copy
        an advisor publishes; a prompt that invites invention poisons the
        intake before our checker ever runs.

   Built from what we already hold, so it improves as the profile fills in. */
function intakePrompt(advisor, profile) {
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

  return `I am a travel advisor. Help me describe my own business clearly so I can
plan a marketing campaign. I will paste your answers into a form.

WHAT YOU ALREADY KNOW ABOUT ME
${known.length ? known.join('\n') : '- (nothing yet — ask me instead of guessing)'}

WHAT TO DO
Read any links above that you can open. Then draft an answer for each field
below, in my voice, in plain language.

RULES — THESE MATTER MORE THAN THE WRITING
1. Do not invent anything. If you cannot find something, write [not found].
   If you inferred it rather than read it, end the line with [guess].
2. Do not describe me as certified, trained, accredited or a specialist unless
   one of my links actually says so. Right now I may accurately say: ${claims.may.join('; ')}.
3. No health or medical claims anywhere. Travel makes days feel different; it
   does not treat, cure, heal, reduce or improve any condition. Write about
   places and time, never about effects on a body.
4. No prices, no availability, no awards, no superlatives.
5. Short and specific beats long and impressive. One or two sentences a field.

ANSWER IN EXACTLY THIS FORMAT
POSITIONING: (what I sell and to whom, in one sentence)
DIFFERENTIATOR: (why someone would choose me over another advisor)
ICP: (my ideal client — who they are, what stage of life, what they care about)
CLIENT EXAMPLES: (the kinds of client I already work with)
SPECIALTIES: (what I am known for — destinations, trip types, occasions)
MARKETS: (the cities or regions my clients actually live in)

THEN, SEPARATELY
Tell me honestly: what is missing or unclear in my public presence that would
make marketing harder? Be blunt. I would rather know.`;
}

module.exports = {
  BANDS, FIELDS, GAPS,
  rung, mayRefresh,
  profileFor, saveProfile,
  gapReport, intakePrompt
};
