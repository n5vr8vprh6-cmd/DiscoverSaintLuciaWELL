/* ============================================================================
   campaign-more-test.js — the offer at the end of a campaign
   ----------------------------------------------------------------------------
     node tools/campaign-more-test.js           assert
     node tools/campaign-more-test.js --write   also write the page to
                                                dist/_hub-preview/ to look at

   Renders the REAL screen handler and the REAL plan section against fixture
   advisors, with no database and no session. Three things it is for:

   1. THE THREE STATES ACTUALLY DIFFER. For weeks they did not — the session
      query did not select plan_builds, foundations_at or immersion_at, so
      balanceLine() was null and rung() was `registered` for everybody, and
      every advisor alive landed on one flat fallback sentence. A test that
      only checked "an offer renders" would have passed throughout.

   2. THE GRADUATE SEES NOTHING. The state nobody has ever seen work.

   3. NOTHING HERE INVENTED A BENEFIT. Every claim on the page traces to
      CLAIMS_LADDER or to the marketing page, and the price and checkout URL
      are compared against advisors/foundations/index.src.html rather than
      trusted. A second copy of a price is only tolerable with this check
      attached to it.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WRITE = process.argv.indexOf('--write') !== -1;

let failed = 0;
function ok(what, cond, detail) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + what + (cond || !detail ? '' : '\n          ' + detail));
  if (!cond) failed++;
}
function section(t) { console.log('\n  ' + t); }

/* ── Stand in for the session ─────────────────────────────────────────────
   The screen destructures requireAdvisor at load time, so the export is
   replaced BEFORE the screen is required. Same trick the openai stub uses:
   patch the module, then load the consumer. */
const auth = require('../api/_lib/auth.js');
let CURRENT = null;
auth.requireAdvisor = async () => CURRENT;

const screen = require('../api/_lib/hub-screens/campaign-more.js');
const { planSection } = require('../api/_lib/campaign-blocks.js');
const FACTS = require('../content/campaign-facts.js');
const BUILDS = require('../api/_lib/builds.js');

/* A response that records instead of sending. */
function fakeRes() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { if (b) this.body += b; return this; },
    write(b) { this.body += b; return this; }
  };
}

async function renderMore(advisor) {
  CURRENT = advisor;
  const res = fakeRes();
  await screen({ url: '/hub/campaign/more', headers: {} }, res);
  return res;
}

const REGISTERED = {
  id: 'r', first_name: 'Wren', last_name: 'Adeyemi', email: 'wren@example.com',
  status: 'active', plan_builds: 0
};
const GRADUATE = Object.assign({}, REGISTERED, { id: 'g', foundations_at: '2026-03-01' });

(async () => {

  /* ── The page ─────────────────────────────────────────────────────────── */
  section('The page a registered advisor sees');
  const page = await renderMore(REGISTERED);
  const html = page.body;

  ok('it renders', page.statusCode === 200 && html.length > 1000, 'got ' + html.length + ' chars');

  const trained = FACTS.CLAIMS_LADDER.foundations.may
    .find((c) => /trained in the Well Destination method/i.test(c));
  ok('the ladder gives us the sentence to sell', Boolean(trained));

  ok('it says what Foundations would let the copy claim', html.indexOf(trained) !== -1,
    'the whole argument of the page — without it this is just adjectives');

  ok('and what the copy is blocked from saying today',
    FACTS.CLAIMS_LADDER.registered.mayNot.every((c) => html.indexOf(c) !== -1),
    'the "before" half of a before-and-after');

  ok('it opens by saying the current campaign stays free',
    /free, unlimited/i.test(html) && /editing, rewriting/i.test(html),
    'an advisor who reads a price first stops reading');

  /* ── One price at a time ──────────────────────────────────────────────── */
  section('One offer, then the other');
  const foundationsAt = html.indexOf('Enrol in Foundations');
  const packAt = html.indexOf('more campaigns — ' + BUILDS.PACK_PRICE);
  ok('Foundations comes first', foundationsAt > -1 && (packAt === -1 || foundationsAt < packAt),
    'the pack is the downsell; leading with $9 against $697 answers itself');
  ok('the downsell is anchored where the decline link points',
    html.indexOf('id="more-campaigns"') !== -1,
    'somebody who clicked "not right now" must land ON it, not scroll past the thing they declined');
  ok('the pack is described as bought once', /not a subscription/i.test(html));

  /* ── Nothing invented ─────────────────────────────────────────────────── */
  section('Every number traces to something');
  const marketing = fs.readFileSync(
    path.join(ROOT, 'advisors', 'foundations', 'index.src.html'), 'utf8');

  const price = (html.match(/\$[0-9,]+ USD/) || [])[0] || '';
  ok('the price matches the Foundations page', price && marketing.indexOf(price) !== -1,
    'page says "' + price + '" — if the marketing page changed, this is now lying about the price');

  /* MEASURED, NOT GUESSED: "Enrol in Foundations — $697 USD" rendered 75px tall
     at 375px, wrapping a 44px control onto two lines. The price moved out of
     the button and this keeps it out. */
  const cta = (html.match(/class="btn btn--gold"[^>]*>([^<]+)</) || [])[1] || '';
  ok('the price is beside the button, not inside it',
    cta.length > 0 && cta.indexOf('$') === -1 && cta.length <= 24,
    'button reads "' + cta + '" (' + cta.length + ' chars) — long CTA labels wrap on a phone');
  ok('and payment plans are mentioned, as the marketing page does',
    /payment plans/i.test(html) && /payment plans/i.test(marketing));

  const url = (html.match(/href="(https:\/\/shop\.[^"]+)"/) || [])[1] || '';
  ok('the checkout URL matches the Foundations page', url && marketing.indexOf(url) !== -1,
    'page links "' + url + '", which is not the button on the marketing page');

  ok('no health or outcome claim slipped in',
    !/(heal|cure|treat|reduce stress|wellness benefits)/i.test(html),
    'this page is on a paid surface and the same rules apply to us as to advisors');

  /* ── The graduate ─────────────────────────────────────────────────────── */
  section('An advisor who already did the training');
  const grad = await renderMore(GRADUATE);
  ok('is sent back to their campaign, not sold to',
    grad.statusCode === 302 && grad.headers.location === '/hub/campaign',
    'got ' + grad.statusCode + ' ' + (grad.headers.location || ''));

  /* ── The three states at the end of the plan ──────────────────────────── */
  section('The bottom of the campaign itself');
  const rows = [{ week: 1, theme: 'Start', actions: [
    { channel: 'instagram', assetKind: 'caption', title: 'A post', day: 'Mon' }] }];
  const base = { advisor: REGISTERED, planId: 'p', premise: '', profile: {}, strip: '', report: '' };

  const withLeft = planSection(rows, Object.assign({}, base, {
    mayRefresh: true, balanceLine: BUILDS.balanceLine({ plan_builds: 2 }) }));
  const outOf = planSection(rows, Object.assign({}, base, {
    mayRefresh: false, balanceLine: BUILDS.balanceLine({ plan_builds: 0 }) }));
  const gradPlan = planSection(rows, Object.assign({}, base, {
    advisor: GRADUATE, mayRefresh: true, balanceLine: null }));

  ok('with campaigns left: the button and the count',
    withLeft.indexOf('id="gtm-rebuild"') !== -1 && /2 more campaigns/.test(withLeft));
  ok('and no offer', withLeft.indexOf('/hub/campaign/more') === -1,
    'somebody who can already build one is not being sold anything');

  ok('out of campaigns: the offer, not a button',
    outOf.indexOf('/hub/campaign/more') !== -1 && outOf.indexOf('id="gtm-rebuild"') === -1);
  ok('with the decline link pointing at the downsell anchor',
    outOf.indexOf('/hub/campaign/more#more-campaigns') !== -1);
  ok('and no price on this screen at all',
    outOf.indexOf(BUILDS.PACK_PRICE) === -1 && outOf.indexOf('697') === -1,
    'the offer page names the price; the plan screen asks the question');

  ok('a graduate gets the button and NOTHING else',
    gradPlan.indexOf('id="gtm-rebuild"') !== -1 &&
    gradPlan.indexOf('/hub/campaign/more') === -1 &&
    gradPlan.indexOf('Foundations') === -1,
    'no meter, no upsell, and no sentence about a programme they completed');

  ok('the three states are genuinely different',
    new Set([withLeft, outOf, gradPlan]).size === 3,
    'they were identical in production for weeks — that is the bug this asserts against');

  /* ── Something to look at ─────────────────────────────────────────────── */
  if (WRITE) {
    const out = path.join(ROOT, 'dist', '_hub-preview');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'campaign-more.html'), html);
    console.log('\n  wrote dist/_hub-preview/campaign-more.html');
  }

  console.log('\n  ' + (failed ? failed + ' FAILED\n' : 'All good.\n'));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('\n  ' + (e && e.stack || e) + '\n'); process.exit(2); });
