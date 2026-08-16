/* ============================================================================
   /hub/campaign/profile — five questions, then a read they can change
   ----------------------------------------------------------------------------
   One question per screen, one submit per question, resumable. Nothing is held
   in the browser, so a closed tab loses nothing and there is no client-side
   form state to go stale.

   ── WHY IT IS NOT ONE LONG PAGE ────────────────────────────────────────────
   The Strategist Bible's rule is that questions are a cost, and the corollary
   is that a page showing five at once reads as a form. Five screens showing one
   each reads as a conversation, and each one can afford to say WHY it is asking
   — which is the only thing that makes a question feel worth answering.

   ── THE REVEAL IS A READ, NOT A VERDICT ────────────────────────────────────
   Section 6 §6 ranks typology labels as the weakest evidence available and says
   never to use them as deterministic rules. So the persona is offered as a
   starting read with the correction one click away, it carries what this
   profile characteristically gets WRONG rather than only its flattery, and the
   correction is stored separately because it is better evidence than the five
   answers that produced the original.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { str, body: parseBody } = require('../core.js');
const { hubPage, esc, pageHead } = require('../hub-render.js');
const { profileFor, savePersona, intakePrompt } = require('../gtm.js');
const { parse: parseBrief, explain: explainBrief } = require('../brief.js');
const P = require('../persona.js');

const STEPS = P.QUESTIONS.map((q) => q.id);

/* The first question with no answer yet. An advisor who leaves after three
   returns to the fourth rather than to the beginning. */
function firstUnanswered(answers) {
  const a = answers || {};
  for (let i = 0; i < STEPS.length; i++) {
    const v = a[STEPS[i]];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return i;
  }
  return STEPS.length;
}

module.exports = async function handler(req, res) {
  const advisor = await requireAdvisor(req, res, '/hub/campaign/profile');
  if (!advisor) return;

  const url = new URL(req.url, 'https://x');
  const profile = await profileFor(advisor.id);
  const answers = (profile && profile.persona_answers) || {};

  /* ── Saving one answer ──────────────────────────────────────────────────*/
  if (req.method === 'POST') {
    /* Read-only in view-as, like account.js and campaign.js. Staff may look at
       an advisor's persona; answering it for them would put a description of
       somebody in their mouth that then shapes copy under their name. */
    if (advisor.viewingAs) {
      return redirect(res, '/hub/campaign/profile?done=readonly');
    }

    const form = parseBody(req) || {};
    const which = str(form.step, 20);

    /* The reveal's own submit — accept, or correct. */
    if (which === 'reveal') return saveReveal(res, advisor, profile, form);
    if (which === 'brief') return saveBrief(res, advisor, form);

    const q = P.QUESTIONS.find((x) => x.id === which);
    if (!q) return redirect(res, '/hub/campaign/profile');

    /* Validated against the question's own options, never trusted. */
    const valid = q.options.map((o) => o.value);
    let value;
    if (q.type === 'multi') {
      value = [].concat(form[q.id] || []).map(String)
        .filter((v) => valid.indexOf(v) !== -1);
      if (q.max) value = value.slice(0, q.max);
    } else {
      value = valid.indexOf(String(form[q.id] || '')) === -1 ? null : String(form[q.id]);
    }

    const next = Object.assign({}, answers, { [q.id]: value });
    const patch = { persona_answers: next };

    /* On the last answer, derive — so the reveal has something to show and the
       generator has something to read even if they never open the reveal. */
    const done = firstUnanswered(next) >= STEPS.length;
    if (done) {
      const persona = P.derive(next);
      if (persona) {
        Object.assign(patch, {
          expr_primary: persona.primary,
          expr_secondary: persona.secondary,
          traveller_orientation: persona.orientation,
          compass_needs: persona.needs,
          capacity_class: persona.capacity,
          persona_at: new Date().toISOString()
        });
      }
    }

    const r = await savePersona(advisor.id, patch);
    if (!r.ok) return redirect(res, '/hub/campaign/profile?done=' + r.error);

    const idx = STEPS.indexOf(q.id);
    return redirect(res, done ? '/hub/campaign/profile?step=reveal'
      : '/hub/campaign/profile?step=' + STEPS[idx + 1]);
  }

  /* ── Rendering ──────────────────────────────────────────────────────────*/
  const done = str(url.searchParams.get('done'), 40);
  const want = str(url.searchParams.get('step'), 20);
  const complete = firstUnanswered(answers) >= STEPS.length;

  if (want === 'brief') return briefScreen(res, advisor, profile, done);
  if (want === 'reveal' || (complete && !want)) {
    return revealScreen(res, advisor, profile, answers, done);
  }

  const idx = STEPS.indexOf(want) === -1 ? firstUnanswered(answers) : STEPS.indexOf(want);
  const q = P.QUESTIONS[Math.min(idx, STEPS.length - 1)];
  return questionScreen(res, advisor, q, answers, done);
};

/* ── One question ─────────────────────────────────────────────────────────*/
function questionScreen(res, advisor, q, answers, done) {
  const n = STEPS.indexOf(q.id) + 1;
  const current = answers[q.id];
  const chosen = [].concat(current || []).map(String);
  const prev = n > 1 ? STEPS[n - 2] : null;

  const option = (o) => {
    const on = chosen.indexOf(String(o.value)) !== -1;
    return `<label class="pq-opt${on ? ' is-on' : ''}">
      <input type="${q.type === 'multi' ? 'checkbox' : 'radio'}" name="${esc(q.id)}"
        value="${esc(o.value)}"${on ? ' checked' : ''}>
      <span class="pq-opt-body">
        <span class="pq-opt-label">${esc(o.label)}</span>
        ${o.detail ? `<span class="pq-opt-detail">${esc(o.detail)}</span>` : ''}
      </span>
    </label>`;
  };

  const body = `<div class="hub-main">
  <div class="wrap wrap--narrow">

    ${pageHead('My Campaign', 'A few questions',
      'Five of them, and they take about two minutes. Every answer changes what your campaign says.')}

    ${done ? `<p class="hub-flash${/readonly|failed|needs_migration/.test(done) ? ' hub-flash--bad' : ''}">${
      esc(DONE[done] || done)}</p>` : ''}

    <div class="pq-rail" aria-hidden="true">
      ${STEPS.map((s, i) => `<span class="pq-dot${i < n - 1 ? ' is-done' : i === n - 1 ? ' is-now' : ''}"></span>`).join('')}
    </div>
    <p class="pq-count">Question ${n} of ${STEPS.length}</p>

    <form method="POST" class="hub-card pq-card">
      <input type="hidden" name="step" value="${esc(q.id)}">

      <h2 class="pq-ask">${esc(q.ask)}</h2>
      <p class="pq-why">${esc(q.why)}</p>
      ${q.hint ? `<p class="hub-hint">${esc(q.hint)}</p>` : ''}

      <div class="pq-opts">${q.options.map(option).join('')}</div>

      <div class="hub-actions pq-actions">
        <button class="btn btn--gold" type="submit">${n === STEPS.length ? 'See what this says' : 'Continue'}</button>
        ${prev ? `<a class="btn btn--ghost btn--sm" href="/hub/campaign/profile?step=${esc(prev)}">Back</a>` : ''}
      </div>
      <p class="hub-hint">You can leave and come back — each answer saves as you go.</p>
    </form>

    <p class="hub-hint"><a href="/hub/campaign">Skip this for now</a> — you can still build a plan,
      it will just have less to go on.</p>

  </div>
</div>`;

  hubPage(res, { path: '/hub/campaign/profile', title: 'A few questions', advisor, body });
}

/* ── The reveal ───────────────────────────────────────────────────────────*/
function revealScreen(res, advisor, profile, answers, done) {
  const persona = P.derive(answers);
  const desc = P.describe(persona);
  const p = profile || {};
  const eff = P.effective(p);
  const profiles = P.QUESTIONS && require('../../../content/marketing-playbook.js').expressionProfiles || [];

  /* If they have already corrected it, the correction is what we show — it is
     what the generator uses, and showing the superseded read would be a lie
     about what their campaign is built on. */
  const shownPrimary = eff.primary || (persona && persona.primary);
  const shownSecondary = eff.secondary || (persona && persona.secondary);
  const shown = P.describe({ primary: shownPrimary, secondary: shownSecondary });
  const hasBrief = Boolean(p.brief_parsed && Object.keys(p.brief_parsed).length);

  const body = `<div class="hub-main">
  <div class="wrap wrap--narrow">

    ${pageHead('My Campaign', 'Here is what that says',
      'A starting read, not a verdict. Change it if it is wrong — that tells us more than the answers did.')}

    ${done ? `<p class="hub-flash${/readonly|failed/.test(done) ? ' hub-flash--bad' : ''}">${
      esc(DONE[done] || done)}</p>` : ''}

    ${shown ? `
    <section class="hub-card pq-reveal">
      <p class="eyebrow">How you create advantage</p>
      <h2 class="pq-reveal-head">${esc(shown.headline)}</h2>
      <p class="pq-reveal-lead">${esc(shown.advantage)}</p>
      ${shown.blend ? `<p class="hub-hint">${esc(shown.blend)}</p>` : ''}

      <div class="pq-reveal-grid">
        <div>
          <p class="gtm-label">What to watch for</p>
          <p class="hub-hint">${esc(shown.watchFor)}</p>
        </div>
        <div>
          <p class="gtm-label">Your growth edge</p>
          <p class="hub-hint">${esc(shown.growthEdge)}</p>
        </div>
      </div>
      ${eff.corrected ? '<p class="hub-hint"><em>You changed this from our original read.</em></p>' : ''}
    </section>

    <form method="POST" class="hub-card">
      <input type="hidden" name="step" value="reveal">
      <h2>Does that sound right?</h2>
      <p class="hub-hint">If it does not, pick what fits. Your correction outranks anything we worked
        out — it is the better evidence, and it is what your campaign will be written from.</p>

      ${/* NAMES ONLY IN THE OPTIONS. The advantage used to be appended, which
            made the option text 591px wide inside a 280px control — so on a
            phone an advisor read "Guide — Makes complexi…". A native select
            clips rather than wraps, and a truncated description in the primary
            control is worse than no description, because it looks like the
            whole answer. The six meanings live in the disclosure below, where
            they have room. */''}
      <label class="hub-field">
        <span class="hub-field-label">Mainly</span>
        <select name="primary">
          ${profiles.map((x) => `<option value="${esc(x.key)}"${
            x.key === shownPrimary ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}
        </select>
      </label>

      <label class="hub-field">
        <span class="hub-field-label">And a bit of</span>
        <select name="secondary">
          <option value="">Nothing much else</option>
          ${profiles.map((x) => `<option value="${esc(x.key)}"${
            x.key === shownSecondary ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}
        </select>
      </label>

      <details class="gtm-angles">
        <summary>What each of these means</summary>
        <ul class="hub-gate-list">
          ${profiles.map((x) => `<li><strong>${esc(x.name)}.</strong> ${esc(x.advantage)}</li>`).join('')}
        </ul>
      </details>

      <div class="hub-actions">
        <button class="btn btn--gold" type="submit" name="accept" value="1">That is right</button>
        <button class="btn btn--ghost" type="submit" name="accept" value="0">Use what I picked</button>
      </div>
    </form>` : `
    <section class="hub-card">
      <h2>Not enough to go on yet</h2>
      <p class="hub-hint">Answer the first two questions and we can make a read.</p>
      <div class="hub-actions">
        <a class="btn btn--gold" href="/hub/campaign/profile?step=acts">Start</a>
      </div>
    </section>`}

    ${/* The optional deeper step. Offered here rather than forced into the
          five, because the persona is the floor everyone completes and this is
          the ceiling — and because it asks for ten minutes in another tool,
          which is a real thing to ask for and should be asked for plainly. */''}
    <section class="hub-card">
      <h2>${hasBrief ? 'Your brief' : 'One more thing, if you have ten minutes'}</h2>
      ${hasBrief ? `
        <p class="hub-hint">Your campaign already has your own clients, markets and proof to draw on.
          <a href="/hub/campaign/profile?step=brief">Review or replace it</a>.</p>`
      : `
        <p class="hub-hint">What we have so far shapes <em>how</em> your campaign sounds. What it does
          not have is anything only you know — the clients you have actually helped, the cities they
          live in, what you have really done.</p>
        <p class="hub-hint">There is a prompt you can run in Claude or ChatGPT that goes and finds
          it. Copy generated with it opens with things like <em>"2019 feels like a lifetime ago"</em>;
          copy generated without it opens with <em>"wellness travel means slowing down"</em>.</p>
        <div class="hub-actions">
          <a class="btn btn--gold" href="/hub/campaign/profile?step=brief">Show me the prompt</a>
        </div>`}
    </section>

    <div class="hub-actions">
      <a class="btn ${hasBrief ? 'btn--gold' : 'btn--ghost'}" href="/hub/campaign">Build my plan</a>
      <a class="btn btn--ghost btn--sm" href="/hub/campaign/profile?step=acts">Change my answers</a>
    </div>

  </div>
</div>`;

  hubPage(res, { path: '/hub/campaign/profile', title: 'Here is what that says', advisor, body });
}

/* ── The brief ────────────────────────────────────────────────────────────
   The deepest input the system has, and the only place an advisor's actual
   clients, markets and proof arrive. Optional on purpose: the persona is the
   floor and everyone completes it; this is the ceiling.

   It is worth the extra screen because of what it demonstrably buys. Copy
   generated against a cited client opened "how long it's been since you both
   had a week off together — 2019 feels like a lifetime ago"; copy in the same
   run without one opened "wellness travel means slowing down". Five earlier
   attempts to close that gap failed, and this is what closed it. */
function briefScreen(res, advisor, profile, done) {
  const p = profile || {};
  const prompt = intakePrompt(advisor, p);
  const has = p.brief_parsed && Object.keys(p.brief_parsed).length;

  /* What they pasted comes back with them, always. Making somebody re-fetch a
     long answer from another chat window because we would not hold it for
     ninety seconds is a cruelty, and they will not bother. */
  const held = p.brief_raw || '';

  /* The rejection reason is RE-DERIVED rather than carried in the URL. It has
     to name the missing section to be worth anything, and `str(done, 40)`
     would have cut "that brief is missing OBJECTIONS and PROOF" in half. */
  const rejection = done === 'rejected' && p.brief_raw
    ? explainBrief(parseBrief(p.brief_raw)) : '';

  const summary = has ? `
    <section class="hub-card pq-brief-have">
      <p class="eyebrow">Captured</p>
      <h2>What your campaign now knows about you</h2>
      <ul class="hub-gate-list">
        ${(p.brief_parsed.CLIENTS || []).map((c, i) =>
          `<li><strong>Client ${i + 1}.</strong> ${esc([c.who, c.situation].filter(Boolean).join(' — '))}</li>`).join('')}
        ${(p.brief_parsed.MARKETS || []).length
          ? `<li><strong>Markets.</strong> ${esc(p.brief_parsed.MARKETS.join(' · '))}</li>` : ''}
        ${(p.brief_parsed.PROOF || []).length
          ? `<li><strong>Proof.</strong> ${esc(p.brief_parsed.PROOF.join(' · '))}</li>` : ''}
      </ul>
      <p class="hub-hint">Your plan can point at each of these individually. That is what makes a
        message sound like it came from you rather than from a travel brochure.</p>
    </section>` : '';

  const body = `<div class="hub-main">
  <div class="wrap wrap--narrow">

    ${pageHead('My Campaign', has ? 'Your brief' : 'Go deeper, for free',
      has
        ? 'This is what your own assistant found out about your business. Replace it whenever it changes.'
        : 'Ten minutes with an assistant you already use, and your campaign stops sounding like everyone else’s.')}

    ${rejection ? `<p class="hub-flash hub-flash--bad">${esc(rejection)}</p>`
      : done ? `<p class="hub-flash${/failed|readonly|needs_migration/.test(done) ? ' hub-flash--bad' : ''}">${
        esc(DONE[done] || done)}</p>` : ''}

    ${summary}

    <section class="hub-card">
      <h2>${has ? 'Run it again' : 'Step one'}</h2>
      <p class="hub-hint">Copy this into <a href="https://claude.ai" target="_blank" rel="noopener">Claude</a>,
        <a href="https://chatgpt.com" target="_blank" rel="noopener">ChatGPT</a> or whichever assistant you
        already use — free plans are fine. It will read your website and socials, which our server
        cannot do, and come back with a brief.</p>
      <p class="hub-hint"><strong>Read what it gives you before you paste it back.</strong> It has been
        told not to invent anything, but it is describing your business and you are the one who knows.</p>

      <div class="hub-link-row">
        <textarea id="brief-prompt" class="hub-prompt" rows="6" readonly>${esc(prompt)}</textarea>
      </div>
      <div class="hub-actions">
        <button class="btn btn--gold btn--sm" type="button" data-copy="#brief-prompt">Copy the prompt</button>
      </div>
    </section>

    <form method="POST" class="hub-card">
      <input type="hidden" name="step" value="brief">
      <h2>Step two</h2>
      <p class="hub-hint">Paste the whole thing back — headings and all. If part of it is missing we
        will tell you which part, rather than quietly building a plan on half a brief.</p>

      <label class="hub-field hub-field--wide">
        <span class="hub-field-label">The brief your assistant produced</span>
        <textarea name="brief" rows="12" placeholder="## VOICE&#10;tone: ...&#10;&#10;## CLIENTS&#10;- who: ..."
          >${esc(held)}</textarea>
      </label>

      <div class="hub-actions">
        <button class="btn btn--gold" type="submit">${has ? 'Replace my brief' : 'Use this brief'}</button>
        <a class="btn btn--ghost btn--sm" href="/hub/campaign">Skip for now</a>
      </div>
    </form>

    <p class="hub-hint"><a href="/hub/campaign/profile?step=reveal">Back to your profile</a></p>

  </div>
</div>`;

  hubPage(res, { path: '/hub/campaign/profile', title: 'Your brief', advisor, body });
}

async function saveBrief(res, advisor, form) {
  const raw = str(form.brief, 20000);
  const result = parseBrief(raw);

  if (!result.ok) {
    /* The raw text is stored even on a rejection, so the textarea can hand it
       back and the advisor can fix the one missing section rather than start
       again. brief_parsed is deliberately NOT written — a plan must never be
       built on a brief we refused. */
    await savePersona(advisor.id, { brief_raw: raw });
    return redirect(res, '/hub/campaign/profile?step=brief&done=rejected');
  }

  const r = await savePersona(advisor.id, {
    brief_raw: raw,
    brief_parsed: result.brief,
    brief_at: new Date().toISOString()
  });
  return redirect(res, '/hub/campaign/profile?step=brief&done=' + (r.ok ? 'brief_saved' : r.error));
}

/* Accepting leaves expr_confirmed null — persona_at already records that they
   saw it and agreed. It is written ONLY on a change, so "corrected" keeps
   meaning something. */
async function saveReveal(res, advisor, profile, form) {
  const primary = str(form.primary, 30);
  const secondary = str(form.secondary, 30);
  const accepted = String(form.accept) === '1';

  const p = profile || {};
  const same = primary === p.expr_primary && (secondary || null) === (p.expr_secondary || null);

  const patch = accepted || same
    ? { expr_confirmed: null }
    : { expr_confirmed: secondary ? `${primary} + ${secondary}` : primary };

  const r = await savePersona(advisor.id, patch);
  return redirect(res, '/hub/campaign/profile?step=reveal&done=' +
    (r.ok ? (patch.expr_confirmed ? 'changed' : 'confirmed') : r.error));
}

function redirect(res, to) {
  res.statusCode = 303;
  res.setHeader('Location', to);
  return res.end();
}

const DONE = {
  brief_saved: 'Got it. Your campaign can now point at your own clients, markets and proof — which is what stops it sounding like everyone else.',
  confirmed: 'Good — that is what your campaign will be written from.',
  changed: 'Changed. Your correction is what we will use from now on.',
  readonly: 'Nothing was changed — you are viewing this Hub, not signed in as its owner.',
  needs_migration: 'That did not save. The database is missing a recent change — tell us and we will fix it.',
  failed: 'That did not save. Try again, and tell us if it keeps happening.',
  not_configured: 'The Hub is not connected to its database just now.'
};
