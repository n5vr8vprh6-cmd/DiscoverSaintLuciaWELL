/* ============================================================================
   ADMIN DATA — reads and writes that span every advisor
   ----------------------------------------------------------------------------
   The sibling of hub-data.js, and the difference is the whole point.

   hub-data.js is scoped to ONE advisor by construction: every query carries an
   advisor_id, and its header says so. This file is deliberately unscoped, which
   is exactly why every function here must only ever be reached through
   requireAdmin(). The names are chosen so the difference is visible at the call
   site — funnelFor(advisorId) against funnelAll().

   NOTHING HERE CHECKS PERMISSION. It cannot: it has no request. The guard lives
   in the screens, and there is one guard, in one place, in auth.js.

   ON AGGREGATION IN JAVASCRIPT
   Counts are computed by pulling the rows and reducing them, not by issuing a
   count query per advisor. With eleven advisors and nine Journeys that is one
   round trip instead of thirty-three. It is the right trade at this size and
   the wrong one at a thousand advisors, at which point these become SQL views
   or an rpc. Written down so the reason to change it is known in advance.
   ========================================================================== */
'use strict';

const { db } = require('./core.js');
const { STAGES } = require('./hub-render.js');

/* Journeys sitting unanswered past this point are the number the dashboard
   exists to surface. Two days is long enough to be a real weekend and short
   enough that acting still matters. */
const STALE_HOURS = 48;

/* ── Reads ───────────────────────────────────────────────────────────────── */

/* Every advisor, each with the counts the list view shows. */
async function allAdvisors() {
  const supabase = db();
  if (!supabase) return [];

  const [advisors, shares, visits, comps] = await Promise.all([
    supabase.from('advisors')
      .select('id, first_name, last_name, email, business, host_agency, website, market, ' +
              'public_code, slug, status, role, is_master, approved_at, locked_at, ' +
              'registration_note, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('journey_shares').select('advisor_id, stage, created_at'),
    supabase.from('campaign_visits').select('advisor_id'),
    supabase.from('finder_completions').select('advisor_id')
  ]);

  if (advisors.error) { console.error('allAdvisors', advisors.error); return []; }

  const tally = (rows, key) => (rows.data || []).reduce((acc, r) => {
    if (r[key]) acc[r[key]] = (acc[r[key]] || 0) + 1;
    return acc;
  }, {});

  const shareCount = tally(shares, 'advisor_id');
  const visitCount = tally(visits, 'advisor_id');
  const compCount = tally(comps, 'advisor_id');

  const stale = (shares.data || []).reduce((acc, s) => {
    if (s.stage === 'new' && hoursSince(s.created_at) > STALE_HOURS) {
      acc[s.advisor_id] = (acc[s.advisor_id] || 0) + 1;
    }
    return acc;
  }, {});

  return (advisors.data || []).map((a) => Object.assign({}, a, {
    journeys: shareCount[a.id] || 0,
    visits: visitCount[a.id] || 0,
    completions: compCount[a.id] || 0,
    waiting: stale[a.id] || 0,
    /* Seeded fixtures are shown, not hidden — the console must not describe a
       database different from the one it is reading. See tools/seed-advisors.js. */
    isTest: /^SEED/.test(a.public_code || '')
  }));
}

/* One advisor, unscoped — the admin detail screen. */
async function advisorById(id) {
  const supabase = db();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('advisors')
    .select('id, first_name, last_name, email, business, host_agency, phone, website, market, ' +
            'public_code, slug, status, role, is_master, approved_at, approved_by, locked_at, ' +
            'registration_note, onboarding_state, auth_user_id, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) { console.error('advisorById', error); return null; }
  return data;
}

/* The platform view. Same shape as funnelFor() in hub-data.js, without the
   advisor scope — deliberately a separate function rather than an optional
   argument, so an unscoped read can never happen by forgetting one. */
async function funnelAll() {
  const supabase = db();
  if (!supabase) return { visits: 0, completions: 0, shares: 0 };
  const count = async (table) => {
    const { count: n } = await supabase.from(table).select('id', { count: 'exact', head: true });
    return n || 0;
  };
  const [visits, completions, shares] = await Promise.all([
    count('campaign_visits'), count('finder_completions'), count('journey_shares')
  ]);
  return { visits, completions, shares };
}

/* Journeys by stage, plus the one derived number worth putting in large type. */
async function pipelineAll() {
  const supabase = db();
  if (!supabase) return { byStage: {}, total: 0, stale: 0, unassigned: 0 };
  const { data, error } = await supabase
    .from('journey_shares').select('id, stage, advisor_id, created_at');
  if (error) { console.error('pipelineAll', error); return { byStage: {}, total: 0, stale: 0, unassigned: 0 }; }

  const rows = data || [];
  const byStage = {};
  STAGES.forEach((s) => { byStage[s] = 0; });
  rows.forEach((r) => { if (r.stage in byStage) byStage[r.stage]++; });

  return {
    byStage,
    total: rows.length,
    stale: rows.filter((r) => r.stage === 'new' && hoursSince(r.created_at) > STALE_HOURS).length,
    /* A Journey with no advisor is one a consumer shared through a link whose
       advisor was unknown or paused. It is not an error — api/share.js records
       it deliberately rather than dropping someone who raised their hand — but
       nobody is looking after it, so somebody should know it exists. */
    unassigned: rows.filter((r) => !r.advisor_id).length
  };
}

async function auditLog({ limit = 100, advisorId } = {}) {
  const supabase = db();
  if (!supabase) return [];
  let q = supabase.from('admin_audit')
    .select('id, admin_email, action, subject_advisor_id, subject_label, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (advisorId) q = q.eq('subject_advisor_id', advisorId);
  const { data, error } = await q;
  if (error) { console.error('auditLog', error); return []; }
  return data || [];
}

/* ── Writes ──────────────────────────────────────────────────────────────── */

/* Every administrative action goes through here. Email and label are stored
   verbatim alongside the ids so the record still reads sensibly after the
   account it refers to has been deleted — an audit row that becomes
   "someone did something to someone" is not an audit row. */
async function audit(admin, action, { subject, share, detail } = {}) {
  const supabase = db();
  if (!supabase) return;
  const { error } = await supabase.from('admin_audit').insert({
    admin_id: admin ? admin.id : null,
    admin_email: admin ? admin.email : null,
    action,
    subject_advisor_id: subject ? subject.id : null,
    subject_share_id: share ? share.id : null,
    subject_label: subject
      ? `${subject.first_name || ''} ${subject.last_name || ''}`.trim() + ` <${subject.email}>`
      : null,
    detail: detail || {}
  });
  /* An audit failure must not swallow the action that was already taken, but it
     must be loud in the logs — a silent gap in an audit trail is worse than a
     noisy one. */
  if (error) console.error('AUDIT WRITE FAILED', action, error);
}

/* Status changes. `patch` is built by the caller so this stays one code path
   for approve, pause and un-pause rather than three near-identical ones. */
async function updateAdvisor(id, patch) {
  const supabase = db();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const { data, error } = await supabase.from('advisors').update(patch).eq('id', id).select().maybeSingle();
  if (error) {
    /* The master-admin trigger raises here. Surfaced rather than swallowed, so
       the console can say what the database refused and why. */
    console.error('updateAdvisor', error);
    return { ok: false, error: error.message || 'update_failed' };
  }
  return { ok: true, advisor: data };
}

const hoursSince = (iso) => (Date.now() - new Date(iso).getTime()) / 3600000;

/* The vocabulary of the audit trail, in one place because the dashboard and the
   log both render it and they must not drift. The keys are what gets written to
   the database; changing one orphans every historical row, so add rather than
   rename. */
const ACTION_LABEL = {
  approve:    'Approved',
  pause:      'Paused',
  unpause:    'Un-paused',
  lock:       'Locked',
  unlock:     'Unlocked',
  reset_sent: 'Sent a reset link'
};

module.exports = {
  allAdvisors, advisorById, funnelAll, pipelineAll, auditLog,
  audit, updateAdvisor, STALE_HOURS, ACTION_LABEL
};
