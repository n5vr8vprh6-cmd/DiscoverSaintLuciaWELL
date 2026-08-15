/* ============================================================================
   /hub/admin/advisors/:id — one advisor, and everything staff can do to them
   ----------------------------------------------------------------------------
   GET renders. POST performs one action and redirects back
   (POST/redirect/GET), so a refresh never repeats an approval.

   FOUR LEVERS, AND THEY ARE NOT THE SAME LEVER:

     Approve   status -> active.  Consumers may now share with them.
     Pause     status -> paused.  Not offered to consumers. STILL SIGNS IN and
                                  still works the Journeys they already hold.
     Lock      Supabase Auth ban. CANNOT SIGN IN AT ALL. Nothing to do with
                                  whether they are offered.
     Reset     Sends them a link to choose a new password themselves.

   Pause and Lock get told apart in the interface because conflating them is
   how someone gets locked out when the intent was to stop new referrals.

   NO ADMIN EVER SETS A PASSWORD. There is one code path in this system that
   sets a credential and it is the advisor's own reset flow.
   ========================================================================== */
'use strict';

const { requireAdmin, setViewAs, VIEWAS_MINUTES } = require('../auth.js');
const { str, body: parseBody } = require('../core.js');
const { hubPage, esc, emptyState, since } = require('../hub-render.js');
const {
  advisorById, auditLog, audit, updateAdvisor, ACTION_LABEL
} = require('../admin-data.js');
const { setLocked, recoveryLink, isLocked } = require('../auth-admin.js');
const { journeysFor, funnelFor } = require('../hub-data.js');
const { deleteAdvisor, deletionImpact, setRole, sendInvite } = require('../admin-people.js');
const { track } = require('../encharge.js');
const { allAdvisors } = require('../admin-data.js');

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.discoversaintluciawell.com';

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'https://x');
  const id = str(url.searchParams.get('id'), 64);

  const admin = await requireAdmin(req, res,
    id ? `/hub/admin/advisors/${encodeURIComponent(id)}` : '/hub/admin/advisors');
  if (!admin) return;
  if (!id) return notFound(res, admin);

  if (req.method === 'POST') {
    /* Entering view-as sets a cookie, so it is handled here rather than in
       act(), which only returns a status string. */
    if (str((parseBody(req) || {}).action, 20) === 'viewas') {
      const target = await advisorById(id);
      if (target && target.id !== admin.id) {
        await audit(admin, 'view_as_start', { subject: target });
        setViewAs(res, target.id);
        res.statusCode = 303;
        res.setHeader('Location', '/hub');
        return res.end();
      }
      res.statusCode = 303;
      res.setHeader('Location', `/hub/admin/advisors/${encodeURIComponent(id)}?done=refused_self`);
      return res.end();
    }

    const result = await act(admin, id, parseBody(req) || {});
    res.statusCode = 303;
    /* A successful delete has nowhere to go back to. */
    res.setHeader('Location', result === 'deleted'
      ? '/hub/admin/advisors?done=deleted'
      : `/hub/admin/advisors/${encodeURIComponent(id)}?done=${encodeURIComponent(result)}`);
    return res.end();
  }

  const advisor = await advisorById(id);
  if (!advisor) return notFound(res, admin);

  const [journeys, funnel, history, locked, everyone] = await Promise.all([
    journeysFor(advisor.id, { limit: 50 }),
    funnelFor(advisor.id),
    auditLog({ advisorId: advisor.id, limit: 20 }),
    isLocked(advisor.auth_user_id),
    allAdvisors()
  ]);
  const adminCount = everyone.filter((a) => a.role === 'admin').length;

  const done = str(url.searchParams.get('done'), 80);
  const name = `${advisor.first_name || ''} ${advisor.last_name || ''}`.trim() || '(no name)';
  const isSelf = advisor.id === admin.id;

  const body = `<div class="hub-main hub-main--detail">
  <div class="wrap">

    <p class="hub-back"><a href="/hub/admin/advisors">← Advisors</a></p>

    ${done ? `<p class="hub-flash${/failed|refused|not_/.test(done) ? ' hub-flash--bad' : ''}">${
      esc(DONE_MESSAGE[done] || done)}</p>` : ''}

    <header class="hub-detail-head">
      <p class="eyebrow">${esc(advisor.public_code || '')}${
        advisor.approved_at ? ' · approved ' + esc(since(advisor.approved_at)) : ''}</p>
      <h1>${esc(name)}</h1>
      <p class="hub-contact">
        <span>${esc(advisor.email)}</span>
        ${advisor.phone ? `<span>${esc(advisor.phone)}</span>` : ''}
        <span class="hub-stage" data-stage="${statusStage(advisor.status)}">${esc(cap(advisor.status))}</span>
        ${locked ? '<span class="hub-tag" data-tag="locked">Locked out</span>' : ''}
        ${advisor.role === 'admin' ? '<span class="hub-tag" data-tag="admin">Admin</span>' : ''}
        ${advisor.is_master ? '<span class="hub-tag" data-tag="admin">Master</span>' : ''}
        ${/^SEED/.test(advisor.public_code || '') ? '<span class="hub-tag" data-tag="test">Test</span>' : ''}
      </p>
      <div class="hub-actions">
        <a class="btn btn--gold" href="mailto:${esc(advisor.email)}?subject=${
          encodeURIComponent('About your Saint Lucia WELL Advisor Hub')}">Email ${esc(advisor.first_name || '')}</a>
      </div>
    </header>

    <div class="hub-detail-grid">
      <div class="hub-detail-main">

        <section class="hub-card">
          <h2>Who they say they are</h2>
          <dl class="hub-answers">
            ${field('Business', advisor.business)}
            ${field('Host agency', advisor.host_agency)}
            ${field('Website', advisor.website)}
            ${field('Market', advisor.market)}
            ${field('Registered', new Date(advisor.created_at).toISOString().slice(0, 10))}
          </dl>
          ${advisor.registration_note ? `
          <figure class="hub-quote">
            <blockquote>${esc(advisor.registration_note)}</blockquote>
            <figcaption>What they wrote when registering</figcaption>
          </figure>` : `
          <p class="hub-hint">They did not say how they found us. If you do not recognise them,
            the email button above is the point of this screen.</p>`}
        </section>

        <section class="hub-card">
          <h2>Their campaign</h2>
          <div class="hub-funnel">
            ${stat(funnel.visits, 'Visits')}
            ${stat(funnel.completions, 'Completions')}
            ${stat(funnel.shares, 'Journeys')}
          </div>
          <p class="hub-hint">Their link: ${esc(SITE_ORIGIN)}/well/${esc(advisor.public_code || '')}</p>
        </section>

        <section class="hub-card">
          <h2>Their Journeys</h2>
          ${journeys.length
            ? `<ul class="hub-journeys">${journeys.slice(0, 10).map(journeyRow).join('')}</ul>
               <p class="hub-hint">Consumer details are shown here because you are staff of the
                 controller that holds them. Viewing another advisor's Hub as them — with these
                 details masked — is a separate feature, deliberately.</p>`
            : '<p class="hub-hint">Nobody has shared a Journey with them yet.</p>'}
        </section>

        <section class="hub-card">
          <h2>History</h2>
          ${history.length
            ? `<ul class="hub-notes">${history.map((h) => `<li>
                <p>${esc(ACTION_LABEL[h.action] || h.action)} — ${esc(h.admin_email || 'unknown')}</p>
                <span class="hub-note-when">${esc(since(h.created_at))}</span>
              </li>`).join('')}</ul>`
            : '<p class="hub-hint">Nothing has been done to this account yet.</p>'}
        </section>

      </div>

      <aside class="hub-detail-side">
        ${isSelf ? `
        <section class="hub-card">
          <h2>This is you</h2>
          <p class="hub-hint">Actions that would lock you out of your own console are not offered
            here. Change your own details in <a href="/hub/account">account settings</a>.</p>
        </section>` : `
        <section class="hub-card">
          <h2>Approval</h2>
          ${advisor.status === 'pending' ? `
            <p class="hub-hint">Consumers cannot share a Journey with them until you approve.</p>
            ${action('approve', 'Approve', 'btn--gold')}
          ` : advisor.status === 'active' ? `
            <p class="hub-hint">Active. They are offered to consumers who arrive through their link.</p>
            ${action('pause', 'Pause')}
          ` : `
            <p class="hub-hint">Paused. They keep their Hub and their existing Journeys, but are
              not offered to anyone new.</p>
            ${action('unpause', 'Make active', 'btn--gold')}
          `}
        </section>

        <section class="hub-card">
          <h2>Access</h2>
          ${advisor.is_master ? `
            <p class="hub-hint">This is the master admin. It cannot be locked, demoted or deleted —
              by this console or by anything else. The database refuses it.</p>
          ` : `
            <p class="hub-hint">${locked
              ? 'They cannot sign in at all. This is separate from approval.'
              : 'Locking blocks sign-in entirely. To stop new referrals without locking them out, use Pause.'}</p>
            ${action(locked ? 'unlock' : 'lock', locked ? 'Unlock sign-in' : 'Lock sign-in')}
          `}
        </section>

        <section class="hub-card">
          <h2>Password</h2>
          <p class="hub-hint">Sends them a link to choose a new one. You never see or set it.</p>
          ${action('reset', 'Send a reset link')}
        </section>

        <section class="hub-card">
          <h2>Support</h2>
          <p class="hub-hint">Opens their Hub exactly as they see it — read-only, with their
            clients' names and contact details hidden. Revealing any of them is recorded, as is
            starting and stopping. Ends by itself after ${VIEWAS_MINUTES} minutes.</p>
          ${action('viewas', 'View their Hub')}
        </section>

        <section class="hub-card">
          <h2>Role</h2>
          ${advisor.is_master ? `
            <p class="hub-hint">The master admin's role cannot be changed.</p>
          ` : advisor.role === 'admin' ? `
            <p class="hub-hint">An admin sees every advisor and every Journey in the system.</p>
            ${adminCount <= 1
              ? '<p class="hub-hint">This is the only admin left. Promote somebody else before removing it.</p>'
              : action('demote', 'Remove admin')}
          ` : `
            <p class="hub-hint">Admins see every advisor and every Journey in the system, including
              consumers' contact details. Give it sparingly.</p>
            ${action('promote', 'Make an admin')}
          `}
        </section>

        ${dangerZone(advisor, journeys.length, everyone)}`}
      </aside>
    </div>

  </div>
</div>`;

  hubPage(res, { path: '/hub/admin', title: name, advisor: admin, body });
};

/* ── Deletion ─────────────────────────────────────────────────────────────
   The one irreversible control, so it is the one that argues with you.

   If the advisor holds Journeys, deleting them would set `advisor_id` to null
   on real people's contact details and wellbeing answers — the foreign keys are
   ON DELETE SET NULL — leaving that data in the table with nobody responsible
   for it. So the screen refuses to offer a plain delete, and makes the choice
   explicit instead: move the Journeys to somebody, or destroy them.

   Both paths require typing the advisor's public code. Not because typing is a
   security control, but because it forces a second look at WHICH account is
   about to go. */
function dangerZone(advisor, journeyCount, everyone) {
  if (advisor.is_master) {
    return `<section class="hub-card">
      <h2>Deletion</h2>
      <p class="hub-hint">The master admin cannot be deleted. The database refuses it, not just
        this screen — so no script or SQL editor can do it either.</p>
    </section>`;
  }

  const others = everyone
    .filter((a) => a.id !== advisor.id && a.status === 'active')
    .map((a) => `<option value="${esc(a.id)}">${esc(a.first_name + ' ' + a.last_name)} — ${esc(a.email)}</option>`)
    .join('');

  const confirmField = `<label class="hub-field hub-field--wide">
      <span class="hub-field-label">Type ${esc(advisor.public_code)} to confirm</span>
      <input name="confirm" autocomplete="off" placeholder="${esc(advisor.public_code)}" required>
    </label>`;

  if (!journeyCount) {
    return `<section class="hub-card hub-danger">
      <h2>Delete</h2>
      <p class="hub-hint">Removes the advisor and their sign-in. They hold no Journeys, so nothing
        belonging to a consumer is affected. This cannot be undone.</p>
      <form method="POST">
        <input type="hidden" name="action" value="delete">
        ${confirmField}
        <button class="btn btn--ghost btn--sm" type="submit">Delete this advisor</button>
      </form>
    </section>`;
  }

  return `<section class="hub-card hub-danger">
    <h2>Delete</h2>
    <p class="hub-hint"><strong>They hold ${journeyCount} ${journeyCount === 1 ? 'Journey' : 'Journeys'}.</strong>
      Each one is a real person who agreed to share their details with this advisor by name.
      Deleting the account would leave that data with nobody responsible for it, so you have to
      say what happens to it.</p>

    <p class="hub-hint">Pausing or locking is usually the right answer instead — both are above,
      and neither touches the Journeys.</p>

    <form method="POST">
      <input type="hidden" name="action" value="delete">
      <input type="hidden" name="disposition" value="transfer">
      <label class="hub-field hub-field--wide">
        <span class="hub-field-label">Move their Journeys to</span>
        <select name="transferTo" required>
          <option value="">Choose an advisor…</option>
          ${others}
        </select>
        <span class="hub-hint">A transfer discloses those consumers' details to another advisor.
          It is recorded separately in the audit log.</span>
      </label>
      ${confirmField}
      <button class="btn btn--ghost btn--sm" type="submit">Transfer, then delete</button>
    </form>

    <form method="POST" class="hub-erase">
      <input type="hidden" name="action" value="delete">
      <input type="hidden" name="disposition" value="erase">
      <p class="hub-hint"><strong>Or erase them.</strong> This destroys ${journeyCount}
        ${journeyCount === 1 ? 'Journey' : 'Journeys'} and the consent record attached to each.
        There is no way to get them back.</p>
      <label class="hub-stage-opt">
        <input type="checkbox" name="understood" value="yes" required>
        <span>I understand this destroys consent evidence</span>
      </label>
      ${confirmField}
      <button class="btn btn--ghost btn--sm" type="submit">Erase the Journeys and delete</button>
    </form>
  </section>`;
}

/* ── The actions ─────────────────────────────────────────────────────────── */
async function act(admin, id, form) {
  const what = str(form.action, 20);
  const target = await advisorById(id);
  if (!target) return 'not_found';

  /* An admin cannot act on their own account here. Approving yourself is
     meaningless; locking yourself out of the console is a footgun with no
     recovery path short of SQL. */
  if (target.id === admin.id) return 'refused_self';

  switch (what) {
    case 'approve': {
      const r = await updateAdvisor(id, {
        status: 'active', approved_at: new Date().toISOString(), approved_by: admin.id
      });
      if (!r.ok) return 'failed';
      await audit(admin, 'approve', { subject: target });
      /* The moment their link starts working is the moment worth an email, so
         this is the event the "you are live" sequence hangs off. Fired with the
         UPDATED row so Encharge sees status=active, not the stale pending. */
      await track('advisor_activated', r.advisor || target, { approvedBy: admin.email });
      return 'approved';
    }
    case 'pause': {
      const r = await updateAdvisor(id, { status: 'paused' });
      if (!r.ok) return 'failed';
      await audit(admin, 'pause', { subject: target });
      return 'paused';
    }
    case 'unpause': {
      const r = await updateAdvisor(id, { status: 'active' });
      if (!r.ok) return 'failed';
      await audit(admin, 'unpause', { subject: target });
      return 'activated';
    }
    case 'lock':
    case 'unlock': {
      const lock = what === 'lock';
      /* The database refuses this for the master too, but the auth ban lives in
         Supabase Auth, outside the reach of that trigger — so it is checked
         here as well. Two guards, because they cover different ground. */
      if (target.is_master) return 'refused_master';
      const r = await setLocked(target.auth_user_id, lock);
      if (!r.ok) return 'failed';
      await updateAdvisor(id, { locked_at: lock ? new Date().toISOString() : null });
      await audit(admin, lock ? 'lock' : 'unlock', { subject: target });
      return lock ? 'locked' : 'unlocked';
    }
    case 'reset': {
      const r = await recoveryLink(target.email, SITE_ORIGIN + '/hub/reset');
      if (!r.ok) return 'failed';
      /* Refuse to send a link that Supabase has quietly repointed somewhere
         else — see api/_lib/auth-admin.js. Emailing a real person a link that
         lands on the wrong domain is worse than telling the admin it is
         misconfigured. */
      if (!r.honoured) return 'redirect_unconfigured';
      const sent = await sendReset(target, r.link);
      if (!sent) return 'email_failed';
      await audit(admin, 'reset_sent', { subject: target });
      return 'reset_sent';
    }
    case 'promote':
    case 'demote': {
      const r = await setRole(admin, id, what === 'promote' ? 'admin' : 'advisor');
      if (!r.ok) return r.error;
      return what === 'promote' ? 'promoted' : 'demoted';
    }

    case 'delete': {
      /* The typed code is checked against the row we just read, not against
         anything the form supplied — a stale page cannot authorise the deletion
         of an account other than the one it was showing. */
      if (str(form.confirm, 20).toUpperCase() !== String(target.public_code || '').toUpperCase()) {
        return 'confirm_mismatch';
      }

      const disposition = str(form.disposition, 20) || 'refuse';
      if (disposition === 'erase' && str(form.understood, 8) !== 'yes') return 'not_understood';

      /* Re-read the impact at the moment of deletion. The preview may be
         minutes old, and a Journey could have arrived since — in which case a
         plain delete would silently orphan it. */
      const impact = await deletionImpact(id);
      if (!impact) return 'not_found';
      if (impact.journeys > 0 && disposition === 'refuse') return 'has_journeys';

      const r = await deleteAdvisor(admin, id, {
        disposition,
        transferTo: str(form.transferTo, 64)
      });
      if (!r.ok) return r.error;
      return 'deleted';
    }

    default:
      return 'unknown_action';
  }
}

/* Delivered by Resend, not Supabase. Supabase's generate_link only generates,
   and this project's Supabase custom SMTP is failing — routing it through the
   channel that is proven to work means this feature does not inherit that. */
async function sendReset(advisor, link) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  if (!key || !from) return false;
  try {
    const { Resend } = require('resend');
    const { error } = await new Resend(key).emails.send({
      from,
      to: advisor.email,
      subject: 'Set a new password for your Saint Lucia WELL Hub',
      html:
        `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#133239">` +
        `<p style="margin:0 0 1.2em">${esc(advisor.first_name || 'Hello')},</p>` +
        `<p style="margin:0 0 1.4em">Someone at Saint Lucia WELL has sent you a link to set a new ` +
        `password for your Advisor Hub. If you did not expect this, you can ignore it — ` +
        `your current password still works until you use the link.</p>` +
        `<p style="margin:0 0 1.4em"><a href="${esc(link)}" style="display:inline-block;` +
        `background:#E89A12;color:#133239;text-decoration:none;font-weight:600;padding:11px 20px;` +
        `border-radius:2px">Choose a new password</a></p>` +
        `<p style="margin:0;color:#5c6b68;font-size:13px">The link works once and expires.</p></div>`
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('admin reset email failed', e);
    return false;
  }
}

/* ── Bits ────────────────────────────────────────────────────────────────── */
function action(name, label, variant) {
  return `<form method="POST" class="hub-action">
    <input type="hidden" name="action" value="${esc(name)}">
    <button class="btn ${variant || 'btn--ghost'} btn--sm" type="submit">${esc(label)}</button>
  </form>`;
}

const field = (label, value) => value ? `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>` : '';
const stat = (n, label) => `<div class="hub-stat">
    <span class="hub-stat-n">${n}</span><span class="hub-stat-label">${esc(label)}</span>
  </div>`;

function journeyRow(j) {
  const n = `${j.consumer_first || ''} ${j.consumer_last || ''}`.trim() || 'Someone';
  return `<li class="hub-journey">
    <span class="hub-journey-name">${esc(n)}</span>
    <span class="hub-journey-meta">
      <span class="hub-stage" data-stage="${esc(j.stage)}">${esc(j.stage)}</span>
      <span>${esc(since(j.created_at))}</span>
    </span>
  </li>`;
}

const DONE_MESSAGE = {
  approved: 'Approved. Consumers can now share a Journey with them.',
  paused: 'Paused. They keep their Hub; they are no longer offered to consumers.',
  activated: 'Active again.',
  locked: 'Locked. They cannot sign in.',
  unlocked: 'Unlocked. They can sign in again.',
  reset_sent: 'Reset link sent.',
  created_invited: 'Account created, and they have been emailed a link to set a password.',
  created_quiet: 'Account created. They have not been emailed — send a reset link when you are ready.',
  promoted: 'They are now an admin.',
  demoted: 'They are no longer an admin.',
  refused_self: 'That action is not available on your own account.',
  refused_master: 'Not available on the master admin.',
  refused_last_admin: 'That would leave nobody with admin access. Promote somebody else first.',
  confirm_mismatch: 'The code did not match, so nothing was deleted.',
  not_understood: 'Erasing Journeys needs the confirmation box ticked.',
  has_journeys: 'They hold Journeys. Choose what happens to those first.',
  transfer_target_required: 'Choose an advisor to move the Journeys to.',
  transfer_target_missing: 'That advisor no longer exists.',
  redirect_unconfigured: 'Not sent — Supabase has no redirect URL configured for /hub/reset, ' +
    'so the link would land on the wrong domain. Add it under Authentication → URL Configuration.',
  email_failed: 'The link was generated but the email did not send.',
  not_found: 'That advisor no longer exists.',
  failed: 'That did not work. The database refused it — check the logs.'
};

function notFound(res, admin) {
  hubPage(res, {
    path: '/hub/admin', title: 'Not found', advisor: admin, status: 404,
    body: `<div class="hub-main"><div class="wrap">${emptyState(
      'No such advisor.', 'It may have been removed.',
      { label: 'All advisors', href: '/hub/admin/advisors' })}</div></div>`
  });
}

const statusStage = (s) => ({ pending: 'new', active: 'booked', paused: 'closed' }[s] || 'closed');
const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
