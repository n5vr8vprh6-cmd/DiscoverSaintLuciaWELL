/* ============================================================================
   /api/gtm — generate the plan, one piece at a time
   ----------------------------------------------------------------------------
   The eleventh of twelve Serverless Functions. One endpoint, four actions,
   dispatched on a parameter — the same shape as api/hub/index.js and for the
   same reason: on Hobby, a file per action is a deploy failure waiting for the
   fourth action.

   ── WHY IT GENERATES IN PIECES ─────────────────────────────────────────────
   Hobby kills a function at ten seconds. A single request that writes a
   skeleton and eight assets will not finish, and what it leaves behind is a
   half-written plan nobody asked for and no way to resume. So:

     plan   — the skeleton alone. One call, one row, fast.
     asset  — one piece of copy. Called once per action that needs one.
     revert — a column read. No model involved.
     edit   — the advisor's own text, re-checked.

   A failed asset costs one caption. The plan and its other assets are already
   in the database and are unaffected — asserted in tools/gtm-plan-test.js by
   failing one deliberately, because a failure path nobody has taken is a
   failure path nobody has tested.

   ── VIEW-AS IS READ-ONLY ───────────────────────────────────────────────────
   Staff supporting an advisor may look at their campaign. Generating one puts
   words into somebody's mouth that they will then publish under their own name
   and warrant as their own. Same rule as account.js and campaign.js.
   ========================================================================== */
'use strict';

const { db, json, str, body: parseBody } = require('./_lib/core.js');
const { requireAdvisorJson } = require('./_lib/auth.js');
const { rung, mayRefresh, profileFor } = require('./_lib/gtm.js');
const { generateSkeleton, generateAsset } = require('./_lib/gtm-generate.js');
const { check, ownNames } = require('./_lib/claims.js');
const { configured, reasonText } = require('./_lib/openai.js');

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.discoversaintluciawell.com';

/* ── Loop guards, not quotas ──────────────────────────────────────────────
   Set where nobody working normally will ever meet them. An advisor past
   Foundations has unlimited plans; this exists so a stuck retry or a runaway
   client-side loop cannot spend the month's budget in a minute. If either of
   these is ever hit by a real person, the number is wrong — not the person. */
const PLANS_PER_HOUR = 12;
const ASSETS_PER_HOUR = 120;

async function countSince(supabase, table, advisorId, minutes) {
  const since = new Date(Date.now() - minutes * 60000).toISOString();
  const { count } = await supabase
    .from(table).select('id', { count: 'exact', head: true })
    .eq('advisor_id', advisorId).gte('created_at', since);
  return count || 0;
}

/* The advisor's real link, substituted AFTER the checker has run. The model
   only ever sees the token — see gtm-generate.js. */
function wellLink(advisor) {
  return advisor.public_code ? `${SITE_ORIGIN}/well/${advisor.public_code}` : SITE_ORIGIN;
}
function substitute(text, advisor) {
  return String(text || '').replace(/\{\{WELL_LINK\}\}/g, wellLink(advisor));
}

/* ── plan ─────────────────────────────────────────────────────────────────
   The skeleton. Frozen rung, because the copy that follows is written under
   the rules that apply right now. */
async function actionPlan(req, res, advisor, supabase) {
  const level = rung(advisor);

  const { count: existing } = await supabase
    .from('gtm_plan').select('id', { count: 'exact', head: true })
    .eq('advisor_id', advisor.id).eq('status', 'ready');

  /* THE GATE. One plan free; unlimited past Foundations. Checked before any
     token is spent, and it reads the same dates the claims ladder reads. */
  if (existing > 0 && !mayRefresh(advisor)) {
    return json(res, 403, {
      error: 'refresh_locked',
      rung: level,
      message: 'Your plan is ready below. Regenerating it is part of Well Destination Foundations.'
    });
  }

  if (await countSince(supabase, 'gtm_plan', advisor.id, 60) >= PLANS_PER_HOUR) {
    return json(res, 429, { error: 'too_fast', message: 'Give it a minute — that is a lot of plans at once.' });
  }

  const profile = await profileFor(advisor.id);
  const r = await generateSkeleton(advisor, profile, level);

  if (!r.ok) {
    /* A failed skeleton is recorded, not swallowed. Without the row there is
       nothing to point at when an advisor says it did not work. */
    await supabase.from('gtm_plan').insert({
      advisor_id: advisor.id, rung_at_generation: level,
      status: 'failed', error: r.reason
    });
    return json(res, 502, { error: r.reason, message: reasonText(r.reason) });
  }

  const { data, error } = await supabase.from('gtm_plan').insert({
    advisor_id: advisor.id,
    rung_at_generation: level,
    skeleton: r.skeleton,
    status: 'ready',
    model: r.model
  }).select('id, skeleton, rung_at_generation, created_at').single();

  if (error) {
    console.error('gtm plan insert', error);
    return json(res, 500, { error: 'save_failed', message: 'The plan was written but not saved. Try again.' });
  }

  /* Which actions still need copy, so the client knows what to ask for next.
     Flattened here rather than in the browser: the shape of a plan is a server
     concern, and a client that derives it would have to be updated in step. */
  const pending = [];
  r.skeleton.weeks.forEach((w) => {
    w.actions.forEach((a, i) => {
      if (a.assetKind !== 'none') pending.push({ week: w.week, position: i, kind: a.assetKind, title: a.title });
    });
  });

  return json(res, 200, { ok: true, plan: data, pending, ms: r.ms });
}

/* ── asset ────────────────────────────────────────────────────────────────
   One piece of copy. Idempotent per (plan, week, position): asking twice
   returns the existing asset rather than paying for it again, which matters
   because a client retrying a timeout is the normal case, not the odd one. */
async function actionAsset(req, res, advisor, supabase, form) {
  const planId = str(form.plan_id, 40);
  const week = Number(form.week) || 0;
  const position = Number(form.position) || 0;
  const force = form.force === '1' || form.force === true;

  const { data: plan } = await supabase
    .from('gtm_plan').select('id, advisor_id, skeleton, rung_at_generation')
    .eq('id', planId).eq('advisor_id', advisor.id).maybeSingle();

  /* Scoped by advisor_id in the query itself, so a guessed plan id belonging to
     somebody else returns nothing rather than somebody else's campaign. */
  if (!plan) return json(res, 404, { error: 'no_plan' });

  const weekRow = (plan.skeleton && plan.skeleton.weeks || []).find((w) => w.week === week);
  const action = weekRow && weekRow.actions && weekRow.actions[position];
  if (!action) return json(res, 400, { error: 'no_action' });

  const { data: already } = await supabase
    .from('gtm_asset').select('*')
    .eq('plan_id', plan.id).eq('week', week).eq('position', position).maybeSingle();

  if (already && already.status === 'ready' && !force) {
    return json(res, 200, { ok: true, asset: publicAsset(already, advisor), cached: true });
  }

  if (await countSince(supabase, 'gtm_asset', advisor.id, 60) >= ASSETS_PER_HOUR) {
    return json(res, 429, { error: 'too_fast', message: 'Give it a minute.' });
  }

  const profile = await profileFor(advisor.id);
  const r = await generateAsset(
    advisor, profile, plan.rung_at_generation,
    Object.assign({ week, position }, action), weekRow.theme
  );

  const row = {
    plan_id: plan.id, advisor_id: advisor.id,
    channel: action.channel, week, position,
    title: action.title, updated_at: new Date().toISOString()
  };

  if (!r.ok) {
    /* Recorded as failed and returned as an error. The plan and every other
       asset are untouched — that is the whole reason for generating in pieces. */
    Object.assign(row, { status: 'failed', error: r.reason });
    await upsertAsset(supabase, already, row);
    return json(res, 502, { error: r.reason, message: reasonText(r.reason), week, position });
  }

  Object.assign(row, {
    body: r.body,
    /* Written once, on first generation, and never overwritten by an edit.
       A forced regeneration DOES move it: the new text becomes the thing you
       revert to, because reverting to copy the advisor deliberately replaced
       would be surprising in the wrong direction. */
    canonical_body: r.body,
    flags: r.flags, severity: r.severity,
    status: 'ready', error: null
  });

  const saved = await upsertAsset(supabase, already, row);
  if (!saved) return json(res, 500, { error: 'save_failed', message: 'Generated but not saved. Try again.' });

  return json(res, 200, { ok: true, asset: publicAsset(saved, advisor), ms: r.ms });
}

async function upsertAsset(supabase, existing, row) {
  const q = existing
    ? supabase.from('gtm_asset').update(row).eq('id', existing.id)
    : supabase.from('gtm_asset').insert(row);
  const { data, error } = await q.select('*').single();
  if (error) { console.error('gtm asset save', error); return null; }
  return data;
}

/* ── edit ─────────────────────────────────────────────────────────────────
   The advisor's own words, re-checked. canonical_body is untouched, which is
   what makes revert possible at all. */
async function actionEdit(req, res, advisor, supabase, form) {
  const id = str(form.asset_id, 40);
  const text = str(form.body, 6000);

  const { data: asset } = await supabase
    .from('gtm_asset').select('id, plan_id, canonical_body')
    .eq('id', id).eq('advisor_id', advisor.id).maybeSingle();
  if (!asset) return json(res, 404, { error: 'no_asset' });

  const { data: plan } = await supabase
    .from('gtm_plan').select('rung_at_generation').eq('id', asset.plan_id).single();

  /* Re-run rather than trust the stored verdict. The flags on the row describe
     text that no longer exists. */
  const verdict = check(text, plan ? plan.rung_at_generation : 'registered', ownNames(advisor));

  const { data, error } = await supabase.from('gtm_asset').update({
    body: text,
    flags: verdict.flags,
    severity: verdict.high ? 'high' : verdict.flags.length ? 'low' : 'none',
    updated_at: new Date().toISOString()
  }).eq('id', asset.id).select('*').single();

  if (error) { console.error('gtm edit', error); return json(res, 500, { error: 'save_failed' }); }
  return json(res, 200, { ok: true, asset: publicAsset(data, advisor) });
}

/* ── revert ───────────────────────────────────────────────────────────────
   A column read. No model, no cost, and exact — which is the point. */
async function actionRevert(req, res, advisor, supabase, form) {
  const id = str(form.asset_id, 40);

  const { data: asset } = await supabase
    .from('gtm_asset').select('id, plan_id, canonical_body')
    .eq('id', id).eq('advisor_id', advisor.id).maybeSingle();
  if (!asset) return json(res, 404, { error: 'no_asset' });
  if (!asset.canonical_body) return json(res, 400, { error: 'nothing_to_revert' });

  const { data: plan } = await supabase
    .from('gtm_plan').select('rung_at_generation').eq('id', asset.plan_id).single();
  const verdict = check(asset.canonical_body, plan ? plan.rung_at_generation : 'registered', ownNames(advisor));

  const { data, error } = await supabase.from('gtm_asset').update({
    body: asset.canonical_body,
    flags: verdict.flags,
    severity: verdict.high ? 'high' : verdict.flags.length ? 'low' : 'none',
    updated_at: new Date().toISOString()
  }).eq('id', asset.id).select('*').single();

  if (error) { console.error('gtm revert', error); return json(res, 500, { error: 'save_failed' }); }
  return json(res, 200, { ok: true, asset: publicAsset(data, advisor) });
}

/* The link is substituted on the way out, never on the way in. The stored text
   keeps the token, so an advisor whose public_code ever changes does not have a
   month of copy pointing at a dead link. */
function publicAsset(row, advisor) {
  return {
    id: row.id, week: row.week, position: row.position,
    channel: row.channel, title: row.title,
    body: substitute(row.body, advisor),
    severity: row.severity,
    flags: row.flags || [],
    copyable: row.severity !== 'high',
    edited: row.body !== row.canonical_body,
    status: row.status
  };
}

/* ── Dispatch ─────────────────────────────────────────────────────────────── */
const ACTIONS = { plan: actionPlan, asset: actionAsset, edit: actionEdit, revert: actionRevert };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });

  const advisor = await requireAdvisorJson(req, res);
  if (!advisor) return;

  if (advisor.viewingAs) {
    return json(res, 403, {
      error: 'read_only',
      message: 'You are viewing this advisor’s Hub. Generating campaign copy under their name is not available here.'
    });
  }

  const supabase = db();
  if (!supabase) return json(res, 503, { error: 'not_configured' });

  const form = parseBody(req) || {};
  const name = str(form.action, 20);
  const run = Object.prototype.hasOwnProperty.call(ACTIONS, name) ? ACTIONS[name] : null;
  if (!run) return json(res, 400, { error: 'bad_action' });

  /* Generation needs a key; edit and revert never do. Checked per action rather
     than at the door, so an advisor with no key set can still fix their own
     copy — and so the Hub behaves exactly as it does today when the key is
     absent, which is the state production is in until it is set. */
  if ((name === 'plan' || name === 'asset') && !configured()) {
    return json(res, 503, { error: 'not_configured', message: reasonText('not_configured') });
  }

  try {
    return await run(req, res, advisor, supabase, form);
  } catch (err) {
    console.error('gtm ' + name, String(err && err.message || err));
    return json(res, 500, { error: 'unexpected' });
  }
};

/* Exported so tools/gtm-plan-test.js drives the REAL handlers rather than
   hand-inserting rows and reading them back. The first version of that test
   asserted that the database can hold two columns — which was never in doubt —
   and would have stayed green with actionRevert regenerating from scratch.

   Each action takes its advisor as a parameter, so a test supplies one
   directly; the auth that normally produces it is covered in auth-test.js.
   Assigned AFTER module.exports is set, or it is overwritten by it. */
module.exports.ACTIONS = ACTIONS;
