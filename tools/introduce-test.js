/* ============================================================================
   introduce-test.js — the warm handoff, and what it must refuse to do
   ----------------------------------------------------------------------------
     node tools/introduce-test.js

   Two things carry this feature and both are asserted against real rows:

     WHO MAY RECEIVE ONE. Only an active advisor who has accepted the current
     Advisor Data Undertaking. Everything else is a traveller's phone number
     going to somebody bound by nothing, which is the gap 007 exists to close.

     THE ENVELOPE. From the brand, to the traveller, CC the advisor, and
     REPLY-TO the advisor — that last one is what makes it a handoff rather
     than a forward. Asserted against the composed object, not against a
     rendered template, so a change to the wording cannot quietly break the
     addressing.

   Fixtures live on seed-intro-…@example.com and are removed, including on
   failure. Nothing is ever actually sent: compose() is exercised directly and
   send() is not called.
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
const I = require('../api/_lib/introductions.js');
const { UNDERTAKING_VERSION } = require('../api/_lib/undertaking.js');
const { houseAdvisor } = require('../api/_lib/advisors.js');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

let pass = 0, fail = 0, skip = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };
const skipped = (n, w) => { skip++; console.log('  – ' + n + '  (' + w + ')'); };

const STAMP = Date.now();
const EMAIL = `seed-intro-${STAMP}@example.com`;
const NOTE = 'I have been running on empty since the spring and I do not want to explain it again.';

let restore = [];

async function cleanup() {
  await db.from('journey_shares').delete().eq('consumer_email', EMAIL);
  for (const r of restore) await db.from('advisors').update(r.patch).eq('id', r.id);
}

(async () => {
  console.log('\n  THE WARM HANDOFF\n  ' + '─'.repeat(60) + '\n');

  try {
    const probe = await db.from('advisors').select('id, is_house').limit(1);
    if (probe.error) {
      console.log('  Migration 010 has not been applied.\n');
      console.log('  ' + '─'.repeat(60) + '\n  0 passed, 0 failed, 1 skipped\n');
      process.exit(0);
    }

    const { data: seeds } = await db.from('advisors')
      .select('id, first_name, last_name, email, business, market, bio, website, status, undertaking_version')
      .like('public_code', 'SEED%').limit(3);
    if (!seeds || seeds.length < 3) {
      skipped('everything', 'needs three seeded advisors — run tools/seed-advisors.js');
      throw new Error('__skip__');
    }
    const [ELIGIBLE, PAUSED, STALE] = seeds;
    seeds.forEach((a) => restore.push({ id: a.id,
      patch: { status: a.status, undertaking_version: a.undertaking_version } }));

    /* ── Eligibility ──────────────────────────────────────────────────────── */
    console.log('  Who may receive an introduction');
    await db.from('advisors').update({ status: 'active', undertaking_version: UNDERTAKING_VERSION }).eq('id', ELIGIBLE.id);
    await db.from('advisors').update({ status: 'paused', undertaking_version: UNDERTAKING_VERSION }).eq('id', PAUSED.id);
    await db.from('advisors').update({ status: 'active', undertaking_version: null }).eq('id', STALE.id);

    const list = await I.eligibleAdvisors();
    const ids = list.map((a) => a.id);
    ok('an active advisor who has accepted IS offered', ids.includes(ELIGIBLE.id));
    ok('a PAUSED advisor is not', !ids.includes(PAUSED.id),
      'somebody not taking Journeys would be handed one');
    ok('an advisor who has NOT accepted the undertaking is not', !ids.includes(STALE.id),
      'a traveller would go to somebody bound by no agreement — the 007 gap, reopened');

    /* Proven able to flip: make the stale one current and it must appear. A
       list that excluded everybody would pass the two checks above. */
    await db.from('advisors').update({ undertaking_version: UNDERTAKING_VERSION }).eq('id', STALE.id);
    ok('…and appears the moment they accept',
      (await I.eligibleAdvisors()).map((a) => a.id).includes(STALE.id),
      'the exclusions above may be an empty list rather than a working filter');
    await db.from('advisors').update({ undertaking_version: null }).eq('id', STALE.id);

    const house = await houseAdvisor(db);
    if (house) {
      ok('the house account cannot be introduced to itself',
        !(await I.eligibleAdvisors()).map((a) => a.id).includes(house.id));
    } else {
      skipped('the house account is excluded', 'none configured');
    }

    /* ── Re-checked at the point of use ───────────────────────────────────── */
    console.log('\n  Checked again when it matters');
    ok('advisorById returns an eligible advisor', !!(await I.advisorById(ELIGIBLE.id)));
    ok('but REFUSES a paused one', (await I.advisorById(PAUSED.id)) === null,
      'a screen left open would send a Journey to somebody who stopped taking them');
    ok('and refuses one who has not accepted', (await I.advisorById(STALE.id)) === null);

    /* ── The envelope ─────────────────────────────────────────────────────── */
    console.log('\n  The envelope');
    const { data: journey } = await db.from('journey_shares').insert({
      advisor_id: house ? house.id : ELIGIBLE.id,
      answers: { intention: 'restore', place: 'volcanic' },
      villages: ['Longevity', 'Nature & Renewal'],
      consumer_first: 'Mira', consumer_last: 'Hall',
      consumer_email: EMAIL, consumer_phone: '555-0142',
      timing: 'Within 3 months', context: NOTE,
      consent_text: 'fixture', stage: 'new'
    }).select('*').single();

    const target = await I.advisorById(ELIGIBLE.id);
    const mail = I.compose(journey, target, '');

    ok('From is the brand address', mail.from === process.env.NOTIFY_FROM, String(mail.from));
    ok('To is the traveller', mail.to === EMAIL);
    ok('Cc is the advisor', mail.cc === target.email);
    ok('REPLY-TO IS THE ADVISOR', mail.replyTo === target.email,
      'a reply would come back to us and the handoff would not be a handoff');
    ok('the subject introduces them by name',
      mail.subject.includes('Mira') && mail.subject.includes(target.first_name), mail.subject);

    /* ── What it must not contain ─────────────────────────────────────────── */
    console.log('\n  What it does not carry');
    ok('the traveller’s own words are NOT in the email', !mail.html.includes(NOTE),
      'quoting somebody back at themselves in front of a stranger is not an introduction');
    ok('their phone number is not in it either', !mail.html.includes('555-0142'),
      'the advisor gets it in the Hub; it does not need to be in the traveller’s inbox');
    ok('but their villages are, so the advisor is briefed',
      mail.html.includes('Longevity'));
    ok('and it says the advisor will make the first move',
      /will be in touch/.test(mail.html),
      'the burden must sit with the advisor, not the person who just handed over a number');
    ok('it names them as independent, matching what was consented to',
      /independent travel professional/.test(mail.html));

    /* ── The personal line is drafted, never invented ─────────────────────── */
    console.log('\n  The personal line');
    const line = I.suggestedLine(target, journey);
    ok('it is drafted from the profile', line.includes(target.first_name));
    if (target.business) {
      ok('and uses the business we actually hold', line.includes(target.business));
    } else {
      ok('and stays short when the profile is empty', line.length < 160, line);
    }
    const bare = I.suggestedLine({ first_name: 'Nobody' }, journey);
    ok('an empty profile invents nothing',
      !/undefined|null/.test(bare) && bare.includes('Nobody'), bare);

    ok('a supplied line replaces the draft',
      I.compose(journey, target, 'They are marvellous.').personalLine === 'They are marvellous.');

    /* ── EVERY TABLE THAT DENORMALISES advisor_id MUST MOVE, OR SAY WHY ──
       Static, no database. It reads migration 022 for tables carrying their own
       advisor_id and asserts each is either handled in introductions.js or on
       the exclusion list below with a reason.

       This exists because the handover shipped covering two of the four. The
       one it missed was journey_itineraries, and the consequence was not a
       cosmetic inconsistency: revokeItinerary() is scoped by advisor, so a
       handed-over Journey left the SENDING advisor able to withdraw a live
       document from a client who was now somebody else's.

       A table added later with no handover line is the same bug again, and
       nothing else would notice. */
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'migrations',
      '022-journey-design.sql'), 'utf8');
    const intro = fs.readFileSync(path.join(__dirname, '..', 'api', '_lib',
      'introductions.js'), 'utf8');

    /* Deliberately not moved, and why. A cost ledger follows the advisor who
       incurred the cost; reassigning it would charge one advisor's usage to
       another's hourly counter and throttle somebody who generated nothing. */
    const EXCLUDED = { design_generation: 'cost and rate-limit ledger — follows the spender' };

    const owning = [];
    sql.replace(/create table if not exists\s+(\w+)\s*\(([\s\S]*?)\n\);/g, (m, name, cols) => {
      if (/^\s*advisor_id\s+uuid/m.test(cols)) owning.push(name);
      return '';
    });

    ok('022 declares tables that own an advisor_id', owning.length >= 4, owning.join(', '));
    owning.forEach((table) => {
      if (EXCLUDED[table]) {
        ok('handover deliberately skips ' + table + ' (' + EXCLUDED[table] + ')', true);
        return;
      }
      ok('handover moves ' + table, intro.indexOf(table) !== -1,
        'introductions.js never mentions it, so a handed-over Journey leaves it behind');
    });

  } catch (e) {
    if (e.message !== '__skip__') { fail++; console.log('\n  ✗ THREW: ' + (e && e.message ? e.message : e)); }
  } finally {
    await cleanup();
  }

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed${skip ? ', ' + skip + ' skipped' : ''}\n`);
  process.exit(fail ? 1 : 0);
})();
