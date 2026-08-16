/* ============================================================================
   PERSONA — five questions that place an advisor, without asking who they are
   ----------------------------------------------------------------------------
   D1 and D3 both established the same thing: the output is input-limited. Six
   free-text fields is the ceiling, and no prompt or model gets past it. But the
   answer is not a longer form — most advisors cannot articulate their own voice
   on demand, and asking them to try is how an intake gets abandoned.

   So the PERSONA carries the depth instead of the advisor's typing. Five
   questions, all selections, under two minutes, and each answer unlocks
   pre-written intelligence they never had to compose.

   ── EVIDENCE, NOT IDENTITY ─────────────────────────────────────────────────
   The Strategist Bible (Section 6 §6) ranks signal classes and is unambiguous:

     observed behaviour > repeated audience response > demonstrated strengths >
     validated trait measures > self-described preferences > TYPOLOGY LABELS

   Typology labels are the weakest thing on that list — "reflection vocabulary
   and prompts; never deterministic channel/visual rules". Its own example is an
   advisor who says "I am an introvert, so video is not for me" while their
   webinar recordings show warmth and clarity.

   So NO QUESTION HERE ASKS WHAT AN ADVISOR IS. Every question asks what they
   did, or what happened to them. "Which of these have you done in the last
   twelve months" is observed behaviour reported first-hand. "When clients thank
   you, what do they thank you for" is repeated audience response — the second
   strongest class available, bought for one multiple-choice question.

   That is also why the two questions are weighted differently: see WEIGHT.

   ── THE RESULT IS A HYPOTHESIS ─────────────────────────────────────────────
   A persona is a prior, never a verdict. It is shown to the advisor as a
   starting read they can change, and the change is stored separately — because
   a correction is better evidence than the answers that produced the original,
   and collapsing the two into one column throws away the fact that a correction
   happened at all.
   ========================================================================== */
'use strict';

const PLAYBOOK = require('../../content/marketing-playbook.js');
const FACTS = require('../../content/campaign-facts.js');

/* Repeated audience response outranks self-reported behaviour, so the question
   about what clients say is worth more than the question about what the advisor
   remembers doing. Two points against one is a deliberate ratio: enough that a
   clear audience signal can overturn a scattered self-report, not so much that
   it ignores a year of evidence. */
const WEIGHT = { acts: 1, thanks: 2 };

const profiles = () => PLAYBOOK.expressionProfiles || [];
const profileFor = (key) => profiles().find((p) => p.key === key) || null;

/* ── The five ─────────────────────────────────────────────────────────────
   `why` is rendered to the advisor. The Bible's rule is that questions are a
   cost, and the least a question can do in return is say what it is for. */
const QUESTIONS = [
  {
    id: 'acts',
    type: 'multi',
    ask: 'Which of these have you actually done in the last twelve months?',
    why: 'What you have done predicts what you will sustain far better than what you would like to be.',
    hint: 'Pick every one that is true. There is no wrong set.',
    options: [
      { value: 'explained-fit',   profile: 'guide',       label: 'Walked a client through why one property suited them better than another' },
      { value: 'built-framework', profile: 'guide',       label: 'Made a comparison, a checklist or a framework to help someone decide' },
      { value: 'shortlist',       profile: 'curator',     label: 'Sent a shortlist with your reason for each option' },
      { value: 'said-no',         profile: 'curator',     label: 'Talked someone out of a booking because the fit was wrong' },
      { value: 'told-moment',     profile: 'storyteller', label: 'Described a place to a client by telling them about a moment there' },
      { value: 'on-camera',       profile: 'storyteller', label: 'Spoke to camera, or recorded a voice note about somewhere you had been' },
      { value: 'introduced',      profile: 'connector',   label: 'Introduced two people who should know each other' },
      { value: 'unasked-referral', profile: 'connector',  label: 'Got a booking from a referral you never asked for' },
      { value: 'hosted',          profile: 'host',        label: 'Hosted an evening, a group call or a briefing' },
      { value: 'brought-together', profile: 'host',       label: 'Brought clients together who had not met before' },
      { value: 'pushed-back',     profile: 'commentator', label: 'Said something about the industry that others pushed back on' },
      { value: 'wrote-pov',       profile: 'commentator', label: 'Wrote something with a clear point of view — a newsletter, a long post' }
    ]
  },

  {
    id: 'thanks',
    type: 'single',
    ask: 'When clients thank you, what do they thank you for?',
    why: 'What people repeatedly say about you is stronger evidence than what you would say about yourself.',
    hint: 'The one you hear most, not the one you like most.',
    options: [
      { value: 'understood',  profile: 'guide',       label: '"You explained it so I finally understood."' },
      { value: 'right-place', profile: 'curator',     label: '"You found exactly the right place."' },
      { value: 'made-me-want', profile: 'storyteller', label: '"The way you described it made me want to go."' },
      { value: 'knew-who',    profile: 'connector',   label: '"You knew exactly who to ask."' },
      { value: 'easy-to-meet', profile: 'host',       label: '"You made it easy — I met people I would not have met."' },
      { value: 'new-angle',   profile: 'commentator', label: '"I had not thought about it that way."' }
    ]
  },

  {
    id: 'orientation',
    type: 'single',
    ask: 'Think of the trips you have sold that went best. Which is closest?',
    why: 'This changes the language of the whole campaign. Most wellness travel is not a retreat, and writing as if it were loses the majority.',
    /* Options come from the field guide rather than being written twice. */
    options: (PLAYBOOK.travellerOrientations || []).map((o) => ({
      value: o.key, label: o.name, detail: o.says
    }))
  },

  {
    id: 'needs',
    type: 'multi',
    max: 2,
    ask: 'Which two do your clients most often actually need?',
    why: 'These are the same eight your travellers choose from in the Journey Finder — so once Journeys come in, we can check this answer against what they really picked.',
    hint: 'Pick two. Not the two that sound best — the two you see most.',
    /* THE WELL COMPASS, not a second taxonomy. It already covers six of the
       Bible's seven need families, and reusing it means an advisor's guess can
       later be compared against real Journey results — which promotes this
       input two classes up the evidence hierarchy, from self-described
       preference to observed audience response. */
    options: (FACTS.compass || []).map((c) => ({
      value: c.key, label: c.name, detail: c.read
    }))
  },

  {
    id: 'capacity',
    type: 'single',
    ask: 'Be honest — what can you actually sustain in a normal week?',
    why: 'A plan you abandon in week two is worse than a smaller one you finish. This sets the size, and nothing else uses it.',
    options: [
      { value: 'C1', label: 'An hour, and only if it is easy',
        detail: 'One good piece and a few small follow-ups. Built to be finished.' },
      { value: 'C2', label: 'A few hours — some social, some email',
        detail: 'The usual shape for an independent advisor.' },
      { value: 'C3', label: 'I market consistently already',
        detail: 'More variety, deeper email, room to test things.' },
      { value: 'C4', label: 'I have help, or I run events',
        detail: 'An event arc, partners, and a calendar with owners.' }
    ]
  }
];

/* ── Scoring ──────────────────────────────────────────────────────────────
   Returns null rather than a default when there is nothing to go on. A persona
   invented from no evidence is worse than no persona: it would be rendered with
   the same confidence as a real one and quietly shape a campaign. */
function derive(answers) {
  const a = answers || {};
  const tally = {};
  const bump = (key, n) => { if (key) tally[key] = (tally[key] || 0) + n; };

  const acts = [].concat(a.acts || []);
  const actOptions = QUESTIONS[0].options;
  acts.forEach((v) => {
    const opt = actOptions.find((o) => o.value === v);
    if (opt) bump(opt.profile, WEIGHT.acts);
  });

  const thanksOpt = QUESTIONS[1].options.find((o) => o.value === a.thanks);
  if (thanksOpt) bump(thanksOpt.profile, WEIGHT.thanks);

  const ranked = Object.keys(tally).sort((x, y) => {
    if (tally[y] !== tally[x]) return tally[y] - tally[x];
    /* TIE-BREAK BY EVIDENCE CLASS. When two profiles score the same, the one
       the audience pointed at wins — repeated audience response outranks
       self-reported behaviour, so the tie is not arbitrary and not alphabetical. */
    const t = thanksOpt && thanksOpt.profile;
    if (x === t) return -1;
    if (y === t) return 1;
    return 0;
  });

  if (!ranked.length) return null;

  const primary = ranked[0];
  /* A secondary only when it is real. A profile scoring 1 against a primary of
     6 is noise, and presenting it as half an identity would be a fiction. */
  const runner = ranked[1];
  const secondary = runner && tally[runner] >= 2 && tally[runner] >= tally[primary] / 2
    ? runner : null;

  return {
    primary,
    secondary,
    scores: tally,
    orientation: orientationFor(a.orientation) ? a.orientation : null,
    needs: [].concat(a.needs || []).filter(validNeed).slice(0, 2),
    capacity: ['C1', 'C2', 'C3', 'C4'].indexOf(a.capacity) === -1 ? null : a.capacity
  };
}

const validNeed = (k) => (FACTS.compass || []).some((c) => c.key === k);
const orientationFor = (key) =>
  (PLAYBOOK.travellerOrientations || []).find((o) => o.key === key) || null;

/* The named blend for a pair, in either order. Falls back to null rather than
   inventing a description — the Bible names six blends and a seventh made up
   here would carry the same authority without the same basis. */
function blendFor(primary, secondary) {
  if (!primary || !secondary) return null;
  return (PLAYBOOK.expressionBlends || []).find((b) =>
    b.pair.indexOf(primary) !== -1 && b.pair.indexOf(secondary) !== -1) || null;
}

/* The sentence the advisor is shown. A starting read, phrased as one. */
function describe(persona) {
  if (!persona) return null;
  const p = profileFor(persona.primary);
  const s = profileFor(persona.secondary);
  if (!p) return null;

  const blend = blendFor(persona.primary, persona.secondary);
  return {
    headline: s ? `${p.name}, with a ${s.name}'s instinct` : p.name,
    advantage: p.advantage,
    blend: blend ? blend.expression : null,
    watchFor: p.risks,
    growthEdge: p.growthEdge
  };
}

/* ── What the generator gets ──────────────────────────────────────────────
   THE CONFIRMED PAIR WINS. If the advisor changed the read, that correction is
   better evidence than the five answers behind the original — so it is what
   reaches the prompt, and the derived pair is kept only as a record of what we
   guessed. */
function effective(profile) {
  const p = profile || {};
  if (p.expr_confirmed) {
    const parts = String(p.expr_confirmed).split('+').map((s) => s.trim()).filter(Boolean);
    return { primary: parts[0] || null, secondary: parts[1] || null, corrected: true };
  }
  return { primary: p.expr_primary || null, secondary: p.expr_secondary || null, corrected: false };
}

/* The block that reaches a prompt. Absent entirely when there is no persona —
   an empty heading invites a model to fill it in. */
function personaBlock(profile) {
  const eff = effective(profile);
  const p = profileFor(eff.primary);
  if (!p) return '';

  const s = profileFor(eff.secondary);
  const blend = blendFor(eff.primary, eff.secondary);
  const orient = orientationFor((profile || {}).traveller_orientation);
  const needs = [].concat((profile || {}).compass_needs || [])
    .map((k) => (FACTS.compass || []).find((c) => c.key === k))
    .filter(Boolean);

  return `HOW THIS ADVISOR CREATES ADVANTAGE
They are a ${p.name}${s ? ` with a ${s.name}'s instinct` : ''}. ${p.advantage}${
  s ? ` ${s.advantage}` : ''}
${blend ? `Together: ${blend.expression}\n` : ''}
Write in this register: ${p.voice}${s ? ` Tempered by: ${s.voice}` : ''}

What this advisor characteristically gets WRONG, so do not do it for them:
  - ${p.risks}${s ? `\n  - ${s.risks}` : ''}
${orient ? `
WHO THEY SELL TO
${orient.name} — they say: "${orient.says}"
${orient.approach}
REGISTER: ${orient.register}
` : ''}${needs.length ? `
WHAT THOSE TRAVELLERS ACTUALLY NEED
${needs.map((n) => `  - ${n.name}: ${n.read}`).join('\n')}
Write toward those two. They are what this advisor's clients keep asking for.
` : ''}`;
}

module.exports = {
  QUESTIONS, WEIGHT,
  derive, describe, effective, personaBlock,
  blendFor, profileFor, orientationFor
};
