/* ============================================================================
   gtm-test.js — the ladder, the gate, and the prompt
   ----------------------------------------------------------------------------
     node tools/gtm-test.js

   Three things carry C1 and each is asserted against real rows:

     THE LADDER defaults DOWN. An advisor with no training dates may claim the
     least. A bug here should under-claim; over-claiming puts a false statement
     about a qualification into somebody's marketing.

     THE GATE reads the same dates as the ladder, which is the whole point —
     one fact about an advisor, not two systems that can disagree.

     THE PROMPT carries the honesty instruction and the claim rules. A prompt
     that invites invention poisons the intake before the checker ever runs, and
     nothing downstream would catch it because the advisor typed it themselves.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ENV = path.join(__dirname, '..', '.env');
if (fs.existsSync(ENV)) {
  fs.readFileSync(ENV, 'utf8').split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  });
}

const { createClient } = require('@supabase/supabase-js');
const G = require('../api/_lib/gtm.js');
const { check } = require('../api/_lib/claims.js');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

let pass = 0, fail = 0, skip = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };
const skipped = (n, w) => { skip++; console.log('  – ' + n + '  (' + w + ')'); };

let restore = [];
async function cleanup() {
  for (const r of restore) {
    await db.from('advisors').update(r.patch).eq('id', r.id);
    await db.from('gtm_profile').delete().eq('advisor_id', r.id);
  }
}

(async () => {
  console.log('\n  GTM PROFILE\n  ' + '─'.repeat(60) + '\n');

  /* ── The ladder, which needs no database ───────────────────────────────── */
  console.log('  The claims ladder');
  ok('no dates → registered', G.rung({}) === 'registered');
  ok('foundations date → foundations',
    G.rung({ foundations_at: '2026-01-01' }) === 'foundations');
  ok('immersion date → immersion',
    G.rung({ foundations_at: '2026-01-01', immersion_at: '2026-02-01' }) === 'immersion');
  ok('a null advisor defaults DOWN, not up', G.rung(null) === 'registered',
    'a bug here would put a false qualification claim into somebody’s marketing');
  ok('an undefined advisor too', G.rung(undefined) === 'registered');

  console.log('\n  The refresh gate');
  ok('registered may not refresh', G.mayRefresh({}) === false);
  ok('foundations may', G.mayRefresh({ foundations_at: '2026-01-01' }) === true);
  ok('it reads the SAME field as the ladder',
    ['registered', 'foundations', 'immersion'].every((r) => {
      const a = r === 'registered' ? {}
        : r === 'foundations' ? { foundations_at: 'x' }
        : { foundations_at: 'x', immersion_at: 'y' };
      return G.mayRefresh(a) === (G.rung(a) !== 'registered');
    }), 'two systems that can disagree about one fact');

  /* ── The gap report ────────────────────────────────────────────────────── */
  console.log('\n  The gap report');
  const empty = G.gapReport(null);
  ok('an empty profile is 0% ready', empty.ready === 0, String(empty.ready));
  ok('and cannot generate', empty.enoughToGenerate === false);
  ok('and says what is blocking it', empty.blockers.length > 0,
    'a diagnostic that will not say what is wrong is a scolding');

  const partial = G.gapReport({ icp: 'Couples in their forties', positioning: 'Slow trips', instagram: '@x' });
  ok('the heavy fields unblock generation', partial.enoughToGenerate === true,
    JSON.stringify(partial.blockers));
  ok('but readiness is still short of 100', partial.ready < 100 && partial.ready > 0,
    String(partial.ready));
  ok('a channel is counted', partial.channels.includes('instagram'));

  const noChannel = G.gapReport({ icp: 'x', positioning: 'y' });
  ok('no channel blocks generation even with good text',
    noChannel.enoughToGenerate === false,
    'a plan with nowhere to send anybody is a document');

  const full = G.gapReport({
    icp: 'a', positioning: 'b', differentiator: 'c', markets: 'd',
    client_examples: 'e', specialties: 'f', website: 'https://x'
  });
  ok('a complete profile is 100%', full.ready === 100, String(full.ready));
  ok('and has nothing missing', full.missing.length === 0);

  /* ── The prompt ────────────────────────────────────────────────────────── */
  console.log('\n  The prompt an advisor runs in their own AI');
  const advisor = { first_name: 'Mira', last_name: 'Hall', business: 'Hall & Co Travel',
    market: 'Toronto', host_agency: 'Nexion' };
  const prompt = G.intakePrompt(advisor, { website: 'https://hallco.example', instagram: '@hallco' });

  ok('it carries what we already know', prompt.includes('Hall & Co Travel') &&
    prompt.includes('hallco.example'), 'otherwise their AI starts from nothing too');
  ok('it forbids inventing', /Do not invent anything/i.test(prompt));
  ok('it asks for [not found] rather than a guess', prompt.includes('[not found]'),
    'a model with no instruction will fill every field, confidently');
  ok('it asks guesses to be marked', prompt.includes('[guess]'));
  ok('it bans health claims', /No health or medical claims/i.test(prompt));
  ok('it bans prices and superlatives', /No prices/i.test(prompt));
  /* THIS ASSERTION CHANGED WHEN THE CONTRACT DID, and it went red the moment
     the prompt did — which is what it was for.

     It used to check that the flat fields came back in our order, because
     pasting back was a field-by-field exercise. D2b replaced that with the
     sectioned brief format, for a reason six live experiments established:
     prose is read as scenery, and only labelled, individually addressable
     items ever reach the copy. Order no longer matters — the parser accepts
     any — so what matters now is that the prompt asks for the sections the
     parser actually requires. api/_lib/brief.js owns that pairing and
     tools/brief-test.js asserts it section by section. */
  ok('it asks for the sectioned brief format',
    /##\s*CLIENTS/.test(prompt) && /##\s*PROOF/.test(prompt),
    'the flat POSITIONING/ICP format was replaced in D2b');
  ok('and it explains why the shape matters',
    /gets read as background/.test(prompt),
    'an advisor pasting into their AI deserves to know why the headings are not optional');

  /* THE ONE THAT MATTERS MOST. The prompt tells the advisor's AI what they may
     claim — so it must say the SAME thing the checker enforces, or an advisor
     is handed copy their own tool then rejects. */
  console.log('\n  The prompt agrees with the checker');
  const regPrompt = G.intakePrompt({ first_name: 'A' }, {});
  const fndPrompt = G.intakePrompt({ first_name: 'A', foundations_at: '2026-01-01' }, {});
  ok('a registered advisor is NOT told they may say "trained in"',
    !/may accurately say:[^\n]*trained in/i.test(regPrompt),
    'the prompt would seed a claim the checker then blocks');
  ok('a Foundations advisor IS', /trained in the Well Destination method/i.test(fndPrompt));
  ok('and the checker agrees with each',
    check('I am trained in the Well Destination method.', 'registered').copyable === false &&
    check('I am trained in the Well Destination method.', 'foundations').copyable === true,
    'prompt and checker must not disagree about the same sentence');

  /* ── Against the database ──────────────────────────────────────────────── */
  console.log('\n  Storage');
  const probe = await db.from('gtm_profile').select('id').limit(1);
  if (probe.error) {
    skipped('migration 011 applied', 'not applied — gtm_profile does not exist yet');
    skipped('a profile round-trips', 'needs 011');
    skipped('training dates drive the ladder', 'needs 011');
  } else {
    const { data: seed } = await db.from('advisors')
      .select('id, foundations_at, immersion_at').like('public_code', 'SEED%').limit(1).single();
    restore.push({ id: seed.id, patch: { foundations_at: seed.foundations_at, immersion_at: seed.immersion_at } });

    ok('the table exists', true);

    const saved = await G.saveProfile(seed.id, {
      positioning: 'Slow trips for people who have not stopped in years',
      icp: 'Couples in their forties', instagram: '@fixture',
      email_band: '500to2k',
      /* Not in FIELDS — must be ignored rather than written. */
      foundations_at: '1999-01-01', role: 'admin'
    });
    ok('a profile saves', saved.ok, JSON.stringify(saved));

    const read = await G.profileFor(seed.id);
    ok('and reads back', read && read.positioning.startsWith('Slow trips'));
    ok('the band is stored', read.email_band === '500to2k');
    ok('a field outside the allow-list is IGNORED', read.foundations_at === undefined,
      'the intake could otherwise promote an advisor up the claims ladder');

    /* The upsert, which is what makes the form saveable repeatedly. */
    await G.saveProfile(seed.id, { positioning: 'Changed' });
    const again = await G.profileFor(seed.id);
    ok('saving again updates rather than duplicating', again.positioning === 'Changed');
    const { count } = await db.from('gtm_profile')
      .select('id', { count: 'exact', head: true }).eq('advisor_id', seed.id);
    ok('and there is still exactly one row', count === 1, String(count));

    /* The real thing: dates on the row drive both the ladder and the gate. */
    await db.from('advisors').update({ foundations_at: new Date().toISOString() }).eq('id', seed.id);
    const { data: after } = await db.from('advisors')
      .select('foundations_at, immersion_at').eq('id', seed.id).single();
    ok('a recorded date moves them up the ladder', G.rung(after) === 'foundations');
    ok('and unlocks refresh', G.mayRefresh(after) === true);

    await db.from('advisors').update({ foundations_at: null }).eq('id', seed.id);
    const { data: back } = await db.from('advisors')
      .select('foundations_at, immersion_at').eq('id', seed.id).single();
    ok('removing it drops them back', G.rung(back) === 'registered',
      'proven able to fall as well as rise');
  }

  await cleanup();
  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed${skip ? ', ' + skip + ' skipped' : ''}\n`);
  process.exit(fail ? 1 : 0);
})();
