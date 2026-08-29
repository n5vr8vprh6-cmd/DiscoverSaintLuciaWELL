/* ============================================================================
   design-data-test.js — the degradation ladder, and the one rung that closes
   ----------------------------------------------------------------------------
     node tools/design-data-test.js

   Runs with NO DATABASE, which is the point. Deploys here run ahead of
   hand-applied migrations as a matter of routine, so "what does this do before
   022 exists" is not an edge case — it is the state production is in between a
   push and Duncan opening the Supabase editor.

   THREE DEGRADATIONS, AND THEY DO NOT GO THE SAME WAY.

     journey_consultations missing   the workspace still works, read-only. All
                                     the matcher needs is in journey_shares
                                     .answers and the scoring is pure
                                     computation, so the shortlist renders.

     journey_itineraries missing     Issue is disabled with a named reason,
                                     never hidden.

     design_generation missing       GENERATION REFUSES. This is the only rung
                                     that fails closed, and it has to: the
                                     ledger's absence is exactly the state in
                                     which a runaway loop against a paid API is
                                     unbounded. Everything else here degrades
                                     toward letting the advisor work.

   Also asserted: nothing throws, and the session write allow-list cannot be
   talked into writing the columns that decide who owns a row or what knowledge
   was in force.
   ========================================================================== */
'use strict';

/* Explicitly unconfigured. core.js's db() returns null without these, which is
   the no-database path every assertion below runs through. */
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const D = require('../api/_lib/design-data.js');
const N = require('../api/_lib/need-state.js');

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };

console.log('\n  DESIGN DATA — DEGRADATION\n  ' + '─'.repeat(60) + '\n');

(async () => {
  /* ══ Missing-migration detection ═════════════════════════════════════════ */
  console.log('  Recognising a table that is not there yet');
  ok('all four codes Postgres and PostgREST use are covered',
    ['42703', '42P01', 'PGRST204', 'PGRST205'].every((c) => D.isMissing({ code: c })),
    'checking one and assuming it covered the others is how a log fills up');
  ok('a real error is not mistaken for a missing migration',
    !D.isMissing({ code: '23505' }) && !D.isMissing({ code: '42501' }) && !D.isMissing(null),
    'a permissions failure reported as "not migrated" sends somebody to the wrong file');

  /* ══ Nothing throws ══════════════════════════════════════════════════════ */
  console.log('\n  With no database at all');
  const caps = await D.capabilities();
  ok('capabilities reports the database is absent', caps.database === false);
  ok('and claims no capability it cannot back',
    caps.consultation === false && caps.itinerary === false && caps.ledger === false);

  ok('reads return null rather than throwing',
    (await D.consultationFor('s', 'a')) === null && (await D.currentSession('s', 'a')) === null);

  const writes = await Promise.all([
    D.saveConsultation('s', 'a', {}),
    D.openSession('c', 's', 'a', 'v'),
    D.updateSession('x', 'a', { stage: 'shortlist' }),
    D.saveCandidates('x', 'a', []),
    D.declineCandidate('x', 'a', 'slug', 'too far')
  ]);
  ok('every write returns { ok:false } rather than throwing',
    writes.every((w) => w && w.ok === false));
  ok('and names not_configured rather than blaming the migration',
    writes.slice(0, 4).every((w) => w.reason === 'not_configured'),
    'no database and no table are different problems with different fixes');

  await D.recordGeneration('a', 's', { kind: 'day_note' });
  ok('recording a generation with nowhere to record it does not throw', true);

  /* ══ The rung that fails closed ══════════════════════════════════════════ */
  console.log('\n  The ledger is the one that refuses');
  ok('an unreadable ledger returns null rather than zero',
    (await D.countSince('design_generation', 'a', 60)) === null,
    'zero would read as "no generations yet" and permit an unbounded loop');

  const gen = await D.mayGenerate('a');
  ok('SO GENERATION REFUSES', gen.ok === false && gen.reason === 'no_ledger');
  ok('and says why, in words a screen can print', /ledger/i.test(gen.message || ''));

  ok('the three degradations each have their own sentence',
    ['consultation', 'itinerary', 'ledger'].every((k) =>
      typeof D.UNAVAILABLE[k] === 'string' && D.UNAVAILABLE[k].length > 40),
    'two screens describing the same missing table differently is how copy drifts');
  ok('two of them name the migration, so the fix is findable',
    /022/.test(D.UNAVAILABLE.consultation) && /022/.test(D.UNAVAILABLE.itinerary));
  ok('and the ledger one does not promise a migration will fix it',
    !/022/.test(D.UNAVAILABLE.ledger),
    'it is switched off, which is a different statement');

  /* ══ The write allow-list ════════════════════════════════════════════════ */
  console.log('\n  What a session update may touch');
  ok('the allow-list is exactly the working fields',
    D.SESSION_WRITABLE.slice().sort().join(',') ===
      ['day_plan', 'narrative', 'recipe_key', 'shortlist', 'stage', 'status'].join(','),
    D.SESSION_WRITABLE.join(','));
  ['advisor_id', 'share_id', 'consultation_id', 'knowledge_version', 'id'].forEach((col) => {
    ok('it cannot write ' + col, D.SESSION_WRITABLE.indexOf(col) === -1,
      col === 'knowledge_version'
        ? 'frozen by definition — it answers a question about the past'
        : 'it decides who can read the row');
  });

  /* ══ The round trip ══════════════════════════════════════════════════════ */
  console.log('\n  A stored row becomes a need-state again');
  const seeded = await N.seedFrom({ intention: 'restore', place: 'ocean', companions: 'partner',
                                    orientation: 'balance', pace: 'still' });
  /* The shape saveConsultation would have written, mapped back. */
  const row = {
    current_states: seeded.current, desired_states: seeded.desired,
    village_weights: seeded.villages, compass_weights: seeded.compass, pillar_weights: seeded.pillars,
    trigger: 'work-cycle', uncertainty: 'fit', readiness: 'comparing', party: seeded.party,
    orientation: seeded.orientation, budget: 'premium', mobility: null,
    continuum_floor: seeded.continuumFloor, continuum_ceiling: seeded.continuumCeiling,
    rhythm: seeded.rhythm, activity: seeded.activity, social: seeded.social, experience: null,
    adults: 2, children: 0, nights: 5, constraints: ['dates']
  };
  const back = D.toNeedState(row);
  ok('the column names map back to the names the modules reason about',
    back.villages === row.village_weights && back.continuumFloor === row.continuum_floor);
  ok('and the result is a valid need-state', (await N.validate(back)).length === 0,
    JSON.stringify(await N.validate(back)));
  ok('a null row maps to null, not an empty shell', D.toNeedState(null) === null);

  /* ══ Limits ══════════════════════════════════════════════════════════════ */
  console.log('\n  Loop guards, not quotas');
  ok('the three limits are set and are generous',
    D.LIMITS.session === 12 && D.LIMITS.generation === 60 && D.LIMITS.itinerary === 24,
    'if a real person ever hits one, the number is wrong, not the person');

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
