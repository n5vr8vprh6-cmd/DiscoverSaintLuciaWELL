/* ============================================================================
   hub-test.js — the Hub's decision logic, tested without a database
   ----------------------------------------------------------------------------
   Everything here is pure: reference resolution, the travel-window mapping, the
   attention ranking, the grounded briefing, and safeNext. No network, no
   Supabase, no deploy. Run it before pushing.

     node tools/hub-test.js

   WHAT IT IS REALLY GUARDING
   Three of these decide what an advisor believes about a real person — which
   Journey looks urgent, how soon they are travelling, and what the briefing
   claims they asked for. A quiet bug in any of them is worse than a crash,
   because nobody would notice.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { REF } = require('../api/_lib/advisors.js');
const { normaliseWindow } = require('../api/share.js');
const { attentionScore, needsAttention } = require('../api/_lib/hub-data.js');
const { brief, answerLabel } = require('../api/_lib/hub-brief.js');
const { safeNext } = require('../api/_lib/auth.js');
const { STAGES, WINDOW_LABEL, WINDOW_ORDER, since } = require('../api/_lib/hub-render.js');

const results = [];
const check = (n, pass, d) => results.push({ n, pass: !!pass, d: d || '' });
const day = (n) => new Date(Date.now() - n * 86400000).toISOString();

/* ── Reference shape ─────────────────────────────────────────────────────── */
check('a public code is a valid reference', REF.test('8K4PX7'));
check('a legacy slug is a valid reference', REF.test('diana-lee'));
check('a reference cannot contain a space', !REF.test('diana lee'));
check('a reference cannot contain a quote', !REF.test("d'lee"));
check('a reference cannot be a URL', !REF.test('https://x.test'));
check('a single character is rejected', !REF.test('a'));

/* ── Travel windows ──────────────────────────────────────────────────────
   The rule that matters: legacy "Within 3 months" must NEVER become the
   under-30-day bucket. Promoting it would invent urgency the consumer never
   expressed and put them at the top of an advisor's list on a guess. */
check('a known bucket is trusted', normaliseWindow('3-6mo', '') === '3-6mo');
check('an unknown bucket falls back to the prose', normaliseWindow('nonsense', '3–6 months') === '3-6mo');
check('legacy "Within 3 months" maps to 31-90d, never 30d',
  normaliseWindow('', 'Within 3 months') === '31-90d');
check('"Within the next month" maps to 30d', normaliseWindow('', 'Within the next month') === '30d');
check('legacy "6–12 months" maps to 6-12mo', normaliseWindow('', '6–12 months') === '6-12mo');
check('legacy "More than a year away" maps to 12mo+', normaliseWindow('', 'More than a year away') === '12mo+');
check('no answer is "exploring", not urgent', normaliseWindow('', '') === 'exploring');
check('every window has a label',
  Object.keys(WINDOW_ORDER).every((k) => !!WINDOW_LABEL[k]));

/* ── Attention ranking ───────────────────────────────────────────────────── */
const mk = (o) => Object.assign({
  id: o.id || 'x', stage: 'new', created_at: day(1), travel_window: '3-6mo',
  answers: {}, villages: []
}, o);

check('a booked Journey drops out of the ranking', attentionScore(mk({ stage: 'booked' })) < 0);
check('a closed Journey drops out of the ranking', attentionScore(mk({ stage: 'closed' })) < 0);
check('an uncontacted Journey outranks a contacted one of the same age',
  attentionScore(mk({ stage: 'new' })) > attentionScore(mk({ stage: 'contacted' })));
check('travelling sooner ranks higher, all else equal',
  attentionScore(mk({ travel_window: '30d' })) > attentionScore(mk({ travel_window: '12mo+' })));
check('a week-old unanswered Journey outranks a fresh contacted one',
  attentionScore(mk({ stage: 'new', created_at: day(7) })) >
  attentionScore(mk({ stage: 'contacted', created_at: day(0) })));

const ranked = needsAttention([
  mk({ id: 'booked', stage: 'booked' }),
  mk({ id: 'old-contacted', stage: 'contacted', created_at: day(20) }),
  mk({ id: 'fresh-new', stage: 'new', created_at: day(0), travel_window: '30d' })
]);
check('the ranking excludes settled Journeys and leads with the new one',
  ranked.length === 2 && ranked[0].id === 'fresh-new', ranked.map((r) => r.id).join(','));

/* ── The briefing ────────────────────────────────────────────────────────
   The load-bearing property is that it says nothing the consumer did not. */
const full = brief({
  consumer_first: 'Marguerite', consumer_last: 'Okonkwo',
  answers: { intention: 'reflect', companions: 'family', pace: 'gentle', recognition: 'yes' },
  villages: ['Rainforest', 'Ocean'], travel_window: '30d', created_at: day(0),
  context: 'I have not taken more than four days off in three years.'
});
check('the briefing names the intention they chose',
  full.lines.some((l) => /space to think clearly/.test(l)));
check('the briefing lists the villages matched',
  full.lines.some((l) => /Rainforest and Ocean/.test(l)));
check('the briefing states the travel window as a sentence',
  full.lines.some((l) => /within the next month/.test(l)));
check('their own words are carried verbatim, not paraphrased',
  full.quote === 'I have not taken more than four days off in three years.');
check('Eclipse is worded as recognition, never as a diagnosis',
  /recognised the description/.test(full.eclipse) && /not a diagnosis/.test(full.eclipse));
check('the briefing never asserts burnout',
  !/burn ?out|burned out|exhausted|depressed/i.test(JSON.stringify(full)));
check('discovery prompts are questions, not instructions to sell',
  full.prompts.length > 0 && !/pitch|upsell|close the sale/i.test(full.prompts.join(' ')));

const bare = brief({ consumer_first: 'Sam', consumer_last: 'Ng', answers: {}, villages: [], created_at: day(0) });
check('a Journey with no answers produces no invented lines', bare.lines.length === 0);
check('no answers means no quote and no Eclipse note', bare.quote === null && bare.eclipse === null);
check('an anonymous Journey still names itself safely',
  brief({ answers: {}, villages: [], created_at: day(0) }).opening === 'Someone shared this Journey with you.');

/* ── Labels ──────────────────────────────────────────────────────────────── */
check('a stored code is never shown to the advisor',
  answerLabel('intention', 'reflect') === 'Space to think clearly');
check('an unknown code degrades to itself rather than throwing',
  answerLabel('intention', 'mystery') === 'mystery');
check('all six stages have labels', STAGES.length === 6);

/* ── safeNext ────────────────────────────────────────────────────────────── */
check('safeNext keeps a Hub path', safeNext('/hub/journeys/abc') === '/hub/journeys/abc');
check('safeNext refuses another origin', safeNext('https://evil.test/x') === '/hub');
check('safeNext refuses a protocol-relative URL', safeNext('//evil.test') === '/hub');
check('safeNext collapses traversal out of the Hub', safeNext('/hub/../admin') === '/hub');
check('safeNext refuses a path that merely starts with /hub', safeNext('/hubsomething') === '/hub');

/* ── CSV ──────────────────────────────────────────────────────────────────
   The case that breaks naive parsers is the whole reason this file exists: a
   split(',') turns `"Smith, Jane"` into two fields, and the failure is not an
   error — it is an advisor created with the wrong surname and somebody else's
   email address, then sent a login link. */
const { parse, toObjects } = require('../api/_lib/csv.js');

const one = (text) => parse(text)[0];

check('a quoted field containing a comma stays one field',
  JSON.stringify(one('"Smith, Jane",jane@example.com')) === JSON.stringify(['Smith, Jane', 'jane@example.com']),
  JSON.stringify(one('"Smith, Jane",jane@example.com')));

check('an escaped quote survives',
  one('"She said ""yes""",x')[0] === 'She said "yes"',
  JSON.stringify(one('"She said ""yes""",x')));

check('a quoted field containing a newline stays one field',
  parse('a,"line one\nline two",c').length === 1 &&
  parse('a,"line one\nline two",c')[0][1] === 'line one\nline two');

check('CRLF line endings parse as one row each', parse('a,b\r\nc,d\r\n').length === 2);
check('a trailing newline does not invent a row', parse('a,b\nc,d\n').length === 2);
check('a file with no trailing newline keeps its last row', parse('a,b\nc,d').length === 2);
check('blank lines are dropped', parse('a,b\n\n\nc,d\n').length === 2);
check('empty fields are preserved', JSON.stringify(parse('a,,c')[0]) === JSON.stringify(['a', '', 'c']));

/* Excel writes a BOM. Without stripping it the first header never matches. */
const bom = toObjects('﻿email,first\nx@example.com,Jo');
check('a UTF-8 BOM does not corrupt the first header',
  bom.headers[0] === 'email' && bom.rows[0].email === 'x@example.com',
  JSON.stringify(bom.headers));

const obj = toObjects(
  'First Name,Last Name,Email,Host agency\nJo,"Park, Jr.",jo@example.com,Fora',
  { firstname: 'firstName', lastname: 'lastName', hostagency: 'hostAgency' });
check('headers normalise across spacing and case',
  JSON.stringify(obj.headers) === JSON.stringify(['firstName', 'lastName', 'email', 'hostAgency']),
  JSON.stringify(obj.headers));
check('a comma inside a quoted name survives to the object',
  obj.rows[0].lastName === 'Park, Jr.', obj.rows[0].lastName);

/* ── Masking ──────────────────────────────────────────────────────────────
   What staff see when looking at somebody else's Hub. The assertions that
   matter are the negative ones: nothing in the returned object may contain the
   real name, address or words, because this object is interpolated straight
   into a page. */
const { maskJourney } = require('../api/_lib/hub-mask.js');

const realJourney = {
  id: 'x', stage: 'new',
  consumer_first: 'Harriet', consumer_last: 'Blythe',
  consumer_email: 'harriet.blythe@gmail.com', consumer_phone: '+1 647 555 0198',
  context: 'I have not taken more than four consecutive days off in three years.'
};
const masked = maskJourney(realJourney, true);

check('masked: name reduced to initials',
  masked.consumer_first === 'H—' && masked.consumer_last === 'B—',
  masked.consumer_first + ' ' + masked.consumer_last);
check('masked: email keeps only the domain', masked.consumer_email === 'h•••@gmail.com', masked.consumer_email);
check('masked: phone keeps only the last three', masked.consumer_phone === '•••198', masked.consumer_phone);
check('masked: their own words are withheld, not obscured',
  !/three years/.test(masked.context), masked.context);
check('masked: no part of the real name survives anywhere in the object',
  !/Harriet|Blythe/.test(JSON.stringify(masked)));
check('masked: no part of the real address survives',
  !/harriet\.blythe/.test(JSON.stringify(masked)));
/* The same row is counted and sorted elsewhere in the request; mutating it
   would quietly change what those did. */
check('masking does not mutate the original row',
  realJourney.consumer_email === 'harriet.blythe@gmail.com');
check('masking off returns the very same object', maskJourney(realJourney, false) === realJourney);
check('an anonymous row masks without throwing',
  maskJourney({ id: 'y' }, true).consumer_first === 'Someone');

/* ── Encharge degrades to nothing ─────────────────────────────────────────
   The property every caller depends on: registration, approval and sharing a
   Journey must all succeed whether or not a marketing platform is configured.
   No network here — these are the no-token paths, which return before any
   request is made.

   THE REST OF THIS SUITE IS SYNCHRONOUS. These three are not, so they are
   collected and awaited before the report runs — a `.then()` that lands after
   the summary has printed is a check that silently did not happen, which is
   the one failure mode this file exists to prevent. */
const encharge = require('../api/_lib/encharge.js');
const savedToken = process.env.ENCHARGE_TOKEN;
delete process.env.ENCHARGE_TOKEN;

const enchargeFixture = { id: 'x', email: 'a@example.com', first_name: 'A', last_name: 'B' };
const asyncChecks = [
  encharge.identify(enchargeFixture)
    .then((r) => check('no token: identify no-ops rather than throwing', r === false)),
  encharge.track('advisor_registered', enchargeFixture, {})
    .then((r) => check('no token: track no-ops rather than throwing', r === false)),
  encharge.track('x', {}, {})
    .then((r) => check('an advisor with no email is skipped', r === false))
];
if (savedToken) process.env.ENCHARGE_TOKEN = savedToken;

/* ── since() ─────────────────────────────────────────────────────────────── */
check('since() reads as today for a fresh share', since(day(0)) === 'today');
check('since() reads as yesterday at one day', since(day(1)) === 'yesterday');
check('since() has no output for a missing date', since(null) === '');

/* ── Every screen can actually be loaded ─────────────────────────────────
   A screen whose require() throws is a 500 on a live route, and neither the
   route table nor any other check here notices — every assertion above works
   on modules it imported itself, and a screen nothing imports is a screen
   nothing proves.

   It has happened twice in one feature, both times a relative path copied from
   a file one directory higher: '../../lib/page.js' from a screen resolves to
   api/lib/, and so does ../../content/. Both were caught by rendering a fixture
   rather than by the suite, which is luck rather than method.

   Loading a module is not the same as exercising it. This proves only that the
   file parses and its requires resolve — which is the whole of what those two
   bugs were. */
const SCREEN_DIR = path.join(__dirname, '..', 'api', '_lib', 'hub-screens');
fs.readdirSync(SCREEN_DIR)
  .filter((f) => f.endsWith('.js'))
  .forEach((f) => {
    let err = null;
    try { require(path.join(SCREEN_DIR, f)); } catch (e) { err = e; }
    check('hub-screens/' + f + ' can be required', !err, err && String(err.message).split('\n')[0]);
  });

/* ── Report ────────────────────────────────────────────────────────────────
   Deferred until the async checks above have settled. A `.then()` that lands
   after the summary is printed is a check that silently did not run, and this
   suite exists to catch exactly that class of thing. */
Promise.all(asyncChecks).then(() => {
  let failed = 0;
  results.forEach((r) => {
    if (!r.pass) failed++;
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d && !r.pass ? '  — ' + r.d : ''}`);
  });
  console.log(`\n  ${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
});
