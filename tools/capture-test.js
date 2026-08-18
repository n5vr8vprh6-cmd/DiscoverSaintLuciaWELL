/* ============================================================================
   capture-test.js — /api/capture, and the guards that keep it from being a
   mail relay
   ----------------------------------------------------------------------------
     node tools/capture-test.js

   This is the second endpoint in the system that sends mail to an address a
   stranger typed, and unlike api/share.js it is not attached to an advisor, a
   record, or anything that would later show somebody had used it. So the
   guards are the product, and this file exists to try to get past them.

   NOTHING IS ACTUALLY SENT. The Resend module is stubbed, so the "did it send"
   assertions inspect the message that WOULD have gone rather than delivering
   it — which also means the composed body can be read and checked, which is
   the part that matters: this endpoint's discipline is that nothing a caller
   types reaches the message.

   The rate-limit half needs the database and reports honestly when it is
   absent, the same way tools/waitlist-test.js does.
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
} catch (e) { /* no .env: the database half is skipped and says so */ }

/* Stub the mailer before the handler is required, and keep what it was asked
   to send. */
let sent = null, sends = 0, throwNext = false;
const Module = require('module');
const realRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'resend') {
    return { Resend: class {
      get emails() {
        return { send: async (m) => {
          if (throwNext) { throwNext = false; return { error: { message: 'stubbed failure' } }; }
          sent = m; sends += 1; return {};
        } };
      }
    } };
  }
  return realRequire.apply(this, arguments);
};

process.env.NOTIFY_FROM = process.env.NOTIFY_FROM || 'Saint Lucia WELL <journeys@example.com>';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'stub-key';

const capture = require('../api/capture.js');
const { db } = require('../api/_lib/core.js');

let pass = 0, fail = 0;
const ok = (what, cond, detail) => {
  if (cond) { pass += 1; console.log('  ✓ ' + what); }
  else { fail += 1; console.log('  ✗ ' + what + (detail ? '\n      ' + detail : '')); }
};

function fakeRes() {
  const r = { statusCode: 200, headers: {}, chunks: [] };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.send = (b) => { r.chunks.push(String(b)); return r; };
  r.end = (b) => { if (b) r.chunks.push(String(b)); return r; };
  Object.defineProperty(r, 'json', { get: () => { try { return JSON.parse(r.chunks.join('')); } catch (e) { return {}; } } });
  return r;
}
const post = (body, headers) => ({
  method: 'POST', url: '/api/capture',
  headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
  body
});

const GOOD = { intention: 'restore', place: 'volcanic', companions: 'partner',
               orientation: 'vacation', pace: 'still', recognition: 'no' };
const send = async (body, headers) => {
  const res = fakeRes();
  sent = null;
  await capture(post(body, headers), res);
  return res;
};

(async () => {
  console.log('\n  /api/capture\n  ' + '─'.repeat(62));

  /* ── It does the thing it promises ───────────────────────────────────── */
  console.log('\n  The message');
  let res = await send({ email: 'reader@example.com', result: GOOD });
  ok('a valid submission is accepted', res.statusCode === 200 && res.json.ok, JSON.stringify(res.json));
  ok('one message was composed', !!sent);
  ok('addressed to the person who asked', sent && sent.to === 'reader@example.com');
  ok('it names the villages the scorer returns',
     sent && sent.html.includes('Longevity Village'),
     'recomputed server-side, never taken from the request');
  ok('it carries a link back to their own result',
     sent && /\/journey#r=restore-volcanic-partner-vacation-still-no/.test(sent.html));
  ok('there is a plain-text alternative', sent && sent.text && sent.text.length > 200);
  ok('it says the address is not kept', sent && /not kept your address/i.test(sent.text));
  ok('no date, price or promise of a series', sent && !/\$\d|weekly|series|subscribe/i.test(sent.text));

  /* ── The guard that matters most ─────────────────────────────────────── */
  console.log('\n  Nothing a caller types reaches the message');
  res = await send({ email: 'a@example.com',
    result: Object.assign({}, GOOD, { intention: '<img src=x onerror=alert(1)>' }) });
  ok('an invented answer VALUE is refused', res.statusCode === 400 && res.json.error === 'answer_unknown',
     JSON.stringify(res.json));
  ok('and nothing was composed', !sent);

  res = await send({ email: 'a@example.com', result: Object.assign({}, GOOD, { evil: 'restore' }) });
  ok('an invented QUESTION is refused', res.statusCode === 400 && res.json.error === 'answer_unknown');

  res = await send({ email: 'a@example.com', result: {} });
  ok('an empty result is refused rather than emailed', res.statusCode === 400 && res.json.error === 'no_result');

  /* ── The cheap guards ────────────────────────────────────────────────── */
  console.log('\n  The cheap guards');
  res = await send({ email: 'bot@example.com', result: GOOD, company: 'ACME' });
  ok('a filled honeypot answers success', res.statusCode === 200 && res.json.ok);
  ok('and sends nothing', !sent, 'telling a bot it failed teaches whoever wrote it to stop');

  res = await send({ email: 'not-an-address', result: GOOD });
  ok('a broken address is refused', res.statusCode === 400 && res.json.error === 'email_invalid');

  res = fakeRes();
  await capture({ method: 'GET', url: '/api/capture', headers: {} }, res);
  ok('GET is refused', res.statusCode === 405);

  /* ── Failure is reported, not swallowed ──────────────────────────────── */
  console.log('\n  Failure is honest');
  throwNext = true;
  res = await send({ email: 'reader@example.com', result: GOOD });
  ok('a send failure is a 502, not a thank-you', res.statusCode === 502 && res.json.error === 'send_failed',
     'this email IS the thing they asked for — swallowing the failure would be a lie');

  const savedKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  res = await send({ email: 'reader@example.com', result: GOOD });
  ok('an unconfigured mailer answers 503 rather than pretending', res.statusCode === 503);
  process.env.RESEND_API_KEY = savedKey;

  /* ── The rate limit ──────────────────────────────────────────────────── */
  console.log('\n  The rate limit');
  if (!db() || !process.env.IP_HASH_SALT) {
    console.log('    skipped — needs SUPABASE_* and IP_HASH_SALT in .env');
  } else {
    const ip = '203.0.113.' + (1 + Math.floor(Date.now() % 200));
    const hdr = { 'x-forwarded-for': ip };
    let refused = null, allowed = 0;
    for (let i = 0; i < 7; i++) {
      const r = await send({ email: `r${i}@example.com`, result: GOOD }, hdr);
      if (r.statusCode === 200) allowed += 1;
      else if (r.statusCode === 429) { refused = i + 1; break; }
    }
    ok('the sixth request from one origin is refused', refused === 6,
       `allowed ${allowed}, first refusal at attempt ${refused}`
       + ' — if this says "allowed 7" the table is missing and the limit is failing OPEN');
    ok('and it says why, so the person can be told',
       (await send({ email: 'r@example.com', result: GOOD }, hdr)).json.error === 'rate_limited');

    /* Sweep the rows this made. They hold only a hash, but a test that leaves
       state behind is a test that eventually explains a mystery. */
    const { ipHash } = require('../api/_lib/core.js');
    const hash = ipHash({ headers: hdr });
    const { data } = await db().from('capture_rate').select('id').eq('ip_hash', hash);
    if (data && data.length) {
      await db().from('capture_rate').delete().eq('ip_hash', hash);
      console.log(`    swept ${data.length} rate row(s)`);
    }
  }

  /* ── The limit fails closed ──────────────────────────────────────────── */
  console.log('\n  A limit that cannot be checked has not been passed');
  {
    const saved = process.env.SUPABASE_URL;
    delete process.env.SUPABASE_URL;          /* db() returns null */
    delete require.cache[require.resolve('../api/_lib/core.js')];
    delete require.cache[require.resolve('../api/capture.js')];
    const isolated = require('../api/capture.js');
    const r = fakeRes();
    sent = null;
    await isolated(post({ email: 'x@example.com', result: GOOD },
                        { 'x-forwarded-for': '203.0.113.99' }), r);
    ok('with no database it refuses rather than sending unlimited mail',
       r.statusCode === 503 && !sent,
       'the first run of this file allowed 7 of 7 because a failed count reads as zero');
    process.env.SUPABASE_URL = saved;
    delete require.cache[require.resolve('../api/_lib/core.js')];
    delete require.cache[require.resolve('../api/capture.js')];
  }

  /* ── The promise on the page ─────────────────────────────────────────── */
  console.log('\n  Nothing is stored');
  const src = fs.readFileSync(path.join(__dirname, '..', 'api', 'capture.js'), 'utf8');
  ok('capture.js writes to exactly one table, and it is the rate counter',
     (src.match(/\.from\('([a-z_]+)'\)/g) || []).every((m) => m.includes('capture_rate')),
     'the consent line promises the address is not kept; this is that promise as a test');
  ok('the word "email" never appears in an insert',
     !/insert\([^)]*email/i.test(src));

  console.log('\n  ' + '─'.repeat(62));
  console.log(`  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('\n  threw:', e); process.exit(1); });
