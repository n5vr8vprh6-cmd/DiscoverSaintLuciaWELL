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
/* One prefix for every fixture address, so cleanup is a single pattern and any
   test can invent a distinct entrant without adding a delete of its own. */
const PREFIX = `seed-sweeps-${STAMP}`;
const EMAIL = `${PREFIX}-a@example.com`;
const who = (tag) => `${PREFIX}-${tag}@example.com`;
const CONSENT = 'Fixture consent. You are also entering a prize draw run by them. ' +
  'That draw is theirs — its rules, eligibility and prize are set by them, not by ' +
  'Discover Saint Lucia WELL, which is not the sponsor.';

let A = null, B = null;      /* two advisors */
const made = [];             /* sweepstakes ids to clean up */

/* `extra` may override consumer_email. Since 009 there is a unique index on
   (sweepstakes_id, lower(consumer_email)), so two entrants on the same draw
   MUST be two different people — the first version of this used one address
   twice and the constraint rightly refused it. */
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
  await db.from('journey_shares').delete().like('consumer_email', PREFIX + '%');
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
    const e1 = await share(A.id, draw.id, { consumer_email: who('e1') });
    const e2 = await share(A.id, draw.id, { consumer_email: who('e2') });
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

    /* ── Ordering ─────────────────────────────────────────────────────────
       The page's whole job is that a live draw is the first thing you see.
       Sorted in listFor() rather than the query, because "open before closed,
       then by a DIFFERENT date column" is not one ORDER BY. */
    console.log('\n  Order on the page');
    const o1 = await S.create(A.id, 'Order fixture ONE');   made.push(o1.sweepstakes.id);
    const o2 = await S.create(A.id, 'Order fixture TWO');   made.push(o2.sweepstakes.id);
    const o3 = await S.create(A.id, 'Order fixture THREE'); made.push(o3.sweepstakes.id);

    /* CLOSE THE NEWEST ONE FIRST, so close order and creation order genuinely
       disagree. The first version of this closed ONE then THREE, which gives
       THREE → ONE under BOTH sorts — it passed while the code sorted closed
       draws by created_at, which is the exact bug it claimed to catch.

       Closing THREE first and ONE second makes them differ:
         by closed_at desc  → ONE, THREE   (what we want)
         by created_at desc → THREE, ONE   (the bug)
       Verified by sabotage: swapping the comparator now turns this red. */
    await S.setStatus(A.id, o3.sweepstakes.id, 'closed');
    await new Promise((r) => setTimeout(r, 1100));
    await S.setStatus(A.id, o1.sweepstakes.id, 'closed');

    const ordered = (await S.listFor(A.id)).filter((d) => /^Order fixture/.test(d.name));
    const names = ordered.map((d) => d.name.replace('Order fixture ', ''));
    ok('open draws come first', names[0] === 'TWO', names.join(' → '));
    ok('then the most recently CLOSED', names[1] === 'ONE' && names[2] === 'THREE',
      names.join(' → ') + ' — expected TWO → ONE → THREE (close order, not creation order)');

    /* Proven able to fail: reopen the last-closed one and it must jump to the
       top. Without this, a passing order could be creation order by luck. */
    await S.setStatus(A.id, o1.sweepstakes.id, 'open');
    const re = (await S.listFor(A.id)).filter((d) => /^Order fixture/.test(d.name))
      .map((d) => d.name.replace('Order fixture ', ''));
    ok('reopening moves it back among the open ones',
      re.indexOf('ONE') < re.indexOf('THREE'), re.join(' → '));

    /* ── One entry per email, per draw ────────────────────────────────────
       Sharing twice stays allowed — a traveller may rethink their answers and
       the advisor should get both. A second TICKET is what must not happen, or
       the advisor draws from a pool one person has weighted. */
    console.log('\n  One entry per email');
    const dupDraw = (await S.create(A.id, 'Duplicate fixture')).sweepstakes;
    made.push(dupDraw.id);
    const DUP = who('dup');

    ok('nobody has entered a fresh draw',
      (await S.alreadyEntered(db, dupDraw.id, DUP)) === false);

    await share(A.id, dupDraw.id, { consumer_email: DUP });
    ok('after one entry, the same address is recognised',
      (await S.alreadyEntered(db, dupDraw.id, DUP)) === true);
    ok('CASE and whitespace do not open a second entry',
      (await S.alreadyEntered(db, dupDraw.id, '  ' + DUP.toUpperCase() + '  ')) === true,
      'Ann@Example.com would get a second ticket');
    ok('a different address has not entered',
      (await S.alreadyEntered(db, dupDraw.id, 'someone-else@example.com')) === false);

    /* Draws are independent: entering one must not lock somebody out of
       another, including another run by the same advisor. */
    const otherDraw = (await S.create(A.id, 'Other fixture')).sweepstakes;
    made.push(otherDraw.id);
    ok('entering one draw does not block another',
      (await S.alreadyEntered(db, otherDraw.id, DUP)) === false);

    /* ── THE INDEX IS THE ACTUAL GUARANTEE ────────────────────────────────
       alreadyEntered() is a check-then-act and can be raced by two submissions
       arriving together — a double-click is enough. Only the unique index in
       009-one-entry.sql actually holds, so it is proven against the database
       directly rather than through the interface that is supposed to respect
       it. Same discipline as the master-admin trigger. */
    const dupRow = {
      advisor_id: A.id, sweepstakes_id: dupDraw.id,
      answers: {}, villages: [], consumer_first: 'Dup', consumer_last: 'Fixture',
      consumer_email: DUP, consent_text: CONSENT
    };
    const raw = await db.from('journey_shares').insert(dupRow).select('id').single();
    if (!raw.error) {
      /* It went in, so 009 is not applied. Clean up the row we just made and
         say so plainly rather than passing a check that proved nothing. */
      await db.from('journey_shares').delete().eq('id', raw.data.id);
      skipped('the database REFUSES a duplicate entry',
        'migration 009 not applied — only the application check is holding');
    } else {
      ok('the database REFUSES a duplicate entry, not just the app',
        String(raw.error.code) === '23505', 'got ' + raw.error.code);

      /* And it must constrain ENTRIES only. Ordinary shares with no draw are
         the overwhelming majority and must stay unconstrained — a partial
         index is the difference between one entry per draw and one share per
         person, ever. */
      const a1 = await db.from('journey_shares').insert(
        Object.assign({}, dupRow, { sweepstakes_id: null })).select('id').single();
      const a2 = await db.from('journey_shares').insert(
        Object.assign({}, dupRow, { sweepstakes_id: null })).select('id').single();
      ok('but allows two ordinary shares from the same person',
        !a1.error && !a2.error,
        'the index is not partial — it would cap non-entrants too');
    }

    /* ── End to end through the real handler ──────────────────────────────── */
    const handler = require('../api/share.js');
    const post = (payload) => new Promise((resolve) => {
      const res = { _c: 200, setHeader() {}, status(c) { this._c = c; return this; },
        send(b) { resolve({ code: this._c, body: JSON.parse(b || '{}') }); },
        end(b) { resolve({ code: this._c, body: JSON.parse(b || '{}') }); } };
      handler({ method: 'POST', headers: {}, body: payload }, res);
    });

    const E2E = who('e2e');
    const payload = {
      firstName: 'Twice', lastName: 'Over', email: E2E, consent: true,
      consentText: CONSENT, advisor: A.public_code, sweeps: dupDraw.code,
      answers: {}, villages: []
    };

    const first = await post(payload);
    const second = await post(payload);
    ok('the first submission enters', first.body.entered === true, JSON.stringify(first.body));
    ok('the second submission still SUCCEEDS', second.body.ok === true,
      'a repeat entrant would be told their share failed');
    ok('but does not enter again', second.body.entered === false);
    ok('and says so, rather than silently doing nothing',
      second.body.alreadyEntered === true);

    const { data: e2eRows } = await db.from('journey_shares')
      .select('sweepstakes_id').eq('consumer_email', E2E);
    ok('both shares were kept', e2eRows.length === 2, e2eRows.length + ' rows');
    ok('exactly one is an entry', e2eRows.filter((r) => r.sweepstakes_id).length === 1);

    const counted = (await S.listFor(A.id)).find((d) => d.id === dupDraw.id);
    ok('the entrant count is not inflated by the repeat', counted.entries === 2,
      'expected 2 (one fixture + one e2e), got ' + counted.entries);
    ok('and the export has one row per person',
      toObjects(S.toCsv(await S.entrantsFor(A.id, dupDraw.id))).rows.length === 2);

    /* Left for cleanup(), which now matches the whole prefix. */

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
    /* The two entrants are distinct people now that 009 forbids one address
       entering twice, so the export is checked against BOTH of them rather
       than against a single shared fixture address. */
    const expected = [who('e1'), who('e2')].sort();
    ok('carries the contact details a draw needs',
      out.rows.every((r) => !!r.firstname && !!r.email),
      JSON.stringify(out.headers));
    ok('carries exactly the entrants and nobody else',
      JSON.stringify(out.rows.map((r) => r.email).sort()) === JSON.stringify(expected),
      out.rows.map((r) => r.email).join(', '));
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
