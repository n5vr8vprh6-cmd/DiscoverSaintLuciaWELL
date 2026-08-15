/* ============================================================================
   /hub/admin/advisors — the approval queue, then everyone
   ----------------------------------------------------------------------------
   Pending first and by default, because approving is what an admin actually
   comes here to do. The other views exist so the population can be inspected,
   not because a table needs tabs.

   Seeded fixtures are shown, marked TEST. A console that quietly filters rows
   out of its own counts is describing a database it is not reading, and that
   divergence is the kind that gets discovered at the worst moment.
   ========================================================================== */
'use strict';

const { requireAdmin } = require('../auth.js');
const { hubPage, esc, pageHead, emptyState, since } = require('../hub-render.js');
const { allAdvisors } = require('../admin-data.js');

const VIEWS = [
  { id: 'pending', label: 'Pending' },
  { id: 'active',  label: 'Active' },
  { id: 'paused',  label: 'Paused' },
  { id: 'all',     label: 'Everyone' }
];

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'https://x');
  const view = VIEWS.some((v) => v.id === url.searchParams.get('view'))
    ? url.searchParams.get('view') : 'pending';

  const admin = await requireAdmin(req, res, `/hub/admin/advisors?view=${view}`);
  if (!admin) return;

  const done = String(url.searchParams.get('done') || '').slice(0, 40);

  const all = await allAdvisors();
  const counts = {
    pending: all.filter((a) => a.status === 'pending').length,
    active:  all.filter((a) => a.status === 'active').length,
    paused:  all.filter((a) => a.status === 'paused').length,
    all:     all.length
  };
  const rows = view === 'all' ? all : all.filter((a) => a.status === view);

  const body = `<div class="hub-main">
  <div class="wrap">

    <p class="hub-back"><a href="/hub/admin">← Admin</a></p>

    ${pageHead('Advisors', counts.all === 1 ? '1 advisor' : `${counts.all} advisors`,
      'Everyone with an account, whatever state it is in.')}

    ${done ? `<p class="hub-flash">${esc(DONE[done] || done)}</p>` : ''}

    <div class="hub-actions">
      <a class="btn btn--gold btn--sm" href="/hub/admin/advisors/new">Add an advisor</a>
      <a class="btn btn--ghost btn--sm" href="/hub/admin/import">Import a CSV</a>
    </div>

    <nav class="hub-views" aria-label="View">
      ${VIEWS.map((v) => `<a href="/hub/admin/advisors?view=${v.id}"${v.id === view
        ? ' aria-current="true" class="is-current"' : ''}>${esc(v.label)} (${counts[v.id]})</a>`).join('\n      ')}
    </nav>

    ${rows.length ? `<ul class="hub-journeys">${rows.map(row).join('')}</ul>`
      : emptyState(
          view === 'pending' ? 'Nobody is waiting.' : `No ${view} advisors.`,
          view === 'pending'
            ? 'Every registered advisor has been dealt with. New registrations appear here.'
            : 'Nothing in this view yet.',
          { label: 'See everyone', href: '/hub/admin/advisors?view=all' })}

  </div>
</div>`;

  hubPage(res, { path: '/hub/admin', title: 'Advisors', advisor: admin, body });
};

function row(a) {
  const name = `${a.first_name || ''} ${a.last_name || ''}`.trim() || '(no name)';
  const org = a.business || a.host_agency || '';

  /* The workshop fast-path. Someone who wrote "met at the Toronto workshop" can
     be approved on sight, so the note is surfaced in the list rather than
     hidden one click away on the detail screen. */
  const note = a.status === 'pending' && a.registration_note
    ? `<span class="hub-journey-villages">“${esc(a.registration_note)}”</span>` : '';

  return `<li class="hub-journey">
    <a href="/hub/admin/advisors/${esc(a.id)}">
      <span class="hub-journey-name">${esc(name)}${
        a.role === 'admin' ? ' <span class="hub-tag" data-tag="admin">Admin</span>' : ''}${
        a.isTest ? ' <span class="hub-tag" data-tag="test">Test</span>' : ''}${
        a.is_house ? ' <span class="hub-tag" data-tag="house">Lead pool</span>' : ''}</span>
      <span class="hub-journey-meta">
        ${a.waiting ? `<span class="hub-tag" data-tag="waiting">${a.waiting} waiting</span>` : ''}
        ${a.locked_at ? '<span class="hub-tag" data-tag="locked">Locked</span>' : ''}
        <span class="hub-stage" data-stage="${statusStage(a.status)}">${esc(cap(a.status))}</span>
        <span>${a.journeys} ${a.journeys === 1 ? 'Journey' : 'Journeys'}</span>
        <span>${esc(a.public_code || '')}</span>
        <span>Joined ${esc(since(a.created_at))}</span>
      </span>
      ${org ? `<span class="hub-journey-villages">${esc(org)}</span>` : ''}
      ${note}
    </a>
  </li>`;
}

const DONE = {
  deleted: 'That advisor has been deleted.'
};

/* Reuse the Journey stage palette rather than inventing a second colour
   language for the same idea of "where in a process is this". */
const statusStage = (s) => ({ pending: 'new', active: 'booked', paused: 'closed' }[s] || 'closed');
const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
