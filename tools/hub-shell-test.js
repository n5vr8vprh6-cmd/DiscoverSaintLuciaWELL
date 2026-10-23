/* ============================================================================
   hub-shell-test.js — the Hub UX lift's promises, held down
   ----------------------------------------------------------------------------
     node tools/hub-shell-test.js          (no environment needed)

   The lift (Hub brief v2, 23 Oct 2026) replaced the Hub's chrome and its Home.
   Each check below is a promise the brief or Duncan made, and each would fail
   silently if broken — a page that renders, looks right, and says something
   untrue or shows a link to the wrong person:

     1  one header, five destinations, the right one lit for every route
     2  Admin only for an admin, and never while viewing as someone
     3  the signed-in footer keeps Privacy, Terms, Accessibility, Cookie
        settings — and stops offering "Advisor sign in" to someone signed in
     4  the demo marker means the same thing in lib/ and api/
     5  Home per advisor state: no zeros for a new advisor, the waiting person
        one click away, no "being confirmed" for the demo, training that never
        claims an advisor has not trained
     6  the WELL link is the www host, and Preview is marked as a preview
   ========================================================================== */
'use strict';

let failed = 0, passed = 0;
const ok = (what, cond, detail) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + what + (cond || !detail ? '' : '\n          ' + detail));
  cond ? passed++ : failed++;
};
const section = (t) => console.log('\n  ' + t);

const { chrome, hubSection, HUB_NAV } = require('../lib/layouts.js');
const { wellLinkFor } = require('../api/_lib/hub-render.js');
const { isDemo, showsAsActive } = require('../api/_lib/demo.js');
const UI = require('../api/_lib/hub-ui.js');
const { buildBody } = require('../api/_lib/hub-screens/home.js');

const A = { id: 'a', first_name: 'Wren', last_name: 'Adeyemi', public_code: '8K4PX7', slug: 'adv-0123456789abcdef', status: 'active', role: 'advisor' };
const head = (page) => chrome(Object.assign({ layout: 'hub', path: '/hub' }, page));

/* ── 1 ── */
section('One header, five destinations');
ok('the five, in order', HUB_NAV.map((n) => n.label).join(' · ') ===
  'Home · Clients · Journey Designer · Explore Saint Lucia · Marketing');
const lit = {
  '/hub': 'home', '/hub/journeys': 'clients', '/hub/journeys/x1': 'clients',
  '/hub/journeys/x1/design': 'designer', '/hub/designer': 'designer',
  '/hub/explore': 'explore', '/hub/marketing': 'marketing', '/hub/campaign': 'marketing',
  '/hub/campaign/playbook': 'marketing', '/hub/sweepstakes': 'marketing', '/hub/sweepstakes/d1': 'marketing',
  '/hub/account': null, '/hub/admin': null
};
Object.keys(lit).forEach((p) => ok(`${p} lights ${lit[p] || 'nothing'}`, hubSection({ path: p }) === lit[p], `got ${hubSection({ path: p })}`));
ok('a screen can name its section (ASK WELL under /hub/journeys)', hubSection({ path: '/hub/journeys', hubSection: 'designer' }) === 'designer');
const h1 = head({ advisor: A, wellLink: wellLinkFor(A) }).header;
ok('exactly one current item in the bar', (h1.match(/class="hub-nav-link"[^>]*aria-current="page"/g) || []).length === 1);
ok('the consumer nav is gone from the Hub', !/Find My WELL Journey|href="\/eclipse"/.test(h1));
ok('the mobile drawer is a <details>, so it opens without script', /<details class="hub-drawer">/.test(h1));
const out = head({ advisor: null, path: '/hub/login' }).header;
ok('signed out: no Hub navigation at all', !/hub-nav-link|hub-drawer/.test(out));

/* ── 2 ── */
section('Admin is a server decision');
ok('an advisor sees no Admin link', !/href="\/hub\/admin"/.test(h1));
const hAdmin = head({ advisor: Object.assign({}, A, { role: 'admin' }) }).header;
ok('an admin does', /href="\/hub\/admin"/.test(hAdmin));
const hView = head({ advisor: Object.assign({}, A, { role: 'admin', viewingAs: true }) }).header;
ok('not while viewing as someone', !/href="\/hub\/admin"/.test(hView));

/* ── 3 ── */
section('The signed-in footer');
const f = head({ advisor: A }).footer;
['Privacy', 'Terms', 'Accessibility', 'Cookie settings'].forEach((l) => ok(`keeps ${l}`, f.includes('>' + l + '<')));
ok('no "Advisor sign in" for someone signed in', !f.includes('Advisor sign in'));
ok('an Account link instead', /href="\/hub\/account">Account</.test(f));
ok('the cookie control still opens the notice', /data-consent-open/.test(f));
const fOut = head({ advisor: null }).footer;
ok('signed out: the ordinary footer, sign-in link and all', fOut.includes('Advisor sign in'));

/* ── 4 ── */
section('The demo marker');
const slugs = ['demo-0123456789abcdef', 'demo-0123', 'adv-0123456789abcdef', 'seed-0123456789abcdef', '', null];
slugs.forEach((s) => {
  const inLib = /hub-demo-chip/.test(head({ advisor: Object.assign({}, A, { slug: s }) }).header);
  ok(`"${s}": lib and api agree (${isDemo({ slug: s })})`, inLib === isDemo({ slug: s }));
});
ok('a paused demo displays as active', showsAsActive({ status: 'paused', slug: 'demo-0123456789abcdef' }));
ok('a paused ordinary account does not', !showsAsActive({ status: 'paused', slug: 'adv-0123456789abcdef' }));

/* ── 5 ── */
section('Home, per advisor state');
const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
const J = [
  { id: 'j-new', consumer_first: 'Ana', consumer_last: 'Q', stage: 'new', travel_window: '30d', villages: ['Nature & Renewal Village'], created_at: day(1) },
  { id: 'j-old', consumer_first: 'Ben', consumer_last: 'R', stage: 'contacted', travel_window: '3-6mo', villages: ['Rainforest'], created_at: day(9) }
];
const zero = { visits: 0, completions: 0, shares: 0, lastVisitAt: null };
const some = { visits: 40, completions: 12, shares: 2, lastVisitAt: day(0) };
const home = (m) => buildBody(Object.assign({ advisor: A, journeys: J, waiting: 1, funnel: some, funnelAll: some, range: '30d', link: wellLinkFor(A) }, m));

const fresh = home({ journeys: [], waiting: 0, funnel: zero, funnelAll: zero });
ok('new: two equal ways in', /Find new clients/.test(fresh) && /I have a client/.test(fresh));
ok('new: no zeroed-out numbers', !/hub-kpi-n">0</.test(fresh) && /How your campaign fills/.test(fresh));
const busy = home({});
ok('waiting: the button opens that person\'s briefing', /href="\/hub\/journeys\/j-new">Open Ana's briefing/.test(busy));
ok('waiting: and can go straight to designing it', /href="\/hub\/journeys\/j-new\/design"/.test(busy));
ok('a contacted person is never called "waiting"', !/Ben R[\s\S]{0,600}Waiting \d/.test(busy));
ok('a village stored as an old short name still resolves', UI.villageOf('Rainforest') && UI.villageOf('Rainforest').key === 'rainforest');
const pend = home({ advisor: Object.assign({}, A, { status: 'pending' }) });
ok('pending: says the account is being confirmed', /being confirmed/.test(pend));
const demo = home({ advisor: Object.assign({}, A, { status: 'paused', slug: 'demo-0123456789abcdef' }) });
ok('demo: no "being confirmed" notice', !/being confirmed/.test(demo));
ok('untrained: neutral offer, never "you have not"', /Explore professional training/.test(busy) && !/have not (taken|completed|attended)/i.test(busy));
const fnd = home({ advisor: Object.assign({}, A, { foundations_at: day(30) }) });
ok('Foundations recorded: offers the Immersion, not the briefing', /About the Immersion/.test(fnd) && !/Explore professional training/.test(fnd));
const imm = home({ advisor: Object.assign({}, A, { foundations_at: day(60), immersion_at: day(10) }) });
ok('Immersion recorded: no training card at all', !/hub-train/.test(imm));
ok('Field Guide is marked Coming soon', /Coming soon[\s\S]{0,200}Field Guide/.test(busy));
ok('Group Studio is by application and opens the real page', /advisors\/groups\?path=hub/.test(busy) && /By application/.test(busy));
ok('no modal anywhere on Home', !/role="dialog"|aria-modal/.test(busy));

/* ── 6 ── */
section('The WELL link');
ok('www host, opaque code', wellLinkFor(A) === 'https://www.discoversaintluciawell.com/well/8K4PX7');
const card = UI.linkCard(wellLinkFor(A), {});
ok('Preview is marked as a preview', /well\/8K4PX7\?preview=1/.test(card));
ok('pending: the card says the link does not credit yet', /does not credit visits/.test(UI.linkCard(wellLinkFor(A), { pending: true })));

console.log(`\n  ${passed}/${passed + failed} passed\n`);
process.exit(failed ? 1 : 0);
