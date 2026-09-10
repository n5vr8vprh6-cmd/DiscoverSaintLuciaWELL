/* ============================================================================
   COMPARE — the second stage of ASK WELL, as a brochure with its reasons open
   ----------------------------------------------------------------------------
   Rendered by design.js for ?step=compare. Everything it needs arrives in v,
   so tools/hub-preview.js renders it exactly as the Hub does.

   ── WHAT CHANGED, AND WHY (Duncan's review, 2026-09-10) ───────────────────
   The card used to fold its reasoning behind "Why this fits · what to watch"
   because the reasoning was the advisor's apparatus, hidden in Present mode.
   Present mode is gone and transparency is the rule, so the fold has lost its
   reason: the verdict sits under the name, the four bands beneath it, and
   "what to watch" is a list on the card. The order is the fit order the
   matcher already decided — a RANK, never a score, because the standing rule
   in design-match.js is that fit is four words, never a number.

   The price block used to be the Field Guide's spa-menu prose. It is now the
   stay price from api/_lib/rates.js — per room a night, two adults, dated —
   and, when Understand has the party in numbers, a per-person figure. The
   prose moves under a small "treatments and menu" disclosure.

   "Carry into the shape" becomes a toggle chip that fills — "In the journey" —
   with a running count against the three allowed; the summary at the foot is
   the same ink card Understand closes on, naming what is carried and the one
   way on: Let's shape the journey →.

   "Add a place" lets the advisor bring in any of the thirty from the
   directory. An added place is scored by the same matcher (M.scoreOne) so it
   carries the same words, but it shows no rank — it was not ranked.

   ── WHAT MAY BE WRITTEN ────────────────────────────────────────────────────
   Nothing here reaches a prompt. The card reads the whole bank record (the
   ADVISOR surface; mayAssert() is the PROMPT boundary), the rate table, and
   the session's shortlist. Every price line keeps its confirmation sentence.
   ========================================================================== */
'use strict';

const { esc, emptyState } = require('../hub-render.js');
const { mediaGallery } = require('../../../lib/components.js');
const M = require('../design-match.js');
const R = require('../rates.js');
const K = require('../well-knowledge.js');

const BAND_WORD = { strong: 'Strong', partial: 'Partial', thin: 'Thin', absent: 'Absent', unknown: 'Not asked' };
const AXIS = [['place', 'Place'], ['direction', 'Direction'], ['depth', 'Depth'], ['ingredients', 'What matters most']];
const MAX_CARRY = 3;
const DECLINE_REASONS = [
  ['style', 'Not their style'], ['terrain', 'Terrain or access'], ['depth', 'Too deep, or not deep enough'],
  ['price', 'Price'], ['availability', 'Availability'], ['other', 'Something else']
];
const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); return m ? MONTHS[Number(m[2]) - 1] : null; };

function villageName(key) {
  const names = { longevity: 'Longevity', rainforest: 'Nature & Renewal', ocean: 'Ocean & Restoration',
    heritage: 'Heritage & Nourishment', movement: 'Movement & Adventure', connection: 'Connection & Romance' };
  return names[key] || key;
}
function villageFor(p, need) {
  const vs = (p && p.villages) || [];
  if (!vs.length) return null;
  const w = (need && need.villages) || {};
  return vs.slice().sort((a, b) => (w[b] || 0) - (w[a] || 0))[0];
}

/* ── Async helpers design.js calls before rendering ──────────────────────── */

/* The stay price per place for the travel month, from the rate table. */
async function ratesFor(cards, travelFrom) {
  const out = {};
  for (const c of cards || []) out[c.slug] = await R.nightly(c.slug, travelFrom || null);
  return out;
}

/* Places the advisor added by hand, scored the same way, in the order added. */
async function addedCards(session, need, shortlist) {
  const added = (session && session.shortlist && Array.isArray(session.shortlist.added)) ? session.shortlist.added : [];
  const onList = {};
  (shortlist || []).forEach((c) => { onList[c.slug] = true; });
  const out = [];
  for (const slug of added) {
    if (onList[slug]) continue;
    const s = await M.scoreOne(need, slug);
    if (s) out.push(s);
  }
  return out;
}

/* Every scorable property not already on screen, for the Add a place select. */
async function directory(exclude) {
  const all = await K.properties();
  const skip = {};
  (exclude || []).forEach((s) => { skip[s] = true; });
  return all.filter((p) => !skip[p.slug]).map((p) => ({ slug: p.slug, name: p.name, collection: p.collection }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ── The stage ─────────────────────────────────────────────────────────── */
function compareStage(v) {
  const { id, need, shortlist, session, caps, frameworks } = v;
  const added = v.added || [];
  const chosen = (session && session.shortlist && session.shortlist.chosen) || [];
  const tied = shortlist.length && shortlist[0].tiedGroup;
  const fw = frameworks || {};
  const rates = v.rateCells || {};
  const all = shortlist.concat(added);

  const cards = shortlist.map((c, i) => propertyCard(id, c, need, chosen, fw, { rank: i + 1, of: shortlist.length, cell: rates[c.slug], travelFrom: v.travelFrom })).join('');
  const addedHtml = added.map((c) => propertyCard(id, c, need, chosen, fw, { rank: null, cell: rates[c.slug], travelFrom: v.travelFrom, added: true })).join('');
  const declines = all.map((c) => `<form method="POST" id="decline-${esc(c.slug)}"
    action="/hub/journeys/${esc(id)}/design?step=compare">
    <input type="hidden" name="action" value="decline"><input type="hidden" name="slug" value="${esc(c.slug)}"></form>`).join('');
  const removes = added.map((c) => `<form method="POST" id="remove-${esc(c.slug)}"
    action="/hub/journeys/${esc(id)}/design?step=compare">
    <input type="hidden" name="action" value="remove_place"><input type="hidden" name="slug" value="${esc(c.slug)}"></form>`).join('');

  if (!shortlist.length && !added.length) {
    return `<section class="design-block design-compare">${emptyState('The knowledge bank is not on this deployment yet.',
      'Run node tools/build-well-knowledge.js and redeploy.')}</section>`;
  }

  return `<section class="design-block design-compare" id="compare">
  <div class="design-compare-head">
    <p class="design-note">Ranked on what you told us — a rank, never a score. Every card says why it sits where it does, and what to watch. ${
      tied ? `The top ${esc(String(shortlist.length))} tie on every axis so far; that is the moment to ask another question rather than pick one.` : ''}</p>
    <p class="design-compare-count" data-fragment-slot="compare-count">${countLine(chosen.length)}</p>
  </div>

  <form method="POST" action="/hub/journeys/${esc(id)}/design?step=compare" class="design-choose" data-live data-fragment="compare-summary" data-max-carry="${MAX_CARRY}">
    <input type="hidden" name="action" value="choose">
    <ol class="design-props">${cards}${addedHtml}</ol>
    <div class="design-actions design-choose-actions">
      <button class="btn btn--gold btn--sm" type="submit"${caps.consultation ? '' : ' disabled'}>Save the journey list</button>
      <span class="design-hint" data-live-status role="status">${caps.consultation ? '' : esc(require('../design-data.js').UNAVAILABLE.consultation)}</span>
    </div>
  </form>
  ${declines}${removes}

  ${addPlace(id, v.directory || [], caps)}

  <div class="design-compare-summary" data-fragment-slot="compare-summary">${summary({ id, need, chosen, cards: all, firstName: v.firstName })}</div>
</section>`;
}

function countLine(n) {
  if (!n) return `Nothing in the journey yet — add up to ${MAX_CARRY}.`;
  return `${n} of ${MAX_CARRY} in the journey${n >= MAX_CARRY ? ' — that is the most; set one aside to change it' : ''}.`;
}

/* ── The card ─────────────────────────────────────────────────────────── */
function propertyCard(id, c, need, chosen, fw, o) {
  o = o || {};
  const p = c.property || {};
  const vk = villageFor(p, need);
  const accent = vk ? ` style="--v: var(--v-${esc(vk)}); --v-ink: var(--v-${esc(vk)}-ink)"` : '';
  const carried = chosen.indexOf(c.slug) !== -1;
  const included = (p.included || []).slice(0, 3).map((f) => f.text || f);
  const menu = p.price && p.price.text;
  const directoryOnly = p.collection && p.collection !== 'deep';
  const eyebrow = [o.added ? 'Added by you' : '', directoryOnly ? 'Directory entry · profile to follow' : (o.added ? '' : (p.modelTag || ''))].filter(Boolean).join(' · ');

  return `<li class="design-prop${carried ? ' is-carried' : ''}${p.image ? '' : ' design-prop--text'}${o.added ? ' design-prop--added' : ''}" id="prop-${esc(c.slug)}"${accent}>
  ${p.image ? `<div class="design-prop-media">${mediaGallery((p.image.images && p.image.images.length) ? p.image.images : [p.image], { sizes: '(min-width: 60rem) 44vw, 100vw', thumbSizes: '(min-width: 60rem) 7vw, 22vw' })}</div>` : ''}
  <div class="design-prop-body">
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <div class="design-prop-title">
      ${o.rank ? `<span class="design-rank" aria-label="Ranked ${o.rank} of ${o.of}">${esc(ORDINAL[o.rank] || o.rank + 'th')}<small>of ${esc(String(o.of))}</small></span>` : ''}
      <h3>${esc(c.name)}</h3>
    </div>
    <p class="design-verdict">${esc(M.verdict(c.bands))}</p>
    <div class="design-bands">${AXIS.map(([k, label]) => `<div class="band band-${esc(c.bands[k])}">
      <span class="band-axis">${label}</span><span class="band-word">${esc(BAND_WORD[c.bands[k]] || c.bands[k])}</span></div>`).join('')}</div>

    ${p.hook ? `<p class="design-prop-hook">${esc(p.hook)}</p>` : ''}
    ${p.bestFor ? `<p class="design-prop-best"><b>Best for</b> ${esc(p.bestFor)}</p>` : ''}
    ${included.length ? `<ul class="design-prop-inc">${included.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}

    <div class="chips design-prop-villages">${(p.villages || []).map((k) => `<span class="chip chip--v" style="--v: var(--v-${esc(k)}); --v-ink: var(--v-${esc(k)}-ink)">${esc(villageName(k))}</span>`).join('')}</div>
    ${continuumStrip(p, fw)}

    ${(c.mismatches || []).length ? `<div class="design-watch"><h4>What to watch</h4><ul class="design-mismatch">${c.mismatches.map((m) => `<li class="sev-${esc(m.severity)}">${esc(m.sentence)}${
      m.evidence ? `<span class="design-ev">${esc(m.evidence)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}

    ${priceBlock(o.cell, need, o.travelFrom, p)}
    ${menu ? `<details class="design-menu"><summary>Treatments and menu, as published</summary>
      <p>${esc(menu)}</p><p class="design-hint">Planning guidance only — every figure is reconfirmed before it is quoted.</p></details>` : ''}
    ${c.verified_at ? `<p class="design-verified">Last verified ${esc(c.verified_at)}</p>` : ''}

    <div class="design-prop-actions">
      <label class="design-pick design-pick--multi design-carry"><input type="checkbox" name="carry" value="${esc(c.slug)}"${carried ? ' checked' : ''} data-carry>
        <span data-carry-word data-on="In the journey" data-off="Add to the journey">${carried ? 'In the journey' : 'Add to the journey'}</span></label>
      <span class="design-aside">
        ${o.added ? `<button class="btn btn--ghost btn--sm" type="submit" form="remove-${esc(c.slug)}">Remove</button>` : ''}
        <select name="reason" form="decline-${esc(c.slug)}" aria-label="Why set aside">${DECLINE_REASONS.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>
        <button class="btn btn--ghost btn--sm" type="submit" form="decline-${esc(c.slug)}">Set aside</button>
      </span>
    </div>
  </div>
</li>`;
}

/* The six-rung ladder, graded pale teal → ink, with the property's band lit.
   Words carry it; the grade is a second signal. */
function continuumStrip(p, fw) {
  const order = fw.continuumOrder || [];
  const names = {};
  (fw.continuum || []).forEach((r) => { names[r.key] = r.name; });
  const on = p.continuum || [];
  if (!order.length) return '';
  if (!on.length) return `<p class="design-depth design-depth--unknown">Depth not mapped for this place yet.</p>`;
  return `<ol class="design-depth" aria-label="Depth">${order.map((k, i) => `<li class="rung-${i + 1}${on.indexOf(k) !== -1 ? ' is-on' : ''}">${esc(names[k] || k)}</li>`).join('')}</ol>`;
}

/* The stay price: per room a night from the lookup, and a person when the
   party is known. Honest when there is nothing: "we'll quote it". */
function priceBlock(cell, need, travelFrom, p) {
  const when = monthName(travelFrom);
  if (!cell || !Number.isFinite(cell.from)) {
    return `<div class="design-stay"><h4>Stay price</h4><p class="design-stay-none">${
      p.collection && p.collection !== 'deep' ? 'No public rate on file for this place yet — we’ll quote it.'
        : (when ? `No public rate seen for ${esc(when)} — we’ll quote it.` : 'Set a travel month on Understand to see a public rate.')}</p></div>`;
  }
  const hi = Number.isFinite(cell.toNext) ? cell.toNext : cell.to;
  const per = R.perPerson(cell, need);
  const room = cell.roomType ? esc(cell.roomType) : 'standard room';
  return `<div class="design-stay"><h4>Stay price</h4>
    <p class="design-stay-line"><b>From ${money(cell.from)}</b>${Number.isFinite(hi) && hi !== cell.from ? `–${money(hi)}` : ''} a night · ${room} · two adults${when ? ' · ' + esc(when) : ''}</p>
    ${per ? `<p class="design-stay-per">About <b>${money(per.from)}</b> a person a night for ${per.people} across ${per.rooms} room${per.rooms === 1 ? '' : 's'}.</p>`
      : `<p class="design-stay-per design-hint">Add adults, children and rooms on Understand to see it a person.</p>`}
    <p class="design-hint">${cell.confidence === 'PUBLISHED TARIFF' ? 'Published tariff' : 'Public rate'}${cell.observed ? ' seen ' + esc(cell.observed) : ''} · reconfirmed before anything is quoted.</p>
  </div>`;
}

/* ── Add a place ───────────────────────────────────────────────────────── */
function addPlace(id, directory, caps) {
  if (!directory.length) return '';
  const deep = directory.filter((p) => p.collection === 'deep');
  const rest = directory.filter((p) => p.collection !== 'deep');
  const opt = (p) => `<option value="${esc(p.slug)}">${esc(p.name)}</option>`;
  return `<form method="POST" action="/hub/journeys/${esc(id)}/design?step=compare" class="design-addplace">
    <input type="hidden" name="action" value="add_place">
    <label class="design-field-label" for="add-place">Add a place from the directory</label>
    <div class="design-addplace-row">
      <select id="add-place" name="slug">
        ${deep.length ? `<optgroup label="Profiled">${deep.map(opt).join('')}</optgroup>` : ''}
        ${rest.length ? `<optgroup label="Directory">${rest.map(opt).join('')}</optgroup>` : ''}
      </select>
      <button class="btn btn--sm" type="submit"${caps.consultation ? '' : ' disabled'}>Add</button>
    </div>
    <span class="design-field-hint">Scored the same way, shown without a rank — it was not ranked.</span>
  </form>`;
}

/* ── The summary — the ink card ──────────────────────────────────────────── */
function summary(s) {
  const { id, need, chosen, cards } = s;
  const first = s.firstName ? String(s.firstName) : '';
  const bySlug = {};
  (cards || []).forEach((c) => { bySlug[c.slug] = c; });
  const picked = (chosen || []).map((slug) => bySlug[slug]).filter(Boolean);
  const items = picked.map((c) => {
    const vk = villageFor(c.property, need);
    return `<li><span class="design-heard-who">${esc(vk ? villageName(vk) : '')}</span><b>${esc(c.name)}</b><span class="design-summary-verdict">${esc(M.verdict(c.bands))}</span></li>`;
  }).join('');
  const cta = `<div class="design-heard-cta">
      <a class="btn btn--gold" href="/hub/journeys/${esc(id)}/design?step=shape" data-prepare="${esc(first)}"${picked.length ? '' : ' aria-disabled="true"'}>Let’s shape the journey →</a>
      <span class="design-heard-ctahint">${picked.length ? 'Next: the days, the pace, and which place answers which part of the week.' : 'Add up to three places above first.'}</span>
    </div>`;
  return `<div class="design-heard-card design-summary-card">
      <div class="design-heard-head"><h3 class="design-heard-h">What we’re carrying into the journey</h3><span class="design-heard-mark" aria-hidden="true">${RING}</span></div>
      ${picked.length ? `<ol class="design-summary-list">${items}</ol>` : `<p class="design-heard-p design-heard-p--empty">Nothing in the journey yet — add up to ${MAX_CARRY} places above.</p>`}
      <p class="design-heard-p design-summary-frame">Next we shape the journey — the days, the pace, and which place answers which part of the week.</p>
      <p class="design-cue design-cue--ink"><span class="design-cue-ask">Ask:</span> “Of these, which one do you keep coming back to?”</p>
      ${cta}
    </div>`;
}
const RING = `<svg width="28" height="28" viewBox="0 0 26 26" aria-hidden="true" focusable="false"><circle cx="13" cy="13" r="11.5" fill="none" stroke="#00A6A8" stroke-width="1.5"/><circle cx="13" cy="13" r="7" fill="none" stroke="#D9A03C" stroke-width="1.5"/><circle cx="13" cy="13" r="2.6" fill="#EF6A4A"/></svg>`;

/* "Also in <village>" stays in design.js (alsoIn) and is appended there. */

module.exports = { compareStage, propertyCard, summary, countLine, priceBlock, continuumStrip, addPlace, ratesFor, addedCards, directory,
  villageName, villageFor, DECLINE_REASONS, MAX_CARRY, BAND_WORD, AXIS };
