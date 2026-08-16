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
const { imageBrief, isVisual, RIGHTS_NOTE } = require('./image-brief.js');

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

/* ── Angles ───────────────────────────────────────────────────────────────
   Four buttons on every block would be clutter on a screen that already has
   four, so they live behind a disclosure that stays shut until somebody wants
   one. `<details>` rather than a script: it opens without JavaScript, it is
   keyboard-navigable for free, and there is nothing to go wrong.

   Each label says what the angle DOES, not what it is called. "Pain" is a
   marketing word; "Lead with what is wrong" is an instruction an advisor can
   choose between without a glossary. */
const ANGLE_LABEL = {
  pain: 'Lead with what is wrong',
  aspiration: 'Lead with what they want back',
  proof: 'Lead with something you know',
  practical: 'Lead with the decision'
};

function angleBlock(current) {
  const buttons = Object.keys(ANGLE_LABEL).map((k) =>
    `<button type="button" class="btn btn--ghost btn--sm" data-gtm="angle" data-angle="${k}"${
      current === k ? ' disabled' : ''}>${esc(ANGLE_LABEL[k])}</button>`).join('');

  return `<details class="gtm-angles">
    <summary>Try another angle${current ? ` <span class="gtm-angle-now">now: ${esc(ANGLE_LABEL[current] || current)}</span>` : ''}</summary>
    <p class="hub-hint">Rewrites this one piece from a different starting point. It does not
      cost you a build — you already paid for this plan.</p>
    <div class="gtm-actions">${buttons}</div>
  </details>`;
}

/* ── The two fields the advisor writes, and the picture they have to take ──
   FALLBACK and PERSONALIZATION are generated and stored by D4b and were never
   rendered — the generator produced them, the database kept them, and nothing
   put them in front of anybody. They are the two fields on the Asset Card that
   carry information existing nowhere else, so being invisible made them worse
   than absent: paid for on every generation and read by no one.

   Personalization goes ABOVE the fallback because it is the one that improves
   the post; the fallback is for the week the post nearly does not happen.

   The image brief sits with them, behind the same disclosure. It is the part
   an advisor needs before they can post at all, and the part nothing in this
   product used to say a word about. */
function makeItYours(a, action, profile) {
  const shot = imageBrief(action, profile);
  const personal = a && a.personalization;
  const fallback = a && a.fallback;
  if (!shot && !personal && !fallback) return '';

  return `<details class="gtm-yours">
    <summary>Make it yours${shot ? ' <span class="gtm-yours-n">and what to photograph</span>' : ''}</summary>

    ${personal ? `<div class="gtm-yours-part">
      <p class="gtm-label">Where to put yourself in it</p>
      <p class="hub-hint">${esc(personal)}</p>
    </div>` : ''}

    ${shot ? `<div class="gtm-yours-part gtm-shot">
      <p class="gtm-label">The picture</p>
      <p class="gtm-shot-line">${esc(shot.shot)}</p>
      <ul class="gtm-shot-spec">
        ${shot.frame ? `<li><strong>Frame.</strong> ${esc(shot.frame.ratio)} · ${esc(shot.frame.px)}. ${esc(shot.frame.note)}</li>` : ''}
        <li><strong>Light.</strong> ${esc(shot.light)}</li>
      </ul>
      <p class="gtm-label">Keep out of frame</p>
      <ul class="gtm-shot-avoid">
        ${shot.avoid.map((x) => `<li>${esc(x)}</li>`).join('')}
      </ul>
      <p class="hub-hint">${esc(shot.instead)}</p>
    </div>` : ''}

    ${fallback ? `<div class="gtm-yours-part">
      <p class="gtm-label">If this week gets away from you</p>
      <p class="hub-hint">${esc(fallback)}</p>
    </div>` : ''}
  </details>`;
}

/* One action. Some have no copy attached — "call two clients" needs a note on
   what to say, not a caption — and those render as the action alone rather than
   as an empty box implying something failed to arrive. */
function block(week, action, advisor, profile) {
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
        </div>
        ${makeItYours(a, Object.assign({ week }, action), profile)}
        ${angleBlock(a.angle)}`
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

/* ── The confidence strip ─────────────────────────────────────────────────
   One line naming what this plan was actually built from, and what it was not.

   IT IS A PROVENANCE DISPLAY, NOT AN UPSELL WIDGET, and the difference is that
   it renders IDENTICALLY FOR EVERY TIER. For a registered advisor the gap
   argues for itself without a sentence of salesmanship. For a Foundations
   graduate the same component reads as reassurance about what their plan
   stands on. The moment it changes its tune by tier it stops being a
   diagnostic and becomes an advert wearing one's clothes, and advisors can
   smell that.

   It is derived from what the generator actually read, not from a hand-written
   list — a strip that claims an input the prompt never received would make the
   one honest surface in the flow the dishonest one. */
function confidenceStrip(profile, capacity) {
  const p = profile || {};
  const built = [];
  const missing = [];

  const intake = ['positioning', 'differentiator', 'icp', 'client_examples', 'specialties', 'markets']
    .filter((f) => String(p[f] || '').trim()).length;
  if (intake) built.push(`your intake (${intake} field${intake === 1 ? '' : 's'})`);
  else missing.push('anything you have told us about your business');

  if (p.expr_primary || p.expr_confirmed) built.push('how you create advantage');
  else missing.push('how you create advantage');

  if (p.traveller_orientation) built.push('who you sell to');
  else missing.push('who you sell to');

  const brief = p.brief_parsed && Object.keys(p.brief_parsed).length ? p.brief_parsed : null;
  if (brief) {
    const items = ['CLIENTS', 'MARKETS', 'OBJECTIONS', 'PROOF']
      .reduce((n, k) => n + (brief[k] || []).length, 0);
    built.push(`your own brief (${items} specifics)`);
  } else {
    missing.push('your own clients, markets and proof');
  }

  /* Always true, and worth saying — an advisor should know the destination
     facts are not being improvised. */
  built.push('the Saint Lucia fact bank');
  built.push('the channel playbook');

  return `<p class="gtm-provenance">
    <strong>Built from:</strong> ${esc(built.join(' · '))}${
    missing.length ? `<br><strong>Not built from:</strong> ${esc(missing.join(' · '))}` : ''}${
    capacity ? `<br><span class="gtm-provenance-size">${esc(capacity.line)}</span>` : ''}
  </p>`;
}

/* One week, rendered whole. Extracted from planSection so that the same markup
   can appear open (this week) or inside a disclosure (the rest) without the two
   drifting into different-looking weeks. */
function weekBlock(w, o) {
  return `<div class="gtm-week${o.currentWeek === w.week ? ' is-now' : ''}"${
    o.currentWeek && o.currentWeek !== w.week ? ' data-later="1"' : ''}>
      <div class="gtm-week-head">
        <span class="gtm-week-n">Week ${w.week}${o.currentWeek === w.week ? ' · this week' : ''}</span>
        <h3>${esc(w.theme)}</h3>
      </div>
      ${w.actions.map((a) => block(w.week, a, o.advisor, o.profile)).join('')}
    </div>`;
}

/* People who asked to hear from this advisor and have not been answered.
   It sits with this week's actions because it outranks every one of them: a
   plan exists to produce these, and a campaign that keeps running while the
   replies pile up has failed at the only thing it was for. */
function waitingLine(n) {
  if (!n) return '';
  return `<p class="gtm-waiting"><strong>${n === 1
    ? 'One person is waiting to hear from you.'
    : `${n} people are waiting to hear from you.`}</strong>
    <a href="/hub/journeys">Answer them first</a> — they asked, which is more than
    anything else on this list can say.</p>`;
}

/* The whole kit. Weeks are sections because that is how somebody uses it —
   they open it on a Monday and want to know what this week asks of them.

   ── WHY THIS WEEK IS THE DEFAULT ──────────────────────────────────────────
   "A single enormous AI response is a poor product interface." Four weeks of
   actions rendered at once is roughly nine assets and forty paragraphs, and
   the effect on a Monday morning is not diligence but paralysis — the advisor
   scrolls, feels behind, and closes the tab.

   So the current week renders open and the rest go behind a disclosure. The
   collapsed weeks are still in the page: <details> hides them from the eye,
   not from the document, so Ctrl-F finds them, a screen reader can reach them
   and printing gets the lot.

   THIS ONLY APPLIES WHILE THE MONTH IS RUNNING. With no current week — the
   month is over, or the report could not be computed — there is no "this week"
   to focus on and everything renders flat, because showing all of it is never
   wrong, only longer. */
function planSection(rows, opts) {
  const o = opts || {};
  const total = rows.reduce((n, w) => n + w.actions.filter((a) => a.assetKind !== 'none').length, 0);
  const ready = rows.reduce((n, w) =>
    n + w.actions.filter((a) => a.asset && a.asset.status === 'ready').length, 0);

  const now = o.currentWeek ? rows.filter((w) => w.week === o.currentWeek) : [];
  const done = o.currentWeek ? rows.filter((w) => w.week < o.currentWeek) : [];
  const ahead = o.currentWeek ? rows.filter((w) => w.week > o.currentWeek) : [];
  const focused = now.length > 0;

  /* The summary says how much is behind it. A disclosure that reads only
     "Show more" asks somebody to spend a click to find out whether the click
     was worth it. */
  const fold = (weeks, label) => weeks.length ? `
    <details class="gtm-more">
      <summary>${esc(label)} <span class="gtm-more-n">${
        weeks.length === 1 ? 'Week ' + weeks[0].week
          : 'Weeks ' + weeks[0].week + '–' + weeks[weeks.length - 1].week}</span></summary>
      ${weeks.map((w) => weekBlock(w, o)).join('')}
    </details>` : '';

  return `<section class="hub-card gtm-plan" id="gtm-plan" data-plan="${esc(o.planId || '')}">
    <div class="hub-sweeps-head">
      <div>
        <h2>Your 30-day plan</h2>
        <p class="hub-hint">${esc(o.premise || '')}</p>
      </div>
      ${total ? `<span class="hub-stage" data-stage="${ready === total ? 'booked' : 'new'}">${ready}/${total} written</span>` : ''}
    </div>

    ${/* ── ORDER, AND WHY IT IS THIS ONE ──────────────────────────────────
          Measured at 380px, the first arrangement put this week's actions
          1717px down — nearly two phone screens under the provenance strip
          and a 727px report. Collapsing three of the four weeks and then
          burying the fourth is not progressive disclosure, it is the same
          scroll with extra steps.

          So the card is ordered by what the advisor came to do:

            1. somebody is waiting for a reply   — a person, not a task
            2. this week's actions               — what they opened this for
            3. the other weeks                   — one click away
            4. what happened                     — answers a different
                                                   question, asked later
            5. what it was built from            — provenance, quietest
            6. build a new plan                  — not a Monday-morning act

          Nothing moved out of the page and nothing moved into a fold; the
          report and the strip are as present as they were. */''}

    ${waitingLine(o.waiting)}

    ${focused ? `
    ${now.map((w) => weekBlock(w, o)).join('')}
    ${fold(ahead, 'What is coming')}
    ${fold(done, 'Already behind you')}`
    : rows.map((w) => weekBlock(w, o)).join('')}

    <p class="hub-hint">Every link in this plan is your WELL link, so anything that comes back is
      yours. Edit freely — it is your name on it, and copy you would not have written yourself
      reads that way.</p>

    ${/* Once per plan, not once per asset. A warning repeated nine times is
          wallpaper and stops being read on the second one. Only shown when
          something in the plan actually needs a picture. */''}
    ${rows.some((w) => w.actions.some(isVisual))
      ? `<p class="hub-hint gtm-rights">${esc(RIGHTS_NOTE)}</p>` : ''}

    ${o.report ? o.report : ''}

    ${o.strip || ''}

    ${o.mayRefresh ? `
    <div class="gtm-plan-actions">
      <button type="button" class="btn btn--ghost btn--sm" id="gtm-rebuild">Build a new plan</button>
      <span class="hub-hint">Your current one stays until the new one is ready.</span>
    </div>` : `
    <p class="hub-hint gtm-locked">This is your plan. Rebuilding it whenever you like is part of
      <a href="/advisors/foundations" target="_blank" rel="noopener">Well Destination Foundations</a>.</p>`}
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

module.exports = {
  planSection, block, thinkingOverlay, angleBlock, confidenceStrip,
  weekBlock, waitingLine,
  KIND_LABEL, ANGLE_LABEL
};
