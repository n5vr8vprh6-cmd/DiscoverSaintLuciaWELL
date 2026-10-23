/* ============================================================================
   GET /hub/designer — the Journey Designer
   ----------------------------------------------------------------------------
   The brief's mockup labelled the Designer "Coming soon". It is not: ASK WELL
   (/hub/journeys/:id/design) already designs a week from a client's shared
   Finder result and issues the itinerary they keep. What is still to come is
   every OTHER way in — from an intention before any Finder, from a property a
   client already has in mind — and a group, which is Group Studio's work.

   So this is the Designer's front door, and the runway the next build lands
   on: the one start that works today is live and full-width, the starts that
   do not are shown for what they are, and nothing here invents a draft or a
   schema for them (brief v2 §10).
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { hubPage, esc } = require('../hub-render.js');
const { journeysFor, needsAttention } = require('../hub-data.js');
const { maskJourneys } = require('../hub-mask.js');
const UI = require('../hub-ui.js');

module.exports = async function handler(req, res) {
  const advisor = await requireAdvisor(req, res, '/hub/designer');
  if (!advisor) return;
  const journeys = await journeysFor(advisor.id);
  hubPage(res, { path: '/hub/designer', title: 'Journey Designer', advisor, body: buildBody({ advisor, journeys }) });
};

/* The four ASK WELL stages, as the workspace names them (design.js STEPS).
   Described by what they do, not by what they promise. */
const STAGES = [
  { name: 'Understand', text: 'Start from what they told the Finder, in their words, and confirm what they need from the trip.' },
  { name: 'Compare', text: 'Properties matched on four separate axes, each said plainly as strong, partial or thin. Never one score.' },
  { name: 'Shape', text: 'Lay out the days: arrival, rhythm, the day with nothing in it. Edit any of it.' },
  { name: 'Send', text: 'Issue an itinerary they keep, at a private link you can reissue or withdraw.' }
];

function buildBody({ advisor, journeys }) {
  /* Booked and closed people have nothing left to design; the ranking that
     orders Home orders this list too, so the first person here is the first
     person there. */
  const ready = maskJourneys(needsAttention(journeys), advisor.viewingAs);
  const design = (j) => `<a class="hub-btn hub-btn--primary hub-btn--sm hub-row-act" href="/hub/journeys/${esc(j.id)}/design">Design</a>`;

  const starts = [
    { k: 'From a client who shared', t: 'Pick someone below. ASK WELL starts from their Journey Finder answers.', href: '#ready', live: true },
    { k: 'From an intention', t: 'Begin with what a client needs, before they have taken the Finder.', soon: true },
    { k: 'From a property', t: 'Begin with a resort a client already has in mind, and design around it.', soon: true },
    { k: 'For a group', t: 'A hosted group or retreat concept is designed with us, through WELL Group Studio.', href: '/advisors/groups?path=designer', apply: true }
  ];

  return `<div class="hub-main hub-designer">
  <section class="hub-hero hub-hero--band hub-hero--page" aria-labelledby="hero-title">
    <div class="hub-hero-media">${UI.picture('wide', { priority: true, sizes: '100vw', decorative: true })}</div>
    <div class="wrap hub-hero-inner">
      <p class="hub-eyebrow">Journey Designer</p>
      <h1 id="hero-title">Design a week around the person.</h1>
      <p class="hub-hero-status">Start with what your client asked for. Finish with an itinerary they keep.</p>
    </div>
  </section>
  <div class="wrap hub-stack">

    <section class="hub-block" aria-labelledby="starts-title">
      ${UI.sectionHead('Start a design', { id: 'starts-title' })}
      <div class="hub-starts">
        ${starts.map((s) => {
          const badge = s.soon ? '<span class="hub-badge" data-badge="soon">Coming soon</span>'
            : s.apply ? '<span class="hub-badge" data-badge="apply">By application</span>'
            : '<span class="hub-badge" data-badge="live">Available now</span>';
          const inner = `${badge}
            <span class="hub-start-k">${esc(s.k)}</span>
            <span class="hub-start-t">${esc(s.t)}</span>`;
          return s.href
            ? `<a class="hub-start${s.live ? ' hub-start--live' : ''}" href="${esc(s.href)}">${inner}<span class="hub-start-cta">${s.live ? 'Choose a client' : 'Explore Group Studio'}<span class="hub-arrow" aria-hidden="true">→</span></span></a>`
            : `<div class="hub-start hub-start--soon" aria-disabled="true">${inner}</div>`;
        }).join('')}
      </div>
    </section>

    <section class="hub-card" id="ready" aria-labelledby="ready-title">
      ${UI.sectionHead('Clients ready to design', {
        id: 'ready-title',
        lead: 'Everyone who shared a Journey and is not yet booked or closed, most in need of you first.',
        action: journeys.length ? { label: 'All clients', href: '/hub/journeys' } : null
      })}
      ${ready.length
        ? `<ul class="hub-rows">${ready.map((j) => UI.inquiryRow(j, { action: design(j) })).join('')}</ul>`
        : `<div class="hub-empty">
            <h3>Nobody to design for yet.</h3>
            <p>When someone completes the Journey Finder through your WELL link and shares it with you, you can design their week from here.</p>
            <a class="hub-btn hub-btn--primary" href="/hub/marketing">Get your WELL link</a>
          </div>`}
    </section>

    <section class="hub-block" aria-labelledby="how-title">
      ${UI.sectionHead('How a design comes together', { id: 'how-title', lead: 'Four stages in one workspace, built to be used with the client on the call or beside you.' })}
      <ol class="hub-steps hub-steps--four">
        ${STAGES.map((s) => `<li class="hub-step"><b>${esc(s.name)}</b><span>${esc(s.text)}</span></li>`).join('')}
      </ol>
    </section>

  </div>
</div>`;
}

module.exports.buildBody = buildBody;
