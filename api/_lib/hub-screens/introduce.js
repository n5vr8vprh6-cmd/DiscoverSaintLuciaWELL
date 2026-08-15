/* ============================================================================
   /hub/journeys/:id/introduce — hand a pooled Journey to an advisor
   ----------------------------------------------------------------------------
   Only the house account sees this, and only for a Journey it holds. Routing is
   a person reading a Journey and choosing somebody — this is that, with the
   email written for them.

   TWO STEPS, ALWAYS. Pick an advisor, then read the actual email and adjust the
   personal line before it goes. This message reaches a member of the public,
   from our domain, with their own details in it, and copies in a third party.
   Nothing about that should happen on one click.

   THE JOURNEY MOVES ON SEND. It leaves the pool and enters the advisor's Hub
   with the briefing, the stages and the notes — so the advisor can work it,
   rather than working from an email and having nowhere to record what happened.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { str, body: parseBody } = require('../core.js');
const { hubPage, esc, emptyState, since } = require('../hub-render.js');
const { journeyById } = require('../hub-data.js');
const { audit } = require('../admin-data.js');
const {
  eligibleAdvisors, advisorById, compose, suggestedLine, send
} = require('../introductions.js');

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'https://x');
  const id = str(url.searchParams.get('id'), 64);

  const me = await requireAdvisor(req, res,
    id ? `/hub/journeys/${encodeURIComponent(id)}/introduce` : '/hub/journeys');
  if (!me) return;

  /* Introductions belong to the pool. A regular advisor has no business handing
     their own client to somebody else through this screen, and staff viewing
     the house Hub are looking, not acting. */
  if (!me.is_house || me.viewingAs) {
    res.statusCode = 302;
    res.setHeader('Location', id ? `/hub/journeys/${encodeURIComponent(id)}` : '/hub/journeys');
    return res.end();
  }

  const journey = id ? await journeyById(me.id, id) : null;
  if (!journey) {
    return hubPage(res, {
      path: '/hub/journeys', title: 'Not found', advisor: me, status: 404,
      body: `<div class="hub-main"><div class="wrap">${emptyState(
        'No such Journey.', 'It may have been introduced already, or removed.',
        { label: 'Your Journeys', href: '/hub/journeys' })}</div></div>`
    });
  }

  const advisors = await eligibleAdvisors();

  if (req.method === 'POST') {
    const form = parseBody(req) || {};
    const target = await advisorById(str(form.advisorId, 64));
    const line = str(form.line, 600);

    if (!target) {
      res.statusCode = 303;
      res.setHeader('Location', `/hub/journeys/${encodeURIComponent(id)}/introduce?done=ineligible`);
      return res.end();
    }

    /* Step one: they picked somebody. Show the email rather than sending it. */
    if (str(form.action, 20) !== 'send') {
      return preview(res, me, journey, target, line || suggestedLine(target, journey));
    }

    const r = await send(journey, target, line);
    if (!r.ok) {
      res.statusCode = 303;
      res.setHeader('Location', `/hub/journeys/${encodeURIComponent(id)}/introduce?done=${encodeURIComponent(r.error)}`);
      return res.end();
    }

    /* Recorded because it is a disclosure of a real person's details to a third
       party. The subject is the ADVISOR — naming the traveller here would put
       their contact details in a table that exists to log staff actions, and
       /hub/admin/subject already answers questions about them. */
    await audit(me, 'introduced', {
      subject: target,
      share: journey,
      detail: { villages: (journey.villages || []).slice(0, 2) }
    });

    res.statusCode = 303;
    res.setHeader('Location', `/hub/journeys?done=introduced`);
    return res.end();
  }

  /* ── Step one ──────────────────────────────────────────────────────────── */
  const done = str(url.searchParams.get('done'), 40);
  const name = `${journey.consumer_first || ''} ${journey.consumer_last || ''}`.trim() || 'This traveller';

  const body = `<div class="hub-main">
  <div class="wrap wrap--narrow">

    <p class="hub-back"><a href="/hub/journeys/${esc(id)}">← ${esc(name)}'s Journey</a></p>

    <header class="hub-detail-head">
      <p class="eyebrow eyebrow--gold">Introduce</p>
      <h1>Hand ${esc(name)} to an advisor</h1>
      <p class="hub-lead">They shared without a referral, so they are waiting on us to find
        them somebody. You will see the email before it goes.</p>
    </header>

    ${done ? `<p class="hub-flash hub-flash--bad">${esc(DONE_MESSAGE[done] || done)}</p>` : ''}

    ${advisors.length ? `
    <form method="POST" class="hub-card">
      <h2>Who should take this?</h2>
      <div class="hub-advisor-picks">
        ${advisors.map((a) => `
        <label class="hub-pick">
          <input type="radio" name="advisorId" value="${esc(a.id)}" required>
          <span class="hub-pick-body">
            <strong>${esc(`${a.first_name} ${a.last_name}`.trim())}</strong>
            ${a.business ? `<span>${esc(a.business)}</span>` : ''}
            ${a.market ? `<span class="hub-pick-market">${esc(a.market)}</span>` : ''}
          </span>
        </label>`).join('')}
      </div>
      <button class="btn btn--gold" type="submit">Write the introduction</button>
      <p class="hub-hint">Only advisors who are active and have accepted the
        <a href="/advisors/data-undertaking" target="_blank" rel="noopener">Advisor Data
        Undertaking</a> appear here. Somebody who has agreed to nothing should not be sent
        a traveller's phone number.</p>
    </form>` : `
    <section class="hub-card">
      <h2>Nobody is eligible yet</h2>
      <p class="hub-hint">An advisor can receive an introduction once they are active and have
        accepted the Advisor Data Undertaking. Until then this Journey stays with the team —
        which is a holding position, not a problem: ${esc(name)} is still yours to help.</p>
    </section>`}

  </div>
</div>`;

  hubPage(res, { path: '/hub/journeys', title: 'Introduce', advisor: me, body });
};

/* ── Step two ────────────────────────────────────────────────────────────── */
function preview(res, me, journey, target, line) {
  const mail = compose(journey, target, line);
  const name = `${journey.consumer_first || ''} ${journey.consumer_last || ''}`.trim();

  const body = `<div class="hub-main">
  <div class="wrap wrap--narrow">

    <p class="hub-back"><a href="/hub/journeys/${esc(journey.id)}/introduce">← Choose someone else</a></p>

    <header class="hub-detail-head">
      <p class="eyebrow eyebrow--gold">Read it before it goes</p>
      <h1>${esc(name)} → ${esc(target.first_name)}</h1>
    </header>

    <section class="hub-card">
      <h2>The envelope</h2>
      <dl class="hub-answers">
        <dt>From</dt><dd>${esc(mail.from || '(not configured)')}</dd>
        <dt>To</dt><dd>${esc(mail.to)}</dd>
        <dt>Cc</dt><dd>${esc(mail.cc)}</dd>
        <dt>Reply-To</dt><dd>${esc(mail.replyTo)}</dd>
        <dt>Subject</dt><dd>${esc(mail.subject)}</dd>
      </dl>
      <p class="hub-hint">A reply from either of them reaches ${esc(target.first_name)}, which is
        what makes this a handoff rather than a forward.</p>
    </section>

    <form method="POST" class="hub-card">
      <input type="hidden" name="action" value="send">
      <input type="hidden" name="advisorId" value="${esc(target.id)}">
      <h2>Your line about ${esc(target.first_name)}</h2>
      <label class="hub-field hub-field--wide">
        <span class="hub-field-label">This is the only part you write</span>
        <textarea name="line" rows="3" maxlength="600">${esc(mail.personalLine)}</textarea>
        <span class="hub-hint">Drafted from their profile. Say what you actually know —
          nothing here should be a guess about somebody's practice.</span>
      </label>
      <button class="btn btn--gold" type="submit">Send the introduction</button>
      <p class="hub-hint"><strong>${esc(name)}'s own words are not in this email.</strong>
        ${esc(target.first_name)} gets them in their Hub the moment this sends — quoting somebody
        back at themselves in front of a stranger is not a warm introduction.</p>
      <p class="hub-hint">Sending moves this Journey to ${esc(target.first_name)}. It leaves your
        pipeline and enters theirs, with the briefing and any notes.</p>
    </form>

    <section class="hub-card">
      <h2>The email itself</h2>
      <div class="hub-mail-preview">${mail.html}</div>
    </section>

  </div>
</div>`;

  hubPage(res, { path: '/hub/journeys', title: 'Preview the introduction', advisor: me, body });
}

const DONE_MESSAGE = {
  ineligible: 'That advisor is no longer eligible — they may have been paused, or the ' +
    'undertaking may have been updated since this page was opened. Nothing was sent.',
  email_failed: 'The introduction did not send, so nothing has moved. Try again.',
  mail_not_configured: 'Email is not configured, so nothing was sent.',
  sent_but_not_moved: 'The introduction WAS SENT but the Journey did not move to them. ' +
    'They have been introduced and cannot be un-introduced — reassign it by hand and tell us.'
};
