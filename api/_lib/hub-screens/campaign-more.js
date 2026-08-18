/* ============================================================================
   /hub/campaign/more — what your next campaign could be, read from this one
   ----------------------------------------------------------------------------
   Reached from the end of a campaign when an advisor has none left to build.
   Foundations first; the $9 pack one decline later, further down the same page.

   ── WHY THIS WAS REBUILT ───────────────────────────────────────────────────
   The first version argued from a RULE. Its largest block — 1,038px of a
   2,715px page — was a claims-permission table: accurate, checkable, and cold.
   It opened on what the copy was allowed to say, listed three curriculum
   headings, and never once mentioned the campaign the reader had just spent an
   evening inside. Duncan followed the flow and called the UX thin, and he was
   describing exactly that: an explanation offered where recognition was wanted.

   ── SO IT ARGUES FROM THEIR OWN CAMPAIGN ───────────────────────────────────
   And it can, because the system already computed the argument. The confidence
   strip at the foot of every plan says what that plan was built FROM and what
   it was NOT built from, and for an advisor with no Brand Profile the second
   list reads: your own clients, markets and proof.

   That is the frustration, in our own words, from before we were selling
   anything. The page reads it back and says what it costs.

   ── THE BRIDGE IS A FACT, NOT A PITCH ──────────────────────────────────────
   /hub/campaign asks six questions: positioning, ideal client, what makes you
   different. Day One of Foundations is "Ideal client · Differentiation ·
   Positioning". They are the same questions. Today an advisor answers them
   alone, in a text box, with an AI prompt beside it — and the campaign is
   written from whatever came out.

   Nothing on this page is invented. Every claim traces to CLAIMS_LADDER, to
   confirmed copy in advisors/foundations/index.src.html, or to this advisor's
   own row. tools/campaign-more-test.js checks the price, the checkout URL and
   the curriculum wording against the marketing page rather than trusting them.

   ── WHAT IT IS NOT ─────────────────────────────────────────────────────────
   No countdown, no scarcity, no testimonials — the reader's own results sit on
   the screen they came from and are better proof than somebody else's quote.
   The Hub renders with scripts:false, so there is no motion layer here and none
   is wanted. And a graduate, or anybody who has already paid, is redirected
   away: selling somebody the thing they own is how a system tells them it is
   not paying attention.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { hubPage, esc } = require('../hub-render.js');
const { rung, profileFor, gapReport, currentPlan } = require('../gtm.js');
const { describe: describeCapacity } = require('../capacity.js');
const BUILDS = require('../builds.js');
const FACTS = require('../../../content/campaign-facts.js');

/* ── The two numbers, and where they came from ────────────────────────────
   $697 and the checkout URL are what advisors/foundations/index.src.html shows
   today. They are stated here because this page has to name a price to be
   honest about what it is asking, and env-overridable because a price that can
   only be changed by a deploy gets changed somewhere else instead.

   tools/campaign-more-test.js reads the marketing page and fails if either has
   drifted. That check is the only reason a second copy of a price is tolerable. */
const FOUNDATIONS_PRICE = process.env.FOUNDATIONS_PRICE || '$697 USD';
const FOUNDATIONS_URL = process.env.FOUNDATIONS_URL ||
  'https://shop.theburnoutclinic.com/discover-saint-lucia-well-foundations/';

/* ── What the reader is missing, and what it costs them ───────────────────
   Each entry is a gap the page can SEE in their row, paired with the effect it
   has on copy they have already read. `cost` is deliberately about their
   campaign rather than about the programme — the sale comes later, and an
   advisor who feels recognised reads further than one who feels sold to.

   `closes` is the Foundations answer, in the curriculum's own words. */
const CONSEQUENCES = [
  {
    key: 'brief',
    missing: (p) => !(p.brief_parsed && Object.keys(p.brief_parsed).length),
    what: 'Your own clients, markets and proof',
    cost: 'It was written from six answers and the Saint Lucia fact bank. Competent, ' +
      'and it could belong to any advisor — nothing in it came from your actual clients.',
    closes: 'Day One settles your ideal client, your differentiation and your positioning, ' +
      'and the Brand Profile is where those answers go. The campaign engine reads it directly.'
  },
  {
    key: 'orientation',
    missing: (p) => !p.traveller_orientation,
    what: 'Who you sell to',
    cost: 'It speaks to a general traveller rather than the person you actually book, ' +
      'and a message written to everybody persuades nobody.',
    closes: 'Day Two turns need into wellbeing intention, village, property and journey. ' +
      'You leave knowing what to recommend, to whom, and why.'
  },
  {
    key: 'expression',
    missing: (p) => !(p.expr_primary || p.expr_confirmed),
    what: 'How you create advantage',
    cost: 'Every piece leads the same way, because nothing told the writer which of ' +
      'your strengths to lead with.',
    closes: 'Day One is where you claim your place: the specialty and ideal client that ' +
      'set you apart.'
  }
];

/* ── TWO GAPS AT MOST, PLUS THE RUNG ──────────────────────────────────────
   Measured: with all four rendered the page ran to 4,361px at 375px, over the
   ceiling this rebuild set itself. Trimming the prose recovered 111px of that,
   which was not the problem — each numbered item is a structural ~370px.

   Capping is also the better page. Four numbered grievances in a column stops
   reading as recognition and starts reading as a list of your failings, and
   the ui-ux-pro-max rule against overwhelming upfront applies to problems as
   much as to features. The order above is by how much the gap is FELT in the
   copy, so the two that survive the cap are the two worth naming.

   The rung is always appended and never counted here — it is true regardless
   of how full the profile is. */
const MAX_GAPS = 2;

/* The rung consequence is separate: it is true for every registered advisor
   regardless of how full their profile is, and it is the one that is checkable
   inside copy they already hold. It USED to be this whole page. */
function claimConsequence(here, after) {
  const gained = after.may.filter((c) => here.may.indexOf(c) === -1);
  return {
    what: 'What your copy may say about you',
    /* THE WHOLE mayNot LIST, not a sample. This is the one consequence a
       reader can check against copy they already hold, so trimming it to fit a
       sentence would make the checkable thing partly unverifiable. */
    cost: `Today it may say ${quote(here.may[0])}. It is blocked from ${
      here.mayNot.map(quote).join(', ')} — so it never says them, ` +
      'even where they would be the most persuasive words on the page.',
    closes: `As a graduate the same generator writes ${quote(gained[0] || after.may[0])}.`
  };
}

const quote = (s) => `<em>${esc(s)}</em>`;

module.exports = async function handler(req, res) {
  const advisor = await requireAdvisor(req, res, '/hub/campaign/more');
  if (!advisor) return;

  /* Trained, or paid and waiting to attend. Nothing here is addressed to them. */
  if (BUILDS.unmetered(advisor)) {
    res.statusCode = 302;
    res.setHeader('Location', '/hub/campaign');
    return res.end();
  }

  const profile = (await profileFor(advisor.id)) || {};
  const gaps = gapReport(profile);
  const capacity = describeCapacity(profile);
  const held = await currentPlan(advisor.id);

  const here = FACTS.CLAIMS_LADDER[rung(advisor)] || FACTS.CLAIMS_LADDER.registered;
  const after = FACTS.CLAIMS_LADDER.foundations;
  const packUrl = process.env.THRIVECART_BUILDPACK_URL || null;

  /* Only what is actually missing for THIS advisor, plus the rung, which always
     applies. An advisor who has filled everything in gets one consequence and a
     different opening — being told you lack a Brand Profile you spent an hour
     on is the fastest way to lose somebody. */
  const found = CONSEQUENCES.filter((c) => c.missing(profile)).slice(0, MAX_GAPS);
  const list = found.concat([claimConsequence(here, after)]);

  const intake = ['positioning', 'differentiator', 'icp', 'client_examples', 'specialties', 'markets']
    .filter((f) => String(profile[f] || '').trim()).length;

  return hubPage(res, {
    path: '/hub/campaign/more',
    title: 'What comes next',
    advisor,
    body: `
    <p class="hub-back"><a href="/hub/campaign">&larr; Back to your campaign</a></p>

    ${/* ── THE BEFORE, WHICH THEY LIVED ────────────────────────────────
          Their campaign read back before anything is offered. The numbers are
          their own and the strip is an object they have already met at the
          foot of their plan, so this reads as a summary rather than a device. */''}
    <section class="hub-card gtm-readback">
      <h1>${found.length
        ? 'Your campaign was written without the part that makes it yours'
        : 'You have given your campaign nearly everything it can use'}</h1>

      <p class="hub-hint">Editing, rewriting and re-angling anything you already have stays
        free and unlimited. This is about what the <em>next</em> one is written from.</p>

      <dl class="gtm-readback-facts">
        <div><dt>Built from</dt><dd>${intake} of six intake answers${
          profile.brief_parsed && Object.keys(profile.brief_parsed).length
            ? ', and your own brief' : ''}, the Saint Lucia fact bank and the channel playbook</dd></div>
        <div><dt>Sized</dt><dd>${esc(capacity.line)}</dd></div>
        <div><dt>Profile</dt><dd>${gaps.ready}% of what the engine can use${
          gaps.channels.length ? ` · ${gaps.channels.length} channel${gaps.channels.length === 1 ? '' : 's'}` : ''}</dd></div>
      </dl>
    </section>

    ${/* ── WHAT THAT COSTS, IN THEIR COPY ──────────────────────────────
          Named per gap, and each one answered in the curriculum's own words
          rather than in ours. An advisor who has filled everything in sees
          only the rung. */''}
    <section class="hub-card">
      <h2>${found.length ? 'What that costs, in the copy you have been editing' : 'What is still out of reach'}</h2>
      <ol class="gtm-costs">
        ${list.map((c) => `<li>
          <p class="gtm-cost-what">${esc(c.what)}</p>
          <p class="gtm-cost-cost">${c.cost}</p>
          <p class="gtm-cost-closes"><strong>Foundations:</strong> ${c.closes}</p>
        </li>`).join('')}
      </ol>
    </section>

    ${/* ── THE BRIDGE ──────────────────────────────────────────────────
          The single most useful true sentence available: the six questions
          the campaign asks are Day One's curriculum. One is answered alone in
          a text box; the other is taught. */''}
    <section class="hub-card gtm-bridge">
      <h2>The six questions your campaign asked are Day One</h2>
      <p>Your positioning. Your ideal client. What makes you different from the advisor down
        the road. The campaign asked for all of it in a text box, with a prompt to run in your
        own AI — then wrote a month of copy from whatever came back.</p>
      <p><strong>Day One of Foundations is those same questions, taught</strong> — with the
        market behind them and somebody to answer to. The curriculum calls it
        <em>“Understand the forces reshaping travel demand, then claim your place: the
        specialty and ideal client that set you apart.”</em></p>
      <p class="hub-hint">Days Two and Three are what the campaign cannot reach at all:
        the matching system that turns an island into a recommendation, and the conversion
        craft that stops unpaid research walking out of the door.</p>
    </section>

    ${/* ── AND WHAT THEY LEAVE WITH ────────────────────────────────────
          Only the deliverables that answer something named above. The 90-day
          plan last, because it is the direct comparison: this campaign is 30
          days from a thin profile. */''}
    <section class="hub-card">
      <h2>What you leave with</h2>
      <dl class="gtm-covers">
        <dt>The WELL Compass Discovery Script</dt>
        <dd>The “begin with how you want to feel” conversation that qualifies a client and
          surfaces what they actually need.</dd>
        <dt>Client-Matching Matrix</dt>
        <dd>One page that turns the whole island into a recommendation.</dd>
        <dt>Consultation &amp; Fee Scripts</dt>
        <dd>Discovery, objection and professional-fee language, so your expertise stops
          walking out unpaid.</dd>
        <dt>90-Day Activation Plan</dt>
        <dd>An email and social launch kit with week-by-week targets. Your campaign is 30 days
          from six answers; this is ninety, from a profile that knows you.</dd>
      </dl>

      <div class="gtm-plan-actions">
        <a class="btn btn--gold" href="${esc(FOUNDATIONS_URL)}" target="_blank" rel="noopener">Enrol in Foundations</a>
        <span class="hub-hint">${esc(FOUNDATIONS_PRICE)} · payment plans on request</span>
      </div>
      <p class="hub-more">Graduates also build campaigns without limit.
        <a href="/advisors/foundations" target="_blank" rel="noopener">The full programme page</a>
        has the curriculum, who teaches it and the VIP option.</p>
    </section>

    ${/* ── The downsell ────────────────────────────────────────────────
          Anchored, because the link that sends people here says "not right
          now" — somebody who declined the training should land ON this rather
          than scroll past the thing they declined. */''}
    <section class="hub-card gtm-downsell" id="more-campaigns">
      <h2>Not ready for the training?</h2>
      <p>Then take more campaigns. ${BUILDS.PACK_SIZE} of them for
        <strong>${esc(BUILDS.PACK_PRICE)}</strong>, bought once — not a subscription, nothing
        to cancel, and they do not expire.</p>
      <p class="hub-hint">Each is a fresh 30 days built from your profile as it stands then,
        with the same unlimited editing and rewriting${held ? ' as the one you have' : ''}.</p>
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
