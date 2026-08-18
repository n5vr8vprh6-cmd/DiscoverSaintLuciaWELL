/* ============================================================================
   POST /api/capture — send a traveller their own Finder result
   ----------------------------------------------------------------------------
   F3. The form said "We can send this result and a short introduction to the
   island" from the day the Finder shipped, and could not: CAPTURE_ENDPOINT was
   an empty string, so pressing the button wrote a small apology below the fold
   and nothing left the building. Duncan found it by using his own site.

   ── THIS ENDPOINT STORES NOTHING ABOUT THE PERSON ──────────────────────────
   No table holds the address. It arrives, it is validated, it is used as the
   `to:` of one message, and it is gone when the function returns. That is the
   whole design and it is what the consent line now promises, so nothing here
   may quietly start keeping it — not "for deliverability", not "for a resend
   button", not for an ESP. If that ever needs to change, the sentence on the
   page changes first and somebody decides it deliberately.

   The one row written is in `capture_rate` (migration 019): a salted hash of
   the network address and a timestamp, so the endpoint can refuse the sixth
   request in an hour. No address, no answers, nothing identifying. See the
   migration for why that trade is the right way round.

   ── FOUR GUARDS, SAME ORDER AS api/share.js ────────────────────────────────
     1. honeypot   — the cheap bots, which fill every field they find
     2. rate limit — the same origin submitting repeatedly
     3. length caps — a single request carrying megabytes
     4. THE ANSWERS ARE NOT TRUSTED. Every value must be a known option code
        for a known question in content/journey.js before it goes near the
        message. The caller sends codes; this file looks up the labels. That is
        what makes it impossible to write the email by posting to it — which
        matters more here than anywhere else in the system, because this is an
        unauthenticated endpoint that sends mail from our domain to an address
        of the caller's choosing.
   ========================================================================== */
'use strict';

const {
  db, json, str, esc, looksLikeEmail, ipHash, body, methodGuard
} = require('./_lib/core.js');
const { finderData } = require('../content/journey.js');
const { VILLAGES } = require('../content/villages.js');

/* Same numbers as api/share.js. Generous on purpose: a real person emails
   themselves once, so this only has to stop a script, not inconvenience an
   office behind one address. */
const RATE_LIMIT = { max: 5, windowMinutes: 60 };

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.discoversaintluciawell.com';

/* Built once from the real questions, so "is this a legal answer" is decided by
   the same data the Finder scores. A new option becomes valid here the moment
   it exists there, and an invented one never does. */
const VALID = finderData.questions.reduce((map, q) => {
  map[q.id] = new Set(q.options.map((o) => o.value));
  return map;
}, {});

const VILLAGE_BY_KEY = VILLAGES.reduce((m, v) => { m[v.key] = v; return m; }, {});

/* ── The scorer, transcribed from js/journey.js ───────────────────────────────
   The email must name the villages the PERSON SAW, and the client already
   computed them — but a client-supplied list is a caller-supplied list, and
   this endpoint's whole discipline is that nothing typed becomes content. So
   the villages are recomputed here from the validated answers, tie-break and
   all. tools/finder-coverage.js checks this same arithmetic against the
   shipped scorer on all 2,160 combinations. */
function villagesFor(answers) {
  const totals = {};
  finderData.villages.forEach((v) => { totals[v.key] = 0; });

  finderData.questions.forEach((q) => {
    const opt = q.options.find((o) => o.value === answers[q.id]);
    if (!opt || !opt.weights) return;
    Object.keys(opt.weights).forEach((k) => {
      if (totals[k] !== undefined) totals[k] += opt.weights[k];
    });
  });

  return finderData.villages
    .map((v, i) => ({ v, n: totals[v.key], i }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, 3)
    .map((r) => r.v);
}

/* The link the Finder itself builds (js/journey.js), so the email returns
   somebody to the exact result rather than to a description of it. Order comes
   from the questions array, which is the same order the client joins in. */
function resultLink(answers) {
  const hash = finderData.questions.map((q) => answers[q.id]).join('-');
  return `${SITE_ORIGIN}/journey#r=${encodeURIComponent(hash)}`;
}

/* ── The message ──────────────────────────────────────────────────────────── */
function compose(email, answers) {
  const villages = villagesFor(answers);
  const link = resultLink(answers);
  const named = villages.map((v) => (VILLAGE_BY_KEY[v.key] || v).name);

  const p = 'style="margin:0 0 1.2em"';
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#133239">
      <p ${p}>Here is what you told us.</p>

      <p ${p}>Three of Saint Lucia's six wellness villages answer what you named:
        <strong>${esc(named.join(', '))}</strong>. They are a starting point rather
        than a package — the order and the pace are things an advisor shapes around
        your time and who you are travelling with.</p>

      <p ${p}><a href="${link}" style="color:#8A5E15">Open your result again</a> —
        the villages, the experiences inside them and the places they happen.</p>

      <p ${p}>Saint Lucia is a small island with a lot of range: rainforest and
        sulphur springs in the south, quiet water on the west coast, cacao estates
        and Creole cooking through the middle. What makes a journey here work is
        the sequence, not the list.</p>

      <p ${p}>When you want to turn this into an actual trip,
        <a href="${SITE_ORIGIN}/about#contact" style="color:#8A5E15">speak to a
        Saint Lucia WELL advisor</a>, or
        <a href="${SITE_ORIGIN}/explore" style="color:#8A5E15">read about all six
        villages</a> first.</p>

      <p ${p}>This is the one email we said we would send. We have not kept your
        address.</p>

      <p style="margin:0">— Discover Saint Lucia WELL</p>
    </div>`;

  const text = [
    'Here is what you told us.',
    '',
    `Three of Saint Lucia's six wellness villages answer what you named: ${named.join(', ')}.`,
    'They are a starting point rather than a package — the order and the pace are',
    'things an advisor shapes around your time and who you are travelling with.',
    '',
    `Open your result again: ${link}`,
    '',
    'Saint Lucia is a small island with a lot of range: rainforest and sulphur',
    'springs in the south, quiet water on the west coast, cacao estates and Creole',
    'cooking through the middle. What makes a journey here work is the sequence,',
    'not the list.',
    '',
    `Speak to an advisor: ${SITE_ORIGIN}/about#contact`,
    `All six villages:    ${SITE_ORIGIN}/explore`,
    '',
    'This is the one email we said we would send. We have not kept your address.',
    '',
    '— Discover Saint Lucia WELL'
  ].join('\n');

  return { to: email, subject: 'Your Saint Lucia WELL result', html, text, villages: named };
}

/* ── Handler ──────────────────────────────────────────────────────────────── */
module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;

  const b = body(req);
  if (!b) return json(res, 400, { error: 'bad_body' });

  /* GUARD 1 — honeypot. Answered as success: telling a bot it failed teaches
     whoever wrote it to stop filling the field. */
  if (str(b.company, 200)) return json(res, 200, { ok: true });

  const email = str(b.email, 200).toLowerCase();
  if (!looksLikeEmail(email)) return json(res, 400, { error: 'email_invalid' });

  /* GUARD 4, run before anything expensive. Every answer must be a real option
     code for a real question. A missing answer is allowed — somebody can reach
     the result through a restored link with a question added since — but an
     INVENTED one is refused outright rather than ignored, because the only
     reason to send one is to find out what this endpoint will do with it. */
  const answers = {};
  const submitted = (b.result && typeof b.result === 'object') ? b.result : {};
  for (const key of Object.keys(submitted)) {
    if (!VALID[key]) return json(res, 400, { error: 'answer_unknown' });
    const value = str(submitted[key], 40);
    if (!VALID[key].has(value)) return json(res, 400, { error: 'answer_unknown' });
    answers[key] = value;
  }
  /* Nothing to send if nothing was answered — an empty result is not a result,
     and composing one would email somebody a page about no villages. */
  if (!Object.keys(answers).length) return json(res, 400, { error: 'no_result' });

  const from = process.env.NOTIFY_FROM;
  if (!from || !process.env.RESEND_API_KEY) {
    console.error('capture: RESEND_API_KEY / NOTIFY_FROM missing — nothing sent');
    return json(res, 503, { error: 'not_configured' });
  }

  /* GUARD 2 — rate limit. Counted in the database, because each request may be
     a different serverless instance and an in-process counter would be reset
     constantly. Skipped, loudly, when there is no salt: hashing with a
     guessable constant would be worse than not hashing. */
  const supabase = db();
  const hash = ipHash(req);
  if (supabase && hash) {
    const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60000).toISOString();
    const { count, error } = await supabase
      .from('capture_rate')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', hash)
      .gte('created_at', since);

    /* FAIL CLOSED, AND NOT ON `error` ALONE — that was the first attempt and
       the test walked straight through it.

       A head-request count against a table that does not exist comes back as
       `{ count: null, error: null, status: 204 }`. No error. No exception.
       Nothing to catch. `(count || 0) >= 5` then reads as `0 >= 5`, every
       request is allowed, and a migration nobody ran turns this into an
       unlimited mail relay whose only symptom is a log line about a failed
       insert AFTER the message has gone.

       So the test is not "did it error" but "do I know the number". A null
       count is an unknown count, and a rate limit that cannot be checked has
       not been passed. Refusing costs somebody their result email while the
       database is unreachable; allowing costs the sending reputation of the
       whole domain, and that is not a close call. */
    if (error || typeof count !== 'number') {
      console.error('capture: rate limit could not be checked — refusing.',
        (error && (error.code + ' ' + error.message)) || 'count came back null',
        '\n  If capture_rate is missing, run db/migrations/019.');
      return json(res, 503, { error: 'not_configured' });
    }
    if (count >= RATE_LIMIT.max) return json(res, 429, { error: 'rate_limited' });
  } else if (!supabase) {
    /* Same reasoning: no database means no counter means no limit. */
    console.error('capture: no database — cannot rate limit, refusing.');
    return json(res, 503, { error: 'not_configured' });
  } else {
    /* No salt is a deployment mistake rather than an outage, and core.js's
       stated rule is to skip rather than hash with a guessable constant. It
       gets the loudest line in the file instead. */
    console.error('capture: IP_HASH_SALT unset — THIS ENDPOINT IS UNRATE-LIMITED.');
  }

  const mail = compose(email, answers);

  try {
    const { Resend } = require('resend');
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      /* One message, and we are not keeping the address — so there is no list
         to leave. The header points at a reply anyway, because somebody who
         wants to say "stop" should not have to find out that there is nothing
         to stop. */
      headers: {
        'List-Unsubscribe': `<mailto:${from.replace(/.*<|>.*/g, '')}?subject=Remove%20me>`
      }
    });
    if (error) throw error;
  } catch (e) {
    /* REPORTED, NOT SWALLOWED. Unlike the waiting-list notification, this email
       IS the thing the person asked for — a failure here is a failure of the
       request, and thanking them for it would be a lie. */
    console.error('capture: send failed', (e && e.message) || e);
    return json(res, 502, { error: 'send_failed' });
  }

  /* Written only after a successful send, so a bounced or rejected message does
     not spend somebody's allowance. Best-effort: a counter that fails to record
     must not fail a message that has already gone. */
  if (supabase && hash) {
    const { error } = await supabase.from('capture_rate').insert({ ip_hash: hash });
    if (error) console.error('capture: rate row not written', error.code || '', error.message || '');
  }

  return json(res, 200, { ok: true });
};

module.exports.compose = compose;
module.exports.villagesFor = villagesFor;
module.exports.resultLink = resultLink;
module.exports.VALID = VALID;
