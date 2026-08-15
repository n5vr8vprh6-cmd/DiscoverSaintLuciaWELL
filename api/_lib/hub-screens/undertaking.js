/* ============================================================================
   /hub/undertaking — accept the Advisor Data Undertaking
   ----------------------------------------------------------------------------
   The one screen an advisor cannot get past without acting. Every other Hub
   route redirects here until the current version is accepted
   (api/_lib/auth.js, undertakingGate).

   IT DOES NOT CALL requireAdvisor. It cannot: that guard is what redirects
   here, so using it would loop. It resolves the advisor itself with
   advisorFor() and does its own signed-out redirect — the one place in the Hub
   where a screen owns its guard for a structural reason rather than an
   inherited one.

   THERE IS A WAY OUT THAT IS NOT ACCEPTANCE. Sign out is on this page, and
   /api/auth/logout is a separate function that never passes through the gate.
   An advisor who does not want to agree must be able to leave; holding somebody
   inside a product until they accept a legal document is not consent, it is
   a hostage situation with a checkbox.

   THE WHOLE DOCUMENT IS LINKED, NOT SUMMARISED HERE. The summary below exists
   so somebody skimming on a phone knows what they are agreeing to; the link is
   what they are actually accepting, and the version string ties the record to
   it.
   ========================================================================== */
'use strict';

const { advisorFor, safeNext } = require('../auth.js');
const { str, body: parseBody } = require('../core.js');
const { hubPage, esc } = require('../hub-render.js');
const {
  UNDERTAKING_VERSION, PATH, needsUndertaking, recordAcceptance
} = require('../undertaking.js');

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'https://x');
  const next = safeNext(str(url.searchParams.get('next'), 200) || '/hub');

  const advisor = await advisorFor(req, res);
  if (!advisor) {
    res.statusCode = 302;
    res.setHeader('Location', '/hub/login?next=' + encodeURIComponent('/hub'));
    return res.end();
  }

  if (req.method === 'POST') {
    const form = parseBody(req) || {};
    if (str(form.accept, 8) !== 'yes') {
      res.statusCode = 303;
      res.setHeader('Location', '/hub/undertaking?next=' + encodeURIComponent(next) + '&done=unticked');
      return res.end();
    }
    /* Recorded against the advisor's OWN id. `advisor.id` while viewing as
       somebody would be the target's — but the gate never fires in that mode,
       so this cannot be reached to forge one. Belt and braces all the same. */
    if (advisor.viewingAs) {
      res.statusCode = 303;
      res.setHeader('Location', '/hub');
      return res.end();
    }
    const r = await recordAcceptance(advisor.id);
    res.statusCode = 303;
    res.setHeader('Location', r.ok ? next : '/hub/undertaking?done=failed');
    return res.end();
  }

  /* Already accepted and arrived here anyway — a bookmark, or a back button
     after accepting. Send them on rather than asking twice. */
  if (!needsUndertaking(advisor)) {
    res.statusCode = 302;
    res.setHeader('Location', next);
    return res.end();
  }

  const done = str(url.searchParams.get('done'), 20);
  const returning = !!advisor.undertaking_version;

  const body = `<div class="hub-main">
  <div class="wrap wrap--narrow">

    <section class="hub-card hub-gate">
      <p class="eyebrow eyebrow--gold">Before you carry on</p>
      <h1>${returning
        ? 'We have updated what advisors agree to.'
        : 'One thing to agree to first.'}</h1>

      <p class="hub-lead">${returning
        ? 'The Advisor Data Undertaking has changed since you last accepted it. Please read the ' +
          'current version and accept it to carry on.'
        : 'When a traveller shares their WELL Journey with you, they hand you their name, their ' +
          'phone number and something honest about what they are looking for. This is what you ' +
          'promise to do with it.'}</p>

      ${done === 'unticked'
        ? '<p class="hub-flash hub-flash--bad">The box needs ticking. Nothing was recorded.</p>' : ''}
      ${done === 'failed'
        ? '<p class="hub-flash hub-flash--bad">That did not save. Try again — and if it keeps ' +
          'failing, email us rather than working around it.</p>' : ''}

      <ul class="hub-gate-list">
        <li><strong>Use it to plan their trip</strong>, and not for anything else without asking.</li>
        <li><strong>No mailing lists without asking them.</strong> Sharing a Journey is not a
          marketing opt-in, and we told them so.</li>
        <li><strong>Keep it safe and keep it to yourself</strong> — not a shared inbox, not another
          advisor.</li>
        <li><strong>Delete it when they ask</strong>, within 30 days, and tell us you have. We
          cannot honestly answer them otherwise.</li>
        <li><strong>Tell us within 72 hours</strong> if it is exposed or goes to the wrong person.
          Not about blame — the law puts a short clock on it and we cannot start one we do not
          know about.</li>
      </ul>

      <p class="hub-hint">That is the summary. <a href="${esc(PATH)}" target="_blank" rel="noopener">
        Read the full undertaking</a> — it is about two minutes, and it is what you are accepting.</p>

      <form method="POST" class="hub-gate-form">
        <label class="hub-stage-opt">
          <input type="checkbox" name="accept" value="yes" required>
          <span>I have read the Advisor Data Undertaking (version ${esc(UNDERTAKING_VERSION)})
            and I agree to it.</span>
        </label>
        <button class="btn btn--gold" type="submit">Agree and continue</button>
      </form>

      <p class="hub-hint">Not ready to agree? You can
        <a href="#" data-signout>sign out</a> and come back. Your account and any Journeys you
        already hold are untouched — you just will not be able to open the Hub until you accept.</p>
    </section>

  </div>
</div>`;

  hubPage(res, { path: '/hub/undertaking', title: 'Advisor Data Undertaking', advisor, body });
};
