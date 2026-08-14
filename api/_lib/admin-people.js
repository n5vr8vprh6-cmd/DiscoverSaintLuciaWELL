/* ============================================================================
   ADMIN PEOPLE — creating, removing and promoting advisors
   ----------------------------------------------------------------------------
   The destructive half of the console. Every guard in this file exists because
   of a specific way the obvious implementation goes wrong.

   NO ADMIN EVER SETS A PASSWORD, including for an account they create. A new
   account is made with a random secret nobody sees, and the person is sent a
   link to choose their own. There is one code path in this system that sets a
   credential and it is the advisor's own reset flow.

   DELETION REFUSES WHEN THE ADVISOR HOLDS JOURNEYS. A consumer consented to
   share their name, email, phone and what they said about their own wellbeing
   with THAT NAMED ADVISOR. Deleting the advisor would leave those rows with
   `advisor_id` set to null — the foreign keys are ON DELETE SET NULL — which is
   real personal data sitting in the table with nobody responsible for it. The
   caller has to say explicitly what should happen to it instead.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const { db } = require('./core.js');
const { recoveryLink } = require('./auth-admin.js');
const { audit } = require('./admin-data.js');

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.discoversaintluciawell.com';

function adminHeaders() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' } };
}

/* ── Create ──────────────────────────────────────────────────────────────── */

/* One advisor. Returns { ok, advisor, invited, error }.
   `invite: false` creates the account quietly — useful when importing a list
   before an event, so fifty people are not emailed at once. */
async function createAdvisor(admin, input, { invite = true } = {}) {
  const supabase = db();
  const c = adminHeaders();
  if (!supabase || !c) return { ok: false, error: 'not_configured' };

  const email = String(input.email || '').trim().toLowerCase();
  const first = String(input.firstName || '').trim();
  const last = String(input.lastName || '').trim();

  if (!first || !last) return { ok: false, error: 'name_required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'email_invalid' };

  /* An address that already has an advisor is not an error worth failing an
     import over — it is the ordinary case of re-importing a list. */
  const { data: existing } = await supabase
    .from('advisors').select('id').eq('email', email).maybeSingle();
  if (existing) return { ok: false, error: 'already_exists' };

  /* A password nobody knows, including us. It exists only because the auth user
     needs one; the person will replace it through the link below. */
  const throwaway = crypto.randomBytes(24).toString('base64url');

  const authRes = await fetch(`${c.url}/auth/v1/admin/users`, {
    method: 'POST', headers: c.headers,
    body: JSON.stringify({ email, password: throwaway, email_confirm: true })
  });
  const authBody = await authRes.json().catch(() => ({}));
  if (!authRes.ok) {
    /* Supabase knows about an auth user we have no advisor row for. Reported
       rather than silently adopted — an orphan is a state somebody should look
       at, not something an import should paper over. */
    return { ok: false, error: (authBody && authBody.msg) || 'auth_create_failed' };
  }

  const { data: advisor, error } = await supabase.from('advisors').insert({
    auth_user_id: authBody.id,
    slug: 'adv-' + crypto.randomBytes(8).toString('hex'),
    first_name: first,
    last_name: last,
    email,
    business: String(input.business || '').trim() || null,
    host_agency: String(input.hostAgency || '').trim() || null,
    website: String(input.website || '').trim() || null,
    market: String(input.market || '').trim() || null,
    registration_note: String(input.note || '').trim() || null,
    /* An admin creating an account has already done the vetting that `pending`
       exists to force. Still stated explicitly rather than left to the schema
       default — see db/migrations/004-admin.sql. */
    status: 'active',
    approved_at: new Date().toISOString(),
    approved_by: admin ? admin.id : null,
    onboarding_state: 'profile'
  }).select().single();

  if (error) {
    /* Roll the auth user back. Leaving it behind would block the address from
       ever registering again, with no advisor row to explain why. */
    await fetch(`${c.url}/auth/v1/admin/users/${authBody.id}`, { method: 'DELETE', headers: c.headers });
    return { ok: false, error: error.message || 'insert_failed' };
  }

  let invited = false;
  if (invite) invited = await sendInvite(advisor);

  await audit(admin, 'create', { subject: advisor, detail: { invited } });
  return { ok: true, advisor, invited };
}

/* Generated by Supabase, delivered by Resend — the same split as every other
   transactional message here, and the reason this does not inherit the Supabase
   SMTP outage. */
async function sendInvite(advisor) {
  const r = await recoveryLink(advisor.email, SITE_ORIGIN + '/hub/reset');
  if (!r.ok || !r.honoured) {
    console.error('invite not sent for ' + advisor.email + ': ' +
      (r.error || 'redirect not honoured — check Supabase URL configuration'));
    return false;
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  if (!key || !from) return false;

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  try {
    const { Resend } = require('resend');
    const { error } = await new Resend(key).emails.send({
      from,
      to: advisor.email,
      subject: 'Your Saint Lucia WELL Advisor Hub',
      html:
        `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#133239">` +
        `<p style="margin:0 0 1.2em">${esc(advisor.first_name)},</p>` +
        `<p style="margin:0 0 1.4em">An account has been created for you on the Saint Lucia WELL ` +
        `Travel Advisor Hub. Choose a password and it is yours — you will find your own WELL link ` +
        `and QR code waiting inside.</p>` +
        `<p style="margin:0 0 1.4em"><a href="${esc(r.link)}" style="display:inline-block;` +
        `background:#E89A12;color:#133239;text-decoration:none;font-weight:600;padding:11px 20px;` +
        `border-radius:2px">Set your password</a></p>` +
        `<p style="margin:0;color:#5c6b68;font-size:13px">The link works once and expires. ` +
        `If you were not expecting this, you can ignore it.</p></div>`
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('invite email failed', e);
    return false;
  }
}

/* ── Delete ──────────────────────────────────────────────────────────────── */

/* What would happen if this advisor were deleted. Called before anything is
   destroyed so the console can show it, and again at the moment of deletion so
   a stale page cannot authorise something the preview never described. */
async function deletionImpact(id) {
  const supabase = db();
  if (!supabase) return null;
  const { data: advisor } = await supabase
    .from('advisors').select('id, first_name, last_name, email, public_code, role, is_master, auth_user_id')
    .eq('id', id).maybeSingle();
  if (!advisor) return null;

  const count = async (table) => {
    const { count: n } = await supabase.from(table)
      .select('id', { count: 'exact', head: true }).eq('advisor_id', id);
    return n || 0;
  };
  const [journeys, visits, completions] = await Promise.all([
    count('journey_shares'), count('campaign_visits'), count('finder_completions')
  ]);

  return { advisor, journeys, visits, completions };
}

/* `disposition` decides what happens to the Journeys, and there is no default:
     'refuse'    — the caller has not decided. Nothing happens.
     'transfer'  — move them to `transferTo`, then delete.
     'erase'     — delete them with the advisor. Destroys consent evidence.
*/
async function deleteAdvisor(admin, id, { disposition = 'refuse', transferTo } = {}) {
  const supabase = db();
  const c = adminHeaders();
  if (!supabase || !c) return { ok: false, error: 'not_configured' };

  const impact = await deletionImpact(id);
  if (!impact) return { ok: false, error: 'not_found' };
  const a = impact.advisor;

  /* Three refusals, in the order they matter. The database enforces the master
     rule too — this is the message, not the mechanism. */
  if (a.is_master) return { ok: false, error: 'refused_master' };
  if (admin && a.id === admin.id) return { ok: false, error: 'refused_self' };
  if (a.role === 'admin') {
    const { count } = await supabase.from('advisors')
      .select('id', { count: 'exact', head: true }).eq('role', 'admin');
    if ((count || 0) <= 1) return { ok: false, error: 'refused_last_admin' };
  }

  if (impact.journeys > 0) {
    if (disposition === 'transfer') {
      if (!transferTo || transferTo === id) return { ok: false, error: 'transfer_target_required' };
      const { data: target } = await supabase
        .from('advisors').select('id, first_name, last_name, email, status').eq('id', transferTo).maybeSingle();
      if (!target) return { ok: false, error: 'transfer_target_missing' };
      const { error } = await supabase.from('journey_shares')
        .update({ advisor_id: transferTo }).eq('advisor_id', id);
      if (error) return { ok: false, error: error.message };
      /* A transfer moves real people's contact details from one advisor to
         another. That is a disclosure, and it is audited as its own event
         rather than as a footnote to the deletion. */
      await audit(admin, 'transfer', {
        subject: a, detail: { to: target.email, journeys: impact.journeys }
      });
    } else if (disposition === 'erase') {
      const { error } = await supabase.from('journey_shares').delete().eq('advisor_id', id);
      if (error) return { ok: false, error: error.message };
      await audit(admin, 'erase', { subject: a, detail: { journeys: impact.journeys } });
    } else {
      return { ok: false, error: 'has_journeys', journeys: impact.journeys };
    }
  }

  /* Attribution rows carry no personal data, so they go without ceremony —
     but they go, because ON DELETE SET NULL would otherwise orphan them. */
  await supabase.from('campaign_visits').delete().eq('advisor_id', id);
  await supabase.from('finder_completions').delete().eq('advisor_id', id);

  const { error: delErr } = await supabase.from('advisors').delete().eq('id', id);
  if (delErr) return { ok: false, error: delErr.message };

  /* Auth user last: a failure here leaves an account that can sign in to
     nothing, which is visible and fixable. The reverse leaves an advisor row
     pointing at a deleted login, which is neither. */
  if (a.auth_user_id) {
    await fetch(`${c.url}/auth/v1/admin/users/${a.auth_user_id}`, { method: 'DELETE', headers: c.headers });
  }

  await audit(admin, 'delete', {
    subject: a, detail: { disposition, journeys: impact.journeys }
  });
  return { ok: true, removed: a, journeys: impact.journeys, disposition };
}

/* ── Roles ───────────────────────────────────────────────────────────────── */
async function setRole(admin, id, role) {
  const supabase = db();
  if (!supabase) return { ok: false, error: 'not_configured' };
  if (role !== 'admin' && role !== 'advisor') return { ok: false, error: 'bad_role' };

  const { data: a } = await supabase
    .from('advisors').select('id, first_name, last_name, email, role, is_master')
    .eq('id', id).maybeSingle();
  if (!a) return { ok: false, error: 'not_found' };

  if (role === 'advisor') {
    /* The master is protected by the database as well; this is the readable
       refusal rather than a raised exception. */
    if (a.is_master) return { ok: false, error: 'refused_master' };
    if (admin && a.id === admin.id) return { ok: false, error: 'refused_self' };
    const { count } = await supabase.from('advisors')
      .select('id', { count: 'exact', head: true }).eq('role', 'admin');
    if ((count || 0) <= 1) return { ok: false, error: 'refused_last_admin' };
  }

  const { error } = await supabase.from('advisors').update({ role }).eq('id', id);
  if (error) return { ok: false, error: error.message };

  await audit(admin, role === 'admin' ? 'promote' : 'demote', { subject: a });
  return { ok: true };
}

module.exports = { createAdvisor, deleteAdvisor, deletionImpact, setRole, sendInvite };
