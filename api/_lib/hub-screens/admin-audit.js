/* ============================================================================
   /hub/admin/audit — what staff have done
   ----------------------------------------------------------------------------
   Read-only, and there is no delete. An audit trail an administrator can edit
   is a diary, not a record.

   Rows keep the admin's email and the subject's name verbatim alongside the
   foreign keys, so an entry still reads sensibly after the account it refers to
   has been removed — "someone did something to someone" is not an audit row.
   ========================================================================== */
'use strict';

const { requireAdmin } = require('../auth.js');
const { hubPage, esc, pageHead, emptyState } = require('../hub-render.js');
const { auditLog, ACTION_LABEL } = require('../admin-data.js');

module.exports = async function handler(req, res) {
  const admin = await requireAdmin(req, res, '/hub/admin/audit');
  if (!admin) return;

  const rows = await auditLog({ limit: 200 });

  const body = `<div class="hub-main">
  <div class="wrap">

    <p class="hub-back"><a href="/hub/admin">← Admin</a></p>

    ${pageHead('Admin', 'Audit log',
      'Every approval, pause, lock and reset link, with who did it.')}

    ${rows.length ? `
    <ul class="hub-journeys">
      ${rows.map((r) => `<li class="hub-journey">
        <span class="hub-journey-name">${esc(ACTION_LABEL[r.action] || r.action)}</span>
        <span class="hub-journey-meta">
          <span>${esc(when(r.created_at))}</span>
        </span>
        <span class="hub-journey-villages">${esc(r.subject_label || '—')}
          &nbsp;·&nbsp; by ${esc(r.admin_email || 'unknown')}</span>
      </li>`).join('')}
    </ul>
    <p class="hub-hint">Showing the most recent ${rows.length}. Nothing here can be edited or
      removed through this console.</p>`
      : emptyState('Nothing recorded yet.',
          'Approvals, pauses, locks and reset links all land here as they happen.',
          { label: 'Advisors', href: '/hub/admin/advisors' })}

  </div>
</div>`;

  hubPage(res, { path: '/hub/admin', title: 'Audit log', advisor: admin, body });
};

/* Absolute, not relative. "3 days ago" is the right register for an advisor
   glancing at their pipeline and the wrong one for a record of who did what. */
const when = (iso) => new Date(iso).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
