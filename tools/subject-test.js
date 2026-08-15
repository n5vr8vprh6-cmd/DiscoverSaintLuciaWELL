/* ============================================================================
   subject-test.js — the privacy-request machinery, proven against real rows
   ----------------------------------------------------------------------------
     node tools/subject-test.js

   EVERY GUARD HERE IS EXERCISED, NOT INSPECTED. This project has produced four
   separate false greens from assertions that survived a change to the thing
   underneath them, so each check below is written to be capable of failing:
   the cascade is proven by counting notes that actually disappeared, the
   allow-list by trying to write a forbidden column and confirming it did not
   move, and the audit's discretion by searching the row for the address itself.

   Creates its own fixtures on seed-subject-…@example.com and removes them,
   including on failure. Nothing real is touched, and no consumer address is
   ever printed.
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
  subjectKey, findSubject, accessExport, correctSubject, eraseSubject
} = require('../api/_lib/subject-data.js');
const { ipHash } = require('../api/_lib/core.js');
const { retentionStatus } = require('../api/_lib/admin-data.js');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

let pass = 0, fail = 0, skip = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (note ? '  — ' + note : '')); }
};
const skipped = (name, why) => { skip++; console.log('  – ' + name + '  (' + why + ')'); };

const STAMP = Date.now();
const A = `seed-subject-a-${STAMP}@example.com`;
const B = `seed-subject-b-${STAMP}@example.com`;
const CONSENT = 'I agreed to exactly this wording, on this date, and it must survive a correction.';

async function makeShare(email, extra) {
  const { data, error } = await db.from('journey_shares').insert(Object.assign({
    answers: { intention: 'rest', companions: 'solo', pace: 'slow', recognition: 'yes' },
    villages: ['Soufriere'],
    consumer_first: 'Fixture', consumer_last: 'Person',
    consumer_email: email, consumer_phone: '555-0100',
    timing: 'Within 3 months', context: 'a note in their own words',
    consent_text: CONSENT, stage: 'new'
  }, extra || {})).select('id').single();
  if (error) throw error;
  return data.id;
}

async function cleanup() {
  await db.from('journey_shares').delete().in('consumer_email', [A, B]);
  await db.from('admin_audit').delete().eq('admin_email', 'subject-test@example.com');
}

(async () => {
  console.log('\n  SUBJECT RIGHTS\n  ' + '─'.repeat(60) + '\n');

  try {
    /* ── The key ─────────────────────────────────────────────────────────── */
    console.log('  The subject key');
    const k1 = subjectKey(A);
    const k2 = subjectKey(A.toUpperCase());
    ok('is stable for the same address', !!k1 && k1 === subjectKey(A));
    ok('is case-insensitive, as addresses are', k1 === k2);
    ok('differs between two people', k1 !== subjectKey(B));

    /* Domain separation is the reason the IP salt can be reused. If these two
       ever matched, a subject key would be probeable with an IP hash. */
    const fakeReq = { headers: { 'x-forwarded-for': A } };
    ok('is NOT the same as an IP hash of the same string', k1 !== ipHash(fakeReq),
      'domain separator missing — the salt is being reused unsafely');

    /* ── Find ────────────────────────────────────────────────────────────── */
    console.log('\n  Finding what is held');
    const idA1 = await makeShare(A);
    const idA2 = await makeShare(A);
    await makeShare(B);

    const found = await findSubject(A);
    ok('finds every Journey for the address', found && found.journeys.length === 2,
      found ? 'got ' + found.journeys.length : 'nothing returned');
    ok('returns nobody else', found && found.journeys.every((j) => j.consumer_email === A));

    /* The lookup must be exact. A prefix search would return B when asked for
       A, disclosing one person's data to answer another's request. */
    const partial = await findSubject('seed-subject-a-');
    ok('refuses a partial address rather than matching on it',
      !partial || partial.journeys.length === 0);

    const none = await findSubject(`nobody-${STAMP}@example.com`);
    ok('reports nothing held as nothing, not as an error',
      none && none.journeys.length === 0 && !none.advisorAccount);

    /* ip_hash is selected, so this reports honestly rather than always false —
       the bug this check exists to catch. */
    const withIp = await makeShare(A, { ip_hash: 'a'.repeat(64) });
    const found2 = await findSubject(A);
    ok('notices an IP hash is held', found2 && found2.ipHashHeld === true,
      'ip_hash missing from the select — the access response would omit it');
    await db.from('journey_shares').delete().eq('id', withIp);

    /* ── Export ──────────────────────────────────────────────────────────── */
    console.log('\n  The access response');
    const exp = accessExport(await findSubject(A));
    const asText = JSON.stringify(exp);
    ok('carries the consent wording verbatim', asText.includes(CONSENT));
    ok('carries what they wrote in their own words', asText.includes('a note in their own words'));
    ok('carries the Finder answers', !!exp.journeys[0].your_journey_finder_answers.intention);
    ok('names the controller and a contact', !!exp.controller && !!exp.contact);
    ok('says what is NOT held here', Array.isArray(exp.not_held_here) && exp.not_held_here.length > 0);
    ok('contains nobody else', !asText.includes(B));

    /* ── Correction ──────────────────────────────────────────────────────── */
    console.log('\n  Correction');
    const bad = await correctSubject(A, {
      consumer_phone: '555-0999',
      /* All four of these must be ignored. Correcting a contact detail is a
         right; editing a consent record is falsifying one. */
      consent_text: 'something they never agreed to',
      stage: 'booked',
      answers: { intention: 'tampered' },
      consumer_email: ''
    });
    ok('applies the allowed field', bad.ok && bad.rows === 2);

    const after = await findSubject(A);
    ok('changed the phone number', after.journeys.every((j) => j.consumer_phone === '555-0999'));
    ok('REFUSED to rewrite the consent record',
      after.journeys.every((j) => j.consent_text === CONSENT),
      'the allow-list is not holding — consent evidence is editable');
    ok('REFUSED to move the stage', after.journeys.every((j) => j.stage === 'new'));
    ok('REFUSED to rewrite the answers',
      after.journeys.every((j) => j.answers.intention === 'rest'));

    const nothing = await correctSubject(A, { consumer_phone: '   ' });
    ok('treats an empty form as nothing to do', !nothing.ok && nothing.error === 'nothing_to_change');

    /* ── Erasure, and the cascade ────────────────────────────────────────── */
    console.log('\n  Erasure');
    await db.from('advisor_notes').insert([
      { share_id: idA1, advisor_id: await anyAdvisor(), body: 'note one about this person' },
      { share_id: idA2, advisor_id: await anyAdvisor(), body: 'note two about this person' }
    ]);
    const notesBefore = await countNotes([idA1, idA2]);
    ok('the fixture has notes attached to erase', notesBefore === 2);

    const erased = await eraseSubject(A);
    ok('reports how many Journeys went', erased.ok && erased.journeys === 2);
    ok('reports how many notes went', erased.notes === 2);

    /* THE AUTHORITY IS THE DATABASE, NOT THE FUNCTION'S OWN REPORT.
       Written this way after the first version asserted `erased.orphans === 0`
       and went on passing while the orphan count was stubbed out — a check that
       asks the code under test whether it worked is not a check. So the real
       count is taken here, independently, and the function's claim is then
       compared against it. */
    const notesLeft = await countNotes([idA1, idA2]);
    ok('THE CASCADE FIRED — no note survived its Journey', notesLeft === 0,
      notesLeft + ' notes outlived the row they belonged to');
    ok('and eraseSubject reported that truthfully', erased.orphans === notesLeft,
      'it claimed ' + erased.orphans + ' orphans, the database has ' + notesLeft);
    ok('nothing is left for that address', (await findSubject(A)).journeys.length === 0);

    /* The other person must be untouched. An erasure that takes a neighbour
       with it is the worst possible bug on this screen. */
    ok('the other person is untouched', (await findSubject(B)).journeys.length === 1);

    const twice = await eraseSubject(A);
    ok('erasing nothing says so rather than claiming success',
      !twice.ok && twice.error === 'nothing_held');

    /* ── The audit must not recreate what it erased ──────────────────────── */
    console.log('\n  The erasure record');
    const { audit } = require('../api/_lib/admin-data.js');
    await audit({ id: null, email: 'subject-test@example.com' }, 'subject_erase', {
      detail: { subject_key: subjectKey(A), journeys: 2, notes: 2, advisors: 1, orphans: 0 }
    });
    const { data: rows } = await db.from('admin_audit')
      .select('subject_label, detail').eq('admin_email', 'subject-test@example.com');
    const row = (rows || [])[0];
    const rowText = JSON.stringify(row || {});
    ok('a record was written', !!row);
    ok('it does NOT contain the address', !rowText.includes(A),
      'the erasure record is a copy of what was erased');
    ok('it does NOT contain a name', !rowText.includes('Fixture'));
    ok('it DOES contain the reproducible key', rowText.includes(subjectKey(A)),
      'without it the record cannot be matched back when they ask again');
    ok('the key reproduces from the address they would give you',
      row && row.detail.subject_key === subjectKey(A.toUpperCase()));

    /* ── Retention ───────────────────────────────────────────────────────── */
    console.log('\n  Retention');
    const r = await retentionStatus();
    if (r.months === null) {
      skipped('migration 006 applied', 'not applied yet — retention is not in force');
      skipped('the limit is read from the database', 'needs 006');
      skipped('a Journey past the limit is reported as overdue', 'needs 006');
    } else {
      ok('the limit is read from the database, not duplicated in JS', r.months === 24);
      ok('the limit in days is derived from it', r.limitDays > 700 && r.limitDays < 740);

      /* Backdate a fixture past the limit and confirm the dashboard would say
         so. This is the check that catches a dead scheduler. */
      const oldId = await makeShare(B, {
        created_at: new Date(Date.now() - (r.limitDays + 40) * 864e5).toISOString()
      });
      const over = await retentionStatus();
      ok('a Journey past the limit is reported as overdue', over.overdue === true,
         'the dashboard would stay green while §12 is untrue');

      const booked = await db.from('journey_shares').update({ stage: 'booked' }).eq('id', oldId);
      const okBooked = !booked.error && (await retentionStatus()).overdue === false;
      ok('a BOOKED Journey of the same age is not counted against the limit', okBooked,
         'booked Journeys are transaction records and are kept deliberately');
      await db.from('journey_shares').delete().eq('id', oldId);
    }

  } catch (e) {
    fail++;
    console.log('\n  ✗ THREW: ' + (e && e.message ? e.message : e));
  } finally {
    await cleanup();
  }

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed${skip ? ', ' + skip + ' skipped' : ''}\n`);
  process.exit(fail ? 1 : 0);
})();

async function anyAdvisor() {
  const { data } = await db.from('advisors').select('id').limit(1).single();
  return data.id;
}
async function countNotes(shareIds) {
  const { data } = await db.from('advisor_notes').select('id').in('share_id', shareIds);
  return (data || []).length;
}
