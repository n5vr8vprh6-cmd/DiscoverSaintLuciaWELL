/* ============================================================================
   /hub/admin/waitlist — who is waiting for Immersion dates
   ----------------------------------------------------------------------------
   Admin only, and the guard in this file is the ONLY thing protecting it: the
   Hub router dispatches by name and does no route-level auth. So requireAdmin
   runs before anything is read, and the CSV export is handled AFTER the guard
   rather than before it, so the two paths cannot disagree about who may see
   the list.

   requireAdmin also refuses while view-as is active, whoever is being viewed.
   That matters here: this is a list of people who wrote to Duncan, not part of
   any advisor's Hub, and it must never appear inside one.

   THE EXPORT IS THE POINT. Nobody works a waiting list inside a web table — it
   goes into a mail tool. So the screen's job is to show that the list exists
   and is growing, make each person one click from an email, and get out of the
   way. It reuses the .hub-journeys list every other admin screen uses rather
   than introducing a table this stylesheet has no rules for.
   ========================================================================== */
'use strict';

const { requireAdmin } = require('../auth.js');
const { hubPage, esc, emptyState, since } = require('../hub-render.js');
const { list, toCsv } = require('../waitlist.js');

const PATH = '/hub/admin/waitlist';

module.exports = async function handler(req, res) {
  const admin = await requireAdmin(req, res, PATH);
  if (!admin) return;

  const url = new URL(req.url, 'https://x');
  const rows = await list(1000);

  if (url.searchParams.get('export') === 'csv') {
    const stamp = new Date().toISOString().slice(0, 10);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',
      `attachment; filename="immersion-waitlist-${stamp}.csv"`);
    /* A file of real people's contact details: never cached, never held by
       anything in between. Same header as the prize-draw export. */
    res.setHeader('Cache-Control', 'private, no-store');
    return res.end(toCsv(rows));
  }

  const body = `<div class="hub-main hub-main--detail">
  <div class="wrap">

    <p class="hub-back"><a href="/hub/admin">← Admin</a></p>

    <header class="hub-detail-head">
      <p class="eyebrow">Immersion</p>
      <h1>Waiting list</h1>
      <p class="hub-contact">${rows.length
        ? `${rows.length} ${rows.length === 1 ? 'person' : 'people'} asking to be told when the dates exist.`
        : 'Nobody yet.'}</p>
    </header>

    ${rows.length ? `
    <p class="hub-actions">
      <a class="btn btn--gold btn--sm" href="${PATH}?export=csv">Export CSV</a>
    </p>

    <ul class="hub-journeys">${rows.map(row).join('')}</ul>

    <p class="hub-note-when">Nobody here has been promised a date, a price or a
      place — they asked to be told. Erasure requests are handled on
      <a href="/hub/admin/subject">the subject-rights screen</a>, which searches
      this list along with everything else.</p>
    ` : emptyState(
        'Nobody on the list yet.',
        'The link is on /advisors/immersion, in the Dates and investment card.',
        { label: 'See the page', href: '/advisors/immersion' })}

  </div>
</div>`;

  return hubPage(res, { path: PATH, title: 'Immersion waiting list', advisor: admin, body });
};

/* mailto rather than a detail page: there is no detail to show that is not
   already on this line, and writing back is the only thing anyone will want to
   do from here. */
function row(r) {
  const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || '(no name)';
  const org = [r.company, r.host_agency].filter(Boolean).join(' · ');

  return `<li class="hub-journey">
    <a href="mailto:${esc(r.email)}">
      <span class="hub-journey-name">${esc(name)}</span>
      <span class="hub-journey-meta">
        <span>${esc(r.phone || '')}</span>
        <span>Joined ${esc(since(r.created_at))}</span>
      </span>
      <span class="hub-journey-villages">${esc(r.email)}${org ? ' · ' + esc(org) : ''}</span>
    </a>
  </li>`;
}
