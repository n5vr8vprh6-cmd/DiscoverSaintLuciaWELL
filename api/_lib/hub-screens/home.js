/* ============================================================================
   GET /hub — Home
   ----------------------------------------------------------------------------
   V2 §8: an action surface, not a vanity dashboard. It answers three questions
   in order — what happened, who needs me, what should I do next — and it is
   deliberately short on charts. Small counts and a clear next action beat a
   sparkline nobody acts on.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { hubPage, esc, emptyState, STAGE_LABEL, WINDOW_LABEL, since } = require('../hub-render.js');
const { journeysFor, funnelFor, needsAttention } = require('../hub-data.js');

module.exports = async function handler(req, res) {
  const advisor = await requireAdvisor(req, res, '/hub');
  if (!advisor) return;

  const [journeys, funnel] = await Promise.all([
    journeysFor(advisor.id, { limit: 100 }),
    funnelFor(advisor.id)
  ]);
  const attention = needsAttention(journeys).slice(0, 5);
  const link = `https://discoversaintluciawell.com/well/${advisor.public_code}`;

  const body = `<div class="hub-main">
  <div class="wrap">

    <div class="hub-greeting">
      <!-- No eyebrow. The context band directly above already says "Travel
           Advisor Hub"; repeating it under the band reads as a mistake. -->
      <h1>${esc(greeting())}, ${esc(advisor.first_name)}.</h1>
      ${advisor.status !== 'active' ? `
      <p class="hub-notice">
        Your account is being confirmed. You can explore the Hub and get your
        campaign link ready — consumers will be able to share Journeys with you
        once it is active.
      </p>` : ''}
    </div>

    ${nextBestAction(advisor, funnel, journeys)}

    <section class="hub-section">
      <h2>Your campaign</h2>
      <div class="hub-funnel">
        ${step('Visits', funnel.visits, 'people arrived through your link')}
        ${step('Finder completions', funnel.completions, 'finished the Journey Finder')}
        ${step('Journeys shared', funnel.shares, 'chose to share with you')}
      </div>
      <div class="hub-link">
        <label class="hub-field-label" for="well-link">Your WELL link</label>
        <div class="hub-link-row">
          <input id="well-link" value="${esc(link)}" readonly>
          <button class="btn btn--ghost btn--sm" type="button" data-copy="#well-link">Copy</button>
          <button class="btn btn--ghost btn--sm" type="button" data-qr="${esc(link)}">QR code</button>
        </div>
        <p class="hub-hint">This link identifies you without putting your name in the address.</p>
      </div>
    </section>

    <section class="hub-section">
      <h2>Needs attention</h2>
      ${attention.length
        ? `<ul class="hub-journeys">${attention.map(row).join('')}</ul>
           <p class="hub-more"><a href="/hub/journeys">All Journeys (${journeys.length})</a></p>`
        : journeys.length
          ? emptyState('Nothing waiting on you.',
              'Every Journey has been picked up. New ones will appear here first.',
              { label: 'See all Journeys', href: '/hub/journeys' })
          : emptyState('No Journeys yet.',
              'When someone completes the Finder through your link and chooses to share it, they land here.',
              { label: 'Copy your WELL link', href: '#well-link' })}
    </section>

  </div>
</div>`;

  hubPage(res, { path: '/hub', title: 'Home', advisor, body });
};

function greeting() {
  const h = new Date().getUTCHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function step(label, n, note) {
  return `<div class="hub-stat">
    <span class="hub-stat-n">${n}</span>
    <span class="hub-stat-label">${esc(label)}</span>
    <span class="hub-stat-note">${esc(note)}</span>
  </div>`;
}

function row(j) {
  const name = `${j.consumer_first || ''} ${j.consumer_last || ''}`.trim() || 'Someone';
  return `<li class="hub-journey">
    <a href="/hub/journeys/${esc(j.id)}">
      <span class="hub-journey-name">${esc(name)}</span>
      <span class="hub-journey-meta">
        <span class="hub-stage" data-stage="${esc(j.stage)}">${esc(STAGE_LABEL[j.stage] || j.stage)}</span>
        ${j.travel_window ? `<span>${esc(WINDOW_LABEL[j.travel_window] || j.travel_window)}</span>` : ''}
        <span>${esc(since(j.created_at))}</span>
      </span>
      ${(j.villages || []).length
        ? `<span class="hub-journey-villages">${esc((j.villages || []).slice(0, 2).join(' · '))}</span>` : ''}
    </a>
  </li>`;
}

/* §19: every empty state drives an action. This picks the one thing that would
   move the advisor forward from where they actually are. */
function nextBestAction(advisor, funnel, journeys) {
  let title, note, cta;

  if (journeys.some((j) => j.stage === 'new')) {
    const n = journeys.filter((j) => j.stage === 'new').length;
    title = n === 1 ? 'Someone is waiting to hear from you.'
                    : `${n} people are waiting to hear from you.`;
    note = 'They shared a Journey deliberately. A reply in the first day or two is what turns it into a conversation.';
    cta = { label: 'Open the newest', href: '/hub/journeys?view=attention' };
  } else if (funnel.completions > 0 && funnel.shares === 0) {
    title = 'People are finishing the Finder but not sharing.';
    note = 'They are interested enough to answer four questions. Try putting the link somewhere it comes with your recommendation rather than on its own.';
    cta = { label: 'See your campaign', href: '#well-link' };
  } else if (funnel.visits === 0) {
    title = 'Your link has not been used yet.';
    note = 'Start with ten people you already know. It works better than a broadcast, and it is quicker.';
    cta = { label: 'Copy your WELL link', href: '#well-link' };
  } else {
    title = 'Keep the link moving.';
    note = 'Traffic is arriving. The next Journey usually comes from the next place you put it.';
    cta = { label: 'See all Journeys', href: '/hub/journeys' };
  }

  return `<section class="hub-nba">
    <p class="eyebrow eyebrow--gold">Next</p>
    <h2>${esc(title)}</h2>
    <p>${esc(note)}</p>
    <a class="btn btn--gold" href="${esc(cta.href)}">${esc(cta.label)}</a>
  </section>`;
}
