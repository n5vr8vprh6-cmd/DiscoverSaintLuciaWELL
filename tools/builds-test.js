/* ============================================================================
   builds-test.js — the gate, and a balance that cannot be cheated
   ----------------------------------------------------------------------------
     node tools/builds-test.js

   This is the only feature in the product with money on it, so the assertions
   are about the ways a balance goes wrong rather than the way it goes right:

     · a build spent on a generation that failed
     · a balance driven below zero
     · one plan charged twice, or two plans charged once
     · a Foundations graduate metered at all
     · a webhook replayed by the provider granting twice
     · an unauthenticated POST granting anything

   ── ON SKIPPING ───────────────────────────────────────────────────────────
   Half of this needs migration 017, and the code ships before Duncan runs it.
   Skipped checks are counted and printed as SKIPPED in the summary, never
   silently passed — a suite that reports "0 failed" while quietly testing
   nothing is worse than one that fails, because it is trusted.
   ========================================================================== */
'use strict';

const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
  const t = l.trim(); if (!t || t.startsWith('#')) return;
  const i = t.indexOf('='); if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
});

const BUILDS = require('../api/_lib/builds.js');
const { mayRefresh, rung } = require('../api/_lib/gtm.js');
const { db } = require('../api/_lib/core.js');

let pass = 0, fail = 0, skip = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };
const skipped = (n, why) => { skip++; console.log('  ⊘ ' + n + '  — ' + why); };

const REG = (n) => ({ id: 'r', plan_builds: n });
const FOUND = (n) => ({ id: 'f', plan_builds: n, foundations_at: '2026-01-01' });
const IMM = (n) => ({ id: 'i', plan_builds: n, immersion_at: '2026-01-01' });

console.log('\n  THE BUILD PACK\n  ' + '─'.repeat(60) + '\n');

/* ══ THE GATE, FOUR WAYS ═════════════════════════════════════════════════ */
console.log('  The gate');
ok('a registered advisor with builds may build', mayRefresh(REG(3)) === true);
ok('with one left, still yes', mayRefresh(REG(1)) === true);
ok('with none left, no', mayRefresh(REG(0)) === false);
ok('a Foundations graduate may build with a zero balance', mayRefresh(FOUND(0)) === true,
  'they are unlimited; the number beside them is not read');
ok('so may an Immersion graduate', mayRefresh(IMM(0)) === true);

/* THE PRE-MIGRATION FALLBACK. The code reaches production before the SQL. */
console.log('\n  Before migration 017 exists');
ok('an unknown balance is null, not zero', BUILDS.balance({ id: 'x' }) === null,
  'zero would lock every advisor out of a feature they are entitled to');
ok('mayBuild says "I cannot tell"', BUILDS.mayBuild({ id: 'x' }) === null);
ok('and the gate falls back to the OLD rule',
  mayRefresh({ id: 'x' }) === false && mayRefresh({ id: 'x', foundations_at: 'y' }) === true,
  'one plan, no rebuild — what shipped before. A payment gate must not fail open into "everything is free"');

/* ══ FOUNDATIONS IS NEVER METERED ════════════════════════════════════════ */
console.log('\n  Foundations is never metered, not even invisibly');
ok('unmetered is true for both rungs', BUILDS.unmetered(FOUND(3)) && BUILDS.unmetered(IMM(3)));
ok('their balance reads as null, not as a number', BUILDS.balance(FOUND(3)) === null,
  'a number that is read is a number that gets acted on later');
ok('and they are shown no balance line at all', BUILDS.balanceLine(FOUND(0)) === null,
  'an advisor who is not being metered must not be shown a meter');

/* ══ WHAT THE ADVISOR IS TOLD ════════════════════════════════════════════ */
console.log('\n  What it says');
ok('one is singular', /One plan build left/.test(BUILDS.balanceLine(REG(1))));
ok('three is plural', /3 plan builds left/.test(BUILDS.balanceLine(REG(3))));
ok('exhausted names the price once', /\$9, once/.test(BUILDS.balanceLine(REG(0))));
ok('and says it is not a subscription', /not a subscription/.test(BUILDS.balanceLine(REG(0))),
  'the whole reason for a pack instead of a plan is that nobody has to remember to cancel it');
ok('it says what stays free', /Editing/.test(BUILDS.balanceLine(REG(0))),
  'an advisor who thinks editing costs money will not edit, and unedited copy is the failure mode');

/* NO PADLOCK VOCABULARY — the same rule as loopback.js. */
const PADLOCK = /unlock|upgrade|premium|locked|gated|pro plan/i;
ok('no padlock vocabulary anywhere in the copy',
  [0, 1, 3].every((n) => !PADLOCK.test(BUILDS.balanceLine(REG(n)) || '')),
  '"unlock" frames the product as withholding something it has chosen not to give');

/* ══ THE WEBHOOK, WITHOUT TOUCHING THE DATABASE ══════════════════════════ */
console.log('\n  The webhook refuses before it does anything');
const hook = require('../api/hook.js');
/* core.js's json() is res.status(n).send(body), not statusCode/end. */
const mkRes = () => {
  const r = { statusCode: 0, headers: {}, payload: null };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (n) => { r.statusCode = n; return r; };
  r.send = (s) => { try { r.payload = JSON.parse(s); } catch (e) { r.payload = s; } return r; };
  return r;
};
const post = async (body, env) => {
  const saved = { s: process.env.THRIVECART_SECRET, p: process.env.THRIVECART_BUILDPACK_ID };
  if (env && 'secret' in env) { if (env.secret === null) delete process.env.THRIVECART_SECRET; else process.env.THRIVECART_SECRET = env.secret; }
  if (env && 'product' in env) { if (env.product === null) delete process.env.THRIVECART_BUILDPACK_ID; else process.env.THRIVECART_BUILDPACK_ID = env.product; }
  const res = mkRes();
  await hook({ method: 'POST', headers: {}, body }, res);
  process.env.THRIVECART_SECRET = saved.s; process.env.THRIVECART_BUILDPACK_ID = saved.p;
  return res;
};

(async () => {
  /* ── 2xx OR THE INTEGRATION CANNOT BE SET UP ─────────────────────────────
     ThriveCart validates the webhook URL before it will save it and refuses
     anything that is not 2xx. The first version answered 405 to the probe and
     503 while the secret was unset, so the webhook could not be saved at all —
     failing closed had been implemented as failing the request.

     These assertions are the record of that: the endpoint must ACKNOWLEDGE
     everything and GRANT almost nothing. */
  const g = mkRes(); await hook({ method: 'GET', headers: {} }, g);
  ok('a GET is 2xx so the provider can validate the URL', g.statusCode === 200,
    'ThriveCart will not save a webhook whose URL does not answer 2xx');
  ok('and it does nothing', g.payload.granted === undefined && !g.payload.error);

  const noSecret = await post({ event: 'order.success' }, { secret: null });
  ok('unconfigured: acknowledged, nothing granted',
    noSecret.statusCode === 200 && noSecret.payload.granted === 0
      && noSecret.payload.reason === 'not_configured',
    'the endpoint has to be savable before the secret can ever be set on it');

  const wrong = await post({ event: 'order.success', thrivecart_secret: 'nope' }, { secret: 'right' });
  ok('a wrong secret grants nothing', wrong.statusCode === 200 && wrong.payload.granted === 0
    && wrong.payload.reason === 'unauthorised');
  ok('and it says nothing about why', !/secret|length|expected|match/i.test(JSON.stringify(wrong.payload)),
    'a uniform response tells somebody probing this endpoint nothing about whether they guessed');

  /* THE SECRET MAY ARRIVE IN THE URL. Some providers offer no secret field at
     all, which makes the webhook URL itself the credential. */
  const viaUrl = mkRes();
  process.env.THRIVECART_SECRET = 'url-secret';
  await hook({ method: 'POST', url: '/api/hook?k=url-secret', headers: {},
    body: { event: 'order.viewed', order_id: 'selftest-url' } }, viaUrl);
  ok('a secret in the query string authenticates too',
    viaUrl.payload.reason === 'ignored_kind',
    'it got past the secret check, which is the point — the kind is why it stopped');
  const viaUrlBad = mkRes();
  await hook({ method: 'POST', url: '/api/hook?k=wrong', headers: {},
    body: { event: 'order.viewed', order_id: 'selftest-url2' } }, viaUrlBad);
  ok('and a wrong one in the query string does not', viaUrlBad.payload.reason === 'unauthorised');
  delete process.env.THRIVECART_SECRET;

  const noProduct = await post(
    { event: 'order.success', thrivecart_secret: 'right', order_id: 'selftest-o1', product_id: 'foundations' },
    { secret: 'right', product: 'buildpack' });
  ok('a purchase of something else grants nothing',
    noProduct.statusCode === 200 && noProduct.payload.granted === 0,
    'Duncan sells more than one thing through ThriveCart; a Foundations sale must not hand out build packs');
  ok('and the reason is product_mismatch', noProduct.payload.reason === 'product_mismatch');

  const unset = await post(
    { event: 'order.success', thrivecart_secret: 'right', order_id: 'selftest-o2', product_id: 'buildpack' },
    { secret: 'right', product: null });
  ok('with no product configured, nothing is granted',
    unset.payload.granted === 0 && unset.payload.reason === 'product_mismatch',
    'fails closed: money features do not guess');

  const ignored = await post(
    { event: 'order.viewed', thrivecart_secret: 'right', order_id: 'selftest-o3' }, { secret: 'right' });
  ok('an event kind we do not act on is ignored, not errored',
    ignored.statusCode === 200 && ignored.payload.reason === 'ignored_kind');

  /* ══ THE SECRET MUST NEVER REACH THE DATABASE ══════════════════════════
     The handler stores the raw body so a disputed payment can be reconstructed
     — and the body carries the shared secret that authenticates the webhook.
     Stored, it would sit in plaintext forever in the table most likely to be
     read by somebody investigating a payment, and anybody who read it could
     forge purchases.

     Caught by feeding a realistic payload through the reader and seeing the
     secret printed back. This asserts the fix rather than the observation. */
  console.log('\n  The shared secret never reaches the ledger');
  const src = require('fs').readFileSync(require('path').join(__dirname, '../api/hook.js'), 'utf8');
  ok('every stored body goes through redact()',
    !/raw:\s*body\b/.test(src) && /raw:\s*redact\(body\)/.test(src),
    'a single un-redacted call site is the whole leak');

  const redact = eval('(' + (src.match(/function redact\(body\)[\s\S]*?\n}/) || [])[0] + ')');
  const SECRETISH = /secret|password|passwd|token|api[_-]?key|signature|authorization/i;
  const sample = redact({
    event: 'order.success', thrivecart_secret: 'the-real-secret', order_id: 'x',
    base_product: '42', customer: { email: 'a@b.c', api_key: 'nested' }
  });
  ok('the secret is redacted', sample.thrivecart_secret === '[redacted]');
  ok('and so is a nested one', sample.customer.api_key === '[redacted]',
    'a webhook body is not flat, and a shallow scrub would miss this');
  ok('everything else survives verbatim',
    sample.base_product === '42' && sample.customer.email === 'a@b.c' && sample.order_id === 'x',
    'redacting too much would defeat the reason the body is kept at all');
  ok('no secret-shaped value is left anywhere',
    !JSON.stringify(sample).includes('the-real-secret'));

  /* ══ THE DATABASE HALF ═════════════════════════════════════════════════ */
  console.log('\n  The balance itself');
  const supabase = db();
  let migrated = false;
  if (supabase) {
    const { error } = await supabase.from('advisors').select('plan_builds').limit(1);
    migrated = !error;
  }

  if (!migrated) {
    ['a build is spent only on success',
     'the balance never goes below zero',
     'one plan costs exactly one build',
     'a Foundations graduate\'s balance never moves',
     'a replayed webhook adds once'].forEach((n) =>
       skipped(n, 'migration 017 is not applied yet'));
  } else {
    const { data: seed } = await supabase.from('advisors').select('*')
      .like('public_code', 'SEED%').eq('status', 'active').order('public_code').limit(1).single();

    const set = async (n, extra) => {
      await supabase.from('advisors').update(Object.assign({ plan_builds: n }, extra || {})).eq('id', seed.id);
      const { data } = await supabase.from('advisors').select('*').eq('id', seed.id).single();
      return data;
    };

    let a = await set(2);
    const s1 = await BUILDS.spend(a);
    ok('spending one leaves one fewer', s1.ok && s1.left === 1, JSON.stringify(s1));

    a = await set(0);
    const s0 = await BUILDS.spend(a);
    ok('spending an empty balance fails and changes nothing',
      !s0.ok && s0.reason === 'exhausted');
    const { data: after } = await supabase.from('advisors').select('plan_builds').eq('id', seed.id).single();
    ok('the balance never goes below zero', after.plan_builds === 0, String(after.plan_builds));

    /* FOUNDATIONS NEVER REACHES THE RPC. */
    a = await set(2, { foundations_at: '2026-01-01' });
    const sf = await BUILDS.spend(a);
    const { data: unchanged } = await supabase.from('advisors').select('plan_builds').eq('id', seed.id).single();
    ok('a Foundations graduate\'s balance never moves',
      sf.ok && sf.unmetered === true && unchanged.plan_builds === 2,
      'not "spent and ignored" — the number itself must not change, or somebody reads it later');
    await set(3, { foundations_at: null });

    /* GRANT ADDS, NEVER REFILLS. */
    a = await set(2);
    const g = await BUILDS.grant(seed.id, 3);
    ok('a pack ADDS three rather than refilling to three', g.ok && g.left === 5,
      'refilling would throw away builds somebody already paid for');

    /* REPLAY. */
    const eid = 'test-' + Date.now();
    const ev = { provider: 'test', eventId: eid, kind: 'order.success', advisorId: seed.id, delta: 3 };
    const r1 = await BUILDS.record(ev);
    const r2 = await BUILDS.record(ev);
    ok('the first record is fresh', r1.ok && r1.fresh === true);
    ok('a REPLAY is recognised and grants nothing', r2.ok && r2.fresh === false,
      'providers retry precisely when the first attempt worked and the response was lost');
    await supabase.from('purchase_events').delete().eq('event_id', eid);
    await set(3);
  }

  /* ══ IT CLEANS UP AFTER ITSELF ═════════════════════════════════════════
     The webhook cases above go through the REAL handler, and the handler
     records every arrival — including the ones it refuses, deliberately, so a
     payment is never lost. Before migration 017 that wrote nothing because the
     table did not exist, so this was invisible. The moment the table appeared,
     every run of this file started leaving rows in the ledger.

     purchase_events is what anyone will reach for when money is disputed. Test
     rows sitting in it are a trap for whoever looks next — the same thing the
     teardown group of the UAT plan exists to prevent, and it caught me first. */
  if (supabase) {
    const { error: ce } = await supabase.from('purchase_events').delete()
      .or('event_id.like.selftest-%,provider.eq.test');
    ok('the run leaves no rows in the ledger', !ce, ce && ce.message);
    const { count: left } = await supabase.from('purchase_events')
      .select('id', { count: 'exact', head: true }).like('event_id', 'selftest-%');
    ok('and none survive the sweep', !left, String(left));
  }

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed${skip ? `, ${skip} SKIPPED (migration 017 not applied)` : ''}\n`);
  process.exit(fail ? 1 : 0);
})();
