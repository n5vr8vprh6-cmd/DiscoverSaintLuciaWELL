/* ============================================================================
   GET /hub/marketing — Marketing, the overview
   ----------------------------------------------------------------------------
   Finding the people the journeys are for. Campaign, the Playbook and prize
   draws were three top-level items; they are one job, so they sit under one
   destination with a tab strip (hubPage renders it), and every screen keeps
   the URL it had — a bookmarked /hub/sweepstakes still opens the draws.

   This page is the WELL link at full size (with the QR downloads and the
   preview the header popover points to) and an honest summary of each tool:
   what it is, and where the advisor stands with it. The image and video
   catalogue is planned (/hub/library) and is shown as coming, with nothing
   behind it.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { hubPage, esc, wellLinkFor } = require('../hub-render.js');
const { listFor } = require('../sweepstakes.js');
const { showsAsActive } = require('../demo.js');
const UI = require('../hub-ui.js');

module.exports = async function handler(req, res) {
  const advisor = await requireAdvisor(req, res, '/hub/marketing');
  if (!advisor) return;
  const draws = await listFor(advisor.id);
  hubPage(res, {
    path: '/hub/marketing', title: 'Marketing', advisor,
    body: buildBody({ advisor, draws, link: wellLinkFor(advisor) })
  });
};

function buildBody({ advisor, draws, link }) {
  const open = draws.filter((d) => d.status === 'open');
  const entries = open.reduce((n, d) => n + (d.entries || 0), 0);
  const drawLine = open.length
    ? `${open.length} open ${open.length === 1 ? 'draw' : 'draws'}, ${entries} ${entries === 1 ? 'entry' : 'entries'} so far.`
    : draws.length ? 'No draw is open right now.' : 'You have not run a draw yet.';

  const card = ({ title, body, status, href, cta, soon }) => `<section class="hub-card hub-mcard">
    ${soon ? '<span class="hub-badge" data-badge="soon">Coming soon</span>' : ''}
    <h2 class="hub-card-title">${esc(title)}</h2>
    <p>${esc(body)}</p>
    ${status ? `<p class="hub-mcard-status">${esc(status)}</p>` : ''}
    ${href ? `<a class="hub-card-link" href="${esc(href)}">${esc(cta)}<span class="hub-arrow" aria-hidden="true">→</span></a>` : ''}
  </section>`;

  return `<div class="hub-main hub-marketing">
  <div class="wrap hub-stack">
    <div class="hub-head">
      <p class="hub-eyebrow">Marketing</p>
      <h1>Find the people your journeys are for.</h1>
      <p class="hub-lead">Your link carries every client to you. Everything else here is a way to put it in front of the right people.</p>
    </div>

    ${UI.linkCard(link, { pending: !showsAsActive(advisor) })}

    <div class="hub-mcards">
      ${card({ title: 'Your 30-day campaign', href: '/hub/campaign', cta: 'Open your campaign',
        body: 'A plan for your first month: who to reach, where, and what to say, written around your own audience.' })}
      ${card({ title: 'The Advisor Playbook', href: '/hub/campaign/playbook', cta: 'Read the Playbook',
        body: 'Everything the Hub knows about how you should go to market, assembled into one document you can read end to end and print.' })}
      ${card({ title: 'Prize draws', href: '/hub/sweepstakes', cta: open.length ? 'Manage your draws' : 'Start a draw',
        body: 'Run your own giveaway through your link. Entries arrive as Journeys, and you export the list to draw.',
        status: drawLine })}
      ${card({ title: 'Image and video catalogue', soon: true,
        body: 'A reference library of Saint Lucia imagery and video for advisors, with what each file may be used for.' })}
    </div>
  </div>
</div>`;
}

module.exports.buildBody = buildBody;
