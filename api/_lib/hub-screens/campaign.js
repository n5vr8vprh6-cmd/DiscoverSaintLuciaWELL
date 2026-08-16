/* ============================================================================
   /hub/campaign — what we know about your business
   ----------------------------------------------------------------------------
   The intake for the 30-day plan, and today the whole of My Campaign. There is
   no generation yet and the screen does not pretend otherwise: it says what it
   will be able to do once there is enough to do it with.

   THE PROMPT IS THE FEATURE HERE, not a helper. A blank box labelled "describe
   your positioning" is where intake forms die — so the advisor gets a prompt
   built from what we already hold, runs it in their own AI, and pastes the
   answers back. It costs us nothing, it works on a free plan, and their AI can
   read the socials that block our server.

   Every field is optional and saves independently. V2 spec §5: "Allow
   save/continue and sensible skipping of optional fields. Do not block Hub
   access because an advisor lacks a website or mature social presence."
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { str, body: parseBody } = require('../core.js');
const { hubPage, esc, pageHead } = require('../hub-render.js');
const {
  BANDS, FIELDS, profileFor, saveProfile, gapReport, intakePrompt, rung, mayRefresh,
  currentPlan, planRows
} = require('../gtm.js');
const { planSection, thinkingOverlay, confidenceStrip } = require('../campaign-blocks.js');
const { describe: describeCapacity } = require('../capacity.js');
const { waitingCount } = require('../hub-data.js');
const LB = require('../loopback.js');
const { configured } = require('../openai.js');

const LADDER_LABEL = {
  registered: 'Registered',
  foundations: 'Foundations complete',
  immersion: 'Immersion complete'
};

module.exports = async function handler(req, res) {
  const advisor = await requireAdvisor(req, res, '/hub/campaign');
  if (!advisor) return;

  if (req.method === 'POST') {
    /* Read-only in view-as, like account.js. Staff supporting an advisor may
       look at their inputs; typing their positioning for them would put words
       in their mouth that a campaign then publishes under their name. */
    if (advisor.viewingAs) {
      res.statusCode = 303;
      res.setHeader('Location', '/hub/campaign?done=readonly');
      return res.end();
    }
    const form = parseBody(req) || {};
    const patch = {};
    FIELDS.forEach((f) => { patch[f] = str(form[f], f.endsWith('_band') ? 20 : 900); });
    const r = await saveProfile(advisor.id, patch);
    res.statusCode = 303;
    res.setHeader('Location', '/hub/campaign?done=' + (r.ok ? 'saved' : r.error));
    return res.end();
  }

  const url = new URL(req.url, 'https://x');
  const done = str(url.searchParams.get('done'), 40);
  const profile = await profileFor(advisor.id);
  const gaps = gapReport(profile);
  const prompt = intakePrompt(advisor, profile);
  const p = profile || {};
  const where = rung(advisor);

  /* The plan, if there is one. Loaded before the intake because it changes what
     the page is: with a plan this screen is a kit you use, and the intake below
     is where you go to improve the next one. */
  const held = await currentPlan(advisor.id);
  const rows = held ? planRows(held.plan, held.assets) : [];

  /* What actually happened. Only ever computed when there is a plan to measure
     against — a report with no campaign behind it is a dashboard, and nobody
     asked for one of those. */
  const report = held ? await LB.forPlan(advisor, held.plan) : null;
  const foundations = report ? LB.foundationsNote(report, advisor, profile) : null;
  const canGenerate = configured() && gaps.enoughToGenerate && !advisor.viewingAs;

  /* Only asked for when there is a plan to put it beside. On the empty screen
     the advisor has no campaign yet, and "3 people are waiting" next to a
     Build button is a reproach rather than a prompt. */
  const waiting = held ? await waitingCount(advisor.id) : null;

  const reasoning = reasoningSections(gaps, prompt, p, where);

  const body = `<div class="hub-main">
  <div class="wrap">

    ${pageHead('My Campaign', 'Your 30-day plan',
      held
        ? 'Small actions with the words already written, each one pointing at your WELL link.'
        : 'A plan of small actions with the words already written, each one pointing at your WELL link. First it needs to know who you are.')}

    ${done ? `<p class="hub-flash${/failed|readonly/.test(done) ? ' hub-flash--bad' : ''}">${
      esc(DONE_MESSAGE[done] || done)}</p>` : ''}

    ${thinkingOverlay()}

    ${held ? planSection(rows, {
        advisor,
        planId: held.plan.id,
        premise: (held.plan.skeleton && held.plan.skeleton.premise) || '',
        mayRefresh: canGenerate && mayRefresh(advisor),
        strip: confidenceStrip(profile, describeCapacity(profile)),
        currentWeek: report && report.currentWeek <= 4 ? report.currentWeek : null,
        report: reportBlock(report, foundations),
        waiting
      }) : `
    ${/* No plan yet. The button is the point of the screen, so it comes first —
          and when it cannot be pressed it says why, rather than sitting greyed
          out with no explanation. */''}
    <section class="hub-card gtm-start">
      <h2>Build your plan</h2>
      ${canGenerate ? `
        <p class="hub-hint">Four weeks of small actions, with the copy written for each one. It
          takes about a minute and you can edit everything afterwards.</p>
        <div class="hub-actions">
          <button type="button" class="btn btn--gold" id="gtm-build">Build my 30-day plan</button>
        </div>
        ${mayRefresh(advisor) ? '' : `<p class="hub-hint">This builds you one plan. You can edit
          every piece of it as much as you like.</p>`}`
      : advisor.viewingAs ? `
        <p class="hub-hint">You are viewing this advisor's Hub. Generating a campaign under their
          name is not available here — it would put words in their mouth that they publish and
          warrant as their own.</p>`
      : !gaps.enoughToGenerate ? `
        <p class="hub-hint">Not yet — fill in the essentials below first. A plan built on guesses
          reads like one, and you would be the one publishing it.</p>
        <p class="hub-hint"><strong>Still needed:</strong> ${esc(gaps.blockers.join(' · '))}</p>`
      : `
        <p class="hub-hint">Plan writing is not switched on just yet. Everything below still works —
          fill it in now and the plan will be ready the moment it is.</p>`}
    </section>`}

    ${held ? `
    ${/* ── THE REASONING, ONE CLICK BEHIND ────────────────────────────────
          With a plan on the screen this is no longer what the page is for.
          The advisor came to use a kit; the intake is where they go to make
          the NEXT one better, and leaving four cards and eleven fields open
          underneath the plan buries the thing they actually came for.

          Without a plan it stays open, because then it IS the point of the
          screen and hiding it would be hiding the only thing to do here. */''}
    <details class="hub-fold">
      <summary>
        <span class="hub-fold-t">Your profile and how ready it is</span>
        <span class="hub-fold-n">${gaps.ready}% · ${gaps.missing.length
          ? esc(gaps.missing.length + ' thing' + (gaps.missing.length === 1 ? '' : 's') + ' would sharpen the next plan')
          : 'nothing missing'}</span>
      </summary>
      <div class="hub-fold-body">
      ${reasoning}
      </div>
    </details>` : reasoning}

  </div>
</div>`;

  hubPage(res, {
    path: '/hub/campaign', title: 'My Campaign', advisor, body,
    js: ['/js/hub-campaign.js']
  });
};

/* Everything that explains and improves the plan, as opposed to the plan
   itself. Kept in one piece so it can be folded as one — see the call site. */
function reasoningSections(gaps, prompt, p, where) {
  return `
    ${/* Readiness before anything else, because it answers the only question
          somebody has on arrival: is this worth my time yet. */''}
    <section class="hub-card">
      <div class="hub-sweeps-head">
        <div>
          <h2>How ready this is</h2>
          <p class="hub-hint">${gaps.enoughToGenerate
            ? 'Enough to build a plan on. More detail makes it more specific, never less.'
            : 'Not quite enough yet — the plan would have to guess, and a plan that guesses reads like it.'}</p>
        </div>
        <span class="hub-stage" data-stage="${gaps.ready >= 70 ? 'booked' : gaps.ready >= 40 ? 'new' : 'closed'}">${gaps.ready}%</span>
      </div>

      ${gaps.blockers.length ? `
      <div class="hub-notice">
        <strong>Still needed before a plan can be built:</strong>
        ${esc(gaps.blockers.join(' · '))}
      </div>` : ''}

      ${gaps.missing.length ? `
      <ul class="hub-gate-list">
        ${gaps.missing.map((g) => `<li><strong>${esc(g.label)}.</strong> ${esc(g.costs)}</li>`).join('')}
      </ul>` : '<p class="hub-hint">Nothing missing. This is a good profile to plan from.</p>'}

      <p class="hub-hint">Channels you have told us about:
        ${gaps.channels.length ? `<strong>${esc(gaps.channels.join(', '))}</strong>` : '<strong>none yet</strong> — a plan needs somewhere to send people from'}.</p>
    </section>

    ${/* THE PROMPT. Placed above the form on purpose: somebody arriving at an
          empty form should meet the thing that fills it, not the thing that
          asks them to. */''}
    <section class="hub-card">
      <h2>Not sure what to write?</h2>
      <p class="hub-hint">Copy this into <a href="https://claude.ai" target="_blank" rel="noopener">Claude</a>,
        <a href="https://chatgpt.com" target="_blank" rel="noopener">ChatGPT</a> or whichever assistant you
        already use — the free plans are fine. It will read your links and draft answers you can paste
        into the form below. <strong>Read them before you paste.</strong> It has been told not to invent
        anything, but it is describing your business and you are the one who knows.</p>

      <div class="hub-link-row">
        <textarea id="gtm-prompt" class="hub-prompt" rows="6" readonly>${esc(prompt)}</textarea>
      </div>
      <div class="hub-actions">
        <button class="btn btn--gold btn--sm" type="button" data-copy="#gtm-prompt">Copy the prompt</button>
      </div>
      <p class="hub-hint">It improves as you fill things in — the more we know, the more precisely it can ask.</p>
    </section>

    <form method="POST">
      <section class="hub-card">
        <h2>Your business</h2>
        <p class="hub-hint">In your own words. Short and specific beats long and impressive, and this is
          what stops your campaign sounding like everybody else's.</p>
        ${area('positioning', 'What you sell, and to whom', p.positioning,
          'e.g. Slow, well-designed trips for couples in their forties who have not taken a proper break in years.')}
        ${area('differentiator', 'Why you rather than anybody else', p.differentiator,
          'What you do that another advisor does not.')}
        ${area('icp', 'Your ideal client', p.icp,
          'Who they are, what stage of life, what they actually care about.')}
        ${area('client_examples', 'The clients you already have', p.client_examples,
          'The kinds of people who already book with you.')}
        ${area('specialties', 'What you are known for', p.specialties,
          'Destinations, trip types, occasions.')}
        ${area('markets', 'Where your clients live', p.markets,
          'Cities or regions. This decides which local hooks and events a plan can suggest.')}
      </section>

      <section class="hub-card">
        <h2>Where you already reach people</h2>
        <p class="hub-hint">Only the ones you actually use. An empty channel in a plan is a week of
          actions nobody does. <strong>We never fetch these</strong> — they are here so the prompt above
          can point your own assistant at them, and so a plan knows where it is sending you.</p>
        <div class="hub-form-grid">
          ${field('website', 'Website', p.website, 'https://')}
          ${field('newsletter', 'Newsletter platform', p.newsletter, 'Mailchimp, Flodesk, Substack…')}
          ${field('instagram', 'Instagram', p.instagram, '@handle')}
          ${field('facebook', 'Facebook', p.facebook, 'Page or profile')}
          ${field('linkedin', 'LinkedIn', p.linkedin, 'Profile URL')}
          ${field('tiktok', 'TikTok', p.tiktok, '@handle')}
        </div>
      </section>

      <section class="hub-card">
        <h2>Roughly how many</h2>
        <p class="hub-hint">Ranges, not numbers. Nobody knows their list size to the person, an exact
          figure is stale the next day, and the only thing a plan needs is the order of magnitude —
          emailing eighty past clients and running an event are different plans.</p>
        <div class="hub-form-grid">
          ${band('email_band', 'Email list', p.email_band, BANDS.email)}
          ${band('social_band', 'Largest social following', p.social_band, BANDS.social)}
          ${band('client_band', 'Past clients you could contact', p.client_band, BANDS.client)}
        </div>
      </section>

      <div class="hub-actions">
        <button class="btn btn--gold" type="submit">Save</button>
      </div>
      <p class="hub-hint">Everything here is optional and you can come back to it. Nothing is published
        anywhere — it shapes what your campaign says, and only you and Saint Lucia WELL staff see it.</p>
    </form>

    <section class="hub-card">
      <h2>What you may say about yourself</h2>
      <p class="hub-hint">Campaign copy will only ever describe you as
        <strong>${esc(LADDER_LABEL[where])}</strong>, because that is what the record shows. This is not
        a formality: describing yourself as trained when you are not is a claim about a qualification,
        and it would be your name on the post.</p>
      ${where === 'registered' ? `
      ${/* An explanation of why their copy says what it says, not a pitch. The
            sentence that followed this — "and it is also what turns one plan
            into as many as you want" — was a sales clause bolted onto a
            factual one, on a screen where the advisor has not yet been helped
            with anything. The selling happens once, in the loop-back, after a
            result. */''}
      <p class="hub-hint">That changes when the record shows
        <a href="/advisors/foundations" target="_blank" rel="noopener">Foundations</a> is complete.</p>` : ''}
    </section>`;
}

/* ── The loop-back ────────────────────────────────────────────────────────
   Rendered only when something happened. "0 visits, 0 Journeys" in week one is
   a worse thing to show somebody than silence — it reports on a campaign they
   have not had time to run yet and reads as a verdict on them.

   THE FOUNDATIONS NOTE APPEARS HERE AND NOWHERE ELSE IN THIS FLOW, and only
   inside the `report.anything` branch. Before a result it would be a pitch;
   after one it is a next step attached to evidence the advisor can see. */
function reportBlock(report, foundations) {
  if (!report || !report.anything) return '';

  const weeks = report.weeks.filter((w) => w.anything);
  return `<section class="hub-card gtm-report">
    <div class="hub-sweeps-head">
      <div>
        <h2>What happened</h2>
        <p class="hub-hint">Through your WELL link${report.finished
          ? ', across the month' : `, so far`}.</p>
      </div>
      <span class="hub-stage" data-stage="${report.totals.journeys ? 'booked' : 'new'}">${
        report.totals.journeys} shared</span>
    </div>

    <ul class="gtm-report-weeks">
      ${weeks.map((w) => `<li><strong>Week ${w.week}.</strong> ${esc(w.line)}</li>`).join('')}
    </ul>

    ${report.totals.journeys ? `<p class="hub-hint"><a href="/hub/journeys">See who they are</a> —
      a Journey is somebody who asked to hear from you.</p>` : ''}

    ${foundations ? `
    <div class="gtm-report-next">
      <p class="gtm-label">${esc(foundations.heading)}</p>
      <p class="hub-hint">${esc(foundations.body)}</p>
      <div class="hub-actions">
        <a class="btn btn--ghost btn--sm" href="${esc(foundations.href)}"
          target="_blank" rel="noopener">What Foundations covers</a>
      </div>
    </div>` : ''}
  </section>`;
}

/* ── Bits ────────────────────────────────────────────────────────────────── */
function area(name, label, value, hint) {
  return `<label class="hub-field hub-field--wide">
    <span class="hub-field-label">${esc(label)}</span>
    <textarea name="${esc(name)}" rows="2" maxlength="900" placeholder="${esc(hint)}">${esc(value || '')}</textarea>
  </label>`;
}

function field(name, label, value, placeholder) {
  return `<label class="hub-field">
    <span class="hub-field-label">${esc(label)}</span>
    <input name="${esc(name)}" value="${esc(value || '')}" placeholder="${esc(placeholder)}" autocomplete="off">
  </label>`;
}

function band(name, label, value, options) {
  return `<label class="hub-field">
    <span class="hub-field-label">${esc(label)}</span>
    <select name="${esc(name)}">
      <option value="">Prefer not to say</option>
      ${options.map(([k, l]) =>
        `<option value="${esc(k)}"${value === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}
    </select>
  </label>`;
}

const DONE_MESSAGE = {
  saved: 'Saved. Come back and add more whenever you like — it all makes the plan more specific.',
  readonly: 'Nothing was changed — you are viewing this Hub, not signed in as its owner.',
  not_configured: 'The Hub is not connected to its database just now.',
  failed: 'That did not save. Try again, and tell us if it keeps failing.'
};
