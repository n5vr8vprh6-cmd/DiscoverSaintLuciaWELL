/* ============================================================================
   GET /hub/journeys — the pipeline
   ----------------------------------------------------------------------------
   V2 §11. Four views, and the default is Needs Attention rather than Newest,
   because "what should I do now" is a different question from "what happened
   most recently" and only one of them is useful at 8am.

   Views are server-side. No client filtering, no table library: an advisor with
   forty Journeys is served better by a fast document than by a grid widget.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const {
  hubPage, esc, pageHead, emptyState,
  STAGES, STAGE_LABEL, WINDOW_LABEL, WINDOW_ORDER, since
} = require('../hub-render.js');
const { journeysFor, needsAttention } = require('../hub-data.js');
const { maskJourneys } = require('../hub-mask.js');

const VIEWS = [
  { id: 'attention', label: 'Needs attention' },
  { id: 'soonest',   label: 'Travelling soonest' },
  { id: 'newest',    label: 'Newest' },
  { id: 'stage',     label: 'By stage' }
];

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'https://x');
  const view = VIEWS.some((v) => v.id === url.searchParams.get('view'))
    ? url.searchParams.get('view') : 'attention';

  const advisor = await requireAdvisor(req, res, `/hub/journeys?view=${view}`);
  if (!advisor) return;

  /* Masked once, here, so every view below renders from the same rows and no
     future view can forget to. */
  const all = maskJourneys(await journeysFor(advisor.id), advisor.viewingAs);

  const body = `<div class="hub-main">
  <div class="wrap">
    ${pageHead('Journeys', all.length === 1 ? '1 Journey' : `${all.length} Journeys`,
      'People who completed the Finder through your link and chose to share the result.')}

    ${all.length ? `
    <nav class="hub-views" aria-label="View">
      ${VIEWS.map((v) => `<a href="/hub/journeys?view=${v.id}"${v.id === view
        ? ' aria-current="true" class="is-current"' : ''}>${esc(v.label)}</a>`).join('\n      ')}
    </nav>

    ${renderView(view, all)}
    ` : emptyState(
      'No Journeys yet.',
      'When someone completes the Finder through your link and chooses to share it, they arrive here — with what they asked for, not just their contact details.',
      { label: 'Get your WELL link', href: '/hub#well-link' })}
  </div>
</div>`;

  hubPage(res, { path: '/hub/journeys', title: 'Journeys', advisor, body });
};

function renderView(view, all) {
  if (view === 'stage') {
    /* Grouped rather than sorted: this view answers "where is everything",
       so an empty stage is information and is shown as one. */
    return STAGES.map((s) => {
      const rows = all.filter((j) => j.stage === s);
      if (!rows.length) return '';
      return `<section class="hub-group">
      <h2 class="hub-group-head"><span class="hub-stage" data-stage="${s}">${esc(STAGE_LABEL[s])}</span>
        <span class="hub-group-n">${rows.length}</span></h2>
      <ul class="hub-journeys">${rows.map(row).join('')}</ul>
    </section>`;
    }).join('');
  }

  let rows;
  if (view === 'soonest') {
    /* Unknown windows sort last rather than first — an absent answer is not
       an urgent one. */
    rows = all.slice().sort((a, b) => {
      const wa = WINDOW_ORDER[a.travel_window]; const wb = WINDOW_ORDER[b.travel_window];
      return (wa === undefined ? 99 : wa) - (wb === undefined ? 99 : wb) ||
        new Date(b.created_at) - new Date(a.created_at);
    });
  } else if (view === 'newest') {
    rows = all;   /* already ordered created_at desc by the query */
  } else {
    rows = needsAttention(all);
  }

  if (!rows.length) {
    return emptyState('Nothing in this view.',
      'Everything has been picked up, or is already booked and closed.',
      { label: 'See all Journeys', href: '/hub/journeys?view=newest' });
  }

  /* Needs Attention drops booked and closed Journeys, which otherwise reads as
     a bug: the heading says four and the list shows three. Say what is missing
     rather than leaving the advisor to count. */
  const hidden = all.length - rows.length;
  const note = hidden > 0
    ? `<p class="hub-more">${hidden === 1
        ? 'One Journey is booked or closed and is not shown here.'
        : `${hidden} Journeys are booked or closed and are not shown here.`}
       <a href="/hub/journeys?view=newest">Show everything</a></p>`
    : '';

  return `<ul class="hub-journeys">${rows.map(row).join('')}</ul>${note}`;
}

function row(j) {
  const name = `${j.consumer_first || ''} ${j.consumer_last || ''}`.trim() || 'Someone';
  const villages = (j.villages || []).slice(0, 3).join(' · ');
  return `<li class="hub-journey">
    <a href="/hub/journeys/${esc(j.id)}">
      <span class="hub-journey-name">${esc(name)}</span>
      <span class="hub-journey-meta">
        <span class="hub-stage" data-stage="${esc(j.stage)}">${esc(STAGE_LABEL[j.stage] || j.stage)}</span>
        ${j.travel_window ? `<span>${esc(WINDOW_LABEL[j.travel_window] || j.travel_window)}</span>` : ''}
        ${/* Marked because it changes how you open the conversation: somebody
              who came in through a giveaway is warmer about the prize than
              about the trip, and worth greeting differently. */''}
        ${j.sweepstakes_id ? '<span class="hub-tag" data-tag="draw">Prize draw</span>' : ''}
        <span>Shared ${esc(since(j.created_at))}</span>
      </span>
      ${villages ? `<span class="hub-journey-villages">${esc(villages)}</span>` : ''}
    </a>
  </li>`;
}
