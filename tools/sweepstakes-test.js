/* ============================================================================
   sweepstakes-test.js — the entry decision, and the ways it must refuse
   ----------------------------------------------------------------------------
     node tools/sweepstakes-test.js

   The whole feature reduces to one decision: is this share an entry? It is
   made on the server, in api/share.js, and everything else follows from it —
   including what the person is TOLD, which is the one thing here that could be
   a lie.

   So the refusals get the attention: a closed draw, an unknown code, and a code
   belonging to a different advisor must all produce a successful share that is
   not an entry. Each is exercised against real rows, and the closed case is
   proven able to fail before it is trusted.

   Fixtures live on seed-sweeps-…@example.com and are removed, including on
   failure. No consumer address is ever printed.
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
const S = require('../api/_lib/sweepstakes.js');
const { toObjects } = require('../api/_lib/csv.js');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

let pass = 0, fail = 0, skip = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };
const skipped = (n, w) => { skip++; console.log('  – ' + n + '  (' + w + ')'); };

const STAMP = Date.now();
const EMAIL = `seed-sweeps-${STAMP}@example.com`;
const CONSENT = 'Fixture consent. You are also entering a prize draw run by them. ' +
  'That draw is theirs — its rules, eligibility and prize are set by them, not by ' +
  'Discover Saint Lucia WELL, which is not the sponsor.';

let A = null, B = null;      /* two advisors */
const made = [];             /* sweepstakes ids to clean up */

async function share(advisorId, sweepsId, extra) {
  const { data, error } = await db.from('journey_shares').insert(Object.assign({
    advisor_id: advisorId,
    sweepstakes_id: sweepsId,
    answers: { intention: 'restore' }, villages: ['Ocean & Restoration'],
    consumer_first: 'Fixture', consumer_last: 'Entrant',
    consumer_email: EMAIL, consumer_phone: '555-0100',
    timing: 'Within 3 months', consent_text: CONSENT, stage: 'new'
  }, extra || {})).select('id, sweepstakes_id').single();
  if (error) throw error;
  return data;
}

async function cleanup() {
  await db.from('journey_shares').delete().eq('consumer_email', EMAIL);
  if (made.length) await db.from('sweepstakes').delete().in('id', made);
}

(async () => {
  console.log('\n  PRIZE DRAWS\n  ' + '─'.repeat(60) + '\n');

  /* Migration 008 is the precondition for every check below, so it is reported
     as itself rather than as a confusing cascade. */
  const probe = await db.from('sweepstakes').select('id').limit(1);
  if (probe.error) {
    console.log('  Migration 008 has not been applied — sweepstakes does not exist.\n');
    console.log('  ' + '─'.repeat(60));
    console.log('  0 passed, 0 failed, 1 skipped\n');
    process.exit(0);
  }

  try {
    const { data: advisors } = await db.from('advisors')
      .select('id, public_code').like('public_code', 'SEED%').limit(2);
    if (!advisors || advisors.length < 2) {
      skipped('everything', 'needs two seeded advisors — run tools/seed-advisors.js');
      throw new Error('__skip__');
    }
    A = advisors[0]; B = advisors[1];

    /* ── Creating ─────────────────────────────────────────────────────────── */
    console.log('  Creating a draw');
    const created = await S.create(A.id, '  Fixture draw ' + STAMP + '  ');
    ok('creates and returns the row', created.ok && !!created.sweepstakes);
    if (!created.ok) throw new Error('create failed: ' + created.error);
    const draw = created.sweepstakes;
    made.push(draw.id);

    ok('the code is generated, not supplied', !!draw.code && draw.code.length === 6, draw.code);
    ok('and uses the unambiguous alphabet', /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/.test(draw.code),
      draw.code + ' contains I, L, O or U');
    ok('the name is trimmed', draw.name === 'Fixture draw ' + STAMP, '"' + draw.name + '"');
    ok('it starts open', draw.status === 'open');
    ok('a nameless draw is refused', (await S.create(A.id, '   ')).error === 'name_required');

    /* ── The entry decision ───────────────────────────────────────────────── */
    console.log('\n  Is this share an entry?');
    const open = await S.resolveForEntry(db, draw.code, A.id);
    ok('an OPEN draw, right advisor → yes', !!open && open.id === draw.id);

    ok('lower case still resolves', !!(await S.resolveForEntry(db, draw.code.toLowerCase(), A.id)));

    /* THE THREE REFUSALS. Each must be a share that is not an entry — never an
       error, because somebody handing over their details to talk to a travel
       advisor must not be blocked by a campaign problem. */
    ok('a draw belonging to ANOTHER advisor → no',
      (await S.resolveForEntry(db, draw.code, B.id)) === null,
      'a second code could move a lead between advisors');
    ok('an unknown code → no', (await S.resolveForEntry(db, 'ZZZZZZ', A.id)) === null);
    ok('no code at all → no', (await S.resolveForEntry(db, '', A.id)) === null);
    ok('a code with no advisor → no', (await S.resolveForEntry(db, draw.code, null)) === null);

    await S.setStatus(A.id, draw.id, 'closed');
    ok('a CLOSED draw → no', (await S.resolveForEntry(db, draw.code, A.id)) === null,
      'entries would keep being counted after the advisor closed it');

    /* Proven able to fail: reopen, and the same call must now say yes. Without
       this, "returns null" could mean the guard works or the lookup is simply
       broken. */
    await S.setStatus(A.id, draw.id, 'open');
    ok('…and yes again once reopened', !!(await S.resolveForEntry(db, draw.code, A.id)),
      'the refusal above may be a broken lookup rather than a working guard');

    /* ── The link resolver is more forgiving than the entry resolver ──────── */
    console.log('\n  The printed link');
    await S.setStatus(A.id, draw.id, 'closed');
    const linkClosed = await S.resolveForLink(db, draw.code, A.id);
    ok('a CLOSED draw still resolves for the link', !!linkClosed,
      'a printed card or QR code would 404 after the campaign ended');
    ok('and reports itself closed, so well.js can drop the flag',
      linkClosed.status === 'closed');
    ok('it carries the canonical code for forwarding', linkClosed.code === draw.code);
    ok('another advisor’s code does not resolve', (await S.resolveForLink(db, draw.code, B.id)) === null);
    await S.setStatus(A.id, draw.id, 'open');

    /* ── Entrants ─────────────────────────────────────────────────────────── */
    console.log('\n  Entrants');
    const e1 = await share(A.id, draw.id);
    const e2 = await share(A.id, draw.id);
    await share(A.id, null);                    /* same advisor, not an entry  */
    await share(B.id, null);                    /* another advisor entirely    */

    const entrants = await S.entrantsFor(A.id, draw.id);
    ok('lists only the entries', entrants.length === 2, 'got ' + entrants.length);
    ok('in the order they entered',
      new Date(entrants[0].created_at) <= new Date(entrants[1].created_at));

    /* The advisor scope is not redundant with the sweepstakes scope: without
       it, a guessed id would return somebody else's people. */
    ok('ANOTHER advisor sees none of them',
      (await S.entrantsFor(B.id, draw.id)).length === 0,
      'entrants leak across advisors on a guessed id');
    ok('and cannot open the draw at all', (await S.byId(B.id, draw.id)) === null);
    ok('the owner can', (await S.byId(A.id, draw.id)).id === draw.id);

    const listed = await S.listFor(A.id);
    const mine = listed.find((d) => d.id === draw.id);
    ok('the list counts entries', mine && mine.entries === 2, mine ? String(mine.entries) : 'missing');

    /* ── The consent record ───────────────────────────────────────────────── */
    console.log('\n  What the entrant agreed to');
    const { data: rec } = await db.from('journey_shares')
      .select('consent_text').eq('id', e1.id).single();
    ok('the wording is stored verbatim', rec.consent_text === CONSENT);
    ok('it names who the draw belongs to', /draw is theirs/.test(rec.consent_text));
    ok('and says we are NOT the sponsor', /not the sponsor/.test(rec.consent_text),
      'the platform would look like the promoter');

    /* ── Export ───────────────────────────────────────────────────────────── */
    console.log('\n  Export');
    /* toObjects() takes raw text, parses it itself, and normalises headers to
       lowercase alphanumeric — so "First name" arrives as `firstname`. Reading
       the helper rather than assuming its shape is the difference between a
       round-trip test and a test of my memory. */
    const csv = S.toCsv(entrants);
    const out = toObjects(csv);
    ok('round-trips through the CSV parser', out.rows.length === 2, out.rows.length + ' rows');
    ok('carries the contact details a draw needs',
      out.rows[0].email === EMAIL && !!out.rows[0].firstname,
      JSON.stringify(out.headers));
    ok('carries nobody else', out.rows.every((r) => r.email === EMAIL));
    ok('starts with a BOM so Excel reads it as UTF-8', csv.charCodeAt(0) === 0xFEFF);

    /* A comma in a name is the classic break, and the file that breaks is the
       one somebody is about to pick a winner from. */
    const tricky = S.toCsv([{ created_at: new Date().toISOString(),
      consumer_first: 'Ann, "The Boss"', consumer_last: 'O\'Neil\nSecond line',
      consumer_email: 'x@example.com', consumer_phone: '', timing: '', villages: [], stage: 'new' }]);
    const back = toObjects(tricky).rows;
    ok('survives commas, quotes and newlines in a name',
      back.length === 1 && back[0].firstname === 'Ann, "The Boss"' &&
      /Second line/.test(back[0].lastname),
      JSON.stringify(back));

    /* ── Deleting ─────────────────────────────────────────────────────────── */
    console.log('\n  Housekeeping');
    ok('a draw with entrants REFUSES to be deleted',
      (await S.remove(A.id, draw.id)).error === 'has_entries',
      'the only record that those people entered anything would vanish');

    const empty = await S.create(A.id, 'Empty fixture');
    made.push(empty.sweepstakes.id);
    ok('an empty one can be deleted', (await S.remove(A.id, empty.sweepstakes.id)).ok);
    ok('another advisor cannot delete yours', (await S.remove(B.id, draw.id)).error !== undefined);
    ok('renaming is scoped too', (await S.rename(B.id, draw.id, 'hijacked')).error === 'not_found');

    /* ── Deleting a draw must not delete its people ───────────────────────── */
    console.log('\n  Deleting a finished campaign');
    const doomed = await S.create(A.id, 'To be deleted');
    made.push(doomed.sweepstakes.id);
    const orphan = await share(A.id, doomed.sweepstakes.id);
    await db.from('sweepstakes').delete().eq('id', doomed.sweepstakes.id);

    const { data: survivor } = await db.from('journey_shares')
      .select('id, sweepstakes_id, consumer_email').eq('id', orphan.id).maybeSingle();
    ok('the ENTRANT survives the draw being deleted', !!survivor,
      'ON DELETE SET NULL is not in force — real people were destroyed with a campaign');
    ok('and is simply no longer flagged', survivor && survivor.sweepstakes_id === null);

  } catch (e) {
    if (e.message !== '__skip__') {
      fail++;
      console.log('\n  ✗ THREW: ' + (e && e.message ? e.message : e));
    }
  } finally {
    await cleanup();
  }

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed${skip ? ', ' + skip + ' skipped' : ''}\n`);
  process.exit(fail ? 1 : 0);
})();
