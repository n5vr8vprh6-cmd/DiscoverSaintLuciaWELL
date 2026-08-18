/* ============================================================================
   gtm-latency.js — how long does the plan builder ACTUALLY take?
   ----------------------------------------------------------------------------
     node tools/gtm-latency.js            the fullest profile in the database
     node tools/gtm-latency.js <email>    a specific advisor

   ── WHY THIS EXISTS ────────────────────────────────────────────────────────
   A-29 failed three times on the deploy with `error = timeout` while every
   test in this repo passed. They all run against OPENAI_STUB, and a stub has
   no latency — so the margin between "works" and "times out" is invisible to
   the entire suite. The one thing that could have caught it is a real call,
   timed.

   And the fault was perverse: the skeleton had 8 seconds, which was enough for
   a 486-character profile and not enough for a 1,099-character one. THE MORE
   AN ADVISOR FILLS IN, THE MORE LIKELY THEIR PLAN FAILS. So this deliberately
   picks the FULLEST profile it can find rather than a convenient one — the
   worst case is the only case worth timing.

   ── IT COSTS REAL MONEY ────────────────────────────────────────────────────
   One skeleton call against the real model, a few cents. That is why it is
   manual and never part of `node tools/...`-everything: the suite has to stay
   free so people actually run it. Run this after changing a prompt, a model or
   a timeout, and before believing that generation is fine.

   It writes NOTHING. No plan row, no asset, no build spent.
   ========================================================================== */
'use strict';

const path = require('path');
const fs = require('fs');

try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
    const t = l.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  });
} catch (e) { /* fall through to the check below */ }

/* Never the stub. The whole point is the real thing. */
delete process.env.OPENAI_STUB;

const { db } = require('../api/_lib/core.js');
const { SKELETON_BUDGET_MS, ASSET_BUDGET_MS } = require('../api/_lib/gtm-generate.js');

const SIX = ['positioning', 'differentiator', 'icp', 'client_examples', 'specialties', 'markets'];

/* Within this much of the budget and the next slightly fuller profile fails.
   40% is not a rounding: the failing profile was 2.3x the size of the passing
   one, so the headroom has to cover a profile growing, not a slow afternoon. */
const MARGIN = 0.6;

(async () => {
  const supabase = db();
  if (!supabase) return bail('No SUPABASE_* in .env — this needs a real profile to time.');
  if (!process.env.OPENAI_API_KEY) return bail('No OPENAI_API_KEY — this makes a real call on purpose.');

  const wanted = (process.argv[2] || '').trim();
  const { data: profiles } = await supabase.from('gtm_profile').select('*');
  if (!profiles || !profiles.length) return bail('No profiles in gtm_profile.');

  const sized = profiles.map((p) => ({
    p, size: SIX.reduce((n, k) => n + String(p[k] || '').length, 0)
  })).sort((a, b) => b.size - a.size);

  let chosen = sized[0];
  if (wanted) {
    const { data: a } = await supabase.from('advisors').select('id').ilike('email', wanted).maybeSingle();
    const match = a && sized.find((x) => x.p.advisor_id === a.id);
    if (!match) return bail(`No profile for ${wanted}.`);
    chosen = match;
  }

  const { data: advisor } = await supabase.from('advisors')
    .select('*').eq('id', chosen.p.advisor_id).maybeSingle();

  console.log('\n  PLAN BUILDER · REAL LATENCY\n  ' + '─'.repeat(64));
  console.log('  advisor        ' + `${advisor.first_name} ${advisor.last_name}`
    + (wanted ? '' : '   (the fullest profile on file)'));
  console.log('  six fields     ' + chosen.size + ' chars');
  console.log('  model          ' + (process.env.OPENAI_MODEL || 'gpt-4o-mini'));
  console.log('  skeleton gets  ' + SKELETON_BUDGET_MS + ' ms');
  console.log('  an asset gets  ' + ASSET_BUDGET_MS + ' ms');
  console.log('\n  calling…');

  /* generateSkeleton is not exported — deliberately, it is an internal step —
     so this drives it the way api/gtm.js does, minus every write. */
  const { skeletonOnly } = require('../api/_lib/gtm-generate.js');
  const began = Date.now();
  const r = await skeletonOnly(advisor, chosen.p);
  const took = Date.now() - began;

  console.log('  ' + '─'.repeat(64));
  if (!r.ok) {
    console.log(`  FAILED after ${took} ms — reason: ${r.reason || 'unknown'}`);
    if (r.reason === 'timeout') {
      console.log(`\n  It was aborted at the budget, so the true duration is longer than`);
      console.log(`  ${SKELETON_BUDGET_MS} ms and this run cannot say by how much. Raise`);
      console.log(`  SKELETON_BUDGET_MS and run it again to find the real number.`);
    }
    process.exit(1);
  }

  const weeks = (r.skeleton && r.skeleton.weeks && r.skeleton.weeks.length) || 0;
  const headroom = ((SKELETON_BUDGET_MS - took) / SKELETON_BUDGET_MS * 100).toFixed(0);
  console.log(`  succeeded in ${took} ms — ${weeks} weeks planned`);
  console.log(`  headroom: ${headroom}% of the ${SKELETON_BUDGET_MS} ms budget unused`);

  if (took > SKELETON_BUDGET_MS * MARGIN) {
    console.log('\n  TOO CLOSE. A fuller profile than this one will time out, which is');
    console.log('  exactly how A-29 failed: 486 chars passed, 1,099 chars did not.');
    console.log('  Raise SKELETON_BUDGET_MS, and maxDuration in vercel.json with it.\n');
    process.exit(1);
  }
  console.log('\n  Comfortable. Nothing was written.\n');
})().catch((e) => bail(e && e.message));

function bail(msg) {
  console.error('\n  ' + msg + '\n');
  process.exit(2);
}
