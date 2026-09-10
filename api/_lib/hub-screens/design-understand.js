/* ============================================================================
   UNDERSTAND — the first stage of ASK WELL, as a conversation
   ----------------------------------------------------------------------------
   Rendered by design.js for ?step=understand. Three movements:

     1. What they told us — the Finder's six answers read back as a reflection
        (away → toward, direction, depth, company, relationship to wellness),
        beside the island with the shortlisted places pinned by village.
     2. The conversation — seven questions, one per section, single column,
        ordered simple → open → sensitive. Every control is a native input in
        one form, so it works with JavaScript off; hub-design.js saves on
        change and swaps in the server's own re-rendered summary.
     3. What I heard — one paragraph built from the codes, read back across the
        table. No model; labels only. It is the affirmation the discovery-call
        literature asks for, and it re-renders on every save.

   ── WHY IT LOOKS LIKE THIS ─────────────────────────────────────────────────
   Duncan's review (2026-09-09): "a big block of text … not UX friendly …
   needs way more space to breathe … this step is about having the prospect
   feel seen and heard." The form pass follows the Interaction Design
   Foundation's form guidance — single column, grouped by theme, simple first
   and sensitive last, visible labels and hints, big targets, inline feedback,
   a progress count, plain-words privacy next to the one field that needs it.

   ── WHAT MAY BE WRITTEN, AND WHERE ─────────────────────────────────────────
   Codes and numbers go into the need-state (need-state.js validates them).
   The one prose field — in their words — goes to the row through `extra` and
   is never part of a need-state; see need-state.js's header. Nothing here
   reaches a prompt: this file writes HTML and reads what design.js hands it.
   ========================================================================== */
'use strict';

const { esc } = require('../hub-render.js');
const { islandMap } = require('../../../lib/components.js');
const ISLAND = require('../../../content/island.js');
const N = require('../need-state.js');

/* The four scales have poles in the vocabulary but no name of their own;
   these are the screen's, and they are words a client understands. */
const SCALE_NAME = { rhythm: 'Structure', activity: 'Energy', social: 'Company', experience: 'Familiarity' };
/* Constraints that became real fields in this stage. Still valid codes; just
   not offered twice. */
const HIDE_CONSTRAINTS = ['budget', 'nights'];
const WORDS_MAX = 400;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const label = (vocab, dim, key) => {
  const hit = (vocab[dim] || []).filter((o) => o.key === key)[0];
  return hit ? hit.label : key;
};
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const monthName = (iso) => {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso || ''));
  return m ? MONTHS[Number(m[2]) - 1] + ' ' + m[1] : null;
};
const lower1 = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const upper1 = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const joinAnd = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);

/* ── The stage ─────────────────────────────────────────────────────────── */
function understandStage(v) {
  return reflection(v) + conversation(v);
}

/* ── Movement 1 · What they told us, and the island ──────────────────────── */
function reflection(v) {
  const { need, stored, vocab } = v;
  const weighted = (dim, bag) => {
    const keys = Object.keys(bag || {}).sort((a, b) => bag[b] - bag[a]);
    if (!keys.length) return '<span class="design-empty">not yet</span>';
    const top = bag[keys[0]];
    return keys.map((k) => `<span class="chip${bag[k] === top ? ' chip--lead' : ''}">${esc(label(vocab, dim, k))}</span>`).join('');
  };

  const lines = [];
  const compassKeys = Object.keys(need.compass || {}).sort((a, b) => need.compass[b] - need.compass[a]);
  if (compassKeys.length) {
    lines.push(`Heading toward <b>${esc(label(vocab, 'compass', compassKeys[0]))}</b>${
      need.continuumFloor ? `, at a depth of <b>${esc(label(vocab, 'continuum', need.continuumFloor))} to ${esc(label(vocab, 'continuum', need.continuumCeiling))}</b>` : ''}.`);
  } else if (need.continuumFloor) {
    lines.push(`A depth of <b>${esc(label(vocab, 'continuum', need.continuumFloor))} to ${esc(label(vocab, 'continuum', need.continuumCeiling))}</b>.`);
  }
  if (need.party) lines.push(`Travelling <b>${esc(lower1(label(vocab, 'party', need.party)))}</b>.`);
  if (need.orientation) lines.push(`<b>${esc(label(vocab, 'orientation', need.orientation))}.</b>`);

  /* Field names the advisor would recognise, not the columns'. */
  const FIELD_WORD = { triggers: 'why now', uncertainties: 'what could get in the way', readiness: 'where they are',
    party: 'who is coming', budget: 'the budget band', budgetUsd: 'the budget', nights: 'nights', constraints: 'things to plan around',
    rhythm: 'structure', activity: 'energy', social: 'company', experience: 'familiarity', orientation: 'relationship to wellness',
    current: 'away from', desired: 'toward', villages: 'places', compass: 'direction', continuumFloor: 'depth', continuumCeiling: 'depth' };
  const overrodeRaw = stored && stored.advisor_overrode && stored.advisor_overrode.length ? stored.advisor_overrode : null;
  const overrode = overrodeRaw ? overrodeRaw.map((k) => FIELD_WORD[k] || k).filter((w, i, a) => a.indexOf(w) === i) : null;

  return `<section class="design-block design-reflect">
  <div class="design-reflect-grid">
    <div class="design-reflect-copy">
      <h2>What you told us</h2>
      <div class="design-states">
        <div><h3>Away from</h3><div class="chips">${weighted('current', need.current)}</div></div>
        <div class="design-arrow" aria-hidden="true">→</div>
        <div><h3>Toward</h3><div class="chips">${weighted('desired', need.desired)}</div></div>
      </div>
      ${lines.length ? `<ul class="design-reflect-lines">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}
      ${overrode ? `<p class="design-note">You changed ${overrode.length} field${overrode.length === 1 ? '' : 's'} from what the Finder proposed: ${esc(overrode.join(', '))}.</p>` : ''}
    </div>
    <div class="design-reflect-map">
      <h3 class="design-reflect-maphead">Where the island answers it</h3>
      ${island(v)}
    </div>
  </div>
</section>`;
}

/* The island: shortlisted places pinned, coloured by the village they answer
   for THIS traveller (the one of the property's villages they weighted
   highest), lead villages full-weight and labelled. Every pin links to its
   card on Compare. */
function island(v) {
  const { id, need, vocab, shortlist } = v;
  const w = need.villages || {};
  const keys = Object.keys(w).sort((a, b) => w[b] - w[a]);
  const top = keys.length ? w[keys[0]] : 0;
  const isLead = (k) => Boolean(k) && w[k] === top && top > 0;
  const villageFor = (p) => {
    const vs = (p && p.villages) || [];
    if (!vs.length) return null;
    return vs.slice().sort((a, b) => (w[b] || 0) - (w[a] || 0))[0];
  };

  const pins = (shortlist || []).map((c) => {
    const p = c.property || {};
    const vk = villageFor(p);
    if (!p.geo) return null;
    return {
      slug: c.slug, name: c.name || p.name,
      href: `/hub/journeys/${encodeURIComponent(id)}/design?step=compare#prop-${encodeURIComponent(c.slug)}`,
      lat: p.geo.lat, lng: p.geo.lng, town: p.geo.town, approx: p.geo.approx,
      village: vk, villageName: vk ? label(vocab, 'villages', vk) : '',
      lead: isLead(vk), image: p.image || null, hook: p.hook || null
    };
  }).filter(Boolean);

  const legend = (vocab.villages || []).filter((o) => w[o.key] > 0)
    .sort((a, b) => w[b.key] - w[a.key])
    .map((o) => ({ key: o.key, label: o.label, lead: isLead(o.key) }));

  return islandMap(ISLAND, pins, legend, { title: 'Saint Lucia, with the places on this shortlist' });
}

/* ── Movement 2 · The conversation ───────────────────────────────────────── */
function conversation(v) {
  const { id, need, stored, vocab, caps, suggestedMonth } = v;
  const multi = Boolean(caps.conversation);
  const opts = (dim) => vocab[dim] || [];
  const has = (arr, key) => ((arr || []).indexOf(key) !== -1 ? ' checked' : '');
  const on = (dim, key) => (need[dim] === key ? ' checked' : '');

  /* A row of chips. Checkbox when the column can hold a list, radio when the
     deployment is still on 023. Same markup, same look; the input decides. */
  const chips = (dim, name, values, kind, cls) => `<div class="design-picks ${cls || ''}">${opts(dim)
    .filter((o) => !(dim === 'constraints' && HIDE_CONSTRAINTS.indexOf(o.key) !== -1))
    .map((o) => `
    <label class="design-pick${kind === 'checkbox' ? ' design-pick--multi' : ''}"><input type="${kind}" name="${name}" value="${esc(o.key)}"${
      kind === 'radio' ? on(dim, o.key) : has(values, o.key)}>
      <span>${esc(o.label)}</span></label>`).join('')}</div>`;

  const steps = `<div class="design-steps" style="--steps: ${opts('readiness').length}">${opts('readiness').map((o) => `
    <label class="design-step"><input type="radio" name="readiness" value="${esc(o.key)}"${on('readiness', o.key)}>
      <span class="design-step-dot" aria-hidden="true"></span><span class="design-step-word">${esc(o.label)}</span></label>`).join('')}</div>`;

  const scale = (k) => {
    const s = opts('scales').filter((x) => x.key === k)[0];
    if (!s) return '';
    const val = need[k] == null ? 0.5 : Number(need[k]);
    return `<div class="design-scale">
      <label class="design-scale-name" for="scale-${k}">${esc(SCALE_NAME[k] || k)}</label>
      <span class="design-scale-lo${val < 0.4 ? ' is-on' : ''}">${esc(s.low)}</span>
      <input type="range" id="scale-${k}" name="${esc(k)}" min="0" max="1" step="0.05" value="${val}" aria-label="${esc(SCALE_NAME[k] || k)}: ${esc(s.low)} to ${esc(s.high)}">
      <span class="design-scale-hi${val > 0.6 ? ' is-on' : ''}">${esc(s.high)}</span></div>`;
  };

  const storedMonth = stored && stored.travel_from ? String(stored.travel_from).slice(0, 7) : '';
  const month = storedMonth || (suggestedMonth ? String(suggestedMonth).slice(0, 7) : '');
  const monthSuggested = !storedMonth && Boolean(month);

  const words = stored && stored.in_their_words ? String(stored.in_their_words) : '';
  const budget = need.budgetUsd;
  const open = need.budget === 'open';

  const ask = (n, key, heading, cue, body) => `<fieldset class="design-ask" id="ask-${key}" data-ask="${key}">
      <legend><span class="design-ask-n" aria-hidden="true">${n}</span><span class="design-ask-h">${esc(heading)}</span></legend>
      <p class="design-ask-cue">${esc(cue)}</p>
      <div class="design-ask-body">${body}</div>
    </fieldset>`;

  const frame = `<div class="design-frame">
        <div class="design-field">
          <label class="design-field-label" for="travel_from">When</label>
          ${caps.travel_from
            ? `<input class="design-month" type="month" id="travel_from" name="travel_from" value="${esc(month)}"${monthSuggested ? ' data-suggested="true"' : ''} aria-describedby="travel_from-hint">
               <span class="design-field-hint" id="travel_from-hint" data-suggest-hint>${monthSuggested ? 'Suggested from their answer to the Finder — change it if they know.' : 'The month they mean to travel.'}</span>`
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

  const whyNow = chips('trigger', multi ? 'triggers' : 'trigger', need.triggers, multi ? 'checkbox' : 'radio', 'design-picks--wide') +
    (multi ? `<div class="design-words">
        <label class="design-field-label" for="in_their_words">In their words</label>
        <textarea id="in_their_words" name="in_their_words" rows="2" maxlength="${WORDS_MAX}" placeholder="Something they said about why now, as you heard it." aria-describedby="words-hint">${esc(words)}</textarea>
        <span class="design-field-hint" id="words-hint">Stays with the consultation. Never sent to the model, never on the client document. <span data-words-count>${words.length ? words.length + ' of ' + WORDS_MAX : ''}</span></span>
      </div>` : `<p class="design-hint">${esc(require('../design-data.js').UNAVAILABLE.conversation)}</p>`);

  const budgetBlock = multi ? `<div class="design-budget">
        <label class="design-field-label" for="budget_usd">About how much, all in</label>
        <div class="design-budget-row">
          <span class="design-money"><span class="design-money-sign" aria-hidden="true">$</span>
            <input type="number" id="budget_usd" name="budget_usd" min="0" step="100" inputmode="numeric" value="${budget == null ? '' : esc(String(budget))}" placeholder="18,000" aria-describedby="budget-hint"></span>
          <span class="design-budget-word" data-fragment-slot="budget-word">${budgetWord(need)}</span>
        </div>
        <span class="design-field-hint" id="budget-hint">US dollars · the whole trip · everyone travelling. A rough number is fine.</span>
        <label class="design-pick design-pick--multi design-pick--open"><input type="checkbox" name="budget_open" value="1"${open ? ' checked' : ''}><span>Open, if it is right</span></label>
      </div>` : chips('budget', 'budget', null, 'radio', 'design-picks--seg');

  const answered = answeredCount(need, month, words);

  return `<section class="design-block design-consult" id="consult">
  <h2>The conversation</h2>
  <p class="design-note">Seven things six answers cannot know. Ask, listen, and mark what you hear — the sentence at the end reads it back.</p>

  <form method="POST" action="/hub/journeys/${esc(id)}/design?step=understand" class="design-consult-form" data-live data-fragment="consult">
    <input type="hidden" name="action" value="consult">

    ${ask(1, 'frame', 'The frame', '“When are you thinking, for how long, and who’s coming?”', frame)}
    ${ask(2, 'why', 'What brought this on', '“What made this the year?”', whyNow)}
    ${ask(3, 'way', 'What could get in the way', '“What would make you hesitate?”', chips('uncertainty', multi ? 'uncertainties' : 'uncertainty', need.uncertainties, multi ? 'checkbox' : 'radio'))}
    ${ask(4, 'feel', 'How they like a trip to feel', '“Would you rather have a plan, or a blank day?”', `<div class="design-scales">${['rhythm', 'activity', 'social', 'experience'].map(scale).join('')}</div>`)}
    ${ask(5, 'around', 'Things to plan around', '“Anything we should build around — dates, food, mobility, kids?”', chips('constraints', 'constraints', need.constraints, 'checkbox'))}
    ${ask(6, 'where', 'Where they are', '“Are we dreaming, or are we picking?”', steps)}
    ${ask(7, 'budget', 'About how much', '“Roughly what feels right for the whole trip, everyone in?”', budgetBlock)}

    <div class="design-heard" data-fragment-slot="consult">${heard({ need, vocab, words, travelFrom: month })}</div>

    <div class="design-actions design-consult-actions">
      <button class="btn btn--sm" type="submit"${caps.consultation ? '' : ' disabled'}>Save what we know</button>
      <span class="design-hint" data-answered>${answered} of 7 answered</span>
      <span class="design-hint" data-live-status role="status">${caps.consultation ? '' : esc(require('../design-data.js').UNAVAILABLE.consultation)}</span>
    </div>
  </form>
</section>`;
}

/* How many of the seven sections carry anything. Server-side, from the row. */
function answeredCount(need, month, words) {
  const scalesTouched = ['rhythm', 'activity', 'social', 'experience'].some((k) => need[k] != null && Math.abs(Number(need[k]) - 0.5) > 0.001);
  return [
    Boolean(month || need.nights || need.party),
    Boolean((need.triggers || []).length || (words && words.length)),
    Boolean((need.uncertainties || []).length),
    scalesTouched,
    Boolean((need.constraints || []).length),
    Boolean(need.readiness),
    Boolean(need.budgetUsd || need.budget === 'open')
  ].filter(Boolean).length;
}

/* The word beside the figure, with its arithmetic. */
function budgetWord(need) {
  if (need.budget === 'open') return 'Open, if it is right.';
  const b = need.budgetUsd, n = need.nights;
  if (!b) return '<span class="design-empty">reads as — once there is a figure</span>';
  const band = N.bandFor(b, n);
  const BAND = { entry: 'Value-led', mid: 'Comfortable', premium: 'Premium' };
  if (!band) return `${money(b)} all in · <span class="design-empty">set the nights to read it as a band</span>`;
  return `reads as <b>${BAND[band]}</b> · about ${money(b / n)} a night across the stay`;
}

/* ── Movement 3 · What I heard ───────────────────────────────────────────── */
function heard(hv) {
  const { need, vocab } = hv;
  const words = hv.words || '';
  const parts = [];

  const trig = (need.triggers || []).map((k) => lower1(label(vocab, 'trigger', k)));
  if (trig.length) parts.push(upper1(joinAnd(trig)) + '.');

  const when = monthName(hv.travelFrom);
  const stay = [need.nights ? need.nights + (need.nights === 1 ? ' night' : ' nights') : null, when ? 'in ' + when : null].filter(Boolean).join(' ');
  const who = need.party ? lower1(label(vocab, 'party', need.party)) : null;
  if (stay || who) parts.push(upper1([stay, who].filter(Boolean).join(', ')) + '.');

  if (need.budget === 'open') parts.push('Budget open, if it is right.');
  else if (need.budgetUsd) {
    const band = N.bandFor(need.budgetUsd, need.nights);
    const BAND = { entry: 'value-led', mid: 'comfortable', premium: 'premium' };
    parts.push('Around ' + money(need.budgetUsd) + ' all in' + (band ? ' — ' + BAND[band] + ' for the week' : '') + '.');
  }

  const feel = [];
  const pole = (k, lo, hi) => { const x = need[k]; if (x == null) return null; if (x < 0.4) return lo; if (x > 0.6) return hi; return null; };
  const a = pole('rhythm', 'unstructured', 'structured'), b = pole('activity', 'restorative', 'active'),
    c = pole('social', 'private', 'communal'), d = pole('experience', 'familiar comforts', 'novelty and growth');
  [a, b, c].forEach((x) => { if (x) feel.push(x); });
  if (feel.length || d) parts.push(upper1([joinAnd(feel), d ? 'leaning to ' + d : ''].filter(Boolean).join('; ')) + '.');

  const unc = (need.uncertainties || []).map((k) => lower1(label(vocab, 'uncertainty', k)));
  if (unc.length) parts.push('Hesitant about ' + joinAnd(unc) + '.');

  const cons = (need.constraints || []).filter((k) => HIDE_CONSTRAINTS.indexOf(k) === -1).map((k) => lower1(label(vocab, 'constraints', k)));
  if (cons.length) parts.push('Planning around ' + joinAnd(cons) + '.');

  if (need.readiness) {
    const R = { dreaming: 'Still dreaming.', comparing: 'Comparing, not choosing yet.', planning: 'Planning in earnest.',
      selecting: 'Choosing between a few.', booking: 'Ready to book.', 'pre-departure': 'Booked; the trip is ahead.', returning: 'Just back.' };
    parts.push(R[need.readiness] || upper1(label(vocab, 'readiness', need.readiness)) + '.');
  }

  const said = words ? `<p class="design-heard-words">“${esc(words)}”<span class="design-heard-who"> — in their words</span></p>` : '';

  if (!parts.length && !said) {
    return `<h3 class="design-heard-h">What I heard</h3>
      <p class="design-heard-p design-empty">Nothing marked yet. As you mark answers, this reads them back.</p>`;
  }
  return `<h3 class="design-heard-h">What I heard</h3>
      <p class="design-heard-p">${esc(parts.join(' '))}</p>${said}`;
}

module.exports = { understandStage, heard, budgetWord, answeredCount, SCALE_NAME, HIDE_CONSTRAINTS, WORDS_MAX };
