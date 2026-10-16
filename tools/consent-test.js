/* ============================================================================
   consent-test — nothing is transmitted until a visitor says yes
   ----------------------------------------------------------------------------
   Runs js/consent.js and js/analytics.js, the real files, inside a bare-bones
   fake browser (no jsdom: this repo has no dev dependencies) and checks the
   promise privacy §7 makes: no analytics script is requested and no analytics
   command is queued until analytics is accepted; declining, Global Privacy
   Control, expiry, a missing consent script and an automated or non-production
   host all mean silence; withdrawing stops it and clears the cookies.

   Run:  node tools/consent-test.js
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const CONSENT_JS = fs.readFileSync(path.join(ROOT, 'js', 'consent.js'), 'utf8');
const ANALYTICS_JS = fs.readFileSync(path.join(ROOT, 'js', 'analytics.js'), 'utf8');
const GA_ID = (ANALYTICS_JS.match(/var GA_ID = '([^']+)'/) || [])[1];

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (detail ? '  — ' + detail : '')); }
}
function group(t) { console.log('\n  ' + t); }

/* ── A fake browser, just big enough ───────────────────────────────────────── */
function makeEnv(o) {
  o = o || {};
  const store = {};
  const el = (tag) => {
    const handlers = {};
    const e = {
      tagName: tag, className: '', parentNode: null, children: [],
      setAttribute() {}, getAttribute() { return null; },
      addEventListener(t, fn) { handlers[t] = fn; },
      querySelector() { return { focus() { e.focused = true; } }; },
      appendChild(c) { c.parentNode = e; e.children.push(c); return c; },
      removeChild(c) { e.children = e.children.filter((x) => x !== c); c.parentNode = null; },
      _click(attr) {   /* a click on a [data-consent] button inside the notice */
        handlers.click({ target: { closest: () => ({ getAttribute: () => attr }) } });
      }
    };
    return e;
  };
  const docHandlers = {};
  const body = el('body');
  body.getAttribute = (a) => (a === 'data-surface' ? 'advisor' : a === 'data-page' ? 'home' : null);
  const head = el('head');
  const cookies = [];
  const document = {
    body, head, title: 'Test page', documentElement: { scrollHeight: 0, scrollTop: 0 },
    createElement: el,
    addEventListener(t, fn) { docHandlers[t] = fn; },
    set cookie(v) { cookies.push(v); }, get cookie() { return ''; }
  };
  const sandbox = {
    document, console,
    navigator: { webdriver: !!o.webdriver, globalPrivacyControl: o.gpc ? true : undefined },
    location: { hostname: o.hostname || 'www.discoversaintluciawell.com',
                origin: 'https://' + (o.hostname || 'www.discoversaintluciawell.com'),
                pathname: '/advisors' },
    requestAnimationFrame() { /* never run: the scroll loop would spin forever */ },
    innerHeight: 800, scrollY: 0
  };
  sandbox.localStorage = o.storageThrows
    ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }
    : { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  if (o.stored !== undefined) store.dslw_consent = o.stored;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  const run = (code, name) => vm.runInContext(code, sandbox, { filename: name });
  if (o.consent !== false) run(CONSENT_JS, 'consent.js');
  run(ANALYTICS_JS, 'analytics.js');

  const api = {
    sandbox, store, cookies, head, body,
    banner: () => body.children.find((c) => c.className === 'consent') || null,
    gaCalls: () => Array.from(sandbox.dataLayer)
      .filter((x) => Object.prototype.toString.call(x) === '[object Arguments]')
      .map((a) => Array.from(a)),
    gaScript: () => head.children.find((c) => /googletagmanager\.com\/gtag\/js/.test(c.src || '')) || null,
    click: (attr) => api.banner()._click(attr),
    gaEvents: () => api.gaCalls().filter((c) => c[0] === 'event')
  };
  return api;
}

const stamp = (msAgo) => JSON.stringify({ v: 1, analytics: true, at: new Date(Date.now() - msAgo).toISOString() });
const DAY = 24 * 60 * 60 * 1000;

/* ── tests ─────────────────────────────────────────────────────────────────── */
console.log('\nconsent + analytics');
ok('the GA measurement id is set in analytics.js', /^G-[A-Z0-9]+$/.test(GA_ID || ''), String(GA_ID));

group('A first-time visitor');
let t = makeEnv();
ok('is shown the notice', !!t.banner());
ok('and nothing is queued for Google', t.gaCalls().length === 0, JSON.stringify(t.gaCalls()));
ok('and no Google script is requested', !t.gaScript());
ok('the page view is still queued locally for inspection',
   t.sandbox.dataLayer.some((x) => x && x.event === 'page_view'));

group('Accepting');
t.click('accept');
ok('requests the GA script for the right id',
   !!t.gaScript() && t.gaScript().src.indexOf('id=' + GA_ID) > -1);
const calls = t.gaCalls();
const names = calls.map((c) => c[0] + ':' + (c[1] && c[1].analytics_storage ? c[1].analytics_storage : c[1] && c[1].ad_storage ? 'ads-' + c[1].ad_storage : ''));
ok('sets consent defaults to denied BEFORE config', calls.findIndex((c) => c[0] === 'consent' && c[1] === 'default') <
   calls.findIndex((c) => c[0] === 'config'), JSON.stringify(names));
const def = (calls.find((c) => c[0] === 'consent' && c[1] === 'default') || [])[2] || {};
ok('and advertising stays denied', def.ad_storage === 'denied' && def.ad_user_data === 'denied' && def.ad_personalization === 'denied');
const upd = (calls.find((c) => c[0] === 'consent' && c[1] === 'update') || [])[2] || {};
ok('analytics storage alone is granted', upd.analytics_storage === 'granted' && !('ad_storage' in upd));
const cfg = (calls.find((c) => c[0] === 'config') || [])[2] || {};
ok('Google signals and ad personalisation are off', cfg.allow_google_signals === false && cfg.allow_ad_personalization_signals === false);
ok('the automatic page view is off (we send our own)', cfg.send_page_view === false);
const pv = t.gaEvents().filter((c) => c[1] === 'page_view');
ok('the page they are on is sent once', pv.length === 1, String(pv.length));
ok('with the path and no query string',
   pv[0] && pv[0][2].page_location === 'https://www.discoversaintluciawell.com/advisors', pv[0] && pv[0][2].page_location);
ok('the notice goes away', !t.banner());
ok('the answer is stored on the device', JSON.parse(t.store.dslw_consent).analytics === true);

group('Events after accepting');
t.sandbox.dslwTrack('advisor_hub_signup_click', { source_page: '/advisors', cta_location: 'hero', location: 'hero', source: 'x', campaign: 'y' });
const ev = t.gaEvents().filter((c) => c[1] === 'advisor_hub_signup_click')[0];
ok('are forwarded as GA events', !!ev);
ok('without the dataLayer-only "event" key', ev && !('event' in ev[2]));
ok('with names that cannot collide with GA traffic-source or page names',
   ev && ev[2].ref_source === 'x' && ev[2].ref_campaign === 'y' && ev[2].site_section === 'hero' &&
   !('source' in ev[2]) && !('campaign' in ev[2]) && !('location' in ev[2]));
ok('carrying the surface and page key', ev && ev[2].surface === 'advisor' && ev[2].page_key === 'home');

group('Declining');
t = makeEnv();
t.click('decline');
ok('queues nothing for Google', t.gaCalls().length === 0);
ok('requests no script', !t.gaScript());
ok('stores the decline', JSON.parse(t.store.dslw_consent).analytics === false);
ok('and the notice does not return on the next page',
   !makeEnv({ stored: t.store.dslw_consent }).banner());

group('A returning visitor who accepted');
t = makeEnv({ stored: stamp(30 * DAY) });
ok('sees no notice', !t.banner());
ok('is measured from the first page', !!t.gaScript() && t.gaEvents().some((c) => c[1] === 'page_view'));

group('An answer older than a year');
t = makeEnv({ stored: stamp(400 * DAY) });
ok('is asked again', !!t.banner());
ok('and is not measured meanwhile', t.gaCalls().length === 0 && !t.gaScript());

group('Garbage in storage');
for (const bad of ['not json', '{"analytics":"yes","at":"2026-01-01"}', '{"analytics":true}', '{"analytics":true,"at":"nonsense"}']) {
  const g = makeEnv({ stored: bad });
  ok('is treated as unanswered: ' + bad.slice(0, 28), !!g.banner() && g.gaCalls().length === 0);
}

group('Global Privacy Control');
t = makeEnv({ gpc: true });
ok('is read as a decline: no notice', !t.banner());
ok('and nothing is sent', t.gaCalls().length === 0 && !t.gaScript());
ok('an explicit accept after it is still honoured', (() => {
  const g = makeEnv({ gpc: true });
  g.sandbox.dslwConsent.open();
  g.click('accept');
  return !!g.gaScript();
})());

group('Where it must stay silent even after accepting');
t = makeEnv({ hostname: 'localhost', stored: stamp(DAY) });
ok('localhost: commands queue but no script is requested', t.gaCalls().length > 0 && !t.gaScript());
t = makeEnv({ hostname: 'discover-saint-lucia-well.vercel.app', stored: stamp(DAY) });
ok('a vercel.app preview: no script', !t.gaScript());
t = makeEnv({ webdriver: true, stored: stamp(DAY) });
ok('an automated browser: no script', !t.gaScript());
t = makeEnv({ hostname: 'discoversaintluciawell.com', stored: stamp(DAY) });
ok('the bare production domain does load it', !!t.gaScript());

group('Without the consent script');
t = makeEnv({ consent: false, stored: stamp(DAY) });
ok('nothing is queued or loaded, whatever is in storage', t.gaCalls().length === 0 && !t.gaScript());

group('Storage unavailable');
t = makeEnv({ storageThrows: true });
ok('does not throw, and asks', !!t.banner());
t.click('accept');
ok('the answer holds for this page', !!t.gaScript());

group('Withdrawing');
t = makeEnv({ stored: stamp(DAY) });
const before = t.gaEvents().length;
t.sandbox.dslwConsent.open();
t.click('decline');
ok('turns on the GA kill switch for the property', t.sandbox['ga-disable-' + GA_ID] === true);
ok('sets analytics storage back to denied', t.gaCalls().some((c) => c[0] === 'consent' && c[1] === 'update' && c[2].analytics_storage === 'denied'));
ok('expires _ga and the property cookie', t.cookies.some((c) => /^_ga=;/.test(c)) &&
   t.cookies.some((c) => c.indexOf('_ga_' + GA_ID.replace(/^G-/, '') + '=;') === 0));
ok('expires them on the bare domain too', t.cookies.some((c) => /domain=\.discoversaintluciawell\.com/.test(c)));
t.sandbox.dslwTrack('scroll_depth', { percent: 50 });
ok('and further events are not sent', t.gaEvents().length === before);
ok('the withdrawal is stored', JSON.parse(t.store.dslw_consent).analytics === false);

console.log('\n  ' + '─'.repeat(62));
console.log('  ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
