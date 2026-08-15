/* ============================================================================
   undertaking-test.js — the gate, and the ways it must not misfire
   ----------------------------------------------------------------------------
     node tools/undertaking-test.js

   A gate in the auth path is the highest-risk thing in this codebase: it runs
   on every Hub request, and its failure modes are locking everybody out and
   letting everybody through. Both are tested here, along with the two ways it
   could record something untrue.

   THE ACCEPTANCE RECORD IS THE POINT, not the checkbox. An acceptance that was
   backfilled, self-certified, or written while staff were viewing somebody
   else's Hub is not evidence that a person agreed to anything — so each of
   those is asserted against the real database rather than reasoned about.
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
const {
  UNDERTAKING_VERSION, needsUndertaking, recordAcceptance, ACCEPT_PATH
} = require('../api/_lib/undertaking.js');
const page = require('../content/advisor-undertaking.js');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

let pass = 0, fail = 0, skip = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };
const skipped = (n, w) => { skip++; console.log('  – ' + n + '  (' + w + ')'); };

(async () => {
  console.log('\n  ADVISOR DATA UNDERTAKING\n  ' + '─'.repeat(60) + '\n');

  /* ── One version, two readers ──────────────────────────────────────────── */
  console.log('  The version');
  ok('the page and the gate read the same constant', page.version === UNDERTAKING_VERSION,
    'page says ' + page.version + ', gate says ' + UNDERTAKING_VERSION);
  ok('it is a date, not a number', /^\d{4}-\d{2}-\d{2}$/.test(UNDERTAKING_VERSION));
  ok('the document is published where the gate links to it',
    page.path === '/advisors/data-undertaking');

  /* The summary on the accept screen must not be the whole agreement. If the
     document ever became shorter than its own summary, people would be
     agreeing to something they were never shown. */
  const words = JSON.stringify(page.sections).split(/\s+/).length;
  ok('the document is substantial enough to be the agreement', words > 400, words + ' words');

  /* ── Who is asked ──────────────────────────────────────────────────────── */
  console.log('\n  Who the gate stops');
  ok('an advisor who has accepted nothing is asked',
    needsUndertaking({ id: 'x', undertaking_version: null }) === true);
  ok('an advisor on the current version is not asked',
    needsUndertaking({ id: 'x', undertaking_version: UNDERTAKING_VERSION }) === false);
  ok('an advisor on an OLD version is asked again',
    needsUndertaking({ id: 'x', undertaking_version: '2020-01-01' }) === true,
    'bumping the version would not re-gate anybody');

  /* The one that would forge a record. An admin viewing somebody's Hub must
     never be shown the accept screen, because clicking it would record that
     the ADVISOR agreed while the advisor was nowhere near a keyboard. */
  ok('staff viewing another Hub are NEVER asked to accept',
    needsUndertaking({ id: 'x', undertaking_version: null, viewingAs: true }) === false,
    'an admin could accept on an advisor’s behalf — that record would be a forgery');

  ok('nobody signed in is not asked', needsUndertaking(null) === false);

  /* ── The gate must not trap anyone ─────────────────────────────────────── */
  console.log('\n  Ways out');
  const auth = fs.readFileSync(path.join(__dirname, '..', 'api', '_lib', 'auth.js'), 'utf8');
  ok('the accept screen itself is excluded from the gate',
    auth.includes('=== ACCEPT_PATH') || auth.includes('ACCEPT_PATH + \'?\''),
    'the redirect would loop forever');

  const screen = fs.readFileSync(
    path.join(__dirname, '..', 'api', '_lib', 'hub-screens', 'undertaking.js'), 'utf8');
  /* Checked against what it IMPORTS, not against whether the word appears —
     the first version of this searched the whole file and failed on the header
     comment explaining why the guard is not used. A check that reads prose is
     not checking the code. It cannot call what it does not import. */
  const imports = (screen.match(/require\(['"]\.\.\/auth\.js['"]\)/) || []).length
    ? screen.slice(0, screen.indexOf("require('../auth.js')"))
    : '';
  ok('the accept screen does NOT import requireAdvisor', !/requireAdvisor/.test(imports.slice(-200)),
    'that guard is what redirects here — using it would loop forever');
  ok('there is a sign-out on the accept screen', screen.includes('data-signout'),
    'somebody who will not agree would be trapped inside the product');

  const router = fs.readFileSync(path.join(__dirname, '..', 'api', 'hub', 'index.js'), 'utf8');
  ok('the screen is registered in the router', /undertaking:\s*\(\)/.test(router));
  const rewrites = fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8');
  ok('and has a rewrite', rewrites.includes('"' + ACCEPT_PATH + '"'));

  /* Sign-out is its own serverless function and never passes through the
     guards. Asserted rather than assumed, because if it ever moved under the
     Hub router a refusing advisor would have no way to leave. */
  ok('sign-out is outside the Hub router entirely',
    fs.existsSync(path.join(__dirname, '..', 'api', 'auth', 'logout.js')));

  /* ── Registration cannot skip it ───────────────────────────────────────── */
  console.log('\n  Registration');
  const reg = fs.readFileSync(path.join(__dirname, '..', 'api', 'auth', 'register.js'), 'utf8');
  ok('the endpoint refuses without an acceptance', reg.includes('undertaking_required'));
  ok('and records the version it was given', reg.includes('undertaking_version: UNDERTAKING_VERSION'));

  /* The bug this catches: fields() read el.value for every element, and a
     checkbox has a value whether or not it is ticked — so an untouched box
     posted "yes" and the server guard could never be reached through the real
     form. */
  const hubjs = fs.readFileSync(path.join(__dirname, '..', 'js', 'hub.js'), 'utf8');
  ok('the client does not post an unticked checkbox',
    /el\.type === 'checkbox'/.test(hubjs) && /el\.checked/.test(hubjs),
    'an unticked box would post its value and forge the acceptance');

  /* ── Against the live database ─────────────────────────────────────────── */
  console.log('\n  The record');
  const { data: advisors, error } = await db
    .from('advisors').select('id, public_code, undertaking_version, undertaking_at');

  if (error) {
    skipped('migration 007 applied', 'not applied — the columns do not exist yet');
    skipped('nobody was backfilled', 'needs 007');
    skipped('accepting writes both columns', 'needs 007');
  } else {
    ok('the columns exist', true);

    /* THE ONE THAT MATTERS MOST, rewritten after it failed for the right
       reason: it demanded that NOBODY had accepted, which was true the day it
       was written and false the moment Duncan signed in and accepted — the
       feature working as designed turned the check red.

       The real invariant is not "nobody accepted", it is "nobody was stamped
       in bulk". A backfill is one UPDATE, so it writes the SAME timestamp to
       every row it touches; genuine acceptances happen one person at a time,
       seconds or weeks apart. Two identical undertaking_at values is the
       signature of the thing this guards against, and it stays meaningful for
       as long as the table exists. */
    const stamped = advisors.filter((a) => a.undertaking_at);
    const bySecond = stamped.reduce((acc, a) => {
      const k = new Date(a.undertaking_at).toISOString().slice(0, 19);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const collisions = Object.keys(bySecond).filter((k) => bySecond[k] > 1);
    ok('acceptances were made one at a time, not backfilled in bulk',
      collisions.length === 0,
      collisions.length + ' timestamp(s) shared by several advisors — the signature of one UPDATE');
    console.log('    (' + stamped.length + ' of ' + advisors.length + ' have accepted so far)');

    /* Round-trip on a seeded fixture, then put it back. */
    const seed = advisors.find((a) => /^SEED/.test(a.public_code || ''));
    if (!seed) {
      skipped('accepting writes both columns', 'no seeded advisor to test against');
    } else {
      const r = await recordAcceptance(seed.id);
      const { data: after } = await db.from('advisors')
        .select('undertaking_version, undertaking_at').eq('id', seed.id).single();
      ok('accepting records the version', r.ok && after.undertaking_version === UNDERTAKING_VERSION);
      ok('and when', !!after.undertaking_at);
      ok('and the gate then lets them through', needsUndertaking(after) === false);

      await db.from('advisors')
        .update({ undertaking_version: null, undertaking_at: null }).eq('id', seed.id);
      const { data: restored } = await db.from('advisors')
        .select('undertaking_version').eq('id', seed.id).single();
      ok('fixture restored', restored.undertaking_version === null);
    }
  }

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed${skip ? ', ' + skip + ' skipped' : ''}\n`);
  process.exit(fail ? 1 : 0);
})();
