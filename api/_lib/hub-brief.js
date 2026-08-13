/* ============================================================================
   THE GROUNDED BRIEFING
   ----------------------------------------------------------------------------
   V2 §12: the Journey detail screen is a briefing, not a quiz dump. An advisor
   opening it should be able to make a good first call without decoding four
   answer codes.

   IT IS DETERMINISTIC ON PURPOSE. Every sentence below is fixed copy keyed to
   an answer the consumer actually selected. Nothing is generated, inferred, or
   softened into a claim they did not make. That is the standing rule in this
   repo — we do not invent facts — and it applies with more force here than
   anywhere else, because the subject is a real person who will be phoned about
   what this page says they want.

   Where an answer is missing, the sentence is missing. There is no filler.

   Note especially the `recognition` wording: "yes" means they recognised a
   description of a state, and the briefing says exactly that. It never becomes
   "they are burnt out" — that would be a diagnosis, from a quiz, about someone
   the advisor has not yet spoken to.
   ========================================================================== */
'use strict';

/* ── Answer vocabulary ────────────────────────────────────────────────────
   Values mirror content/journey.js. `said` is what they chose, phrased so it
   reads inside a sentence; `ask` is the discovery question it opens up. */
const INTENTION = {
  restore: {
    label: 'Rest that actually restores',
    said: 'rest that actually restores — sleep, quiet, and a nervous system that settles',
    ask: 'What does a genuinely restful day look like for you at home? What gets in the way of it?'
  },
  reflect: {
    label: 'Space to think clearly',
    said: 'space to think clearly — decompression, perspective, room for their own thoughts',
    ask: 'Is there a decision or a change sitting behind this trip, or is it more that you need the room?'
  },
  move: {
    label: 'Energy and vitality back',
    said: 'energy and vitality back — movement that returns capacity rather than spending it',
    ask: 'What kind of movement do you actually enjoy, and what has your body been asking for lately?'
  },
  nourish: {
    label: 'Pleasure, food and culture',
    said: 'pleasure, food and culture — cooking, markets, music, and the people behind them',
    ask: 'Do you want to eat your way through the island, or learn to cook some of it?'
  },
  connect: {
    label: 'Reconnection with someone',
    said: 'reconnection with someone — shared presence and meaningful time',
    ask: 'Who are you travelling with, and what would make this feel like time together rather than a trip you happened to take together?'
  }
};

const COMPANIONS = {
  solo:    { label: 'On their own',    said: 'travelling on their own',   ask: 'How much company do you want on a solo trip — none, or the option of it?' },
  partner: { label: 'With a partner',  said: 'travelling with a partner', ask: 'Are you two after the same thing from this, or different things?' },
  friends: { label: 'With friends',    said: 'travelling with friends',   ask: 'How many of you, and who is making the decisions?' },
  family:  { label: 'With family',     said: 'travelling with family',    ask: 'What ages, and what does everyone need to come home happy?' }
};

const PACE = {
  still:  { label: 'Almost still', said: 'almost still — very little scheduled, long unhurried days' },
  gentle: { label: 'Gentle',       said: 'gentle — a little structure, at walking pace' },
  active: { label: 'Active',       said: 'active — real movement, with recovery built around it' }
};

const RECOGNITION = {
  yes: { label: 'Yes, some of it' },
  no:  { label: 'Not really' }
};

/* The advisor should never be shown a stored code. `reflect` means something to
   the scoring engine and nothing to a person about to make a phone call. */
function answerLabel(question, value) {
  const map = { intention: INTENTION, companions: COMPANIONS, pace: PACE, recognition: RECOGNITION }[question];
  const entry = map && map[value];
  return entry ? entry.label : (value || '');
}

/* ── Assemble ─────────────────────────────────────────────────────────────
   Returns { opening, lines[], quote, eclipse, prompts[] }. The renderer
   decides how it looks; this decides what is true. */
function brief(j) {
  const a = j.answers || {};
  const name = (j.consumer_first || '').trim() || 'They';
  const lines = [];

  const intention = INTENTION[a.intention];
  if (intention) lines.push(`${name} began with ${intention.said}.`);

  const who = COMPANIONS[a.companions];
  const pace = PACE[a.pace];
  if (who && pace) lines.push(`${cap(who.said)}, at a pace they described as ${pace.said}.`);
  else if (who) lines.push(`${cap(who.said)}.`);
  else if (pace) lines.push(`They want a pace that is ${pace.said}.`);

  const villages = (j.villages || []).filter(Boolean);
  if (villages.length) {
    lines.push(`Their answers pointed toward ${list(villages)}.`);
  }

  /* Phrased as a sentence rather than by lower-casing the chip label, which
     produced "They gave their travel timing as within 30 days." */
  const WHEN = {
    '30d':     'They are looking to travel within the next month.',
    '31-90d':  'They are looking to travel in the next one to three months.',
    '3-6mo':   'They are looking three to six months out.',
    '6-12mo':  'They are looking six to twelve months out.',
    '12mo+':   'They are looking more than a year ahead.',
    exploring: 'They are still exploring rather than working to a date.'
  };
  if (WHEN[j.travel_window]) lines.push(WHEN[j.travel_window]);

  /* Eclipse. Worded as recognition, and framed as something to raise carefully
     rather than something to sell. */
  const eclipse = a.recognition === 'yes'
    ? 'They recognised the description of still functioning and still meeting expectations, ' +
      'while sleep no longer fully restores and effort has replaced ease. That is a state they ' +
      'saw themselves in, not a diagnosis — and it is why Eclipse appeared in their results. ' +
      'Worth listening for rather than leading with.'
    : null;

  /* Discovery prompts: questions, never assertions. Deduplicated and capped so
     this reads as a call sheet rather than a script. */
  const prompts = [];
  if (intention) prompts.push(intention.ask);
  if (who) prompts.push(who.ask);
  if (j.context) prompts.push('They wrote something in their own words — open with that rather than with the quiz.');
  prompts.push('What would make this trip worth having taken, six months after you are home?');
  if (a.recognition === 'yes') {
    prompts.push('When did you last feel properly rested? Do not lead with Eclipse — let them get there.');
  }

  return {
    opening: `${fullName(j)} shared this Journey with you.`,
    lines,
    quote: j.context || null,
    eclipse,
    prompts: prompts.slice(0, 5)
  };
}

function fullName(j) {
  const n = `${j.consumer_first || ''} ${j.consumer_last || ''}`.trim();
  return n || 'Someone';
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function list(items) {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

module.exports = { brief, fullName, answerLabel, INTENTION, COMPANIONS, PACE, RECOGNITION };
