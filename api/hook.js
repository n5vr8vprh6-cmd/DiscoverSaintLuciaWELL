/* ============================================================================
   /api/hook — ThriveCart tells us somebody bought a build pack
   ----------------------------------------------------------------------------
   The only endpoint in this product that money passes through, which sets the
   standard for everything below: it fails closed, it never trusts the body
   about who anybody is, and it writes down every single thing that arrives.

   ── WHAT "FAILS CLOSED" MEANS HERE ────────────────────────────────────────
   It means NOTHING IS EVER GRANTED unless the secret matches, the product is
   the build pack, and the event is one we act on. It does NOT mean the request
   fails: a webhook that returns 4xx/5xx to everything cannot even be saved in
   ThriveCart, which validates the URL first — the original version of this
   file made the integration impossible to set up. Anything we cannot act on
   returns 200 having done nothing, and 5xx is kept for our own failures, where
   a retry is the right answer.

   ── IT FAILS CLOSED, FOUR WAYS ────────────────────────────────────────────
   1. NO SECRET CONFIGURED, NOTHING GRANTED. If THRIVECART_SECRET is unset the
      endpoint acknowledges and grants nothing, loudly, in the log.
   2. THE SECRET IS COMPARED IN CONSTANT TIME. A byte-by-byte early return
      leaks the secret to anybody patient enough to measure. An unauthenticated
      request is also recorded NOWHERE — otherwise anyone could fill the ledger.
   3. AN UNRECOGNISED PRODUCT GRANTS NOTHING. Duncan sells more than one thing
      through ThriveCart. A Foundations purchase must not quietly hand out
      build packs, so the product has to match THRIVECART_BUILDPACK_ID — and
      when it does not, the event is RECORDED with a delta of zero and a note,
      not dropped. Somebody paid; the evidence has to exist.
   4. NO EVENT ID, NO GRANT. Idempotency depends on it, and a grant we cannot
      make idempotent is a grant that doubles on the provider's first retry.

   ── IT NEVER TRUSTS THE BODY ABOUT IDENTITY ───────────────────────────────
   The payload says which email bought. It does not get to say which advisor
   that is, what they should receive, or how many. The email is looked up; the
   pack size comes from our own constant. A body field named `builds` would be
   somebody else's arithmetic running on our balance.

   ── AND IT NEVER LOSES A PAYING CUSTOMER ──────────────────────────────────
   A purchase whose email matches no advisor is recorded with advisor_id null
   and a note, and returns 200. Returning an error would make ThriveCart retry
   forever against a mismatch that retrying cannot fix, while the person who
   paid stays invisible. Recorded, it is one query for Duncan to find and one
   grant to settle.

   ── WHY THE PARSING IS TOLERANT ───────────────────────────────────────────
   I do not have ThriveCart's payload in front of me, and guessing a single
   exact shape would produce an endpoint that silently matches nothing. So it
   accepts JSON or form encoding, looks for each field under several documented
   spellings, and stores the body either way. The first real webhook will show
   exactly what arrives, and `raw` is what makes tightening this a five-minute
   job rather than an investigation. `node tools/read-webhook.js` prints it.

   THE STORED BODY IS REDACTED FIRST — see redact() below. Everything survives
   except the shared secret, which must never reach the database.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const { db, json } = require('./_lib/core.js');
const BUILDS = require('./_lib/builds.js');

const PROVIDER = 'thrivecart';

/* Events that mean "they paid". Anything else is recorded and ignored. */
const PAID = ['order.success', 'order_success', 'purchase', 'order.completed', 'upsell.accepted'];
const REFUNDED = ['order.refund', 'order_refund', 'refund', 'order.chargeback', 'rebill.failed'];

module.exports = async function handler(req, res) {
  /* ── 2xx MEANS "RECEIVED", NOT "ACTED ON" ────────────────────────────────
     The first version answered 405 to a GET and 503 while the secret was
     unset, which was wrong in a way that only showed up against the real
     provider: ThriveCart validates the URL before it will save the webhook,
     the probe never saw a 2xx, and the integration could not be set up at all.
     Failing closed had been implemented as failing the request, and those are
     not the same thing.

     What must fail closed is GRANTING. So every request we cannot act on now
     returns 200 having granted nothing — which is what the product-mismatch
     and ignored-kind paths already did — and 5xx is reserved for the cases
     where WE failed at something a retry could fix. An unauthenticated request
     is still recorded nowhere and still moves no balance.

     It also leaks less: a uniform 200 tells somebody probing this endpoint
     nothing about whether they guessed the secret. */
  const received = (reason, extra) =>
    json(res, 200, Object.assign({ ok: true, granted: 0, reason }, extra || {}));

  if (req.method !== 'POST') {
    /* A validation probe, or somebody in a browser. Does nothing, says so. */
    return json(res, 200, { ok: true, endpoint: 'thrivecart-webhook', method: 'POST' });
  }

  const secret = process.env.THRIVECART_SECRET;
  const body = (await readBody(req)) || {};

  if (!secret) {
    console.error('hook: THRIVECART_SECRET is not set — received a webhook and granted nothing');
    return received('not_configured');
  }

  /* ── ANY MATCHING CREDENTIAL AUTHENTICATES, NOT THE FIRST ONE FOUND ──────
     The secret can arrive by several routes and this used to take the FIRST
     one present, which is a different thing entirely. ThriveCart's real
     payload turned out to carry a `thrivecart_secret` field AND the ?k= we
     configured; the body value won the `||` chain, did not match, and the
     correctly-configured query string was never consulted. A non-matching
     credential shadowed a matching one, and the log said only "secret did not
     match" — true, and useless.

     So: collect every candidate and accept if ANY of them matches. Written
     without an early return so the work does not vary with how many
     candidates happen to be present. */
  const url = new URL(req.url || '/', 'https://x');
  const candidates = [
    body.thrivecart_secret, body.secret, body['x-thrivecart-secret'],
    url.searchParams.get('k'), url.searchParams.get('secret'),
    req.headers['x-thrivecart-secret']
  ].filter((v) => v !== undefined && v !== null && v !== '');

  let authenticated = false;
  candidates.forEach((c) => { if (constantEquals(c, secret)) authenticated = true; });

  if (!authenticated) {
    /* Nothing is recorded: an unauthenticated request must not be able to
       write rows into the ledger. Logged, so a misconfiguration is visible.

       ── WHY THIS LOGS A SHAPE ────────────────────────────────────────────
       "Secret did not match" told us ThriveCart had called and been refused,
       and nothing else — not whether the query string survived being saved,
       not whether the secret was in the body under a name we do not read. A
       rejected webhook is the one case with NO row to inspect afterwards, so
       the log line is the only evidence there will ever be.

       Only OUR OWN vocabulary is logged: whether a query string was present,
       which of the field names we already look for appeared, and how many
       fields arrived. No values, and no attacker-supplied strings. */
    const shape = [
      url.search ? 'query:yes' : 'query:no',
      'bodyFields:' + Object.keys(body).length,
      'secretFieldsPresent:' + (['thrivecart_secret', 'secret', 'x-thrivecart-secret']
        .filter((n) => body[n] !== undefined).join(',') || 'none'),
      'productFieldsPresent:' + (['product_id', 'base_product', 'product', 'item_id']
        .filter((n) => body[n] !== undefined).join(',') || 'none')
    ].join(' ');
    console.error('hook: secret did not match — granted nothing, recorded nothing · ' + shape);
    return received('unauthorised');
  }

  const eventId = pick(body, ['event_id', 'order_id', 'invoice_id', 'id', 'transaction_id']);
  const kind = String(pick(body, ['event', 'event_type', 'type']) || 'unknown').toLowerCase();
  const email = normaliseEmail(pick(body, ['customer[email]', 'customer_email', 'email', 'buyer_email']));
  const product = String(pick(body, ['product_id', 'base_product', 'product', 'item_id']) || '');

  /* ── A SANDBOX ORDER MOVES NO REAL BALANCE ──────────────────────────────
     The first successful test purchase granted three real builds against a
     real advisor, on an order where no money moved. ThriveCart says so itself:
     mode:"test". Nothing here had thought to look.

     The exposure is small but it is the wrong shape: while a product sits in
     test mode its checkout URL still works, so anyone who found that URL could
     mint themselves build packs for nothing. A payment integration should not
     depend on a product never being left in the wrong mode.

     So a test order is RECORDED — it is still evidence, and it is how you
     confirm the wiring works — and it grants nothing. The cost is that the
     grant path can only be proven with a live purchase, which is the right way
     round for the one place money changes hands. */
  const isTest = /^(1|true|test|yes)$/i.test(String(pick(body, ['mode', 'test_mode', 'sandbox']) || ''));

  /* No id, nothing to be idempotent against. Recorded under a synthetic id so
     the arrival is still visible, and granted nothing. */
  if (!eventId) {
    await BUILDS.record({
      provider: PROVIDER, eventId: 'no-id-' + Date.now(), kind, email,
      delta: 0, note: 'No event id in the payload — cannot be made idempotent, so nothing was granted.',
      raw: redact(body)
    });
    console.error('hook: no event id', kind, email);
    return json(res, 200, { ok: true, granted: 0, reason: 'no_event_id' });
  }

  const isPaid = PAID.indexOf(kind) !== -1;
  const isRefund = REFUNDED.indexOf(kind) !== -1;

  if (!isPaid && !isRefund) {
    await BUILDS.record({ provider: PROVIDER, eventId, kind, email, delta: 0,
      note: 'Event kind not one we act on.', raw: redact(body) });
    return json(res, 200, { ok: true, granted: 0, reason: 'ignored_kind' });
  }

  /* THE PRODUCT CHECK. Fails closed: when we cannot prove this is the build
     pack, nothing is granted and the event says so in the note. */
  const expected = process.env.THRIVECART_BUILDPACK_ID;
  if (!expected || String(expected) !== product) {
    await BUILDS.record({ provider: PROVIDER, eventId, kind, email, delta: 0,
      note: expected
        ? `Product "${product}" is not the build pack (${expected}) — nothing granted.`
        : 'THRIVECART_BUILDPACK_ID is not set, so no purchase can be identified as a build pack.',
      raw: redact(body) });
    console.error('hook: product not the build pack', product, 'expected', expected || '(unset)');
    return json(res, 200, { ok: true, granted: 0, reason: 'product_mismatch' });
  }

  if (isTest) {
    await BUILDS.record({ provider: PROVIDER, eventId, kind, email, delta: 0,
      note: 'Sandbox order — recorded so you can confirm the wiring, but no money moved so no builds were granted.',
      raw: redact(body) });
    console.log('hook: sandbox order recorded, nothing granted', kind, email);
    return json(res, 200, { ok: true, granted: 0, reason: 'test_mode' });
  }

  const advisor = await advisorByEmail(email);
  const delta = isRefund ? -BUILDS.PACK_SIZE : BUILDS.PACK_SIZE;

  /* ── RECORD FIRST ───────────────────────────────────────────────────────
     The insert is the idempotency check: UNIQUE (provider, event_id) in the
     database, not a lookup-then-insert here, because the reason this exists is
     that providers retry exactly when the first attempt succeeded and the
     response was lost. A replay stops here having changed nothing. */
  const rec = await BUILDS.record({
    provider: PROVIDER, eventId, kind, email,
    advisorId: advisor ? advisor.id : null,
    delta: advisor ? delta : 0,
    note: advisor ? null : 'No advisor with this email — nobody was credited. Somebody paid; settle by hand.',
    raw: redact(body)
  });

  if (!rec.ok) {
    /* A ledger we could not write to is the one case worth a retry, because
       granting without recording is how a replay double-grants. */
    console.error('hook: could not record', rec.reason, eventId);
    return json(res, 500, { error: 'record_failed' });
  }
  if (!rec.fresh) return json(res, 200, { ok: true, granted: 0, reason: 'replay' });

  if (!advisor) {
    console.error('hook: paid but no advisor', email, eventId);
    return json(res, 200, { ok: true, granted: 0, reason: 'no_advisor' });
  }

  const g = await BUILDS.grant(advisor.id, delta);
  if (!g.ok) {
    console.error('hook: recorded but not granted', advisor.id, g.reason, eventId);
    return json(res, 500, { error: 'grant_failed' });
  }

  console.log('hook:', kind, email, delta > 0 ? '+' + delta : delta, '→', g.left);
  return json(res, 200, { ok: true, granted: delta, balance: g.left });
};

/* ── Bits ──────────────────────────────────────────────────────────────── */

async function advisorByEmail(email) {
  if (!email) return null;
  const supabase = db();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('advisors').select('id, email, foundations_at, immersion_at')
    .ilike('email', email).limit(1).maybeSingle();
  if (error) { console.error('advisorByEmail', error); return null; }
  return data || null;
}

/* Several spellings, first one that has a value. ThriveCart posts nested
   fields as customer[email] in form encoding and as an object in JSON, so
   both shapes are checked for each name. */
function pick(body, names) {
  for (const name of names) {
    if (body[name] !== undefined && body[name] !== null && body[name] !== '') return body[name];
    const m = name.match(/^(\w+)\[(\w+)\]$/);
    if (m && body[m[1]] && typeof body[m[1]] === 'object') {
      const v = body[m[1]][m[2]];
      if (v !== undefined && v !== null && v !== '') return v;
    }
  }
  return null;
}

const normaliseEmail = (v) => (v ? String(v).trim().toLowerCase().slice(0, 320) : null);

/* ── NEVER STORE THE SECRET ───────────────────────────────────────────────
   The raw body is kept because the first question when money goes wrong is
   "what exactly did they send us". But the body CONTAINS the shared secret
   that authenticates the webhook, and writing it to purchase_events would
   park it in plaintext, permanently, in the one table most likely to be read
   by somebody investigating a payment — and anyone who read it could forge
   purchases at will.

   So the secret is stripped before the body is stored. Everything else is kept
   verbatim. Matched by pattern rather than by exact key, because the cost of
   redacting one field too many is a slightly less complete record, and the
   cost of missing one is a leaked credential. */
const SECRETISH = /secret|password|passwd|token|api[_-]?key|signature|authorization/i;

function redact(body) {
  if (!body || typeof body !== 'object') return body;
  const out = Array.isArray(body) ? [] : {};
  Object.keys(body).forEach((k) => {
    const v = body[k];
    if (SECRETISH.test(k)) out[k] = '[redacted]';
    else if (v && typeof v === 'object') out[k] = redact(v);
    else out[k] = v;
  });
  return out;
}

/* Constant time, and length is compared first without leaking through an early
   return that differs in timing — timingSafeEqual throws on a length mismatch,
   so the lengths are equalised by hashing both sides. */
function constantEquals(a, b) {
  if (!a || !b) return false;
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* JSON or form encoding, capped. A webhook body should be small; anything
   large is either a mistake or somebody probing. */
function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);

    let raw = '';
    let over = false;
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 100000) { over = true; req.destroy(); }
    });
    req.on('end', () => {
      if (over) return resolve(null);
      const type = String(req.headers['content-type'] || '');
      try {
        if (/json/i.test(type)) return resolve(JSON.parse(raw || '{}'));
        const out = {};
        new URLSearchParams(raw).forEach((v, k) => { out[k] = v; });
        return resolve(out);
      } catch (e) { return resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}
