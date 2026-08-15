/* ============================================================================
   /hub/admin — the ecosystem dashboard
   ----------------------------------------------------------------------------
   HONEST AT ELEVEN ADVISORS. Percentages and trend lines over a population this
   small are noise wearing a suit: one advisor joining moves a conversion rate
   by nine points and means nothing. So this shows counts, and exactly one
   derived number — Journeys sitting unanswered past 48 hours — because that is
   the failure the whole product exists to prevent, and it is the only figure
   that earns large type.

   Rates appear only once there is enough underneath them to mean something,
   and say so plainly until then. Same discipline as the advisor's own Home.
   ========================================================================== */
'use strict';

const { requireAdmin } = require('../auth.js');
const { hubPage, esc, pageHead, emptyState, since, STAGE_LABEL, STAGES } = require('../hub-render.js');
const {
  allAdvisors, funnelAll, pipelineAll, auditLog, retentionStatus, STALE_HOURS, ACTION_LABEL
} = require('../admin-data.js');

/* Below this, a percentage is a story about three people. */
const RATE_THRESHOLD = 30;

module.exports = async function handler(req, res) {
  const admin = await requireAdmin(req, res, '/hub/admin');
  if (!admin) return;

  const [advisors, funnel, pipeline, recent, retention] = await Promise.all([
    allAdvisors(), funnelAll(), pipelineAll(), auditLog({ limit: 6 }), retentionStatus()
  ]);

  const pending = advisors.filter((a) => a.status === 'pending');
  const active = advisors.filter((a) => a.status === 'active');
  const paused = advisors.filter((a) => a.status === 'paused');
  const waiting = advisors.filter((a) => a.waiting > 0);

  const body = `<div class="hub-main">
  <div class="wrap">

    ${pageHead('Admin', 'The ecosystem', 'Everything across every advisor.')}

    ${pending.length ? `
    <section class="hub-nba">
      <p class="eyebrow eyebrow--gold">Waiting on you</p>
      <h2>${pending.length === 1
        ? 'One advisor is waiting to be approved.'
        : `${pending.length} advisors are waiting to be approved.`}</h2>
      <p>Until you confirm them, consumers are not offered the option to share a
        Journey with them — they have a Hub and a link, and nothing arrives.</p>
      <a class="btn btn--gold" href="/hub/admin/advisors?view=pending">Review them</a>
    </section>` : ''}

    <section class="hub-section">
      <h2>Advisors</h2>
      <div class="hub-funnel">
        ${stat(advisors.length, 'Total', 'registered accounts')}
        ${stat(active.length, 'Active', 'can receive Journeys')}
        ${stat(pending.length, 'Pending', 'awaiting approval')}
        ${stat(paused.length, 'Paused', 'not offered to consumers')}
      </div>
      <p class="hub-more"><a href="/hub/admin/advisors">See all advisors</a></p>
    </section>

    <section class="hub-section">
      <h2>Journeys</h2>
      ${pipeline.total ? `
      <div class="hub-funnel">
        ${STAGES.map((s) => stat(pipeline.byStage[s] || 0, STAGE_LABEL[s], '')).join('')}
      </div>

      ${pipeline.stale ? `
      <div class="hub-notice">
        <strong>${pipeline.stale} ${pipeline.stale === 1 ? 'Journey has' : 'Journeys have'}
        been sitting at New for more than ${STALE_HOURS} hours.</strong>
        Someone shared their details and has heard nothing.
        ${waiting.length ? `Across ${waiting.length} ${waiting.length === 1 ? 'advisor' : 'advisors'}:
          ${waiting.map((a) => `<a href="/hub/admin/advisors/${esc(a.id)}">${esc(a.first_name)} ${esc(a.last_name)}</a>`).join(', ')}.` : ''}
      </div>` : `
      <p class="hub-hint">Nothing has been sitting unanswered for more than ${STALE_HOURS} hours.</p>`}

      ${pipeline.unassigned ? `
      <p class="hub-hint">${pipeline.unassigned} ${pipeline.unassigned === 1 ? 'Journey is' : 'Journeys are'}
        unassigned — shared through a link whose advisor was unknown or paused. They were kept
        rather than dropped, but nobody is looking after them.</p>` : ''}
      ` : emptyState('No Journeys yet.',
          'Nothing has been shared with any advisor.',
          { label: 'See all advisors', href: '/hub/admin/advisors' })}
    </section>

    <section class="hub-section">
      <h2>Reach</h2>
      <div class="hub-funnel">
        ${stat(funnel.visits, 'Visits', 'arrived through an advisor link')}
        ${stat(funnel.completions, 'Finder completions', 'finished the Finder')}
        ${stat(funnel.shares, 'Journeys shared', 'chose to share')}
      </div>
      ${/* The one place a rate would be tempting, and the one place it would
            lie hardest at this size. */''}
      <p class="hub-hint">${funnel.visits >= RATE_THRESHOLD
        ? `${Math.round((funnel.completions / funnel.visits) * 100)}% of visits finish the Finder, and ` +
          `${funnel.completions ? Math.round((funnel.shares / funnel.completions) * 100) : 0}% of those are shared.`
        : `Not enough traffic yet to quote a rate honestly — percentages need about ${RATE_THRESHOLD} visits before they mean anything.`}</p>
    </section>

    <section class="hub-section">
      <h2>Data we hold</h2>
      <p class="hub-hint">Somebody writes in asking what you have about them, or asks you to
        delete it. The Privacy Policy promises an answer within 30 days.</p>
      <p class="hub-more"><a href="/hub/admin/subject">Answer a privacy request →</a></p>

      ${retention.months === null ? `
      <p class="hub-hint hub-hint--bad">Retention is not configured — migration 006 has not been
        applied, so nothing expires and §12 of the policy is not true yet.</p>`
      : `
      <p class="hub-hint${retention.overdue ? ' hub-hint--bad' : ''}">
        Journeys are kept ${retention.months} months, then deleted automatically.
        ${retention.oldest
          ? `The oldest is <strong>${Math.floor(retention.oldestDays / 30.44)} months</strong> old.`
          : 'There are none held.'}
        ${retention.overdue
          ? ' <strong>That is past the limit, so the purge is not running.</strong> Check the pg_cron job — until it is fixed, the retention promise is words.'
          : ''}
        ${!retention.scheduled
          ? ' <strong>No purge has ever run.</strong> Expected right after the migration; a problem if it persists past tomorrow.'
          : ` Last swept ${esc(since(retention.lastRun))}.`}
      </p>`}
    </section>

    <section class="hub-section">
      <h2>Recent admin activity</h2>
      ${recent.length
        ? `<ul class="hub-journeys">${recent.map(auditRow).join('')}</ul>
           <p class="hub-more"><a href="/hub/admin/audit">Full audit log</a></p>`
        : '<p class="hub-hint">Nothing recorded yet. Every approval, pause, lock and reset lands here.</p>'}
    </section>

  </div>
</div>`;

  hubPage(res, { path: '/hub/admin', title: 'Admin', advisor: admin, body });
};

function stat(n, label, note) {
  return `<div class="hub-stat">
    <span class="hub-stat-n">${n}</span>
    <span class="hub-stat-label">${esc(label)}</span>
    ${note ? `<span class="hub-stat-note">${esc(note)}</span>` : ''}
  </div>`;
}

function auditRow(r) {
  return `<li class="hub-journey">
    <span class="hub-journey-name">${esc(ACTION_LABEL[r.action] || r.action)}</span>
    <span class="hub-journey-meta">
      <span>${esc(r.subject_label || '—')}</span>
      <span>${esc(r.admin_email || 'unknown')}</span>
      <span>${esc(new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' '))}</span>
    </span>
  </li>`;
}

