/* ============================================================================
   UNDERSTAND — the first stage of ASK WELL, as a conversation
   ----------------------------------------------------------------------------
   Rendered by design.js for ?step=understand. Three bands, paper · white ·
   paper, each a movement of the conversation:

     1. What you told us — the client's own Finder answers quoted back in the
        Finder's phrasing (the affirmation), then away → toward in spoken
        words, then room for the advisor to dig in: a cue per away-from state
        and a note, "What they said about it". The human layer first.
     2. Where the island answers it — one sentence ("Five places on the island
        answer moving from running hot toward here, fully…"), then the island
        with the places we're considering pinned by village, a card for the
        one under the pointer, and the advisor's own story about the place.
     3. Let's get into the details — seven questions, headings you could say
        aloud, single column, simple → open → sensitive, notes under the ones
        that need them, a floor from the places we're considering under the
        budget, and What I heard — one paragraph built from the codes and the
        notes, re-rendered by the server on every save, with a button to send
        it to the client.

   ── WHY IT LOOKS LIKE THIS ─────────────────────────────────────────────────
   Duncan's two reviews (2026-09-09, 2026-09-10): "this step is about having
   the prospect feel seen and heard"; "AI and tech enable advisors to be more
   human, not just taking orders." The client may be reading over a shoulder,
   so nothing addresses them in the third person and every heading is a
   question. The form pass follows the Interaction Design Foundation's form
   guidance — single column, grouped by theme, simple first and sensitive
   last, visible labels and hints, big targets, inline feedback, a progress
   count, plain-words privacy next to the fields that need it.

   ── WHAT MAY BE WRITTEN, AND WHERE ─────────────────────────────────────────
   Codes and numbers go into the need-state (need-state.js validates them).
   Prose — the four notes — goes to the row's `notes` column through `extra`
   and is never part of a need-state; see need-state.js's header. The
   advisor's stories about places live in advisor_place_notes, theirs alone.
   Nothing here reaches a prompt: this file writes HTML and reads what
   design.js hands it. The one thing it computes from outside the need-state
   is the floor, from api/_lib/rates.js — the same lookup the estimate uses.
   ========================================================================== */
'use strict';

const { esc } = require('../hub-render.js');
const { islandMap } = require('../../../lib/components.js');
const ISLAND = require('../../../content/island.js');
const FINDER = require('../../../content/journey.js').finderData;
const ECLIPSE = require('../../../content/eclipse.js');
const { eclipseMark } = require('../../../lib/brand.js');
const N = require('../need-state.js');
const R = require('../rates.js');

/* The four scales have poles in the vocabulary but no name of their own;
   these are the screen's, and they are words a client understands. */
const SCALE_NAME = { rhythm: 'Structure', activity: 'Energy', social: 'Company', experience: 'Familiarity' };
/* Constraints that became real fields in this stage. Still valid codes; just
   not offered twice. */
const HIDE_CONSTRAINTS = ['budget', 'nights'];
const WORDS_MAX = 400;
/* The four notes, in the order they appear, with the label the read-back and
   the recap email use for each. */
const NOTE_LABEL = { told: 'On how they feel', why: 'On why now', hesitate: 'On what would make them hesitate', around: 'Things to plan around' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BAND_ORDER = ['rest', 'low', 'medium', 'high'];

const label = (vocab, dim, key) => {
  const hit = (vocab[dim] || []).filter((o) => o.key === key)[0];
  return hit ? hit.label : key;
};
/* The spoken form where the vocabulary has one (current · desired), else the label. */
const say = (vocab, dim, key) => {
  const hit = (vocab[dim] || []).filter((o) => o.key === key)[0];
  return hit ? (hit.say || hit.label) : key;
};
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const monthName = (iso) => {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso || ''));
  return m ? MONTHS[Number(m[2]) - 1] + ' ' + m[1] : null;
};
const lower1 = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const upper1 = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const joinAnd = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
const topKeys = (bag) => Object.keys(bag || {}).sort((a, b) => bag[b] - bag[a]);
const leaders = (bag) => { const k = topKeys(bag); return k.filter((x) => bag[x] === bag[k[0]]); };
const NUMBER_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const numberWord = (n) => (n >= 0 && n <= 10 ? NUMBER_WORD[n] : String(n));
const D_UNAVAILABLE = () => require('../design-data.js').UNAVAILABLE;

/* ── The stage ─────────────────────────────────────────────────────────── */
function understandStage(v) {
  return told(v) + islandBand(v) + eclipseBand(v) + details(v);
}

/* ── Eclipse · only when they recognised the description ──────────────────
   The Finder's recognition question gates this, as it gates Eclipse on the
   site: a client who did not see themselves in the description is not shown
   a journey built for it. The band speaks in the second person about what
   THEY recognised — a state, never a diagnosis — and the advisor's one
   control is to record whether they want to hear how Eclipse would shape
   the week. Shape reads that later. Midnight and copper: Eclipse's own
   palette, so it reads as a different thing from the ink read-back below. */
function eclipseBand(v) {
  const a = v.answers || {};
  if (a.recognition !== 'yes') return '';
  return `<section class="design-band design-band--eclipse">
  <div data-fragment-slot="eclipse">${eclipseInner(v)}</div>
</section>`;
}

function eclipseInner(v) {
  const { id, need, caps } = v;
  const p = ECLIPSE.programme || {};
  const interest = need.eclipseInterest;
  const recorded = interest === true ? 'Recorded — Shape will start from Eclipse.'
    : interest === false ? 'Recorded — not for this trip.' : '';
  return `<div class="design-eclipse">
    ${eclipseMark({ variant: 'hub', widths: [220] })}
    <p class="design-eclipse-eyebrow">${esc(p.name || 'Eclipse')}</p>
    <h3>You recognised something.</h3>
    <p>You said some of the description sounded familiar — still functioning, still meeting expectations,
      while sleep no longer fully restores. That is a state you saw yourself in, not a diagnosis, and it is
      why Eclipse appeared in your results.</p>
    <p>Eclipse is a curated recovery journey designed by practitioners and health professionals —
      ${esc(numberWord(p.days || 5))} days, one sequence across several places on the island, built around
      restoration rather than a hotel. If you want to hear how it would shape your week, we can lay the days
      out that way instead.</p>
    <div class="design-eclipse-figure">
      <b>From ${money(p.fromUsd || 7500)}</b><span>a ${esc(p.per || 'person')}</span><span>${esc(numberWord(p.days || 5))} days</span>
      <span>${esc(p.basis || 'programme and stays, before flights')}</span>
    </div>
    <p class="design-hint">Every figure is confirmed before anything is booked.</p>
    <p class="design-cue"><span class="design-cue-ask">Ask:</span> “Does that description still feel true today?”</p>
    ${caps.eclipse ? `<form method="POST" action="/hub/journeys/${esc(id)}/design?step=understand" class="design-eclipse-form" data-live data-fragment="eclipse">
      <input type="hidden" name="action" value="eclipse">
      <p class="design-cue"><span class="design-cue-ask">Ask:</span> “Would you like to hear how Eclipse would shape this?”</p>
      <div class="design-eclipse-picks" role="group" aria-label="Eclipse">
        <label class="design-pick"><input type="radio" name="interest" value="yes"${interest === true ? ' checked' : ''}><span>Yes — tell me how Eclipse would shape it</span></label>
        <label class="design-pick"><input type="radio" name="interest" value="no"${interest === false ? ' checked' : ''}><span>Not for this trip</span></label>
      </div>
      <div class="design-actions"><button class="btn btn--ghost btn--sm" type="submit">Save</button>
        <span class="design-eclipse-recorded" data-live-status role="status">${esc(recorded)}</span></div>
    </form>` : `<p class="design-hint">Recording their answer needs migration 026 on this deployment.</p>`}
    <div class="design-eclipse-programs">
      <label for="signature-programs">Signature Wellness Programs</label>
      <select id="signature-programs" aria-describedby="signature-programs-hint">
        <option selected>${esc(p.name || 'Eclipse')} — ${esc(numberWord(p.days || 5))} days</option>
        <option disabled>Coming soon</option>
      </select>
      <span class="design-hint" id="signature-programs-hint">Eclipse is the first. More programmes, designed with partner places and practitioners, will appear here.</span>
    </div>
  </div>`;
}

/* ── Band 1 · What you told us ───────────────────────────────────────────── */

/* The Finder's own option labels for the answers the client gave, as one or
   two sentences. Keyed on question id and option value, never position —
   the same discipline as need-state.js seedFrom(). */
function quote(answers) {
  const a = answers || {};
  const pick = (qid) => {
    const q = ((FINDER && FINDER.questions) || []).filter((x) => x.id === qid)[0];
    if (!q || !a[qid]) return null;
    return (q.options || []).filter((o) => o.value === a[qid])[0] || null;
  };
  const intention = pick('intention'), place = pick('place'), companions = pick('companions'),
    orientation = pick('orientation'), pace = pick('pace');
  const first = [];
  if (intention) first.push(`you need <q>${esc(lower1(intention.label))}</q>`);
  if (place) first.push(`<q>${esc(lower1(place.label))}</q> called you first`);
  const second = [];
  if (companions) second.push(lower1(companions.label));
  if (pace) second.push(`at a${/^[aeiou]/i.test(pace.label) ? 'n' : ''} ${lower1(pace.label)} pace`);
  if (orientation) second.push(`<q>${esc(lower1(orientation.label))}</q>`);
  if (!first.length && !second.length) return '';
  /* A white card with a large gold quotation mark — type, not an icon; the
     brand's own glyph — so the client's words are visibly theirs. */
  return `<div class="design-quote-card">
    <span class="design-quote-mark" aria-hidden="true">“</span>
    <p class="design-quote">${first.length ? 'You said ' + first.join(', and ') + '.' : ''}${
      second.length ? ' ' + upper1(second.join(', ')) + '.' : ''}</p>
  </div>`;
}

function told(v) {
  const { need, stored, vocab, answers, caps, notes } = v;
  const chips = (dim, bag) => {
    const keys = topKeys(bag);
    if (!keys.length) return '<span class="design-empty">not yet</span>';
    const top = bag[keys[0]];
    return keys.map((k) => `<span class="chip${bag[k] === top ? ' chip--lead' : ''}">${esc(upper1(say(vocab, dim, k)))}</span>`).join('');
  };

  /* A cue per leading away-from state — the question the advisor asks, in
     the second person, with "Ask:" as the advisor's own prompt. */
  const away = leaders(need.current);
  const cues = away.map((k) => `<span class="design-cue-ask">Ask:</span> “What does <b>${esc(say(vocab, 'current', k))}</b> look like for you right now?”`);

  return `<section class="design-band design-band--told">
  <h2>What you told us</h2>
  ${quote(answers)}
  <div class="design-states">
    <div><h3>Moving away from</h3><div class="chips chips--away">${chips('current', need.current)}</div></div>
    <div class="design-arrow" aria-hidden="true">→</div>
    <div><h3>Toward</h3><div class="chips chips--toward">${chips('desired', need.desired)}</div></div>
  </div>
  ${cues.length ? `<p class="design-cue">${cues.join(' ')}</p>` : ''}
  ${caps.notes ? noteField('told', notes, 'What they said about it', 'How it shows up for them — their words, as you heard them.', v.id) : ''}
</section>`;
}

/* A note field. Its own tiny form when it stands alone (band 1), or a field
   inside the conversation form (band 3) — same markup, same live save. */
function noteField(key, notes, heading, hint, id, standalone) {
  const text = (notes && notes[key]) || '';
  /* The first note is where the advisor writes most, so it opens taller. */
  const rows = key === 'told' ? 5 : 2;
  const field = `<div class="design-words${key === 'told' ? ' design-words--tall' : ''}">
        <label class="design-field-label" for="note_${key}">${esc(heading)}</label>
        <textarea id="note_${key}" name="note_${key}" rows="${rows}" maxlength="${WORDS_MAX}" placeholder="${esc(hint)}" aria-describedby="note_${key}-hint">${esc(text)}</textarea>
        <span class="design-field-hint" id="note_${key}-hint">Stays with the consultation. Never sent to the model, never on the client document. <span data-words-count>${text.length ? text.length + ' of ' + WORDS_MAX : ''}</span></span>
      </div>`;
  if (!standalone && key !== 'told') return field;
  /* Band 1's note posts through the same consult action, alone. */
  return `<form method="POST" action="/hub/journeys/${esc(id)}/design?step=understand" class="design-told-form" data-live data-fragment="consult" data-partial="1">
      <input type="hidden" name="action" value="consult"><input type="hidden" name="partial" value="1">
      ${field}
      <div class="design-actions"><button class="btn btn--gold btn--sm" type="submit">Save</button><span class="design-hint" data-live-status role="status"></span></div>
    </form>`;
}

/* ── Band 2 · Where the island answers it ─────────────────────────────────── */

/* The band's inside is a fragment slot: when the answers change, the server
   re-renders this from the new shortlist and the browser swaps it in — the
   map answering as you talk. */
function islandBand(v) {
  return `<section class="design-band design-band--white design-band--island">
  <div data-fragment-slot="island">${islandInner(v)}</div>
</section>`;
}

function islandInner(v) {
  const { id, need, vocab, shortlist } = v;
  const w = need.villages || {};
  const lead = leaders(w);
  const isLead = (k) => Boolean(k) && lead.indexOf(k) !== -1;
  const villageFor = (p) => {
    const vs = (p && p.villages) || [];
    if (!vs.length) return null;
    return vs.slice().sort((a, b) => (w[b] || 0) - (w[a] || 0))[0];
  };

  const pins = (shortlist || []).map((c) => {
    const p = c.property || {};
    if (!p.geo) return null;
    const vk = villageFor(p);
    return {
      slug: c.slug, name: c.name || p.name,
      href: `/hub/journeys/${encodeURIComponent(id)}/design?step=compare#prop-${encodeURIComponent(c.slug)}`,
      lat: p.geo.lat, lng: p.geo.lng, town: p.geo.town, approx: p.geo.approx,
      village: vk, villageName: vk ? label(vocab, 'villages', vk) : '',
      lead: isLead(vk), image: p.image || null, hook: p.hook || null
      /* The advisor's story about the place stays in the data layer
         (advisor_place_notes) and off this screen — Duncan is working it into
         the training rather than the tool for this version. */
    };
  }).filter(Boolean);

  const legend = (vocab.villages || []).filter((o) => w[o.key] > 0)
    .sort((a, b) => w[b.key] - w[a.key])
    .map((o) => ({ key: o.key, label: o.label, lead: isLead(o.key) }));

  /* The sentence. Counts, the spoken states, the lead village. */
  const away = leaders(need.current).map((k) => say(vocab, 'current', k));
  const toward = leaders(need.desired).map((k) => say(vocab, 'desired', k));
  const n = pins.length;
  let sentence;
  if (!n) sentence = 'No places to show yet — the answers above are what the island is matched against.';
  else {
    sentence = `${upper1(numberWord(n))} place${n === 1 ? '' : 's'} on the island answer${n === 1 ? 's' : ''}` +
      (away.length ? ` moving from <b>${esc(joinAnd(away))}</b>` : ' what you told us') +
      (toward.length ? ` toward <b>${esc(joinAnd(toward))}</b>` : '') +
      (lead.length ? ` — ${n > 1 ? 'most of them' : 'it sits'} in ${esc(joinAnd(lead.map((k) => label(vocab, 'villages', k))))}.` : '.');
  }

  return `<h2>Where the island answers it</h2>
  <p class="design-island-sentence">${sentence}</p>
  ${islandMap(ISLAND, pins, legend, { title: 'Saint Lucia, with the places we are considering', caption: false })}`;
}

/* ── Band 3 · Let's get into the details ─────────────────────────────────── */

function details(v) {
  const { id, need, stored, vocab, caps, suggestedMonth, notes, floor, shortlist, firstName } = v;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const multi = Boolean(caps.conversation);
  const opts = (dim) => vocab[dim] || [];
  const has = (arr, key) => ((arr || []).indexOf(key) !== -1 ? ' checked' : '');
  const on = (dim, key) => (need[dim] === key ? ' checked' : '');

  const chips = (dim, name, values, kind, cls) => `<div class="design-picks ${cls || ''}">${opts(dim)
    .filter((o) => !(dim === 'constraints' && HIDE_CONSTRAINTS.indexOf(o.key) !== -1))
    .map((o) => `
    <label class="design-pick${kind === 'checkbox' ? ' design-pick--multi' : ''}"><input type="${kind}" name="${name}" value="${esc(o.key)}"${
      kind === 'radio' ? on(dim, o.key) : has(values, o.key)}>
      <span>${esc(o.label)}</span></label>`).join('')}</div>`;

  /* Nothing recorded yet → the line opens on Planning, the middle of the
     road. It becomes a fact only when the form saves. */
  const readinessShown = need.readiness || 'planning';
  const steps = `<div class="design-steps" style="--steps: ${opts('readiness').length}">${opts('readiness').map((o) => `
    <label class="design-step"><input type="radio" name="readiness" value="${esc(o.key)}"${readinessShown === o.key ? ' checked' : ''}>
      <span class="design-step-dot" aria-hidden="true"></span><span class="design-step-word">${esc(o.label)}</span></label>`).join('')}</div>`;

  const scale = (k) => {
    const s = opts('scales').filter((x) => x.key === k)[0];
    if (!s) return '';
    const val = need[k] == null ? 0.5 : Number(need[k]);
    return `<div class="design-scale">
      <label class="design-scale-name" for="scale-${k}">${esc(SCALE_NAME[k] || k)}</label>
      <span class="design-scale-lo${val < 0.4 ? ' is-on' : ''}">${esc(s.low)}</span>
      <input type="range" id="scale-${k}" name="${esc(k)}" min="0" max="1" step="0.05" value="${val}" aria-label="${esc(SCALE_NAME[k] || k)}: ${esc(s.low)} to ${esc(s.high)}">
      <span class="design-scale-hi${val > 0.6 ? ' is-on' : ''}">${esc(s.high)}</span></div>` +
      (k === 'activity' ? `<div class="design-whisper" data-fragment-slot="whisper-energy">${whisper(need, shortlist)}</div>` : '');
  };

  const storedMonth = stored && stored.travel_from ? String(stored.travel_from).slice(0, 7) : '';
  const month = storedMonth || (suggestedMonth ? String(suggestedMonth).slice(0, 7) : '');
  const monthSuggested = !storedMonth && Boolean(month);
  /* No figure yet → the field opens at $7,500 as a starting point to talk
     from; it becomes a fact only when the form saves. */
  const budget = need.budgetUsd == null ? 7500 : need.budgetUsd;
  const open = need.budget === 'open';

  const ask = (n, key, heading, cue, body) => `<fieldset class="design-ask" id="ask-${key}" data-ask="${key}">
      <legend><span class="design-ask-n" aria-hidden="true">${n}</span><span class="design-ask-h">${esc(heading)}</span></legend>
      ${cue ? `<p class="design-ask-cue">${esc(cue)}</p>` : ''}
      <div class="design-ask-body">${body}</div>
    </fieldset>`;

  const frame = `<div class="design-frame">
        <div class="design-field">
          <label class="design-field-label" for="travel_from">When</label>
          ${caps.travel_from
            ? `<input class="design-month" type="month" id="travel_from" name="travel_from" min="${thisMonth}" value="${esc(month)}"${monthSuggested ? ' data-suggested="true"' : ''} aria-describedby="travel_from-hint">
               <span class="design-field-hint" id="travel_from-hint" data-suggest-hint>${monthSuggested ? 'Suggested from your answers — change it if you know.' : 'The month you mean to travel.'}</span>`
            : '<span class="design-hint">Dates need migration 023.</span>'}
        </div>
        <div class="design-field">
          <label class="design-field-label" for="nights">How long</label>
          <div class="design-stepper"><button type="button" data-step="-1" aria-label="Fewer nights">−</button>
            <input type="number" id="nights" name="nights" min="1" max="21" inputmode="numeric" value="${need.nights == null ? '' : esc(String(need.nights))}" placeholder="7" aria-describedby="nights-hint">
            <button type="button" data-step="1" aria-label="More nights">+</button></div>
          <span class="design-field-hint" id="nights-hint">Nights, 1 to 21.</span>
        </div>
        <div class="design-field design-field--wide">
          <span class="design-field-label" id="party-label">Who is coming</span>
          <div role="group" aria-labelledby="party-label">${chips('party', 'party', null, 'radio', 'design-picks--seg')}</div>
        </div>
      </div>`;

  const notesOn = Boolean(caps.notes);
  const whyNow = chips('trigger', multi ? 'triggers' : 'trigger', need.triggers, multi ? 'checkbox' : 'radio', 'design-picks--wide') +
    (notesOn ? noteField('why', notes, 'Extra notes', 'Anything behind the answer that is worth remembering.', id)
      : multi ? noteField('why', notes, 'Extra notes', 'Anything behind the answer that is worth remembering.', id) /* 024 only: saved to in_their_words */
      : `<p class="design-hint">${esc(D_UNAVAILABLE().conversation)}</p>`);

  const hesitate = chips('uncertainty', multi ? 'uncertainties' : 'uncertainty', need.uncertainties, multi ? 'checkbox' : 'radio') +
    (notesOn ? noteField('hesitate', notes, 'Extra notes', 'What "something else" is, or the detail behind a tick.', id) : '');

  const around = chips('constraints', 'constraints', need.constraints, 'checkbox') +
    (notesOn ? noteField('around', notes, 'Details', 'Dates that are fixed, what the diet is, who the children are.', id) : '');

  /* The figure, and beside it the tick that lets the advisor look past it —
     the question is theirs to ask; the tick records the answer. */
  const budgetBlock = multi ? `<div class="design-budget">
        <label class="design-field-label" for="budget_usd">About how much, all in</label>
        <div class="design-budget-row">
          <span class="design-money"><span class="design-money-sign" aria-hidden="true">$</span>
            <input type="number" id="budget_usd" name="budget_usd" min="0" step="100" inputmode="numeric" value="${budget == null ? '' : esc(String(budget))}" placeholder="18,000" aria-describedby="budget-hint"></span>
          <label class="design-pick design-pick--multi design-pick--open"><input type="checkbox" name="budget_open" value="1"${open ? ' checked' : ''} aria-describedby="open-hint"><span>Open, if it is right</span></label>
        </div>
        <span class="design-field-hint" id="budget-hint">US dollars · the whole trip · everyone travelling. A rough number is fine.</span>
        <p class="design-budget-word" data-fragment-slot="budget-word">${budgetWord(need, floor)}</p>
        <p class="design-cue design-cue--small" id="open-hint"><span class="design-cue-ask">Ask:</span> “If the right week cost more than that, would you want to see it?” <span class="design-hint">The tick is what lets us make the most of the trip rather than fit it to a number.</span></p>
        <p class="design-floor" data-fragment-slot="floor">${floorLine(floor)}</p>
      </div>` : chips('budget', 'budget', null, 'radio', 'design-picks--seg');

  const answered = answeredCount(need, month, notes);
  const heardHtml = heard({ need, vocab, notes, travelFrom: month, floor, id, firstName });

  return `<section class="design-band design-band--details" id="consult">
  <h2>Let’s get into the details</h2>
  <p class="design-note">A few things your answers couldn’t tell us. We’ll talk them through, and the sentence at the end says it back.</p>

  <form method="POST" action="/hub/journeys/${esc(id)}/design?step=understand" class="design-consult-form" data-live data-fragment="consult">
    <input type="hidden" name="action" value="consult">

    ${ask(1, 'frame', 'When are you thinking, for how long, and who’s coming?', null, frame)}
    ${ask(2, 'why', 'Why are you travelling — and why now?', 'Sometimes it’s a date on the calendar; sometimes a feeling that’s been building.', whyNow)}
    ${ask(3, 'way', 'What would make you hesitate?', null, hesitate)}
    ${ask(4, 'feel', 'How do you like a trip to feel?', 'Would you rather have a plan, or a blank day?', `<div class="design-scales">${['rhythm', 'activity', 'social', 'experience'].map(scale).join('')}</div>`)}
    ${ask(5, 'around', 'Anything we should plan around?', 'Dates, food, mobility, children — the things a good plan is built around.', around)}
    ${ask(6, 'where', 'Where are we in the decision?', 'Dreaming, or picking?', steps)}
    ${ask(7, 'budget', 'Roughly what feels right, all in?', 'For the whole trip, everyone in. A range is fine; we will make it real together.', budgetBlock)}

    <div class="design-actions design-consult-actions">
      <button class="btn btn--gold btn--sm" type="submit"${caps.consultation ? '' : ' disabled'}>Save what we know</button>
      <span class="design-hint" data-answered>${answered} of 7 answered</span>
      <span class="design-hint" data-live-status role="status">${caps.consultation ? '' : esc(D_UNAVAILABLE().consultation)}</span>
    </div>

    <div class="design-heard" data-fragment-slot="consult">${heardHtml}</div>
  </form>
</section>`;
}
/* "Send what I heard" left this stage on 2026-09-10 — Duncan will place it on
   Send. composeHeard()/sendHeard() and the heard_send action stay for that. */

/* How many of the seven sections carry anything. Server-side, from the row. */
function answeredCount(need, month, notes) {
  const n = notes || {};
  const scalesTouched = ['rhythm', 'activity', 'social', 'experience'].some((k) => need[k] != null && Math.abs(Number(need[k]) - 0.5) > 0.001);
  return [
    Boolean(month || need.nights || need.party),
    Boolean((need.triggers || []).length || n.why),
    Boolean((need.uncertainties || []).length || n.hesitate),
    scalesTouched,
    Boolean((need.constraints || []).length || n.around),
    Boolean(need.readiness),
    Boolean(need.budgetUsd || need.budget === 'open')
  ].filter(Boolean).length;
}

/* ── The floor ────────────────────────────────────────────────────────────
   What the places we're considering start from, for THIS month and THESE
   nights: the cheapest place's nightly range × nights, plus the cheapest
   priced arrival and departure transfer. Before flights — we have no flight
   data and invent none. Null when there is no month, no nights, or nothing
   priced. Async, so design.js computes it and hands it in. */
async function floor(input) {
  const i = input || {};
  const nights = Number(i.nights);
  if (!i.travelFrom || !Number.isFinite(nights) || nights <= 0) return null;
  const stays = [];
  for (const c of (i.shortlist || [])) {
    const cell = await R.nightly(c.slug, i.travelFrom);
    const hi = Number.isFinite(cell.toNext) ? cell.toNext : cell.to;
    if (Number.isFinite(cell.from) && Number.isFinite(hi)) stays.push({ slug: c.slug, name: c.name, from: cell.from * nights, to: hi * nights, observed: cell.observed || null });
  }
  if (!stays.length) {
    /* Nothing priced for that month: say which months the lookup covers,
       rather than going quiet. `none: true` tells floorLine() why. */
    const sp = await R.span();
    return { none: true, month: monthName(i.travelFrom), nights,
      covers: sp ? { first: monthName(sp.first), last: monthName(sp.last) } : null, places: (i.shortlist || []).length };
  }
  stays.sort((a, b) => a.from - b.from);
  const cheapest = stays[0];
  const transfers = (await R.transfers(null)).filter((t) => /^uvf-/.test(t.key) && Number.isFinite(t.from));
  const ride = transfers.length ? transfers.sort((a, b) => a.from - b.from)[0] : null;
  const pad = ride ? ride.from * 2 : 0;
  return {
    from: Math.round(cheapest.from + pad), to: Math.round(cheapest.to + pad),
    nights, month: monthName(i.travelFrom), cheapest: cheapest.slug, cheapestName: cheapest.name,
    transfers: Boolean(ride), places: stays.length, observed: cheapest.observed
  };
}

function floorLine(f) {
  if (!f) return '<span class="design-empty">A starting figure appears once there is a month and a night count.</span>';
  if (f.none) {
    return `<span class="design-empty">No public rates for ${esc(f.month)}${f.covers ? ` — the lookup covers ${esc(f.covers.first)} to ${esc(f.covers.last)}` : ''}${
      f.places ? '' : ', and there are no places to price yet'}.</span>`;
  }
  return `The places we’re considering start from about <b>${money(f.from)}</b> for ${f.nights} night${f.nights === 1 ? '' : 's'} in ${esc(f.month)} — ${
    esc(f.cheapestName)}, standard room, two adults${f.transfers ? ', with transfers' : ''} — <b>before flights</b>.${
    f.observed ? ` <span class="design-floor-seen">Public rates seen ${esc(f.observed)}.</span>` : ''}`;
}

/* The word beside the figure, with its arithmetic — and where it sits
   against the floor. */
function budgetWord(need, f) {
  const b = need.budgetUsd, n = need.nights;
  const openTail = need.budget === 'open' ? ' · <b>a guide, not a ceiling</b>' : '';
  if (!b) return need.budget === 'open' ? 'Open — <b>a guide, not a ceiling</b>.' : '<span class="design-empty">reads as — once there is a figure</span>';
  const band = N.bandFor(b, n);
  const BAND = { entry: 'Value-led', mid: 'Comfortable', premium: 'Premium' };
  if (!band) return `${money(b)} all in${openTail} · <span class="design-empty">set the nights to read it as a band</span>`;
  const vs = f && f.from ? (b < f.from ? ` · <b class="design-under">below where these places start (${money(f.from)}) — worth saying now</b>` : '') : '';
  return `reads as <b>${BAND[band]}</b> · about ${money(b / n)} a night across the stay${openTail}${vs}`;
}

/* ── The whisper ──────────────────────────────────────────────────────────
   Only Energy has data behind it: a property's typical intensity band,
   authored (inferred) in the Field Guide. Restorative → places whose typical
   band tops out at medium and starts at rest or low; Active → places that
   reach high. The middle third whispers nothing; so do the other three
   scales, because nothing in the bank would make the sentence true. */
function whisper(need, shortlist) {
  const x = need.activity;
  if (x == null || (x >= 0.4 && x <= 0.6)) return '';
  const restorative = x < 0.4;
  const names = (shortlist || []).filter((c) => {
    const t = c.property && c.property.intensity && c.property.intensity.typical;
    if (!Array.isArray(t) || t.length < 2) return false;
    const lo = BAND_ORDER.indexOf(t[0]), hi = BAND_ORDER.indexOf(t[1]);
    return restorative ? (hi <= 2 && lo <= 1) : hi === 3;
  }).map((c) => c.name).slice(0, 3);
  if (!names.length) return '';
  return `<p>${restorative ? 'Restorative' : 'Active'} points to <b>${esc(joinAnd(names))}</b>.</p><p class="design-inferred">From each place’s typical intensity, inferred.</p>`;
}

/* ── What I heard ─────────────────────────────────────────────────────────
   One paragraph from the codes, then the notes marked as theirs. Rendered as
   HTML for the page and as plain parts for the recap email. */
function heardParts(hv) {
  const { need, vocab } = hv;
  const notes = hv.notes || {};
  const parts = [];

  const trig = (need.triggers || []).map((k) => lower1(label(vocab, 'trigger', k)));
  if (trig.length) parts.push(upper1(joinAnd(trig)) + '.');

  const when = monthName(hv.travelFrom);
  const stay = [need.nights ? need.nights + (need.nights === 1 ? ' night' : ' nights') : null, when ? 'in ' + when : null].filter(Boolean).join(' ');
  const who = need.party ? lower1(label(vocab, 'party', need.party)) : null;
  if (stay || who) parts.push(upper1([stay, who].filter(Boolean).join(', ')) + '.');

  const away = leaders(need.current).map((k) => say(vocab, 'current', k));
  const toward = leaders(need.desired).map((k) => say(vocab, 'desired', k));
  if (away.length || toward.length) parts.push(upper1([away.length ? 'moving from ' + joinAnd(away) : '', toward.length ? 'toward ' + joinAnd(toward) : ''].filter(Boolean).join(', ')) + '.');

  if (need.budget === 'open') parts.push('Budget open, if it is right.');
  else if (need.budgetUsd) {
    const band = N.bandFor(need.budgetUsd, need.nights);
    const BAND = { entry: 'value-led', mid: 'comfortable', premium: 'premium' };
    const f = hv.floor;
    parts.push('Around ' + money(need.budgetUsd) + ' all in' + (band ? ' — ' + BAND[band] + ' for the week' : '') +
      (f && f.from && need.budgetUsd < f.from ? ', which sits below where these places start' : '') + '.');
  } else if (hv.floor && hv.floor.from) {
    parts.push('These places start from about ' + money(hv.floor.from) + ' before flights.');
  }

  const feel = [];
  const pole = (k, lo, hi) => { const x = need[k]; if (x == null) return null; if (x < 0.4) return lo; if (x > 0.6) return hi; return null; };
  const a = pole('rhythm', 'unstructured', 'structured'), b = pole('activity', 'restorative', 'active'),
    c = pole('social', 'private', 'communal'), d = pole('experience', 'familiar comforts', 'novelty and growth');
  [a, b, c].forEach((x) => { if (x) feel.push(x); });
  if (feel.length || d) parts.push(upper1([joinAnd(feel), d ? 'leaning to ' + d : ''].filter(Boolean).join('; ')) + '.');

  const unc = (need.uncertainties || []).filter((k) => k !== 'other').map((k) => lower1(label(vocab, 'uncertainty', k)));
  if (unc.length) parts.push('Hesitant about ' + joinAnd(unc) + '.');

  const cons = (need.constraints || []).filter((k) => HIDE_CONSTRAINTS.indexOf(k) === -1 && k !== 'other').map((k) => lower1(label(vocab, 'constraints', k)));
  if (cons.length) parts.push('Planning around ' + joinAnd(cons) + '.');

  if (need.eclipseInterest === true) parts.push('Curious how Eclipse would shape it.');

  if (need.readiness) {
    const RD = { dreaming: 'Still dreaming.', comparing: 'Comparing, not choosing yet.', planning: 'Planning in earnest.',
      selecting: 'Choosing between a few.', booking: 'Ready to book.', 'pre-departure': 'Booked; the trip is ahead.', returning: 'Just back.' };
    parts.push(RD[need.readiness] || upper1(label(vocab, 'readiness', need.readiness)) + '.');
  }

  const said = ['told', 'why', 'hesitate', 'around'].filter((k) => notes[k]).map((k) => ({ key: k, label: NOTE_LABEL[k], text: String(notes[k]) }));
  return { parts, said };
}

/* The crown jewel of the stage: an ink card, the paragraph large, the notes
   quoted, the advisor's closing prompt, and the one call to action — on to
   Compare, carrying the "preparing options" moment. */
function heard(hv) {
  const { parts, said } = heardParts(hv);
  const first = hv.firstName ? String(hv.firstName) : '';
  const cta = hv.id ? `<div class="design-heard-cta">
        <a class="btn btn--gold" href="/hub/journeys/${esc(hv.id)}/design?step=compare" data-prepare="${esc(first)}">Let’s compare the places →</a>
        <span class="design-heard-ctahint">Takes a moment — the island is matched against everything above.</span>
      </div>` : '';
  const body = (!parts.length && !said.length)
    ? `<p class="design-heard-p design-heard-p--empty">Nothing marked yet. As you mark answers, this reads them back.</p>`
    : `${parts.length ? `<p class="design-heard-p">${esc(parts.join(' '))}</p>` : ''}
      ${said.map((s) => `<p class="design-heard-words"><span class="design-heard-who">${esc(s.label)}:</span> “${esc(s.text)}”</p>`).join('')}`;
  return `<div class="design-heard-card">
      <div class="design-heard-head"><h3 class="design-heard-h">What I heard</h3><span class="design-heard-mark" aria-hidden="true">${RING}</span></div>
      ${body}
      <p class="design-cue design-cue--ink"><span class="design-cue-ask">Ask:</span> “Anything you feel is missing before we lay this out?”</p>
      ${cta}
    </div>`;
}
const RING = `<svg width="28" height="28" viewBox="0 0 26 26" aria-hidden="true" focusable="false"><circle cx="13" cy="13" r="11.5" fill="none" stroke="#00A6A8" stroke-width="1.5"/><circle cx="13" cy="13" r="7" fill="none" stroke="#D9A03C" stroke-width="1.5"/><circle cx="13" cy="13" r="2.6" fill="#EF6A4A"/></svg>`;
/* Plain text, for the recap email. */
function heardText(hv) { return heardParts(hv).parts.join(' '); }
function heardNotes(hv) { return heardParts(hv).said.map((s) => ({ label: s.label, text: s.text })); }

module.exports = { understandStage, islandInner, eclipseBand, eclipseInner, heard, heardText, heardNotes, budgetWord, floor, floorLine, whisper, answeredCount, quote,
  SCALE_NAME, HIDE_CONSTRAINTS, WORDS_MAX, NOTE_LABEL };
