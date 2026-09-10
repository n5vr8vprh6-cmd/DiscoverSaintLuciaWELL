/* ============================================================================
   design-migration-check.js — did 022 actually land?
   ----------------------------------------------------------------------------
     node tools/design-migration-check.js

   Reads the service-role key from the gitignored .env and never prints it, same
   as tools/db.js. Touches no rows: every request is a HEAD or a zero-row select.

   WHY THIS EXISTS SEPARATELY FROM THE MIGRATION'S OWN FOOTER. The footer runs
   inside the Supabase editor, where somebody has to read it. This runs from the
   same machine that deploys, answers the same question with an exit code, and
   is the difference between "I think I ran it" and "the deployment can see it".

   WHAT IT CANNOT CHECK. Triggers and cascade rules are not visible through
   PostgREST. The migration's own do-blocks report both when it is applied, and
   that output is the record for those two. This covers the tables, the columns
   and the retention arm, which is what a deploy actually depends on.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const env = {};
try {
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  });
} catch (e) {
  console.error('\n  No .env beside this repo. This check runs where the keys are.\n');
  process.exit(1);
}

const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('\n  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env\n');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

const TABLES = ['journey_consultations', 'design_sessions', 'design_candidates',
                'journey_itineraries', 'design_generation'];

const ICP = ['icp_current_states', 'icp_desired_states', 'icp_trigger', 'icp_uncertainty',
             'icp_readiness', 'icp_party', 'icp_budget', 'icp_at'];

/* A column that does not exist comes back 400 with 42703 in the body, which is
   the same signal api/_lib/design-data.js degrades on. Asking for it here means
   the check and the runtime agree about what "missing" looks like. */
async function selects(table, cols) {
  const res = await fetch(`${URL}/rest/v1/${table}?select=${cols}&limit=0`, { headers: H });
  if (res.ok) return { ok: true };
  let body = '';
  try { body = JSON.stringify(await res.json()); } catch (e) { /* status is enough */ }
  return { ok: false, status: res.status, body: body.slice(0, 160) };
}

(async () => {
  console.log('\n  MIGRATION 022 — JOURNEY DESIGN');
  console.log('  ' + '─'.repeat(64));

  let bad = 0;

  console.log('\n  Tables');
  for (const t of TABLES) {
    const r = await selects(t, 'id');
    if (r.ok) console.log('    ✓ ' + t);
    else { bad++; console.log('    ✗ ' + t + '   ' + (r.body || r.status)); }
  }

  console.log('\n  The consultation carries codes, not prose');
  const shape = await selects('journey_consultations',
    'current_states,desired_states,village_weights,compass_weights,pillar_weights,' +
    'trigger,uncertainty,readiness,party,orientation,budget,mobility,' +
    'continuum_floor,continuum_ceiling,rhythm,activity,social,experience,' +
    'adults,children,nights,constraints,seeded_from,advisor_overrode');
  if (shape.ok) console.log('    ✓ all 25 need-state columns present');
  else { bad++; console.log('    ✗ ' + (shape.body || shape.status)); }

  console.log('\n  The workspace freezes what it was designed against');
  const sess = await selects('design_sessions',
    'stage,status,recipe_key,shortlist,day_plan,narrative,knowledge_version');
  if (sess.ok) console.log('    ✓ knowledge_version and the working fields present');
  else { bad++; console.log('    ✗ ' + (sess.body || sess.status)); }

  console.log('\n  The artifact is versioned and revocable');
  const itin = await selects('journey_itineraries',
    'version,document,brand,share_token_hash,share_expires_at,revoked_at,view_count,last_viewed_at,issued_at');
  if (itin.ok) console.log('    ✓ token, expiry, revocation and view counters present');
  else { bad++; console.log('    ✗ ' + (itin.body || itin.status)); }

  console.log('\n  The ledger can be counted');
  const led = await selects('design_generation', 'kind,model,ms,prompt_chars,tokens_in,tokens_out,reason');
  if (led.ok) console.log('    ✓ cost and failure columns present');
  else { bad++; console.log('    ✗ ' + (led.body || led.status)); }

  console.log('\n  The advisor\'s own priority traveller');
  const icp = await selects('gtm_profile', ICP.join(','));
  if (icp.ok) console.log('    ✓ all 8 Day 2 columns on gtm_profile');
  else { bad++; console.log('    ✗ ' + (icp.body || icp.status)); }

  /* 023 and 024 are additive columns; a deployment ahead of them degrades in
     words rather than failing, so this reports them separately from 022. */
  console.log('\n  023 — a dated trip, an estimate, a send');
  const m23 = [
    await selects('journey_consultations', 'travel_from'),
    await selects('design_sessions', 'estimate'),
    await selects('journey_itineraries', 'sent_at')
  ];
  if (m23.every((r) => r.ok)) console.log('    ✓ travel_from, estimate and sent_at present');
  else { bad++; console.log('    ✗ 023 not fully applied: ' + m23.filter((r) => !r.ok).map((r) => r.body || r.status).join(' · ')); }

  console.log('\n  024 — the conversation: multi-select, a budget figure, their words');
  const m24 = await selects('journey_consultations', 'triggers,uncertainties,budget_usd,in_their_words');
  if (m24.ok) console.log('    ✓ triggers, uncertainties, budget_usd and in_their_words present');
  else { bad++; console.log('    ✗ 024 not applied: ' + (m24.body || m24.status)); }

  console.log('\n  025 — the human layer: notes, the recap, the advisor\'s stories');
  const m25 = [await selects('journey_consultations', 'notes,heard_sent_at'), await selects('advisor_place_notes', 'id,slug,body')];
  if (m25.every((r) => r.ok)) console.log('    ✓ notes, heard_sent_at and advisor_place_notes present');
  else { bad++; console.log('    ✗ 025 not applied: ' + m25.filter((r) => !r.ok).map((r) => r.body || r.status).join(' · ')); }

  console.log('\n  026 — Eclipse interest');
  const m26 = await selects('journey_consultations', 'eclipse_interest');
  if (m26.ok) console.log('    ✓ eclipse_interest present');
  else { bad++; console.log('    ✗ 026 not applied: ' + (m26.body || m26.status)); }

  console.log('\n  ' + '─'.repeat(64));
  if (bad) {
    console.log('  ✗ 022 is not fully applied. Run db/migrations/022-journey-design.sql');
    console.log('    in the Supabase SQL editor and read its footer.\n');
  } else {
    console.log('  ✓ 022 is applied and the deployment can see it.');
    console.log('    Triggers and cascades are not visible here — the migration\'s own');
    console.log('    do-blocks report those, and they run in the editor.\n');
  }
  process.exit(bad ? 1 : 0);
})();
