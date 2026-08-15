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
  BANDS, FIELDS, profileFor, saveProfile, gapReport, intakePrompt, rung, mayRefresh
} = require('../gtm.js');

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

  const body = `<div class="hub-main">
  <div class="wrap">

    ${pageHead('My Campaign', 'Your 30-day plan',
      'A plan of small actions with the words already written, each one pointing at your WELL link. First it needs to know who you are.')}

    ${done ? `<p class="hub-flash${/failed|readonly/.test(done) ? ' hub-flash--bad' : ''}">${
      esc(DONE_MESSAGE[done] || done)}</p>` : ''}

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
      <p class="hub-hint"><a href="/advisors/foundations" target="_blank" rel="noopener">Well Destination
        Foundations</a> is what changes it — and it is also what turns one plan into as many as you
        want, since ${mayRefresh(advisor) ? '' : 'right now you get one'}.</p>` : ''}
    </section>

  </div>
</div>`;

  hubPage(res, { path: '/hub/campaign', title: 'My Campaign', advisor, body });
};

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
