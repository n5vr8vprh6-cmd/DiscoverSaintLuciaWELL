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

/* The page reads the advisor's profile and their plan, and its whole argument
   is built from what it finds. Both are stubbed here — patched BEFORE the
   screen is required, because the screen destructures them at load time. */
const gtm = require('../api/_lib/gtm.js');
let PROFILE = {};
let PLAN = null;
gtm.profileFor = async () => PROFILE;
gtm.currentPlan = async () => PLAN;

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

async function renderMore(advisor, profile) {
  CURRENT = advisor;
  PROFILE = profile || {};
  const res = fakeRes();
  await screen({ url: '/hub/campaign/more', headers: {} }, res);
  PROFILE = {};
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

  /* The INTENT, not the phrasing. This asserted the exact words "free,
     unlimited" and went red the moment the sentence was tightened — a test
     that pins wording stops people improving copy. What must stay true is that
     the page opens on what is still free, before it asks for anything. */
  const opening = html.slice(0, html.indexOf('gtm-costs') === -1 ? 4000 : html.indexOf('gtm-costs'));
  ok('it opens by saying the current campaign stays free',
    /\bfree\b/i.test(opening) && /unlimited/i.test(opening) && /editing/i.test(opening),
    'an advisor who reads a price first stops reading');
  ok('and says it BEFORE naming any price',
    opening.indexOf('$') === -1,
    'the free half is the larger true thing and has to land first');

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

  /* ── FOUR PROFILES, FOUR DIFFERENT PAGES ──────────────────────────
     The point of the rebuild. The old page said the same thing to everybody
     because it argued from a rule; this one argues from the reader's own row,
     so the consequences it names have to CHANGE with that row — and an advisor
     who has done the work must not be told they have not.

     The worst failure this can have is telling somebody with a full Brand
     Profile that their campaign has nothing of their clients in it. */
  section('Four profiles, four different pages');

  const SIX = {
    positioning: 'Slow trips', differentiator: 'I walked them', icp: 'Couples at forty',
    client_examples: 'Two lawyers', specialties: 'Caribbean', markets: 'Toronto'
  };
  const PROFILES = {
    empty: {},
    intake: Object.assign({}, SIX),
    persona: Object.assign({}, SIX, { expr_primary: 'craft', traveller_orientation: 'restorative' }),
    full: Object.assign({}, SIX, {
      expr_primary: 'craft', traveller_orientation: 'restorative',
      brief_parsed: { CLIENTS: ['a', 'b'], MARKETS: ['c'], PROOF: ['d'] }
    })
  };

  const pages = {};
  for (const k of Object.keys(PROFILES)) {
    pages[k] = (await renderMore(REGISTERED, PROFILES[k])).body;
  }

  ok('all four render differently', new Set(Object.values(pages)).size === 4,
    'if any two match, the page is not reading the profile it claims to');

  const costs = (h) => (h.match(/gtm-cost-what/g) || []).length;
  /* CAPPED AT TWO GAPS PLUS THE RUNG. Measured at 4,361px with all four
     rendered; each item is a structural ~370px, and four numbered grievances
     in a column reads as a list of somebody's failings rather than as
     recognition. The order in CONSEQUENCES is by how much the gap is felt, so
     the two that survive the cap are the two worth naming. */
  ok('the list is capped at three',
    Object.values(pages).every((h) => costs(h) <= 3),
    'empty ' + costs(pages.empty) + ', intake ' + costs(pages.intake));
  ok('an empty profile is shown the cap',
    costs(pages.empty) === 3 && costs(pages.intake) === 3,
    'empty ' + costs(pages.empty) + ', intake ' + costs(pages.intake));
  ok('a persona profile is shown fewer', costs(pages.persona) === 2,
    'got ' + costs(pages.persona) + ' — the missing brief, and the rung');
  ok('a full profile is shown only the rung', costs(pages.full) === 1,
    'got ' + costs(pages.full));

  /* THE ONE THAT MATTERS MOST. */
  ok('a full-brief advisor is NEVER told they lack their own clients',
    pages.full.indexOf('Your own clients, markets and proof') === -1 &&
    !/could belong to any advisor/.test(pages.full),
    'telling somebody who spent an hour on a Brand Profile that they have not ' +
    'done it is the fastest way to lose them');
  ok('and their headline changes to match',
    /nearly everything it can use/.test(pages.full) &&
    /without the part that makes it yours/.test(pages.empty),
    'the opening sentence has to agree with the list under it');

  ok('every page still reaches the offer and the pack',
    Object.values(pages).every((h) =>
      h.indexOf('Enrol in Foundations') !== -1 && h.indexOf('id="more-campaigns"') !== -1),
    'the argument shrinks with the gaps; the offer does not disappear with them');

  /* ── The bridge is the same for everybody, and must be exact ─────────── */
  section('The bridge quotes the curriculum, not us');
  const DAY_ONE = 'Understand the forces reshaping travel demand, then claim your place: ' +
    'the specialty and ideal client that set you apart.';
  ok('Day One is quoted verbatim from the programme page',
    marketing.indexOf(DAY_ONE) !== -1,
    'the sentence this page attributes to the curriculum is not on the curriculum');
  ok('and the page actually carries it',
    Object.values(pages).every((h) => h.indexOf(DAY_ONE.slice(0, 60)) !== -1));
  ok('the deliverables are the confirmed ones', ['The WELL Compass Discovery Script',
    'Client-Matching Matrix', '90-Day Activation Plan'].every((d) =>
      pages.empty.indexOf(d) !== -1 && marketing.indexOf(d) !== -1),
    'each name must appear on the marketing page too');

  /* ── Paid, but not yet trained ──────────────────────────────────
     The state 021 creates. They own everything this page sells, so it must not
     sell it to them — and the loop-back note must stay quiet too, or the
     product spends weeks pitching a thing it processed the payment for. */
  section('An advisor who has paid but not yet attended');
  const PAID = Object.assign({}, REGISTERED, { id: 'pd', foundations_paid_at: '2026-08-18' });
  const paidPage = await renderMore(PAID);
  ok('is not sold Foundations again',
    paidPage.statusCode === 302 && paidPage.headers.location === '/hub/campaign',
    'they bought it; the page is addressed to somebody who has not');

  const LB = require('../api/_lib/loopback.js');
  const someResults = { anything: true, totals: { journeys: 2 }, weeks: [], finished: false };
  ok('and the loop-back note stays quiet for them',
    LB.foundationsNote(someResults, PAID, {}) === null,
    'pitching Foundations to somebody waiting to attend it is the product failing ' +
    'to notice a purchase it processed itself');
  ok('while a plain registered advisor with results still gets it',
    LB.foundationsNote(someResults, REGISTERED, {}) !== null,
    'the evidence gate must keep working — this is the only place Foundations is ' +
    'allowed to appear before exhaustion');
  ok('and it points at the short page, not the long one',
    (LB.foundationsNote(someResults, REGISTERED, {}) || {}).href === '/hub/campaign/more');
  ok('a zero-result advisor still gets nothing',
    LB.foundationsNote({ anything: false }, REGISTERED, {}) === null,
    'loopback.js: "before a result there is no argument, only a pitch"');

  /* ── The count, where it can be read ──────────────────────────────────── */
  section('The chip and the sentence quote the same number');
  [0, 1, 2, 3].forEach((n) => {
    const a = { plan_builds: n };
    const chip = BUILDS.countChip(a) || '';
    const line = BUILDS.balanceLine(a) || '';
    const inChip = (chip.match(/\d+/) || [])[0];
    const inLine = (line.match(/\d+/) || [])[0];
    ok('at ' + n + ': "' + chip + '" agrees with the sentence',
      n <= 1 ? true : inChip === inLine && inChip === String(n),
      'chip ' + inChip + ' vs sentence ' + inLine + ' — a header and a footer disagreeing about ' +
      'somebody\'s balance is worse than either alone');
  });
  ok('a graduate gets no chip', BUILDS.countChip({ foundations_at: 'x' }) === null,
    'nobody who is not being counted is shown a count');
  ok('an unreadable balance gets no chip', BUILDS.countChip({}) === null);

  /* ── The four states at the end of the plan ───────────────────────────── */
  section('The bottom of the campaign itself');
  const rows = [{ week: 1, theme: 'Start', actions: [
    { channel: 'instagram', assetKind: 'caption', title: 'A post', day: 'Mon' }] }];
  const base = { advisor: REGISTERED, planId: 'p', premise: '', profile: {}, strip: '', report: '' };

  const withLeft = planSection(rows, Object.assign({}, base, {
    mayRefresh: true, outOfCampaigns: false,
    balanceLine: BUILDS.balanceLine({ plan_builds: 2 }),
    countChip: BUILDS.countChip({ plan_builds: 2 }) }));
  const outOf = planSection(rows, Object.assign({}, base, {
    mayRefresh: false, outOfCampaigns: true, hasResults: true,
    balanceLine: BUILDS.balanceLine({ plan_builds: 0 }),
    countChip: BUILDS.countChip({ plan_builds: 0 }) }));
  const outOfNoResults = planSection(rows, Object.assign({}, base, {
    mayRefresh: false, outOfCampaigns: true, hasResults: false,
    balanceLine: BUILDS.balanceLine({ plan_builds: 0 }),
    countChip: BUILDS.countChip({ plan_builds: 0 }) }));
  const gradPlan = planSection(rows, Object.assign({}, base, {
    advisor: GRADUATE, mayRefresh: true, outOfCampaigns: false,
    balanceLine: null, countChip: null }));

  /* uat2 EXACTLY: three campaigns in hand, profile missing its essentials, so
     canGenerate is false and mayRefresh comes through false. Before the flags
     were split this rendered the Foundations upsell — asking for money from
     somebody whose actual problem was two empty fields. */
  const blocked = planSection(rows, Object.assign({}, base, {
    mayRefresh: false, outOfCampaigns: false,
    balanceLine: BUILDS.balanceLine({ plan_builds: 3 }),
    countChip: BUILDS.countChip({ plan_builds: 3 }) }));

  ok('with campaigns left: the button and the count',
    withLeft.indexOf('id="gtm-rebuild"') !== -1 && /2 more campaigns/.test(withLeft));
  ok('and no offer', withLeft.indexOf('/hub/campaign/more') === -1,
    'somebody who can already build one is not being sold anything');

  ok('the count is in the HEADER, not only at the foot',
    withLeft.indexOf('2 campaigns left') !== -1 &&
    withLeft.indexOf('2 campaigns left') < withLeft.indexOf('gtm-week'),
    'the sentence at the bottom was true, rendered and unreachable — Duncan scrolled ' +
    'a working feature and concluded it was missing');
  ok('and it links to the button rather than to a purchase',
    /href="#gtm-next"/.test(withLeft) && withLeft.indexOf('id="gtm-next"') !== -1,
    'the anchor has to resolve, or the chip is a link to nowhere');

  ok('out of campaigns: the offer, not a button',
    outOf.indexOf('/hub/campaign/more') !== -1 && outOf.indexOf('id="gtm-rebuild"') === -1);
  ok('with the decline link pointing at the downsell anchor',
    outOf.indexOf('/hub/campaign/more#more-campaigns') !== -1);
  ok('and no price on this screen at all',
    outOf.indexOf(BUILDS.PACK_PRICE) === -1 && outOf.indexOf('697') === -1,
    'the offer page names the price; the plan screen asks the question');

  ok('campaigns left but BLOCKED: no offer, no button, just the count',
    blocked.indexOf('/hub/campaign/more') === -1 &&
    blocked.indexOf('id="gtm-rebuild"') === -1 &&
    /3 more campaigns/.test(blocked),
    'uat2 has three campaigns and an unfinished profile. mayRefresh is false for FOUR ' +
    'reasons and only one of them is a reason to sell anybody anything.');

  ok('a graduate gets the button and NOTHING else',
    gradPlan.indexOf('id="gtm-rebuild"') !== -1 &&
    gradPlan.indexOf('/hub/campaign/more') === -1 &&
    gradPlan.indexOf('Foundations') === -1 &&
    gradPlan.indexOf('hub-stage--count') === -1,
    'no meter, no chip, no upsell, and no sentence about a programme they completed');

  ok('the four states are genuinely different',
    new Set([withLeft, outOf, blocked, gradPlan]).size === 4,
    'they were identical in production for weeks — that is the bug this asserts against');

  /* ── The offer follows the evidence ───────────────────────────────
     loopback.js: "before a result there is no argument, only a pitch", and it
     names "beside a locked button" as forbidden — which is exactly where this
     section renders. An advisor can exhaust their campaign in week one with
     nothing to show, and pitching training to them then is the guard eroding. */
  section('Which offer leads at zero');
  const foundIdx = (h) => h.indexOf('/hub/campaign/more"');
  const packIdx = (h) => h.indexOf('#more-campaigns');

  ok('with results, Foundations leads',
    foundIdx(outOf) > -1 && foundIdx(outOf) < packIdx(outOf),
    'there is a month of their own numbers on the same screen to argue from');
  ok('without results, the pack leads',
    packIdx(outOfNoResults) < foundIdx(outOfNoResults),
    'they are stuck. The honest thing to offer somebody stuck is the way to keep working.');
  ok('and Foundations is still reachable either way',
    foundIdx(outOfNoResults) > -1,
    'quieter, not absent — Duncan asked for both to be visible at zero');
  ok('and the pack is still reachable either way', packIdx(outOf) > -1,
    'a blocked advisor should not have to click "not right now" to find the unblock');
  ok('the two zero states differ', outOf !== outOfNoResults);

  /* ── The empty screen, which is where uat3 actually is ────────────────── */
  section('No plan yet');

  /* The whole /hub/campaign screen, not just a block: the dead button lives in
     the handler's own branch, so rendering planSection would prove nothing. */
  const campaign = require('../api/_lib/hub-screens/campaign.js');
  const renderCampaign = async (advisor) => {
    CURRENT = advisor;
    const res = fakeRes();
    await campaign({ url: '/hub/campaign', headers: {}, method: 'GET' }, res);
    return res.body;
  };

  const atZero = await renderCampaign({ id: 'z', first_name: 'Wren', status: 'active', plan_builds: 0 });
  ok('an advisor at zero is NOT offered a button that will be refused',
    atZero.indexOf('id="gtm-build"') === -1,
    'canGenerate never asked the balance, so uat3 got a live "Build my 30-day plan" ' +
    'that api/gtm.js refuses with no_builds. The fifth dead CTA this UAT.');
  ok('and is shown where to go instead', atZero.indexOf('/hub/campaign/more') !== -1);

  const fresh = await renderCampaign({ id: 'f', first_name: 'Wren', status: 'active', plan_builds: 1 });
  ok('an advisor with one campaign and no plan is told so',
    /One campaign to build/.test(fresh),
    'the count used to render only inside the plan card, so before your first plan ' +
    'there was no number anywhere');

  /* ── NOTHING ON THE EMPTY SCREEN DESCRIBES A CAMPAIGN THEY DO NOT HAVE ────
     balanceLine's wording was written for the foot of a plan and selected by
     the BALANCE, so uat3 — zero campaigns, none ever built — was told "This is
     your campaign, and everything in it stays yours to work on". Duncan
     photographed it. hasPlan=false is the fix. */
  ok('and is never told "this is your campaign" before building one',
    !/This is your campaign/.test(fresh) && !/This is your campaign/.test(atZero),
    'it described a campaign that did not exist');
  ok('nor offered something to rework',
    !/Reworking this one/.test(fresh),
    'there is nothing on that screen to rework');
  ok('the heading matches what the body says',
    !(/Build your plan/.test(atZero) && /have used the campaign/.test(atZero)),
    'the h2 sat outside the branch, so "Build your plan" headed a paragraph ' +
    'explaining that they could not');

  /* ── Something to look at ─────────────────────────────────────────────── */
  if (WRITE) {
    const out = path.join(ROOT, 'dist', '_hub-preview');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'campaign-more.html'), html);

    /* The plan itself, with four weeks rather than one, because the whole
       point of the chip is that it is visible on a plan long enough to hide
       the sentence at the foot of it. A one-week fixture would prove nothing
       about the thing being fixed. */
    const { hubPage } = require('../api/_lib/hub-render.js');
    const big = [1, 2, 3, 4].map((w) => ({
      week: w, theme: 'Week ' + w + ' theme',
      actions: [0, 1, 2].map((i) => ({
        channel: 'instagram', assetKind: 'caption', day: 'Mon',
        title: 'Action ' + (i + 1) + ' of week ' + w,
        asset: { status: 'ready', body: 'Fixture copy for week ' + w + ', action ' + (i + 1) + '.', flags: [] }
      }))
    }));
    const planRes = fakeRes();
    hubPage(planRes, {
      path: '/hub/campaign', title: 'My Campaign', advisor: REGISTERED,
      body: `<div class="hub-main"><div class="wrap">${planSection(big, Object.assign({}, base, {
        mayRefresh: true, outOfCampaigns: false, premise: 'A fixture plan, four weeks.',
        balanceLine: BUILDS.balanceLine({ plan_builds: 2 }),
        countChip: BUILDS.countChip({ plan_builds: 2 })
      }))}</div></div>`
    });
    fs.writeFileSync(path.join(out, 'campaign-plan.html'), planRes.body);

    console.log('\n  wrote dist/_hub-preview/campaign-more.html');
    console.log('  wrote dist/_hub-preview/campaign-plan.html   (4 weeks, 12 actions)');
  }

  console.log('\n  ' + (failed ? failed + ' FAILED\n' : 'All good.\n'));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('\n  ' + (e && e.stack || e) + '\n'); process.exit(2); });
