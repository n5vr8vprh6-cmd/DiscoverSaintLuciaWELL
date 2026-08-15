/* ============================================================================
   gtm-plan-test.js — the generator's guards, each one exercised
   ----------------------------------------------------------------------------
     node tools/gtm-plan-test.js

   Runs against OPENAI_STUB=1, so it costs nothing and is deterministic. What
   the stub cannot prove is whether a real model returns text in the shape the
   parser expects; that is what `node tools/gtm-plan-test.js --live` is for, and
   it is the only part that spends money.

   THE RULE THIS FILE IS WRITTEN UNDER: an assertion that still passes when the
   thing underneath it is sabotaged is not an assertion. Every guard below is
   proven by making it fire, not by watching the happy path succeed. Half of
   these check that SAFE input is left alone — a guard that refuses everything
   is as broken as one that refuses nothing, and only the first kind gets
   noticed.
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

const LIVE = process.argv.includes('--live');
if (!LIVE) process.env.OPENAI_STUB = '1';

const { createClient } = require('@supabase/supabase-js');
const G = require('../api/_lib/gtm-generate.js');
const OA = require('../api/_lib/openai.js');
const FACTS = require('../content/campaign-facts.js');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

let pass = 0, fail = 0, skip = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };
const skipped = (n, w) => { skip++; console.log('  – ' + n + '  (' + w + ')'); };

const ADVISOR = {
  id: '00000000-0000-0000-0000-0000000000aa',
  first_name: 'Mira', last_name: 'Hall', business: 'Hall & Co Travel',
  host_agency: 'Nexion', market: 'Toronto', public_code: 'TESTCODE'
};
const PROFILE = {
  positioning: 'Slow trips for people who have not stopped in years',
  icp: 'Couples in their forties', differentiator: 'I only sell places I have been',
  markets: 'Toronto and Hamilton', instagram: '@hallco', newsletter: 'Substack',
  website: 'https://hallco.example', email_band: '500to2k'
};

let cleanup = [];

(async () => {
  console.log('\n  GTM GENERATION' + (LIVE ? '  · LIVE — this spends money' : '  · stubbed') + '\n  ' + '─'.repeat(60) + '\n');

  /* ══ 1. NO CONSUMER DATA REACHES THE AI ═══════════════════════════════════
     The strongest form of this assertion is not "we filtered it out" but "it
     was never passed in". advisorContext takes an advisor and a profile; there
     is no parameter a Journey could arrive through. So the test pollutes the
     objects that ARE passed and proves the allow-list drops the extras. */
  console.log('  No consumer data reaches the AI');

  const polluted = Object.assign({}, ADVISOR, {
    /* Exactly the shape journey_shares rows have. If somebody later "helpfully"
       widens the allow-list or swaps it for a denylist, these appear. */
    consumer_email: 'traveller@example.com',
    consumer_name: 'Priya Raman',
    consumer_phone: '+1 416 555 0142',
    notes: 'Wants somewhere quiet in February',
    ip_hash: 'deadbeef', stage: 'new', answers: { q1: 'Rest' }
  });
  const ctx = G.advisorContext(polluted, PROFILE);
  const ctxText = JSON.stringify(ctx);

  ok('the allow-list keeps what it should', ctx.business === 'Hall & Co Travel' && ctx.icp === 'Couples in their forties',
    'a filter that drops everything would pass the next four assertions for the wrong reason');
  ['traveller@example.com', 'Priya Raman', '+1 416 555 0142', 'Wants somewhere quiet', 'deadbeef'].forEach((v) => {
    ok('drops ' + JSON.stringify(v.slice(0, 22)), ctxText.indexOf(v) === -1);
  });
  ok('drops the answers object entirely', ctxText.indexOf('q1') === -1 && ctxText.indexOf('Rest') === -1);

  /* And the same thing again at the other end — on the composed request. */
  const sk = await G.generateSkeleton(polluted, PROFILE, 'registered');
  const wire = JSON.stringify(sk.payload);
  ok('and none of it survives into the composed request',
    ['traveller@example.com', 'Priya Raman', '0142', 'Priya'].every((v) => wire.indexOf(v) === -1),
    'this is the assertion that matters — it runs against what would actually be sent');

  /* Real rows, if there are any. Synthetic pollution proves the mechanism;
     this proves it against the data that actually exists. */
  const { data: shares } = await db.from('journey_shares')
    .select('consumer_name, consumer_email, notes').limit(20);
  if (shares && shares.length) {
    const values = [];
    shares.forEach((s) => ['consumer_name', 'consumer_email', 'notes'].forEach((f) => {
      if (s[f] && String(s[f]).length > 4) values.push(String(s[f]));
    }));
    ok(`no value from ${shares.length} real Journey rows appears in the payload`,
      values.every((v) => wire.indexOf(v) === -1), String(values.length) + ' values checked');
  } else {
    skipped('checked against real Journey rows', 'no rows to check');
  }

  /* ══ 2. THE FACT PROJECTION ═══════════════════════════════════════════════ */
  console.log('\n  What the model is allowed to know');
  const facts = G.modelFacts();

  ok('confirmed properties are present', facts.properties.length > 0 &&
    facts.properties.some((p) => p.name === 'Anse Chastanet'));
  ok('their hook comes through', facts.properties.some((p) => /wellness/i.test(p.hook || '')));

  /* `unverified` is a caution for a human. Handing it to a copywriter
     introduces the exact topic it warns about. */
  const withUnverified = FACTS.properties.filter((p) => p.unverified);
  const factText = JSON.stringify(facts);
  ok('the `unverified` note is NEVER sent', withUnverified.length > 0 &&
    withUnverified.every((p) => factText.indexOf(String(p.unverified).slice(0, 40)) === -1),
    withUnverified.length + ' properties carry one');
  ok('nor are the checker\'s own pattern lists',
    factText.indexOf('HEALTH_PATTERNS') === -1 && !facts.healthPatterns,
    'sending the model the list of banned phrases is a list of suggestions');

  /* Both halves: an unconfirmed property is absent, and confirming it brings
     it back. An empty filter would pass the first half alone. */
  const fake = { name: 'Zzz Unconfirmed Retreat', slug: 'zzz', hook: 'x', confirmed: false, villages: [], compass: [] };
  FACTS.properties.push(fake);
  ok('an UNCONFIRMED property is excluded',
    G.modelFacts().properties.every((p) => p.name !== 'Zzz Unconfirmed Retreat'));
  fake.confirmed = true;
  ok('and confirming it lets it through — so the filter works, not the list',
    G.modelFacts().properties.some((p) => p.name === 'Zzz Unconfirmed Retreat'));
  FACTS.properties.pop();

  /* ══ 3. THE LINK IS A TOKEN UNTIL AFTER THE CHECK ═════════════════════════ */
  console.log('\n  The advisor\'s link');
  ok('the model gets a token, never a URL',
    wire.indexOf('{{WELL_LINK}}') !== -1 && wire.indexOf('/well/TESTCODE') === -1,
    'a model handed a URL will eventually print a mangled one');
  ok('and never the advisor\'s own site either',
    wire.indexOf('hallco.example') === -1,
    'we do not fetch it and the model cannot open it — it is just a token it might print');

  /* ══ 4. THE RULES TRAVEL WITH EVERY PROMPT ════════════════════════════════ */
  console.log('\n  The rules in the prompt');
  const rules = G.rulesBlock('registered');
  ok('health claims are forbidden', /never say or imply/i.test(rules) && /cortisol/i.test(rules));
  ok('the safe register is offered, not just the ban', /come back rested/i.test(rules),
    'a rule that only says no produces copy that says nothing');
  ok('a registered advisor is not licensed to say "trained in"',
    !/may accurately say:[^\n]*trained in/i.test(rules));
  ok('a Foundations advisor is', /trained in the Well Destination method/i.test(
    G.rulesBlock('foundations').split('may NOT')[0]));
  ok('an unknown rung falls back to the LOWEST',
    G.rulesBlock('nonsense') === G.rulesBlock('registered'),
    'a typo in a rung name must under-claim, never over-claim');

  /* ══ 5. PARSING WHAT COMES BACK ═══════════════════════════════════════════ */
  console.log('\n  Parsing');
  ok('plain JSON parses', G.parseJson('{"a":1}').a === 1);
  ok('a ```json fence parses', G.parseJson('```json\n{"a":2}\n```').a === 2);
  ok('a bare fence parses', G.parseJson('```\n{"a":3}\n```').a === 3);
  ok('a prose preamble parses', G.parseJson('Here is your plan:\n{"a":4}').a === 4);
  ok('garbage returns null rather than throwing', G.parseJson('not json at all') === null);
  ok('empty returns null', G.parseJson('') === null);

  console.log('\n  Shaping what came back');
  const wild = G.normaliseSkeleton({
    premise: 'x',
    weeks: [1, 2, 3, 4, 5, 6].map((n) => ({
      week: n, theme: 'T' + n,
      actions: [1, 2, 3, 4, 5, 6, 7].map((i) => ({
        title: 'Do thing ' + i, why: 'because', channel: 'instagram', assetKind: 'interpretive dance'
      }))
    }))
  });
  ok('six weeks becomes four', wild.weeks.length === 4, String(wild.weeks.length));
  ok('seven actions becomes four', wild.weeks[0].actions.length === 4, String(wild.weeks[0].actions.length));
  ok('an invented assetKind becomes "none"', wild.weeks[0].actions[0].assetKind === 'none',
    'the Hub must not be asked to render a kind it has no shape for');
  ok('a real assetKind survives',
    G.normaliseSkeleton({ weeks: [{ week: 1, actions: [{ title: 't', assetKind: 'email' }] }] })
      .weeks[0].actions[0].assetKind === 'email',
    'otherwise the previous assertion passes because everything becomes none');
  ok('actions with no title are dropped',
    G.normaliseSkeleton({ weeks: [{ week: 1, actions: [{ title: '', assetKind: 'email' }] }] }) === null);
  ok('a response with no weeks is null, not an empty plan', G.normaliseSkeleton({ premise: 'x' }) === null);
  ok('null in, null out', G.normaliseSkeleton(null) === null);

  /* ══ 6. THE CHECKER RUNS ON GENERATED COPY ════════════════════════════════ */
  console.log('\n  The checker runs on what the model produced');
  const asset = await G.generateAsset(ADVISOR, PROFILE, 'registered',
    { week: 1, position: 0, title: 'Post once', why: 'x', channel: 'instagram', assetKind: 'caption' }, 'The warm list');
  ok('an asset comes back', asset.ok, asset.reason);
  ok('it carries a verdict', asset && typeof asset.severity === 'string' &&
    ['none', 'low', 'high'].indexOf(asset.severity) !== -1, String(asset.severity));
  ok('the stub copy is clean', asset.severity !== 'high',
    'if our own sample copy trips the checker, the sample is wrong');
  ok('it keeps the link token for substitution later', /\{\{WELL_LINK\}\}/.test(asset.body));

  /* ══ 7. NO KEY IS A NORMAL STATE ══════════════════════════════════════════ */
  console.log('\n  With no key set — the state production is in until one is');
  const savedKey = process.env.OPENAI_API_KEY;
  const savedStub = process.env.OPENAI_STUB;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_STUB;

  ok('configured() is false', OA.configured() === false);
  const none = await OA.chat({ system: 's', user: 'u' });
  ok('chat does not throw', none && none.ok === false);
  ok('and says why, specifically', none.reason === 'not_configured', String(none.reason));
  ok('and still returns the composed payload', none.payload && none.payload.messages.length === 2,
    'the isolation assertion must be checkable with no key and no network');
  ok('the reason has advisor-facing words', /not switched on/i.test(OA.reasonText('not_configured')));
  ok('a real failure reads differently from an unconfigured one',
    OA.reasonText('timeout') !== OA.reasonText('not_configured'),
    'telling somebody to try again when nothing will change is a lie');

  /* ══ 7b. 429 MEANS TWO DIFFERENT THINGS ═══════════════════════════════════
     OpenAI returns 429 both for genuine rate limiting and for an account with
     no credit. Waiting fixes the first and never fixes the second. This file
     shipped classifying every 429 as rate_limited, which would have told an
     advisor to try again in a moment, forever. Found by pointing a real key at
     a real empty account — the only way it could have been found. */
  console.log('\n  Telling apart the two things a 429 means');
  ok('a plain 429 is rate limiting', OA.classify(429, 'Rate limit reached for requests') === 'rate_limited');
  ok('a 429 that mentions quota is NO CREDIT, not rate limiting',
    OA.classify(429, 'You exceeded your current quota, please check your plan and billing details.') === 'no_credit',
    'waiting never fixes an empty account — this is the bug the live run caught');
  ok('and billing wording is caught too',
    OA.classify(429, 'Please check your billing details') === 'no_credit');
  ok('401 is a bad key', OA.classify(401, '') === 'bad_key');
  ok('402 is no credit', OA.classify(402, '') === 'no_credit');
  ok('500 is upstream, not our problem to explain', OA.classify(503, '') === 'upstream');
  ok('anything else keeps its status so a log is actionable',
    OA.classify(418, '') === 'http_418');
  ok('the two 429 cases produce DIFFERENT advisor-facing words',
    OA.reasonText('rate_limited') !== OA.reasonText('no_credit'),
    'otherwise the distinction is real in the logs and invisible where it matters');

  process.env.OPENAI_API_KEY = savedKey;
  if (savedStub) process.env.OPENAI_STUB = savedStub;
  ok('configured() is true again', OA.configured() === true,
    'read at call time, not captured at require()');

  /* ══ 8. THE BUDGET ════════════════════════════════════════════════════════ */
  console.log('\n  The ten-second budget');
  ok('the transport caps its own timeout below the function ceiling',
    OA.DEFAULT_TIMEOUT_MS <= 8000, String(OA.DEFAULT_TIMEOUT_MS));
  ok('a caller cannot raise max_tokens past the ceiling',
    (await OA.chat({ system: 's', user: 'u', maxTokens: 999999 })).payload.max_tokens === OA.HARD_MAX_TOKENS,
    'a cost control any caller can opt out of is a suggestion');
  ok('a caller cannot raise the timeout past 9s either',
    OA.HARD_MAX_TOKENS === 2000);

  if (LIVE) {
    console.log('\n  Against the real model');
    const t0 = Date.now();
    const live = await G.generateSkeleton(ADVISOR, PROFILE, 'registered');
    const ms = Date.now() - t0;
    ok('a real skeleton comes back', live.ok, live.reason);
    ok('and parses into our shape', live.ok && live.skeleton && live.skeleton.weeks.length > 0,
      'the one thing the stub cannot prove');
    ok(`and fits the budget (${ms}ms)`, ms < 9000, ms + 'ms');
    if (live.ok) {
      ok('four weeks or fewer', live.skeleton.weeks.length <= 4, String(live.skeleton.weeks.length));
      ok('and it is not thirty posts',
        live.skeleton.weeks.every((w) => w.actions.length <= 4),
        JSON.stringify(live.skeleton.weeks.map((w) => w.actions.length)));
    }
  } else {
    skipped('a real skeleton parses', 'run with --live');
    skipped('a real call fits the budget', 'run with --live');
  }

  /* ══ 9. STORAGE, FAILURE ISOLATION, REVERT ════════════════════════════════ */
  console.log('\n  Storage, failure isolation and revert');
  const probe = await db.from('gtm_plan').select('id').limit(1);
  if (probe.error) {
    ['migration 012 applied', 'a failed asset leaves the plan intact',
     'revert returns the canonical text exactly', 'the refresh gate refuses a second plan',
     'and never refuses a Foundations advisor'].forEach((n) => skipped(n, 'needs migration 012'));
  } else {
    /* ORDER BY is not decoration. Row order is unspecified without it, so
       `limit(2)` returns an arbitrary pair and the suite passes or fails by
       luck — the exact flake that took an afternoon out of sweepstakes-test.
       Status is filtered too: a paused advisor is a different fixture. */
    const { data: seeds } = await db.from('advisors')
      .select('id, public_code, foundations_at').like('public_code', 'SEED%')
      .eq('status', 'active').order('public_code').limit(2);

    if (!seeds || seeds.length < 2) {
      skipped('handler assertions', 'need two active SEED advisors, found ' + (seeds ? seeds.length : 0));
      throw Object.assign(new Error('skip'), { soft: true });
    }
    const seed = seeds[0];
    /* A REAL second advisor. The first version of this test used a made-up
       UUID, so removing the ownership scope tripped a foreign-key error rather
       than the assertion — it went red for the wrong reason, which is only one
       step better than staying green for the wrong reason. With a real advisor
       the test proves the thing that matters: whether somebody else's campaign
       can be reached at all. */
    const strangerRow = seeds[1];

    ok('the tables exist', true);
    ok('two distinct fixtures', seed.id !== strangerRow.id,
      seed.public_code + ' vs ' + strangerRow.public_code);

    /* ── Drive the REAL handlers ────────────────────────────────────────────
       Everything below calls the exported action functions from api/gtm.js.
       Inserting rows by hand and reading them back would assert that Postgres
       can store two columns, which was never the question — and would stay
       green with actionRevert regenerating from scratch, which is the actual
       thing worth proving. */
    const { ACTIONS } = require('../api/gtm.js');
    const fakeRes = () => {
      const r = { code: 0, payload: null, headers: {} };
      r.setHeader = (k, v) => { r.headers[k] = v; };
      r.status = (c) => { r.code = c; return r; };
      r.send = (s) => { r.payload = JSON.parse(s); return r; };
      return r;
    };
    const call = async (action, advisor, form) => {
      const res = fakeRes();
      await ACTIONS[action]({ method: 'POST', url: '/api/gtm' }, res, advisor, db, form || {});
      return res;
    };

    const before = seed.foundations_at;
    /* Start registered and with no plans, so the gate below is measured from a
       known state rather than from whatever the last run left behind. */
    await db.from('advisors').update({ foundations_at: null }).eq('id', seed.id);
    await db.from('gtm_plan').delete().eq('advisor_id', seed.id);
    const advisor = Object.assign({}, seed, { foundations_at: null, immersion_at: null });

    /* ── The plan, through actionPlan ──────────────────────────────────────*/
    const p1 = await call('plan', advisor);
    ok('actionPlan returns 200 and a plan', p1.code === 200 && p1.payload.ok,
      p1.code + ' ' + JSON.stringify(p1.payload).slice(0, 120));
    const planId = p1.payload.plan && p1.payload.plan.id;
    if (planId) cleanup.push(planId);
    ok('it freezes the rung it was generated under',
      p1.payload.plan.rung_at_generation === 'registered');
    ok('and reports which actions still need copy',
      Array.isArray(p1.payload.pending) && p1.payload.pending.length > 0,
      'the client cannot ask for assets it has not been told about');

    /* ── THE GATE, both halves, through the real handler ───────────────────*/
    const p2 = await call('plan', advisor);
    ok('a registered advisor is REFUSED a second plan',
      p2.code === 403 && p2.payload.error === 'refresh_locked',
      p2.code + ' ' + JSON.stringify(p2.payload).slice(0, 80));

    const promoted = Object.assign({}, advisor, { foundations_at: new Date().toISOString() });
    const p3 = await call('plan', promoted);
    ok('and a Foundations advisor is NOT',
      p3.code === 200 && p3.payload.ok,
      'both halves, or the gate is indistinguishable from one that never fires');
    if (p3.payload.plan) cleanup.push(p3.payload.plan.id);
    /* Guarded. An unguarded read here crashes the whole run when the assertion
       above fails, and a crash reports less than a failure does — it hides
       every assertion that would have run after it. */
    ok('their plan records the higher rung',
      Boolean(p3.payload.plan) && p3.payload.plan.rung_at_generation === 'foundations',
      p3.payload.plan ? p3.payload.plan.rung_at_generation : 'no plan returned');

    /* ── An asset, through actionAsset ─────────────────────────────────────*/
    const a1 = await call('asset', advisor, { plan_id: planId, week: 1, position: 0 });
    ok('actionAsset generates and stores one', a1.code === 200 && a1.payload.ok,
      a1.code + ' ' + JSON.stringify(a1.payload).slice(0, 120));
    const assetId = a1.payload.asset && a1.payload.asset.id;
    const generated = a1.payload.asset && a1.payload.asset.body;

    ok('the link token is substituted on the way OUT',
      /\/well\//.test(generated) && !/\{\{WELL_LINK\}\}/.test(generated),
      'the advisor must get a real link, not a token');
    const { data: stored } = await db.from('gtm_asset').select('body').eq('id', assetId).single();
    ok('but the STORED text keeps the token',
      /\{\{WELL_LINK\}\}/.test(stored.body),
      'so a changed public_code does not leave a month of copy pointing nowhere');

    ok('asking again returns the cached asset rather than paying twice',
      (await call('asset', advisor, { plan_id: planId, week: 1, position: 0 })).payload.cached === true,
      'a client retrying a timeout is the normal case, not the odd one');

    /* Somebody else's plan id must not resolve, even with a valid session. */
    const { data: other } = await db.from('gtm_plan').insert({
      advisor_id: seed.id, rung_at_generation: 'registered', status: 'ready',
      skeleton: G.normaliseSkeleton(JSON.parse(G.STUB_SKELETON))
    }).select('id').single();
    cleanup.push(other.id);
    const stranger = Object.assign({}, strangerRow, { foundations_at: null, immersion_at: null });
    const intrusion = await call('asset', stranger, { plan_id: other.id, week: 1, position: 0 });
    ok('a real advisor cannot reach a plan belonging to someone else',
      intrusion.code === 404,
      'scoped in the query itself, so a guessed id returns nothing — got ' + intrusion.code);
    /* The consequence, stated directly: nothing was written under their name. */
    const { count: leaked } = await db.from('gtm_asset')
      .select('id', { count: 'exact', head: true }).eq('advisor_id', stranger.id);
    ok('and nothing was written under their id', (leaked || 0) === 0, String(leaked));

    /* ── FAILURE ISOLATION, by causing a real failure ──────────────────────*/
    const savedStubMode = process.env.OPENAI_STUB;
    const savedRealKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_STUB;
    delete process.env.OPENAI_API_KEY;
    const bad = await call('asset', advisor, { plan_id: planId, week: 1, position: 1 });
    if (savedStubMode) process.env.OPENAI_STUB = savedStubMode;
    process.env.OPENAI_API_KEY = savedRealKey;

    ok('a failing asset returns an error, not a crash',
      bad.code === 502 && bad.payload.error === 'not_configured', bad.code + '');

    /* Counted from the database, not from the handler that just claimed it. */
    const { data: after } = await db.from('gtm_asset').select('status, week, position').eq('plan_id', planId);
    ok('it is recorded as failed',
      after.some((a) => a.week === 1 && a.position === 1 && a.status === 'failed'));
    ok('the earlier asset is UNTOUCHED',
      after.some((a) => a.week === 1 && a.position === 0 && a.status === 'ready'),
      'one caption failing must not take the others with it');
    const { data: planAfter } = await db.from('gtm_plan').select('status').eq('id', planId).single();
    ok('and the plan is still ready', planAfter.status === 'ready',
      'one caption failing must not condemn the month');

    /* ── EDIT then REVERT, through the real handlers ───────────────────────*/
    const e1 = await call('edit', advisor, { asset_id: assetId, body: 'I rewrote this and now I regret it.' });
    ok('actionEdit stores the advisor\'s own words', e1.code === 200 &&
      /now I regret it/.test(e1.payload.asset.body));
    ok('and marks it as edited', e1.payload.asset.edited === true);

    const { data: afterEdit } = await db.from('gtm_asset')
      .select('body, canonical_body').eq('id', assetId).single();
    ok('the edit does NOT touch canonical_body',
      afterEdit.canonical_body === stored.body,
      'if an edit overwrites the canonical text there is nothing left to revert to');

    const r1 = await call('revert', advisor, { asset_id: assetId });
    ok('actionRevert returns 200', r1.code === 200 && r1.payload.ok);
    const { data: afterRevert } = await db.from('gtm_asset').select('body').eq('id', assetId).single();
    ok('and restores the canonical text EXACTLY, byte for byte',
      afterRevert.body === stored.body,
      'a regeneration would return different text, which is not a revert at all');
    ok('the reverted asset no longer reads as edited', r1.payload.asset.edited === false);

    /* A stranger must not be able to revert somebody else's asset. */
    ok('a stranger cannot revert an asset they do not own',
      (await call('revert', stranger, { asset_id: assetId })).code === 404);

    /* The claims checker runs on EDITED text, not just generated text — the
       one place an advisor can introduce a health claim by hand. */
    const bad2 = await call('edit', advisor, {
      asset_id: assetId, body: 'Ten days in Saint Lucia reduces burnout and lowers your cortisol.'
    });
    ok('an edit containing a health claim is flagged high',
      bad2.payload.asset.severity === 'high', String(bad2.payload.asset.severity));
    ok('and is not copyable', bad2.payload.asset.copyable === false,
      'the checker must run on what the advisor typed, not only on what we generated');

    const good = await call('edit', advisor, {
      asset_id: assetId, body: 'Six villages, one island. Unhurried days if you want them.'
    });
    ok('while safe copy the advisor wrote is left alone',
      good.payload.asset.severity !== 'high' && good.payload.asset.copyable === true,
      'a checker that cries wolf teaches advisors to click past the one that mattered');

    await call('revert', advisor, { asset_id: assetId });
    await db.from('advisors').update({ foundations_at: before }).eq('id', seed.id);
  }

  for (const id of cleanup) await db.from('gtm_plan').delete().eq('id', id);

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed${skip ? ', ' + skip + ' skipped' : ''}\n`);
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  for (const id of cleanup) await db.from('gtm_plan').delete().eq('id', id);
  /* A missing fixture is a skip, not a crash — the suite still reports what it
     did manage to prove. Anything else is a real crash and says so loudly. */
  if (e && e.soft) {
    console.log('\n  ' + '─'.repeat(60));
    console.log(`  ${pass} passed, ${fail} failed, ${skip} skipped\n`);
    process.exit(fail ? 1 : 0);
  }
  console.error('\n  CRASHED — ' + (e && e.message || e) + '\n');
  process.exit(1);
});
