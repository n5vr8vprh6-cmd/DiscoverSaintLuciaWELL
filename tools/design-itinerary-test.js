/* ============================================================================
   design-itinerary-test.js — the artifact that leaves the building
   ----------------------------------------------------------------------------
     node tools/design-itinerary-test.js

   Stubbed and offline. It tests the two things that are properties of the code
   rather than of the database: what the assembled document CONTAINS, and what
   the public screen says when a link is dead.

   WHAT IT DELIBERATELY DOES NOT TEST. Immutability. That is enforced by the
   itinerary_frozen() trigger in 022, below the service role, and a test here
   could only prove that this file did not try — which is not the property that
   matters. The trigger's own do-block reports it when the migration runs, and
   tools/design-migration-check.js confirms the table is there.
   ========================================================================== */
'use strict';

process.env.OPENAI_STUB = '1';

const IT = require('../api/_lib/design-itinerary.js');
const D = require('../api/_lib/design-data.js');

let failed = 0;
let ran = 0;

function ok(label, cond, detail) {
  ran++;
  if (cond) { console.log('    PASS  ' + label); return; }
  failed++;
  console.log('    FAIL  ' + label + (detail ? '\n          ' + detail : ''));
}

const RHYTHM = {
  rhythm: [
    { key: 'd1', text: 'Arrival decompression' },
    { key: 'd2', text: 'Structured protocol days' },
    { key: 'd3', text: 'Gentle nature and ocean' },
    { key: 'd4', text: 'Protected transition home' }
  ]
};

(async () => {
  console.log('\n  ASK WELL — THE ITINERARY');
  console.log('  ' + '─'.repeat(64));

  /* ── The day layout ──────────────────────────────────────────────────── */
  console.log('\n  The days');

  const six = IT.days(RHYTHM, 6, {});
  ok('six nights fills six days', six.length === 6);
  ok('the arrival day happens once, first',
    six.filter((d) => d.shape === 'Arrival decompression').length === 1 &&
    six[0].shape === 'Arrival decompression');

  /* The bug this test exists for. Clamping the index repeated the LAST rhythm
     entry to fill, so a 6-night trip on a 4-day recipe told the client they
     were going home on days 4, 5 and 6. It was invisible in the data and
     obvious the moment the page was rendered. */
  const departures = six.filter((d) => d.shape === 'Protected transition home');
  ok('the departure day happens ONCE, last',
    departures.length === 1 && six[5].shape === 'Protected transition home',
    'got: ' + six.map((d) => d.shape).join(' | '));

  const ten = IT.days(RHYTHM, 10, {});
  ok('and still once at ten nights',
    ten.filter((d) => d.shape === 'Protected transition home').length === 1 &&
    ten[9].shape === 'Protected transition home');

  const short = IT.days(RHYTHM, 3, {});
  ok('fewer nights than the recipe just takes the first days',
    short.length === 3 && short[0].shape === 'Arrival decompression');

  /* With no interior to stretch there is nothing honest to put in the middle,
     so the middle stays blank rather than confidently wrong. */
  const two = IT.days({ rhythm: [{ key: 'a', text: 'Arrive' }, { key: 'b', text: 'Go home' }] }, 5, {});
  ok('a two-day recipe leaves the middle BLANK rather than guessing',
    two[0].shape === 'Arrive' && two[4].shape === 'Go home' &&
    two.slice(1, 4).every((d) => d.shape === null),
    'got: ' + two.map((d) => d.shape).join(' | '));

  ok('no recipe and no nights makes no days', IT.days(null, null, {}).length === 0);

  /* ── What the document carries ───────────────────────────────────────── */
  console.log('\n  What the document carries, and what it must not');

  const doc = await IT.assemble({
    recipeKey: 'longevity-renewal', nights: 6,
    slugs: ['anse-chastanet', 'ladera-resort'],
    open: 'An opening.', close: 'A closing.',
    advisorNote: 'A note from the advisor.'
  });

  const flat = JSON.stringify(doc);

  ok('the places are there', doc.places.length === 2);
  ok('each place carries its verification date',
    doc.places.every((p) => Boolean(p.verified_at)));
  ok('the bank version is frozen into the document', Boolean(doc.knowledge_version));

  /* The four things that must never reach a client's document. Checked by
     KEY here — the values are checked by the privacy sweep — because these are
     fields the assembler could plausibly be asked to add one day. */
  ['price', 'priceTag', 'watch', 'verify'].forEach((k) => {
    ok('no ' + k + ' anywhere in the document',
      flat.indexOf('"' + k + '"') === -1);
  });

  /* A mismatch sentence is written for an advisor who is in the room. */
  ok('no mismatch rules reach the document',
    flat.indexOf('mismatch') === -1 && flat.indexOf('depth_gap') === -1);

  /* ── Readiness ───────────────────────────────────────────────────────── */
  console.log('\n  Readiness reports sentences, not booleans');
  ok('a complete document is ready', IT.readiness(doc).length === 0);

  const bare = await IT.assemble({ slugs: [], open: null, close: null });
  const missing = IT.readiness(bare);
  ok('an empty one names every missing piece', missing.length === 4, JSON.stringify(missing));
  ok('and names them in words an advisor can act on',
    missing.every((m) => /\s/.test(m)), JSON.stringify(missing));

  /* ── The brand snapshot ──────────────────────────────────────────────── */
  console.log('\n  The brand snapshot');
  const brand = IT.brandOf({
    first_name: 'Marguerite', last_name: 'Okonkwo', business: 'Okonkwo Travel',
    email: 'm@example.invalid', phone: '+1 416 555 0142',
    id: 'uuid-should-not-travel', password_hash: 'nope', is_house: true
  });
  ok('carries the contact details a client needs',
    brand.email === 'm@example.invalid' && brand.phone === '+1 416 555 0142');
  ok('and nothing else off the advisor row',
    Object.keys(brand).every((k) => IT.BRAND_FIELDS.indexOf(k) !== -1),
    Object.keys(brand).join(', '));

  /* ── The token ───────────────────────────────────────────────────────── */
  console.log('\n  The token');
  const h = D.hashToken('some-token');
  ok('is hashed to 64 hex characters', /^[0-9a-f]{64}$/.test(h));
  ok('hashing is stable', D.hashToken('some-token') === h);
  ok('and the hash is not the token', h.indexOf('some-token') === -1);

  /* ── The four dead states ────────────────────────────────────────────── */
  console.log('\n  A dead link says which kind of dead it is');
  const screen = require('../api/_lib/hub-screens/itinerary.js');

  /* The screen reads through design-data, so the reasons are stubbed at that
     boundary rather than by standing up a database. */
  const realRead = D.itineraryByToken;
  const cases = [
    ['revoked', 410, 'withdrawn'],
    ['expired', 410, 'expired'],
    ['not_found', 404, 'nothing at this link'],
    ['not_migrated', 503, 'problem at our end']
  ];

  for (const [reason, status, phrase] of cases) {
    D.itineraryByToken = async () => ({ ok: false, reason });
    let html = '', got = 0;
    const res = { statusCode: 200, setHeader() {}, end(b) { html = b; got = this.statusCode; } };
    await screen({ url: '/api/hub?screen=itinerary&t=x', method: 'GET' }, res);
    ok(reason + ' returns ' + status, got === status, 'got ' + got);
    ok(reason + ' says so in words', html.toLowerCase().indexOf(phrase) !== -1);
    /* The one that must not leak: a revoked document tells the reader nothing
       about what used to be there. */
    if (reason === 'revoked') {
      ok('and reveals nothing about the document',
        html.indexOf('Anse Chastanet') === -1 && html.indexOf('Okonkwo') === -1);
    }
  }
  D.itineraryByToken = realRead;

  console.log('\n  ' + '─'.repeat(64));
  if (failed) {
    console.log('  ' + failed + ' of ' + ran + ' FAILED.\n');
    process.exit(1);
  }
  console.log('  All ' + ran + ' passed.\n');
})().catch((e) => {
  console.error('\n  design-itinerary-test threw: ' + (e && e.stack) + '\n');
  process.exit(1);
});
