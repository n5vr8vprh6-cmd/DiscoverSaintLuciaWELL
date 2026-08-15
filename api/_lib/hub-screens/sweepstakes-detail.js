/* ============================================================================
   /hub/sweepstakes/:id — the entrants, and the way to get them out
   ----------------------------------------------------------------------------
   The export IS the draw mechanism. The advisor downloads the list and picks a
   winner however they like — a spreadsheet, a randomiser, a hat. Building a
   picker here would put Discover Saint Lucia WELL inside the act of selecting a
   winner, which is precisely the position it does not hold.

   EVERY ENTRANT IS ALSO A JOURNEY. The same people appear in /hub/journeys with
   the same names and the same details; this screen is a filter over them, not a
   separate list of contest data. That matters when somebody asks to be erased:
   one deletion removes them from both, because there is only one record.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { str } = require('../core.js');
const { hubPage, esc, emptyState, since, STAGE_LABEL, WINDOW_LABEL } = require('../hub-render.js');
const { byId, entrantsFor, toCsv, OPEN } = require('../sweepstakes.js');

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.discoversaintluciawell.com';

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'https://x');
  const id = str(url.searchParams.get('id'), 64);

  const advisor = await requireAdvisor(req, res,
    id ? `/hub/sweepstakes/${encodeURIComponent(id)}` : '/hub/sweepstakes');
  if (!advisor) return;

  /* Scoped by advisor inside byId(). A guessed id belonging to somebody else
     returns null and renders as "no such draw" — the truth from where this
     advisor is standing, and it discloses nothing about whose it really is. */
  const draw = id ? await byId(advisor.id, id) : null;
  if (!draw) {
    return hubPage(res, {
      path: '/hub/sweepstakes', title: 'Not found', advisor, status: 404,
      body: `<div class="hub-main"><div class="wrap">${emptyState(
        'No such draw.', 'It may have been deleted.',
        { label: 'Your draws', href: '/hub/sweepstakes' })}</div></div>`
    });
  }

  const entrants = await entrantsFor(advisor.id, draw.id);

  /* The export leaves as a file rather than a page. Handled before the render
     so the two paths cannot disagree about who is allowed to see the list. */
  if (url.searchParams.get('export') === 'csv') {
    const safe = draw.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'draw';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safe}-entrants.csv"`);
    /* Never cached, never stored by an intermediary: this file is a list of
       real people's contact details. */
    res.setHeader('Cache-Control', 'private, no-store');
    return res.end(toCsv(entrants));
  }

  const link = `${SITE_ORIGIN}/well/${advisor.public_code || advisor.slug}/${draw.code}`;
  const open = draw.status === OPEN;

  const body = `<div class="hub-main hub-main--detail">
  <div class="wrap">

    <p class="hub-back"><a href="/hub/sweepstakes">← Prize draws</a></p>

    <header class="hub-detail-head">
      <p class="eyebrow">${esc(draw.code)} · started ${esc(since(draw.created_at))}</p>
      <h1>${esc(draw.name)}</h1>
      <p class="hub-contact">
        <span class="hub-stage" data-stage="${open ? 'new' : 'closed'}">${open ? 'Open' : 'Closed'}</span>
        <span>${entrants.length} ${entrants.length === 1 ? 'entrant' : 'entrants'}</span>
      </p>
      ${entrants.length ? `<div class="hub-actions">
        <a class="btn btn--gold" href="/hub/sweepstakes/${esc(draw.id)}?export=csv">Export the entrants</a>
      </div>` : ''}
    </header>

    <section class="hub-card">
      <h2>Drawing your winner</h2>
      <p class="hub-hint">Export the list and pick however you like — a spreadsheet, a randomiser,
        a hat. <strong>The draw is yours to run.</strong> We record who entered and give you the
        list; we take no part in choosing, and we do not contact your entrants about it.</p>
      <p class="hub-hint">Export before you close anything you are about to draw from. If an
        entrant later asks us to delete their information, we do — and they disappear from this
        list, because it is the same record.</p>
    </section>

    <section class="hub-card">
      <h2>The link</h2>
      <div class="hub-link-row">
        <input id="draw-link" value="${esc(link)}" readonly>
        <button class="btn btn--ghost btn--sm" type="button" data-copy="#draw-link">Copy</button>
        <button class="btn btn--ghost btn--sm" type="button" data-qr="${esc(link)}">QR code</button>
      </div>
      <p class="hub-hint">${open
        ? 'Anyone who shares their Journey through this link is entered, and is told so.'
        : 'This draw is closed, so nothing new is counted — but the link still works and still ' +
          'attributes visitors to you, which is why a printed card or QR code is safe to leave out there.'}</p>
    </section>

    <section class="hub-card">
      <h2>Who entered</h2>
      ${entrants.length
        ? `<ul class="hub-journeys">${entrants.map(row).join('')}</ul>
           <p class="hub-hint">In the order they entered. Each one is also in
             <a href="/hub/journeys">your Journeys</a> — same person, same record.</p>`
        : `<p class="hub-hint">Nobody yet. Entries appear here when someone completes the Journey
             Finder through the link above <strong>and</strong> shares it with you — sharing is the
             entry, because that is the step that gives you their details.</p>`}
    </section>

  </div>
</div>`;

  hubPage(res, { path: '/hub/sweepstakes', title: draw.name, advisor, body });
};

function row(e) {
  const name = `${e.consumer_first || ''} ${e.consumer_last || ''}`.trim() || 'Someone';
  return `<li class="hub-journey">
    <a href="/hub/journeys/${esc(e.id)}">
      <span class="hub-journey-name">${esc(name)}</span>
      <span class="hub-journey-meta">
        <span>${esc(e.consumer_email || '')}</span>
        <span class="hub-stage" data-stage="${esc(e.stage)}">${esc(STAGE_LABEL[e.stage] || e.stage)}</span>
        ${e.travel_window ? `<span>${esc(WINDOW_LABEL[e.travel_window] || e.travel_window)}</span>` : ''}
        <span>${esc(since(e.created_at))}</span>
      </span>
    </a>
  </li>`;
}
