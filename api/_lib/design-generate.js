/* ============================================================================
   DESIGN GENERATE — the only file in ASK WELL that calls a model
   ----------------------------------------------------------------------------
   openai.js moves text. design-need.js decides what may be said. This decides
   what is asked and what is done with the answer. Nothing else in the feature
   touches chat(), which is what makes "how many model calls are there?" a
   question with an answer.

   ── WHAT IS GENERATED, AND WHAT EMPHATICALLY IS NOT ────────────────────────
   Generated: a day note (one sentence per day) and a journey narrative (a
   paragraph the advisor reads aloud). That is the whole list for this step.

   Not generated, ever, by anything:
     · The shortlist and its four bands — design-match.js, arithmetic.
     · The mismatch sentences — a rule engine. A model handed a downside
       softens it or invents a second one, and both are worse than silence.
     · Cost. Advisor-entered. There is no prompt here that has seen a price,
       because design-need.js never passes one.

   ── THE MODEL IS NEVER ASKED TO POLICE ITSELF ──────────────────────────────
   The prompts carry the rules, because a prompt that invites invention makes
   more work for the checker. But the verdict is always claims.js running plain
   code. Same position as gtm-generate.js: a checker that can hallucinate is not
   a control.

   ── WHY THE PLACES ARE PASSED AS A CLOSED LIST ─────────────────────────────
   The prompt names the properties it may mention and says the list is closed.
   That is a prompt instruction, so it is a request rather than a guarantee —
   which is why nameCheck() runs afterwards and flags any capitalised
   multi-word phrase that is not on the list. The rule engine catches what the
   instruction misses.

   ── TIMEOUTS ARE DERIVED FROM THE ROUTER'S LIMIT ───────────────────────────
   These calls run inside api/hub/index.js, which is a page router: a 20-second
   generation inside a function with no maxDuration is a 504 with nothing
   written, which is precisely the failure openai.js:47 records. vercel.json now
   sets maxDuration 60 for the hub router. Keep the two in step — a timeout
   longer than maxDuration is not a timeout.
   ========================================================================== */
'use strict';

const { chat } = require('./openai.js');
const { check, ownNames } = require('./claims.js');
const { project } = require('./design-need.js');

/* A day note is one sentence and must feel instant on a live call; the advisor
   is talking while it lands. The narrative is read aloud once and can afford to
   be slower. Both sit well inside the router's 60s. */
const DAY_NOTE_BUDGET_MS = 6000;
const NARRATIVE_BUDGET_MS = 20000;

const DAY_NOTE_TOKENS = 200;
const NARRATIVE_TOKENS = 900;

/* Enforced in code after the fact, not just asked for. A model told "under 40
   words" goes over often enough that the limit has to be real somewhere. */
const DAY_NOTE_MAX_WORDS = 40;

/* ── The scales, named ─────────────────────────────────────────────────────
   design-need.js passes 0-1 numbers because it does not write sentences. This
   is where the poles get their words. A bare 0.65 tells a model nothing; "0.65
   between Private and Communal" tells it where to sit. */
const SCALE_POLES = {
  rhythm: ['High freedom', 'High structure'],
  activity: ['Restorative', 'Active'],
  social: ['Private', 'Communal'],
  experience: ['Familiar comfort', 'Novelty and growth']
};

function scaleLines(t) {
  return Object.keys(SCALE_POLES)
    .filter((k) => t[k] != null)
    .map((k) => `  ${k}: ${t[k]} on 0-1, where 0 is ${SCALE_POLES[k][0]} and 1 is ${SCALE_POLES[k][1]}`)
    .join('\n');
}

const bag = (o) => Object.keys(o || {})
  .sort((a, b) => o[b] - o[a])
  .map((k) => `${k} ${o[k]}`)
  .join(', ');

/* ── The traveller, as the model reads them ────────────────────────────────
   Codes and numbers. Every line here came out of design-need.js, so there is
   nothing to strip: if a value is in this block, somebody named it. */
function travellerBlock(t) {
  const lines = [];
  if (Object.keys(t.current || {}).length) lines.push(`  moving away from: ${bag(t.current)}`);
  if (Object.keys(t.desired || {}).length) lines.push(`  moving toward: ${bag(t.desired)}`);
  if (Object.keys(t.compass || {}).length) lines.push(`  compass directions: ${bag(t.compass)}`);
  if (Object.keys(t.villages || {}).length) lines.push(`  villages: ${bag(t.villages)}`);
  if (Object.keys(t.pillars || {}).length) lines.push(`  pillars: ${bag(t.pillars)}`);
  if (t.depthFloor) lines.push(`  depth discussed: ${t.depthFloor} to ${t.depthCeiling}`);
  if (t.party) lines.push(`  travelling as: ${t.party}`);
  if (t.adults != null || t.children != null) {
    lines.push(`  party size: ${t.adults == null ? 'unstated' : t.adults} adults, ${
      t.children == null ? 'unstated' : t.children} children`);
  }
  if (t.mobility) lines.push(`  mobility: ${t.mobility}`);
  if (t.nights != null) lines.push(`  nights: ${t.nights}`);
  if (t.orientation) lines.push(`  relationship to wellness: ${t.orientation}`);
  if (t.trigger) lines.push(`  why now: ${t.trigger}`);
  if (t.uncertainty) lines.push(`  main uncertainty: ${t.uncertainty}`);
  if (t.readiness) lines.push(`  readiness: ${t.readiness}`);
  if ((t.constraints || []).length) lines.push(`  constraints: ${t.constraints.join(', ')}`);
  const scales = scaleLines(t);
  if (scales) lines.push(scales);

  /* An empty block is a real state — an advisor can open the workspace before
     filling anything in — and it has to read as "you do not know this person
     yet" rather than as a missing variable. */
  return lines.length ? lines.join('\n') : '  (nothing recorded yet)';
}

/* design-need.js projects the advisor and, until the privacy sweep asked what
   the payload actually carried, nothing read it. The itinerary is co-branded
   and the system prompt says "for a travel advisor to read aloud" — so leaving
   the advisor out meant asking for a voice without saying whose. */
function advisorBlock(a) {
  const name = [a.first_name, a.last_name].filter(Boolean).join(' ');
  const lines = [];
  if (name) lines.push(`  reading this aloud: ${name}`);
  if (a.business) lines.push(`  their business: ${a.business}`);
  if (a.host_agency) lines.push(`  their host agency: ${a.host_agency}`);
  return lines.length ? lines.join('\n') : '  (advisor not named)';
}

function placesBlock(places) {
  if (!places.length) return '  (no places chosen yet)';
  return places.map((p) => [
    `  ${p.name}`,
    `    what it is: ${p.hook}`,
    `    villages: ${(p.villages || []).join(', ') || 'none recorded'}`,
    `    compass: ${(p.compass || []).join(', ') || 'none recorded'}`,
    `    pillars: ${(p.pillars || []).join(', ') || 'none recorded'}`
  ].join('\n')).join('\n');
}

/* ── The rules every prompt carries ────────────────────────────────────────
   Deliberately close to gtm-generate.js's rulesBlock, because the claims
   position is the same one and two divergent statements of it would be two
   things to keep in step. What differs is rule 5: this writer has a closed
   list of places, which the campaign writer does not. */
function rulesBlock(places) {
  const names = places.map((p) => p.name);
  return `RULES — THESE OUTRANK THE WRITING

1. HEALTH. Never say or imply that travel treats, cures, heals, reduces or
   prevents any condition. No "reduces stress", no "heals burnout", no
   "boosts immunity". Describe what someone does and where they are, not what
   it does to them.

2. NO GUARANTEES. Nothing is promised, assured, or certain to work.

3. NO CREDENTIALS. Do not describe anyone as a doctor, therapist, clinician or
   practitioner, and do not imply medical supervision.

4. NO INVENTED DETAIL. Every fact about a place must come from the block above.
   Do not add a treatment, an amenity, a distance, a duration, a price, a
   staff member or a partnership. If you want a detail that is not there, leave
   it out — an advisor will add it from their own knowledge.

5. THESE ARE THE ONLY PLACES YOU MAY NAME: ${names.length ? names.join('; ') : '(none)'}.
   The list is closed. Do not name another property, restaurant, operator or
   brand, on the island or off it.

6. NO PRICES. Not a number, not a band, not "affordable", not "premium". Cost
   is the advisor's to give and they have not given it to you.

7. SECOND PERSON, SINGULAR. You are writing for one traveller to hear. Not
   "guests", not "travellers", not "clients".`;
}

/* ── Day note ──────────────────────────────────────────────────────────────
   One sentence for one day of the rhythm. Short on purpose: it sits under a
   day heading the recipe already named, so a paragraph would be repeating the
   heading back at the reader. */
function dayNotePrompt(ctx, day) {
  const system = `You write one sentence for a travel advisor to read aloud to
one person, on a call, while they look at a day of a wellbeing journey in Saint
Lucia together. Plain, warm, specific. No exclamation marks, no marketing
register, no rhetorical questions.

${rulesBlock(ctx.places)}`;

  const user = `THE DAY
  ${day.label}: ${day.text}

THE ADVISOR
${advisorBlock(ctx.advisor)}

THE TRAVELLER
${travellerBlock(ctx.traveller)}

THE PLACES CHOSEN
${placesBlock(ctx.places)}

Write ONE sentence, under ${DAY_NOTE_MAX_WORDS} words, saying what this day is
for this particular traveller. No heading, no label, no quotation marks. Return
the sentence and nothing else.`;

  return { system, user };
}

/* ── Narrative ─────────────────────────────────────────────────────────────
   The paragraph that answers "why this shape, for you". It is the one piece of
   generated prose the traveller is likely to hear verbatim, which is why it
   gets the long timeout and the full claims pass. */
function narrativePrompt(ctx) {
  const system = `You write a short passage for a travel advisor to read aloud
to one person about the journey they are designing together in Saint Lucia.
Plain, warm, specific, unhurried. No exclamation marks, no marketing register,
no rhetorical questions, no sign-off.

${rulesBlock(ctx.places)}`;

  const user = `THE ADVISOR
${advisorBlock(ctx.advisor)}

THE TRAVELLER
${travellerBlock(ctx.traveller)}

THE PLACES CHOSEN
${placesBlock(ctx.places)}

${ctx.recipe ? `THE SHAPE OF THE JOURNEY
  ${ctx.recipe.name}${ctx.recipe.sub ? ' — ' + ctx.recipe.sub : ''}
${(ctx.recipe.rhythm || []).map((d) => `  ${d.label}: ${d.text}`).join('\n')}` : ''}

Write two short paragraphs, 120 to 180 words in total, saying what this journey
is and why it is shaped this way for this traveller. Connect what they are
moving away from to what the days actually hold. Do not list the places as a
catalogue. Do not open by restating their situation back to them. Return the
paragraphs and nothing else.`;

  return { system, user };
}

/* ── Stubs ─────────────────────────────────────────────────────────────────
   In the caller's shape, not this file's idea of it, and deliberately CLEAN —
   they pass the checker, so a stubbed test that fails is a real failure rather
   than the stub tripping over itself. The dirty cases are constructed in the
   tests, where they can be read beside the assertion. */
const STUB_DAY_NOTE = 'A slow start on the estate, with the afternoon left open '
  + 'so nothing has to be decided in advance.';

const STUB_NARRATIVE = 'You have been running at a pitch that leaves very little '
  + 'room, and this journey is built around giving that room back rather than '
  + 'filling it with something else. The first days sit low and close to the '
  + 'rainforest, where the only thing asked of you is to be somewhere quiet.\n\n'
  + 'From there the shape opens a little. There is water when you want it and a '
  + 'kitchen that knows what it is doing, and the days are arranged so that '
  + 'family time and time on your own both have a place rather than competing '
  + 'for the same hours.';

/* ── The name check ────────────────────────────────────────────────────────
   Rule 5 tells the model the list is closed. This finds out whether it
   listened. Capitalised multi-word phrases are the shape a property name takes;
   the sentence-start allowance is because "Your first morning" is not a hotel.

   It is deliberately noisy in one direction only: it flags, it does not block.
   A false positive costs an advisor a glance. A missed invented property is a
   sentence about a hotel that does not exist, read aloud, on a sales call. */
const COMMON = new Set(['Saint', 'Lucia', 'Saint Lucia', 'The', 'You', 'Your', 'It',
  'A', 'An', 'And', 'But', 'This', 'That', 'There', 'These', 'Those', 'From',
  'Day', 'Days', 'Morning', 'Afternoon', 'Evening', 'Night', 'Caribbean',
  'Atlantic', 'Pitons', 'Piton']);

function nameCheck(text, places) {
  const allowed = new Set();
  places.forEach((p) => {
    allowed.add(p.name);
    /* Advisors and models both shorten. "Anse Chastanet" standing in for
       "Anse Chastanet Resort" is the same place, not an invention. */
    String(p.name).split(/\s+/).forEach((word) => { if (word.length > 3) allowed.add(word); });
  });

  const found = [];
  const re = /\b([A-Z][a-z’']+(?:\s+(?:de|of|from|the|&)?\s*[A-Z][a-z’']+)+)\b/g;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    const phrase = m[1];
    if (allowed.has(phrase) || COMMON.has(phrase)) continue;
    if (phrase.split(/\s+/).every((word) => allowed.has(word) || COMMON.has(word))) continue;
    /* A phrase that starts the sentence is usually grammar, not a name. */
    const before = String(text).slice(0, m.index).replace(/\s+$/, '');
    if (!before || /[.!?\n]$/.test(before)) continue;
    if (found.indexOf(phrase) === -1) found.push(phrase);
  }

  return found.map((phrase) => ({
    rule: 'unlisted_name',
    severity: 'high',
    message: `"${phrase}" is not one of the places on this journey. Check it exists before reading it out.`
  }));
}

function words(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/* ── Running one ───────────────────────────────────────────────────────────
   Never throws — same contract as openai.js and for the same reason. A failed
   day note costs one sentence; the session, the shortlist and every other day
   are already on screen and are untouched.

   The verdict travels WITH the text rather than gating it. An advisor who can
   see the flagged sentence can fix it; an advisor shown "generation failed"
   cannot, and the sentence was usually nearly right. */
async function run(kind, prompt, opts) {
  const o = opts || {};
  const res = await chat({
    system: prompt.system,
    user: prompt.user,
    maxTokens: o.maxTokens,
    timeoutMs: o.timeoutMs,
    temperature: 0.6,
    stub: o.stub
  });

  const out = {
    kind,
    ok: false,
    text: '',
    reason: res.reason || null,
    ms: res.ms,
    model: res.model,
    stub: res.stub,
    payload: res.payload,
    promptChars: (prompt.system || '').length + (prompt.user || '').length,
    usage: res.usage,
    flags: [],
    high: 0
  };

  if (!res.ok) return out;

  const text = String(res.text || '').trim();
  if (!text) return Object.assign(out, { reason: 'empty' });

  const verdict = check(text, o.rung, ownNames(o.advisor));
  const flags = verdict.flags.concat(nameCheck(text, o.places || []));

  if (kind === 'day_note' && words(text) > DAY_NOTE_MAX_WORDS) {
    flags.push({
      rule: 'too_long',
      severity: 'low',
      message: `${words(text)} words. Day notes read better under ${DAY_NOTE_MAX_WORDS}.`
    });
  }

  return Object.assign(out, {
    ok: true,
    text,
    flags,
    high: flags.filter((f) => f.severity === 'high').length
  });
}

/* ── The two public calls ──────────────────────────────────────────────────
   Both take the four separate parameters design-need.project() wants. Neither
   accepts a share, a session row or a consultation record — there is no object
   in either signature that HOLDS a consumer's name, which is the difference
   between a boundary and a habit. */
async function generateDayNote(input) {
  const ctx = await project(input);
  const day = input.day || {};
  return run('day_note', dayNotePrompt(ctx, day), {
    maxTokens: DAY_NOTE_TOKENS,
    timeoutMs: DAY_NOTE_BUDGET_MS,
    stub: STUB_DAY_NOTE,
    rung: input.rung,
    advisor: input.advisor,
    places: ctx.places
  });
}

async function generateNarrative(input) {
  const ctx = await project(input);
  return run('narrative', narrativePrompt(ctx), {
    maxTokens: NARRATIVE_TOKENS,
    timeoutMs: NARRATIVE_BUDGET_MS,
    stub: STUB_NARRATIVE,
    rung: input.rung,
    advisor: input.advisor,
    places: ctx.places
  });
}

module.exports = {
  generateDayNote, generateNarrative,
  dayNotePrompt, narrativePrompt,
  travellerBlock, advisorBlock, placesBlock, rulesBlock, scaleLines, nameCheck, words,
  DAY_NOTE_BUDGET_MS, NARRATIVE_BUDGET_MS, DAY_NOTE_MAX_WORDS,
  STUB_DAY_NOTE, STUB_NARRATIVE, SCALE_POLES
};
