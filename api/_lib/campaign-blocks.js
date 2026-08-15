/* ============================================================================
   CAMPAIGN BLOCKS — the kit as things you can paste
   ----------------------------------------------------------------------------
   Spec §9's deliverable is not a document. An advisor opens this on a phone,
   between other work, and pastes a caption into Instagram. A ZIP gets
   downloaded once and opened never; a PDF gets skimmed. So every piece of copy
   is a block with the text already selected-able and a Copy button on it.

   ── WHAT EACH BLOCK CARRIES ────────────────────────────────────────────────
   Copy · Edit · Regenerate · Revert, and the checker's verdict above the text
   rather than below it — a warning underneath copy somebody has already read
   and copied is a warning that arrived too late.

   HIGH SEVERITY DISABLES THE COPY BUTTON. Not a confirm dialog, which teaches
   people to click through, and not a red border, which teaches people nothing.
   The text stays editable and the button comes back the moment the claim goes.

   ── THE CONSENT WARNING IS NOT DECORATION ──────────────────────────────────
   CASL in Canada and the TCPA in the US both govern unsolicited commercial
   messages, and the penalties land on the sender — the advisor. Handing
   somebody a ready-to-send SMS template without saying so would be a liability
   given away as a gift. It appears on the message kinds and nowhere else,
   because a warning on every block is wallpaper.
   ========================================================================== */
'use strict';

const { esc } = require('./hub-render.js');
const { substitute } = require('./gtm.js');

/* Kinds that go to one person's phone or inbox directly. These carry the
   consent note; a public post does not, because nobody is being messaged. */
const DIRECT_KINDS = { sms: 1, dm: 1, email: 1 };

const KIND_LABEL = {
  caption: 'Social caption',
  email: 'Email',
  sms: 'Text message',
  dm: 'Direct message',
  script: 'What to say',
  outline: 'Outline',
  none: ''
};

/* Roughly fit the box to the copy so nothing important is hidden behind a
   scrollbar on a phone. Generous rather than exact — a box slightly too tall
   reads as finished, one slightly too short reads as broken. */
function rowsFor(text) {
  const t = String(text || '');
  const lines = t.split('\n').length + Math.floor(t.length / 60);
  return Math.max(4, Math.min(18, lines + 2));
}

function flagList(asset) {
  const flags = (asset && asset.flags) || [];
  if (!flags.length) return '';

  const high = flags.filter((f) => f.severity === 'high');
  const rest = flags.filter((f) => f.severity !== 'high');

  const one = (f) => `<li>
      <strong>${esc(f.match)}</strong> — ${esc(f.why)}
      ${f.instead && f.instead.length
        ? `<span class="gtm-instead">Try instead: ${esc(f.instead.join('; '))}</span>` : ''}
    </li>`;

  return `<div class="gtm-flags${high.length ? ' gtm-flags--high' : ''}">
    <p class="gtm-flags-head">${high.length
      ? 'Edit this before you use it'
      : 'Worth a look, but you can still copy it'}</p>
    <ul>${high.map(one).join('')}${rest.map(one).join('')}</ul>
  </div>`;
}

function consentNote(kind) {
  if (!DIRECT_KINDS[kind]) return '';
  const what = kind === 'sms' ? 'text' : kind === 'dm' ? 'message' : 'email';
  return `<p class="gtm-consent"><strong>Before you send this ${esc(what)}:</strong>
    Canada's CASL and the US TCPA both require consent before a commercial message,
    and it is the sender who carries that — you, not us. A past client who booked with
    you recently is usually covered; somebody who has never heard from you is not.
    If you are not sure, ask them first. This is a prompt to check, not legal advice.</p>`;
}

/* One action. Some have no copy attached — "call two clients" needs a note on
   what to say, not a caption — and those render as the action alone rather than
   as an empty box implying something failed to arrive. */
function block(week, action, advisor) {
  const a = action.asset;
  const id = `gtm-a-${week}-${action.position}`;
  const kind = action.assetKind;
  const high = a && a.severity === 'high';
  const failed = a && a.status === 'failed';
  const edited = a && a.canonical_body && a.body !== a.canonical_body;
  /* Stored with the token, shown with the link — see substitute() in gtm.js. */
  const shown = a ? substitute(a.body, advisor) : '';

  const head = `<div class="gtm-block-head">
      <div>
        <h4>${esc(action.title)}</h4>
        ${action.why ? `<p class="hub-hint">${esc(action.why)}</p>` : ''}
      </div>
      <span class="gtm-chan">${esc(action.channel)}</span>
    </div>`;

  if (kind === 'none') {
    return `<article class="gtm-block gtm-block--bare">${head}</article>`;
  }

  return `<article class="gtm-block" data-week="${week}" data-pos="${action.position}"
      data-kind="${esc(kind)}"${a ? ` data-asset="${esc(a.id)}"` : ''}>
    ${head}
    <div class="gtm-block-body">
      ${a && a.status === 'ready' ? `
        ${flagList(a)}
        ${consentNote(kind)}
        <label class="gtm-label" for="${id}">${esc(KIND_LABEL[kind] || 'Copy')}${
          edited ? ' <span class="gtm-edited">edited</span>' : ''}</label>
        <textarea id="${id}" class="gtm-body" rows="${rowsFor(shown)}" readonly>${esc(shown)}</textarea>
        <div class="gtm-actions">
          <button type="button" class="btn btn--gold btn--sm gtm-copy"
            data-copy="#${id}"${high ? ' disabled' : ''}>${high ? 'Edit it first' : 'Copy'}</button>
          <button type="button" class="btn btn--ghost btn--sm" data-gtm="edit">Edit</button>
          <button type="button" class="btn btn--ghost btn--sm" data-gtm="regenerate">Regenerate</button>
          <button type="button" class="btn btn--ghost btn--sm gtm-revert"${
            edited ? '' : ' hidden'} data-gtm="revert">Revert</button>
        </div>`
      : failed ? `
        <p class="gtm-failed">This piece did not come back. Nothing else in the plan
          was affected — try it again on its own.</p>
        <div class="gtm-actions">
          <button type="button" class="btn btn--gold btn--sm" data-gtm="regenerate">Write it</button>
        </div>`
      : `
        <div class="gtm-actions">
          <button type="button" class="btn btn--gold btn--sm" data-gtm="regenerate">Write this one</button>
        </div>`}
    </div>
  </article>`;
}

/* The whole kit. Weeks are sections because that is how somebody uses it —
   they open it on a Monday and want to know what this week asks of them. */
function planSection(rows, opts) {
  const o = opts || {};
  const total = rows.reduce((n, w) => n + w.actions.filter((a) => a.assetKind !== 'none').length, 0);
  const ready = rows.reduce((n, w) =>
    n + w.actions.filter((a) => a.asset && a.asset.status === 'ready').length, 0);

  return `<section class="hub-card gtm-plan" id="gtm-plan" data-plan="${esc(o.planId || '')}">
    <div class="hub-sweeps-head">
      <div>
        <h2>Your 30-day plan</h2>
        <p class="hub-hint">${esc(o.premise || '')}</p>
      </div>
      ${total ? `<span class="hub-stage" data-stage="${ready === total ? 'booked' : 'new'}">${ready}/${total} written</span>` : ''}
    </div>

    ${o.mayRefresh ? `
    <div class="gtm-plan-actions">
      <button type="button" class="btn btn--ghost btn--sm" id="gtm-rebuild">Build a new plan</button>
      <span class="hub-hint">Your current one stays until the new one is ready.</span>
    </div>` : `
    <p class="hub-hint gtm-locked">This is your plan. Rebuilding it whenever you like is part of
      <a href="/advisors/foundations" target="_blank" rel="noopener">Well Destination Foundations</a>.</p>`}

    ${rows.map((w) => `
    <div class="gtm-week">
      <div class="gtm-week-head">
        <span class="gtm-week-n">Week ${w.week}</span>
        <h3>${esc(w.theme)}</h3>
      </div>
      ${w.actions.map((a) => block(w.week, a, o.advisor)).join('')}
    </div>`).join('')}

    <p class="hub-hint">Every link in this plan is your WELL link, so anything that comes back is
      yours. Edit freely — it is your name on it, and copy you would not have written yourself
      reads that way.</p>
  </section>`;
}

/* The overlay while a plan is being built. It says what it is doing because
   this is the moment the product either feels like it works or feels like it
   has hung — and a bare spinner throws that away. The ring and the journey
   line are the brand's own marks; this is the one Hub screen that earns them. */
function thinkingOverlay() {
  return `<div class="gtm-thinking" id="gtm-thinking" hidden role="status" aria-live="polite">
    <div class="gtm-thinking-inner">
      <svg class="gtm-ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" class="gtm-ring-1"/>
        <circle cx="60" cy="60" r="40" class="gtm-ring-2"/>
        <circle cx="60" cy="60" r="28" class="gtm-ring-3"/>
      </svg>
      <p class="gtm-thinking-step" id="gtm-step">Reading your profile</p>
      <div class="gtm-thinking-bar"><span id="gtm-bar"></span></div>
      <p class="hub-hint" id="gtm-count"></p>
      <p class="hub-hint gtm-thinking-note">This takes about a minute. You can leave this page —
        anything already written is saved.</p>
    </div>
  </div>`;
}

module.exports = { planSection, block, thinkingOverlay, KIND_LABEL };
