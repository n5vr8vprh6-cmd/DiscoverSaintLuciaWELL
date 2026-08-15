/* ============================================================================
   /hub/sweepstakes — an advisor's prize draws
   ----------------------------------------------------------------------------
   A draw here is a LINK AND A LABEL, nothing more. There is no prize field, no
   rules field, no dates that enforce anything, and no winner picker. Discover
   Saint Lucia WELL is not the sponsor: the advisor runs the promotion, sets the
   rules, and draws their own winner from the list they export.

   What this screen provides is the one thing the advisor cannot do for
   themselves — knowing which of their Journeys arrived through the promotion.

   CLOSING IS NOT DELETING, and the interface has to make that obvious. Closing
   stops new entries being counted and leaves the link working as an ordinary
   WELL link, because a QR code printed on a card outlives the campaign it was
   made for. Deleting is offered only for a draw nobody entered.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { str, body: parseBody } = require('../core.js');
const { hubPage, esc, pageHead, emptyState, since } = require('../hub-render.js');
const {
  listFor, create, rename, setStatus, remove, OPEN, NAME_MAX
} = require('../sweepstakes.js');

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.discoversaintluciawell.com';

/* How many finished draws stay in view before the rest go behind a disclosure.
   Four is enough to see the recent ones at a glance without the page turning
   into an archive — an advisor runs a few campaigns a year, not a few a week. */
const CLOSED_SHOWN = 4;

module.exports = async function handler(req, res) {
  const advisor = await requireAdvisor(req, res, '/hub/sweepstakes');
  if (!advisor) return;

  if (req.method === 'POST') {
    /* Read-only while viewing as somebody, exactly as account.js is. Staff
       supporting an advisor may look at their draws; creating or closing one
       on their behalf would be acting as them. */
    if (advisor.viewingAs) {
      res.statusCode = 303;
      res.setHeader('Location', '/hub/sweepstakes?done=readonly');
      return res.end();
    }
    const result = await act(advisor, parseBody(req) || {});
    res.statusCode = 303;
    res.setHeader('Location', '/hub/sweepstakes?done=' + encodeURIComponent(result));
    return res.end();
  }

  const url = new URL(req.url, 'https://x');
  const done = str(url.searchParams.get('done'), 40);
  const draws = await listFor(advisor.id);
  const code = advisor.public_code || advisor.slug;

  /* An open draw and a closed one are different objects with different jobs.
     You open this page to copy a live link, or to reach a finished draw's
     entrants — never to press Copy on a campaign that is over. So they are
     rendered differently rather than sorted into one uniform list. */
  const open = draws.filter((d) => d.status === OPEN);
  const closed = draws.filter((d) => d.status !== OPEN);
  /* Collapse only when it earns its place. Hiding ONE row behind a disclosure
     costs more vertical space than the row it saves and makes somebody click to
     see nothing much — so the archive appears only once at least two would go
     into it. */
  const archive = closed.length > CLOSED_SHOWN + 1;
  const recent = archive ? closed.slice(0, CLOSED_SHOWN) : closed;
  const older = archive ? closed.slice(CLOSED_SHOWN) : [];

  const body = `<div class="hub-main">
  <div class="wrap">

    ${pageHead('Prize draws', 'Your draws',
      'A link that marks which Journeys came in through a promotion you are running.')}

    ${done ? `<p class="hub-flash${/failed|required|has_entries|not_found|readonly/.test(done) ? ' hub-flash--bad' : ''}">${
      esc(DONE_MESSAGE[done] || done)}</p>` : ''}

    ${open.length
      ? open.map((d) => card(d, code)).join('')
      : (closed.length ? '' : emptyState('No draws yet.',
          'Create one when you are running a promotion. Your ordinary WELL link keeps working ' +
          'exactly as it does now.',
          { label: 'Your WELL link', href: '/hub#well-link' }))}

    ${!open.length && closed.length
      ? `<section class="hub-card"><p class="hub-hint">Nothing running at the moment. Your
          finished draws are below, and your ordinary WELL link keeps working as it always
          does.</p></section>`
      : ''}

    ${/* Creating is a deliberate act. With draws on the page it must not sit
          above the link somebody came to copy — but with none, it IS the page,
          so it stays open. */''}
    ${createForm(draws.length > 0)}

    ${closed.length ? `
    <section class="hub-section">
      <h2>Finished draws</h2>
      <ul class="hub-journeys">${recent.map(row).join('')}</ul>
      ${older.length ? `
      <details class="hub-archive">
        <summary>Show all ${closed.length} finished draws</summary>
        <ul class="hub-journeys">${older.map(row).join('')}</ul>
      </details>` : ''}
      <p class="hub-hint">Their links still work and still credit you — they simply stop counting
        entries. Open one to export its entrants.</p>
    </section>` : ''}

  </div>
</div>`;

  hubPage(res, { path: '/hub/sweepstakes', title: 'Prize draws', advisor, body });
};

/* ── One draw ────────────────────────────────────────────────────────────── */
function card(d, advisorCode) {
  const link = `${SITE_ORIGIN}/well/${advisorCode}/${d.code}`;
  const open = d.status === OPEN;
  const id = 'sw-' + d.id.slice(0, 8);

  return `<section class="hub-card">
    <div class="hub-sweeps-head">
      <div>
        <h2>${esc(d.name)}</h2>
        <p class="hub-hint">${open
          ? 'Open — entries are being counted.'
          : 'Closed ' + esc(since(d.closed_at || d.created_at)) + '. The link still works as your ordinary WELL link; nothing new is counted.'}</p>
      </div>
      <span class="hub-stage" data-stage="${open ? 'new' : 'closed'}">${open ? 'Open' : 'Closed'}</span>
    </div>

    <div class="hub-funnel hub-funnel--tight">
      <div class="hub-stat">
        <span class="hub-stat-n">${d.entries}</span>
        <span class="hub-stat-label">${d.entries === 1 ? 'Entry' : 'Entries'}</span>
      </div>
    </div>

    <label class="hub-field-label" for="${id}">The link to give out</label>
    <div class="hub-link-row">
      <input id="${id}" value="${esc(link)}" readonly>
      <button class="btn btn--ghost btn--sm" type="button" data-copy="#${id}">Copy</button>
      <button class="btn btn--ghost btn--sm" type="button" data-qr="${esc(link)}">QR code</button>
    </div>

    <div class="hub-actions">
      <a class="btn btn--gold btn--sm" href="/hub/sweepstakes/${esc(d.id)}">
        ${d.entries ? 'See the ' + d.entries + ' ' + (d.entries === 1 ? 'entrant' : 'entrants') : 'Open it'}</a>
      ${form(d.id, open ? 'close' : 'reopen', open ? 'Close it' : 'Reopen it')}
      ${d.entries === 0 ? form(d.id, 'delete', 'Delete') : ''}
    </div>

    <details class="hub-consent">
      <summary>Rename</summary>
      <form method="POST" class="hub-search">
        <input type="hidden" name="action" value="rename">
        <input type="hidden" name="id" value="${esc(d.id)}">
        <label class="hub-field hub-field--wide">
          <span class="hub-field-label">New name</span>
          <input name="name" value="${esc(d.name)}" maxlength="${NAME_MAX}" required>
        </label>
        <button class="btn btn--ghost btn--sm" type="submit">Save</button>
      </form>
    </details>
  </section>`;
}

/* ── A finished draw ──────────────────────────────────────────────────────
   Deliberately NOT a card. Copy and QR are meaningless on a campaign that is
   over, and a row of controls nobody will press is what buried the live draw
   in the first place. One line, one destination: the entrants.

   Built from .hub-journey, the same list the Journeys screen uses, so it needs
   no new CSS and reads as something already familiar. */
function row(d) {
  return `<li class="hub-journey">
    <a href="/hub/sweepstakes/${esc(d.id)}">
      <span class="hub-journey-name">${esc(d.name)}</span>
      <span class="hub-journey-meta">
        <span>${d.entries} ${d.entries === 1 ? 'entrant' : 'entrants'}</span>
        <span>Closed ${esc(since(d.closed_at || d.created_at))}</span>
      </span>
    </a>
  </li>`;
}

/* Open when there is nothing else on the page, because then it IS the page.
   Collapsed once draws exist, so the link somebody came to copy is what they
   see first. */
function createForm(collapse) {
  const inner = `<p class="hub-hint">Give it a name only you will see, and you get a link. Anyone
        who completes the Journey Finder through that link and shares it with you is recorded as
        an entrant, and told so.</p>
      <form method="POST" class="hub-search">
        <input type="hidden" name="action" value="create">
        <label class="hub-field hub-field--wide">
          <span class="hub-field-label">What are you calling it?</span>
          <input name="name" maxlength="${NAME_MAX}" autocomplete="off"
                 placeholder="Spring giveaway, October event…" required>
        </label>
        <button class="btn btn--gold btn--sm" type="submit">Create the link</button>
      </form>
      <p class="hub-hint"><strong>The draw is yours.</strong> Its rules, who may enter, the prize
        and picking the winner are all yours to set and to run — Discover Saint Lucia WELL is not
        the sponsor and takes no part in it. Entrants are told that in the words they agree to
        when they share.</p>`;

  return collapse
    ? `<details class="hub-card hub-create"><summary>Start another draw</summary>${inner}</details>`
    : `<section class="hub-card"><h2>Start a draw</h2>${inner}</section>`;
}

const form = (id, action, label) => `<form method="POST" class="hub-action">
    <input type="hidden" name="action" value="${esc(action)}">
    <input type="hidden" name="id" value="${esc(id)}">
    <button class="btn btn--ghost btn--sm" type="submit">${esc(label)}</button>
  </form>`;

/* ── Actions ─────────────────────────────────────────────────────────────── */
async function act(advisor, f) {
  const what = str(f.action, 20);
  const id = str(f.id, 64);

  switch (what) {
    case 'create': {
      const r = await create(advisor.id, str(f.name, NAME_MAX));
      return r.ok ? 'created' : r.error;
    }
    case 'rename': {
      const r = await rename(advisor.id, id, str(f.name, NAME_MAX));
      return r.ok ? 'renamed' : r.error;
    }
    case 'close':
    case 'reopen': {
      const r = await setStatus(advisor.id, id, what === 'close' ? 'closed' : OPEN);
      return r.ok ? (what === 'close' ? 'closed' : 'reopened') : r.error;
    }
    case 'delete': {
      const r = await remove(advisor.id, id);
      return r.ok ? 'deleted' : r.error;
    }
    default:
      return 'unknown_action';
  }
}

const DONE_MESSAGE = {
  created: 'Created. Give out the link below — entries start counting straight away.',
  renamed: 'Renamed. Only you see the name.',
  closed: 'Closed. Nothing new will be counted, and the link still works as your ordinary WELL link.',
  reopened: 'Open again. New shares through that link will be counted.',
  deleted: 'Deleted.',
  name_required: 'Give it a name first.',
  has_entries: 'People have entered that one, so it cannot be deleted — closing it is what you want. ' +
    'Their Journeys are real and stay yours either way.',
  not_found: 'That draw no longer exists.',
  readonly: 'Nothing was changed — you are viewing this Hub, not signed in as its owner.',
  failed: 'That did not work. If it keeps failing, tell us rather than working around it.'
};
