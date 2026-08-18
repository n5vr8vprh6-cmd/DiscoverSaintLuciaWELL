/* ============================================================================
   OPENAI — transport, and nothing else
   ----------------------------------------------------------------------------
   This file knows how to send messages to a model and get text back. It knows
   nothing about campaigns, advisors, claims or Saint Lucia. That separation is
   deliberate: the prompts change often and the transport does not, and mixing
   them is how a timeout bug ends up hiding inside a copywriting change.

   ── IT NEVER THROWS ────────────────────────────────────────────────────────
   Same contract as encharge.js. Every failure — no key, timeout, rate limit,
   malformed response — comes back as { ok:false, reason }. A campaign screen
   must render whether or not OpenAI is reachable, and a half-generated plan is
   a normal state here rather than an exception.

   ── IT ALWAYS RETURNS THE PAYLOAD ──────────────────────────────────────────
   `payload` is the exact object that was sent, or would have been sent. This
   is what makes "no consumer data reaches the AI" a test rather than an
   intention: the assertion runs against the composed request, in stub mode,
   without a network call or a token spent. A safety property nobody can afford
   to check is a safety property nobody checks.

   ── OPENAI_STUB ────────────────────────────────────────────────────────────
   With OPENAI_STUB=1 the payload is composed exactly as normal and then the
   caller's canned text is returned instead of sending it. The whole pipeline —
   prompt building, parsing, checking, storage, revert — is exercised for free
   and deterministically. What the stub does NOT prove is whether a real model
   returns text in the shape we parse; only a live call proves that, which is
   why the suite runs both ways.

   ── TIMEOUT ────────────────────────────────────────────────────────────────
   The reasoning is unchanged and the numbers are not: a call is aborted before
   the platform can kill the function, because an aborted call is one missing
   caption while a killed function is a 504 with no explanation and nothing
   written.

   WHAT CHANGED IS THE PLATFORM. This said "Vercel Hobby kills a function at
   ten seconds" and capped every caller at nine — and it went on saying it
   after the project moved to Pro, where vercel.json now sets maxDuration
   explicitly. The consequence was A-29: the skeleton call needs more than
   eight seconds once an advisor's profile is full, so the plan builder failed
   for exactly the advisors who had done the most work, three times in a row,
   while every test passed because they all run stubbed.

   So the ceiling is derived from the function's own limit rather than from a
   plan nobody is on any more, and callers ask for what they need — see
   SKELETON_BUDGET_MS and ASSET_BUDGET_MS in gtm-generate.js. Keep the two in
   step: a timeout longer than maxDuration is not a timeout, it is a 504.
   ========================================================================== */
'use strict';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/* Read at call time, not at module load. Tests flip these between cases, and a
   constant captured at require() would make the no-key path untestable in the
   same process. */
const key = () => process.env.OPENAI_API_KEY || '';
const model = () => process.env.OPENAI_MODEL || 'gpt-4o-mini';
const stubbed = () => process.env.OPENAI_STUB === '1';

/* What a caller gets if it does not say. Deliberately short: most calls in
   this system are one asset, and one slow asset must not hold a request open.
   Anything that genuinely needs longer asks for it explicitly, which makes the
   exception visible at the call site rather than hidden in a default. */
const DEFAULT_TIMEOUT_MS = 8000;

/* The most any caller may ask for, and the one number that has to stay inside
   vercel.json's maxDuration for api/gtm.js (60s), with room for the database
   write that follows. Raising one without the other is how a timeout becomes a
   504 — the failure this ceiling exists to prevent. */
const MAX_TIMEOUT_MS = 50000;
const DEFAULT_MAX_TOKENS = 900;

/* A ceiling the caller cannot raise past. Token limits are a cost control, and
   a cost control that any caller can opt out of is a suggestion. */
const HARD_MAX_TOKENS = 2000;

function configured() {
  return Boolean(key()) || stubbed();
}

/* ── What went wrong, in words that lead somewhere ────────────────────────
   ORDER MATTERS HERE, and getting it wrong is not cosmetic.

   OpenAI returns 429 for two completely different situations: genuine rate
   limiting, and an account with no credit. The first is fixed by waiting; the
   second is never fixed by waiting. An early `status === 429 → rate_limited`
   test therefore swallows the no-credit case and tells an advisor to try again
   in a moment, forever. That is exactly the bug this file shipped with — it
   surfaced the first time a real key hit a real empty account, which is also
   the only way it could have surfaced.

   So the body is read BEFORE the status is trusted: OpenAI puts "exceeded your
   current quota, please check your plan and billing details" in the message
   whichever status code it chooses to wrap it in. */
function classify(status, detail) {
  const d = String(detail || '');
  if (status === 401 || status === 403) return 'bad_key';
  if (status === 402 || /quota|billing|insufficient|credit/i.test(d)) return 'no_credit';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'upstream';
  return 'http_' + status;
}

/* ── The one call ─────────────────────────────────────────────────────────
   chat({ system, user, maxTokens, timeoutMs, temperature, stub })

   Returns, always, and never throws:
     { ok, text, reason, ms, model, usage, payload, stub }

   `stub` is the text to return in place of a real response when OPENAI_STUB=1.
   It is the caller's, not this file's, because only the caller knows the shape
   its own parser expects — a stub that does not look like real output tests
   the parser against a fiction and passes when production would fail. */
async function chat(opts) {
  const o = opts || {};
  const started = Date.now();

  const payload = {
    model: model(),
    messages: [
      { role: 'system', content: String(o.system || '') },
      { role: 'user', content: String(o.user || '') }
    ],
    max_tokens: Math.min(Number(o.maxTokens) || DEFAULT_MAX_TOKENS, HARD_MAX_TOKENS),
    /* Low but not zero. Marketing copy at 0 is repetitive across assets — the
       same sentence structure thirty times — and above about 0.8 the model
       starts reaching for the health-outcome phrasing the checker then blocks.
       This sits where output varies and stays inside the rules. */
    temperature: typeof o.temperature === 'number' ? o.temperature : 0.6
  };

  /* Composed first, returned on every path below, so a caller inspecting the
     payload gets the same object whether or not the call went out. */
  const base = { payload, model: payload.model, ms: 0, usage: null, stub: false };

  if (stubbed()) {
    return Object.assign(base, {
      ok: true,
      text: String(o.stub || ''),
      stub: true,
      ms: Date.now() - started
    });
  }

  if (!key()) {
    /* Not an error. It is the state production is in until the key is set, and
       every screen is built to render in it. */
    return Object.assign(base, { ok: false, reason: 'not_configured', text: '' });
  }

  const timeoutMs = Math.min(Number(o.timeoutMs) || DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key()
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });

    if (!res.ok) {
      /* Body may carry a useful message; it may also carry nothing. Read it
         defensively and log the STATUS, never the key or the prompt. */
      let detail = '';
      try {
        const j = await res.json();
        detail = (j && j.error && j.error.message) ? String(j.error.message).slice(0, 200) : '';
      } catch (_) { /* not JSON — the status is enough */ }

      const reason = classify(res.status, detail);
      console.error('openai ' + reason, { status: res.status, detail });
      return Object.assign(base, { ok: false, reason, detail, text: '', ms: Date.now() - started });
    }

    const json = await res.json();
    const text = json && json.choices && json.choices[0] && json.choices[0].message
      ? String(json.choices[0].message.content || '')
      : '';

    if (!text.trim()) {
      return Object.assign(base, { ok: false, reason: 'empty', text: '', ms: Date.now() - started });
    }

    return Object.assign(base, {
      ok: true,
      text,
      /* Token counts only. The content is never logged: prompts carry an
         advisor's business description, and completions become their copy. */
      usage: json.usage || null,
      ms: Date.now() - started
    });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || /abort/i.test(String(err.message || '')));
    if (!aborted) console.error('openai transport', String(err && err.message || err));
    return Object.assign(base, {
      ok: false,
      reason: aborted ? 'timeout' : 'transport',
      text: '',
      ms: Date.now() - started
    });
  } finally {
    clearTimeout(timer);
  }
}

/* What a screen shows when generation is unavailable. Distinguishes "we have
   not set this up" from "it broke", because those deserve different words and
   an advisor should never be told to try again when nothing will change. */
const REASON_TEXT = {
  not_configured: 'Plan generation is not switched on yet.',
  timeout:        'That took too long. Your other pieces are unaffected — try this one again.',
  rate_limited:   'The writing service is busy. Wait a moment and try again.',
  no_credit:      'Plan generation is temporarily unavailable.',
  bad_key:        'Plan generation is temporarily unavailable.',
  empty:          'Nothing came back. Try that piece again.',
  upstream:       'The writing service is having trouble. Your plan is saved — try again shortly.',
  transport:      'Could not reach the writing service. Your plan is saved.'
};

function reasonText(reason) {
  return REASON_TEXT[reason] || 'Something went wrong generating that piece.';
}

module.exports = {
  chat, configured, reasonText, classify,
  HARD_MAX_TOKENS, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS
};
