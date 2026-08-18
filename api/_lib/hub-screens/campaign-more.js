/* ============================================================================
   /hub/campaign/more — what comes after the campaign you just built
   ----------------------------------------------------------------------------
   Reached from the bottom of a finished campaign when an advisor has none left
   to build. Foundations first; the $9 pack one decline later, further down the
   same page.

   ── WHY NOT JUST LINK TO /advisors/foundations ─────────────────────────────
   That page is a thousand lines and is written for somebody who has never met
   any of this. This reader has just spent an evening in the campaign builder
   and wants one question answered: what would be different if I did the
   training. A long page answers it on the way to answering forty others.

   This page also knows something the marketing page cannot: WHO IS READING,
   and what their plan was allowed to say.

   ── THE PITCH IS A RULE, NOT AN ADJECTIVE ──────────────────────────────────
   It leads with CLAIMS_LADDER out of content/campaign-facts.js — the same
   table api/_lib/claims.js enforces on every generated asset. So the headline
   benefit is not "elevate your positioning"; it is that the generator is
   currently forbidden from writing "trained in the Well Destination method"
   for this advisor, and would be permitted to after Foundations.

   That is checkable by the reader, in the copy they already have in front of
   them, and it is the one Foundations claim nobody has to take on trust.

   NOTHING ON THIS PAGE IS INVENTED. Every line traces to the ladder, to
   confirmed copy on the Foundations page, or to the measured facts in
   builds.js. tools/campaign-more-test.js asserts the price and the checkout
   URL still match the marketing page rather than drifting into a second copy.

   ── AN ADVISOR WHO DOES NOT NEED THIS SHOULD NOT SEE IT ────────────────────
   A graduate is redirected straight back to their campaign. Selling somebody
   the programme they already completed is the kind of thing that makes a
   system feel like it is not paying attention.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { hubPage, esc } = require('../hub-render.js');
const { rung } = require('../gtm.js');
const BUILDS = require('../builds.js');
const FACTS = require('../../../content/campaign-facts.js');

/* ── The two numbers, and where they came from ────────────────────────────
   $697 and the checkout URL are what advisors/foundations/index.src.html
   shows today. They are stated here because this page has to name a price to
   be honest about what it is asking, and env-overridable because a price that
   can only be changed by a deploy gets changed somewhere else instead.

   tools/campaign-more-test.js reads the marketing page and fails if either of
   these has drifted from it. That check is the only reason a second copy of a
   price is tolerable at all. */
const FOUNDATIONS_PRICE = process.env.FOUNDATIONS_PRICE || '$697 USD';
const FOUNDATIONS_URL = process.env.FOUNDATIONS_URL ||
  'https://shop.theburnoutclinic.com/discover-saint-lucia-well-foundations/';

/* What the programme covers, in the words of its own curriculum section. Three
   of them, not eleven: this is a page about one decision. */
const COVERS = [
  ['The Opportunity &amp; Your Position',
    'Where wellness travel is actually going, and where you already sit in it.'],
  ['The Client-Matching System',
    'The WELL Compass discovery script and the matching matrix — how to read what a client needs before recommending anywhere.'],
  ['The Client Conversion System',
    'Turning that reading into a booking, rather than into a nice conversation.']
];

module.exports = async function handler(req, res) {
  const advisor = await requireAdvisor(req, res, '/hub/campaign/more');
  if (!advisor) return;

  /* Already trained. Nothing here is addressed to them. */
  if (BUILDS.unmetered(advisor)) {
    res.statusCode = 302;
    res.setHeader('Location', '/hub/campaign');
    return res.end();
  }

  const here = FACTS.CLAIMS_LADDER[rung(advisor)] || FACTS.CLAIMS_LADDER.registered;
  const after = FACTS.CLAIMS_LADDER.foundations;
  const packUrl = process.env.THRIVECART_BUILDPACK_URL || null;

  /* What Foundations ADDS, rather than the whole list — a reader can see for
     themselves what they already have, and repeating it back would pad the
     one comparison this page is built on. */
  const gained = after.may.filter((c) => here.may.indexOf(c) === -1);

  return hubPage(res, {
    path: '/hub/campaign/more',
    title: 'What comes next',
    advisor,
    body: `
    <p class="hub-back"><a href="/hub/campaign">&larr; Back to your campaign</a></p>

    <section class="hub-card">
      <h1>What your next campaign could say</h1>
      <p class="hub-hint">Everything in the campaign you have stays yours — editing, rewriting
        and re-angling any piece of it is free, unlimited, and always will be. This is about
        the <em>next</em> one.</p>
    </section>

    ${/* ── The claim ladder, as a before and after ──────────────────────
          The whole argument of this page, and it is a mechanical fact rather
          than a promise: claims.js will flag "trained" in this advisor's copy
          today and will not after Foundations. */''}
    <section class="hub-card gtm-ladder">
      <h2>The difference is what the writing is allowed to claim</h2>
      <p>Every asset this system writes is checked against a fixed list of what you may
        honestly say about yourself. It is not a style preference — copy that overclaims is
        copy you would be the one publishing under your own name.</p>

      <div class="gtm-ladder-now">
        <p class="gtm-label">Today, as a registered advisor, your campaign may say</p>
        <ul>${here.may.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        ${here.mayNot && here.mayNot.length ? `
        <p class="gtm-label">and is blocked from saying</p>
        <ul class="gtm-ladder-no">${here.mayNot.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      </div>

      <div class="gtm-ladder-after">
        <p class="gtm-label">After Foundations, the same generator may write</p>
        <ul>${gained.map((c) => `<li><strong>${esc(c)}</strong></li>`).join('')}</ul>
      </div>

      <p class="hub-hint">Which is simply true rather than a claim we are making: you would
        have completed the training, so the sentence stops being an overclaim.</p>
    </section>

    <section class="hub-card">
      <h2>What the training covers</h2>
      <dl class="gtm-covers">
        ${COVERS.map(([t, d]) => `<dt>${t}</dt><dd>${esc(d)}</dd>`).join('')}
      </dl>
      <p>Graduates also build campaigns here without limit — the counter this page exists
        because of does not apply to them at all.</p>

      ${/* The price sits BESIDE the button, not inside it. "Enrol in
            Foundations — $697 USD" wraps to two lines at 375px, and a
            two-line button reads as broken rather than as emphatic.
            Measured, not assumed: 75px tall against a 44px control. */''}
      <div class="gtm-plan-actions">
        <a class="btn btn--gold" href="${esc(FOUNDATIONS_URL)}" target="_blank" rel="noopener">Enrol in Foundations</a>
        <span class="hub-hint">${esc(FOUNDATIONS_PRICE)} · payment plans on request</span>
      </div>
      <p class="hub-more"><a href="/advisors/foundations" target="_blank" rel="noopener">The full programme page</a>
        — curriculum, who teaches it, payment plans and the VIP option.</p>
    </section>

    ${/* ── The downsell ─────────────────────────────────────────────────
          Below the fold on purpose and anchored, because the link that sends
          people here says "not right now". Somebody who declined the training
          should land on this, not scroll past the thing they declined. */''}
    <section class="hub-card gtm-downsell" id="more-campaigns">
      <h2>Not ready for the training?</h2>
      <p>Then just take more campaigns. ${BUILDS.PACK_SIZE} of them for
        <strong>${esc(BUILDS.PACK_PRICE)}</strong>, bought once — not a subscription, nothing
        to cancel, and they do not expire.</p>
      <p class="hub-hint">Each one is a fresh 30 days built from your profile as it stands
        then — a new season, a different channel, a campaign around an event. And each comes
        with the same unlimited editing and rewriting as the one you already have.</p>
      ${packUrl ? `
      <div class="gtm-plan-actions">
        <a class="btn btn--ghost btn--sm" href="${esc(packUrl)}" target="_blank" rel="noopener">${BUILDS.PACK_SIZE} more campaigns — ${esc(BUILDS.PACK_PRICE)}</a>
      </div>`
      : `<p class="hub-hint">Checkout is not connected yet — tell us you want these and we
        will add them to your account.</p>`}
    </section>

    <p class="hub-back"><a href="/hub/campaign">&larr; Back to your campaign</a></p>`
  });
};
