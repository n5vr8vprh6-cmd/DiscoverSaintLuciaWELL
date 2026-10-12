/* ============================================================================
   groups-test.js — /advisors/groups, the page and the form behind it
   ----------------------------------------------------------------------------
     node tools/groups-test.js

   FOUR HALVES. NONE OF THEM TOUCHES A REAL DATABASE OR SENDS MAIL — the
   environment is emptied first, and the database is a fake injected into
   core.js, so nothing here can write a row however the machine is configured.

     1 · THE PAGE, CLOSED   built exactly as build.js builds it, then read. The
                            brief's negative rules are enforced here because
                            they are easy to break with one well-meaning button.
     2 · THE PAGE, OPEN     the same page with SITE.groupStudio.intakeOpen set.
     3 · THE ENDPOINT       validation and the screen, driven with a fake
                            request.
     4 · THE WRITE PATH     a fake Supabase that records what it is given, so
                            "fails closed" and "inserts exactly this" are
                            asserted rather than believed.

   WHAT THIS CANNOT PROVE: that migration 029 has been run, or that mail is
   delivered. Those are owner actions and are reported as such.
   ========================================================================== */
'use strict';

const path = require('path');
const fs = require('fs');

['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'RESEND_API_KEY',
 'NOTIFY_FROM', 'GROUP_STUDIO_EMAIL', 'PRACTITIONER_EMAIL', 'ADMIN_EMAIL', 'IP_HASH_SALT']
  .forEach((k) => { delete process.env[k]; });

const core = require('../api/_lib/core.js');
const { render } = require('../lib/page.js');
const { renderSections } = require('../lib/components.js');
const SITE = require('../content/site.js');

let pass = 0, fail = 0;
function ok(what, cond, detail) {
  if (cond) { pass += 1; console.log('  ✓ ' + what); }
  else { fail += 1; console.log('  ✗ ' + what + (detail ? '\n      ' + detail : '')); }
}
const head = (t) => console.log('\n  ' + t + '\n  ' + '─'.repeat(62));

function fakeRes() {
  const r = { statusCode: 200, headers: {}, chunks: [] };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.send = (b) => { r.chunks.push(String(b)); r.ended = true; return r; };
  r.end = (b) => { if (b) r.chunks.push(String(b)); r.ended = true; return r; };
  Object.defineProperty(r, 'text', { get: () => r.chunks.join('') });
  return r;
}
const req = (o) => Object.assign({ method: 'GET', url: '/advisors/groups/apply', headers: {}, query: {} }, o);
const JSON_REQ = { 'content-type': 'application/json' };
const FORM_REQ = { 'content-type': 'application/x-www-form-urlencoded' };

const GOOD = {
  program_interest: 'custom', first_name: 'ZZTest', last_name: 'Advisor', email: 'selftest@example.com',
  business: 'ZZTest Travel', country: 'Canada', concept: 'A six-night restorative retreat',
  audience: 'Past clients and a newsletter', how_you_sell: 'Direct, to my own list',
  support_needed: ['design', 'property'], contact_consent: 'yes'
};
const w = (o, patch) => Object.assign({}, o, patch);

/* Loaded fresh each time so a changed flag is actually read. */
function loadPage(open) {
  SITE.groupStudio.intakeOpen = open;
  delete require.cache[require.resolve('../content/advisor-groups.js')];
  return require('../content/advisor-groups.js');
}
const SCHEDULER = /calendly|savvycal|cal\.com|acuity|hubspot\.com\/meetings|luma\.com|book a call|book a time|book now|schedule a call|schedule a time/i;
const CLAIMS = /guarantee[ds]?\b(?! acceptance)|exclusive preferred|certified specialist|unlimited concierge|fill your|sell[- ]?out|\bcommission\b|\$\s?\d/i;

(async () => {
  /* ═══ 1 · THE PAGE, CLOSED ═══════════════════════════════════════════ */
  head('THE PAGE — closed (the state it ships in)');
  const closed = loadPage(false);
  const rawC = render(closed, renderSections(closed.sections));
  const htmlC = rawC.replace(/ /g, ' ');
  const mainC = htmlC.slice(htmlC.indexOf('<main'), htmlC.indexOf('</main>'));

  ok('exactly one <h1>', (htmlC.match(/<h1[\s>]/g) || []).length === 1);
  ok('the H1 is the brief\'s', /Your group\. Your brand\. <em>Our destination wellness expertise\.<\/em>/.test(htmlC));
  ok('NO <form> is rendered while the intake is closed', !/<form[\s>]/.test(mainC));
  ok('…and no honeypot, no consent box, no groups.js', !/name="company"|contact_consent|\/js\/groups\.js/.test(htmlC));
  ok('it says applications open shortly, honestly', /Applications open shortly/.test(mainC));
  ok('…and offers real routes: the concierge mailbox and the briefing',
    /mailto:concierge@discoversaintluciawell\.com/.test(mainC) && /href="\/advisors\/intro"/.test(mainC));
  ok('no calendar, scheduler or booking link anywhere', !SCHEDULER.test(mainC));
  ok('no price, commission or sell-out language',
    !CLAIMS.test(mainC.replace(/does not guarantee acceptance/gi, '')),
    'matched: ' + (mainC.match(CLAIMS) || [''])[0]);
  ok('"a concept alone does not guarantee acceptance" is said plainly', /does not guarantee acceptance/.test(mainC));
  ok('Eclipse is "designed around your group" with no fixed schedule', /designed around you/.test(mainC) && /no fixed schedule/.test(mainC));
  ok('Eclipse is never called a scheduled departure', !/eclipse[^.]{0,60}\bdeparture\b/i.test(mainC.replace(/custom-branded WELL departure/gi, '')));
  ok('no partner is named (SITE.partners is empty on purpose)', !/Tourism Authority|Wellness Tourism Association|\bSLTA\b|\bWTA\b/.test(mainC));
  ok('properties are never "participating"', !/participating propert/i.test(mainC));
  ok('the umbrella "Partner Program" label is not on this page', !/Partner Program/.test(mainC));
  ok('it points non-advisors at /practitioners instead of receiving them', /href="\/practitioners"/.test(mainC));
  ok('the advisor overview is one link away', /href="\/advisors"/.test(htmlC));
  ok('backgrounds alternate — no two adjacent sections share a skin', (() => {
    const skins = [...mainC.matchAll(/<section[^>]*class="[^"]*section--(paper|sand)[^"]*"/g)].map((m) => m[1]);
    return skins.every((s, i) => i === 0 || s !== skins[i - 1]);
  })(), 'sequence: ' + [...mainC.matchAll(/section--(paper|sand)/g)].map((m) => m[1]).join(','));

  /* ═══ 2 · THE PAGE, OPEN ═════════════════════════════════════════════ */
  head('THE PAGE — open (after migration 029 and the flag)');
  const open = loadPage(true);
  const htmlO = render(open, renderSections(open.sections)).replace(/ /g, ' ');
  const mainO = htmlO.slice(htmlO.indexOf('<main'), htmlO.indexOf('</main>'));
  const G = require('../api/_lib/group-studio.js');

  ok('one real <form> posting to the Group Studio screen', (mainO.match(/<form[\s>]/g) || []).length === 1 && /action="\/advisors\/groups\/apply"/.test(mainO));
  ok('the honeypot is named `company`, and the business field is not', /name="company"/.test(mainO) && /name="business"/.test(mainO));
  ok('program interest offers exactly the fixed vocabulary',
    Object.keys(G.PROGRAM_INTEREST).every((k) => new RegExp(`name="program_interest" value="${k}"`).test(mainO)) &&
    (mainO.match(/name="program_interest"/g) || []).length === Object.keys(G.PROGRAM_INTEREST).length);
  ok('support options are the same table the endpoint validates against',
    Object.keys(G.SUPPORT).every((k) => new RegExp(`name="support_needed" value="${k}"`).test(mainO)));
  ok('consent to be contacted is a required control', /name="contact_consent"[^>]*required/.test(mainO));
  ok('the brief\'s success sentence is in the markup for the JS to read', mainO.includes(G.THANKS.replace(/’/g, '&#39;')) || mainO.includes(G.THANKS) || /data-thanks="Thanks—your group concept/.test(mainO));
  ok('the privacy notice links to /privacy', /apply-privacy[^>]*>[^<]*<a href="\/privacy"/.test(mainO));
  ok('groups.js is loaded only now', /\/js\/groups\.js/.test(htmlO));
  ok('the form offers no scheduler either', !SCHEDULER.test(mainO));
  loadPage(false); // leave the flag where the repository has it

  /* ═══ 3 · THE ENDPOINT ═══════════════════════════════════════════════ */
  head('THE ENDPOINT — validation');
  const refuse = (patch, error, field, label) => {
    const r = G.validate(w(GOOD, patch));
    ok(label, r.ok === false && r.error === error && r.field === field, JSON.stringify(r));
  };
  ok('a complete application validates', G.validate(GOOD).ok === true);
  const f = G.validate(GOOD).fields;
  ok('…stamped advisor_group_studio, with consent recorded', f.submission_source === 'advisor_group_studio' && f.contact_consent === true);
  refuse({ program_interest: 'practitioner' }, 'interest_required', 'program_interest', 'an off-list program interest is refused');
  refuse({ program_interest: '' }, 'interest_required', 'program_interest', 'a missing program interest is refused');
  refuse({ email: 'nope' }, 'email_invalid', 'email', 'a bad address is refused');
  refuse({ first_name: '' }, 'name_required', 'first_name', 'a missing first name is refused');
  refuse({ business: '' }, 'business_required', 'business', 'a missing business is refused');
  refuse({ country: '' }, 'country_required', 'country', 'a missing country is refused');
  refuse({ concept: '' }, 'concept_required', 'concept', 'a missing concept is refused');
  refuse({ audience: '' }, 'audience_required', 'audience', 'a missing audience is refused');
  refuse({ how_you_sell: '' }, 'sell_required', 'how_you_sell', 'a missing "how you sell" is refused');
  refuse({ support_needed: [] }, 'support_required', 'support_needed', 'no support selected is refused');
  refuse({ support_needed: ['design', 'a-made-up-option'] }, 'support_unknown', 'support_needed', 'one off-list support option refuses the WHOLE submission');
  refuse({ contact_consent: '' }, 'consent_required', 'contact_consent', 'no consent is refused, not defaulted');
  refuse({ contact_consent: 'no' }, 'consent_required', 'contact_consent', '…and "no" is not consent');
  refuse({ website_url: 'a.com, b.com' }, 'website_invalid', 'website_url', 'two links in one box are refused');
  refuse({ social: '@handle' }, 'social_invalid', 'social', 'a bare handle is refused');
  ok('both links are optional', G.validate(w(GOOD, { website_url: '', social: '' })).ok === true);
  ok('a bare domain gets https:// added', G.validate(w(GOOD, { website_url: 'example.com' })).fields.website === 'https://example.com/');
  ok('a single support option as a string (no-JS post) is accepted', G.validate(w(GOOD, { support_needed: 'design' })).ok === true);
  ok('duplicate support options collapse', G.validate(w(GOOD, { support_needed: ['design', 'design', 'property'] })).fields.support_needed.length === 2);
  ok('every long answer is capped, not trusted', G.validate(w(GOOD, { concept: 'x'.repeat(5000) })).fields.concept.length === G.MAX.long);
  ok('empty optionals become null, not ""', G.validate(GOOD).fields.phone === null && G.validate(GOOD).fields.notes === null);
  ok('a posted submission_source is IGNORED, not stored',
    G.validate(w(GOOD, { submission_source: 'practitioner' })).fields.submission_source === 'advisor_group_studio');

  head('THE ENDPOINT — the notification');
  const M = require('../api/_lib/group-studio-mail.js');
  const mail = M.compose(G.validate(GOOD).fields);
  ok('the subject has its own prefix, so it cannot blur with practitioners', /^\[DSW Group Studio\] Custom - ZZTest Advisor - ZZTest Travel$/.test(mail.subject), mail.subject);
  ok('a newline or U+2028 in a name cannot inject a header',
    !/[\r\n\u2028\u2029]/.test(M.subjectFor(w(G.validate(GOOD).fields, { first_name: 'A\nBcc: x@y.z', business: 'Acme\u2028Evil' }))));
  ok('the email offers no scheduler and promises nothing', !SCHEDULER.test(mail.html + mail.text) && /Nothing has been quoted, held or promised/.test(mail.html));
  ok('applicant text is escaped in the HTML body',
    !/<script/i.test(M.compose(w(G.validate(GOOD).fields, { concept: '<script>alert(1)</script>' })).html));
  ok('the recipient falls back to the concierge inbox', M.recipient() === 'concierge@discoversaintluciawell.com', M.recipient());
  process.env.GROUP_STUDIO_EMAIL = 'groups@example.com';
  ok('…and GROUP_STUDIO_EMAIL overrides it', M.recipient() === 'groups@example.com');
  delete process.env.GROUP_STUDIO_EMAIL;
  process.env.NOTIFY_FROM = 'Saint Lucia WELL <concierge@discoversaintluciawell.com>';
  ok('…but never the sending identity (nobody reads a sender)', M.recipient() === '');
  delete process.env.NOTIFY_FROM;

  head('THE ENDPOINT — the screen');
  const screen = require('../api/_lib/hub-screens/groups.js');
  let res = fakeRes();
  await screen(req(), res);
  ok('a GET sends the visitor to the form', res.statusCode === 302 && res.headers.location === '/advisors/groups#apply');
  res = fakeRes();
  await screen(req({ method: 'DELETE' }), res);
  ok('other methods are 405', res.statusCode === 405);
  res = fakeRes();
  await screen(req({ method: 'POST', headers: JSON_REQ, body: w(GOOD, { company: 'http://spam' }) }), res);
  ok('a filled honeypot is answered as success', res.statusCode === 200 && /"ok":true/.test(res.text));
  res = fakeRes();
  await screen(req({ method: 'POST', headers: JSON_REQ, body: w(GOOD, { email: 'nope' }) }), res);
  const bad = JSON.parse(res.text || '{}');
  ok('a bad address is a 400 carrying a code, a field and a sentence',
    res.statusCode === 400 && bad.error === 'email_invalid' && bad.field === 'email' && /does not look right/.test(bad.message), res.statusCode + ' ' + res.text);
  res = fakeRes();
  await screen(req({ method: 'POST', headers: FORM_REQ, body: w(GOOD, { email: 'nope' }) }), res);
  ok('without JavaScript the same error renders as a PAGE that links back to the form',
    /We could not send that/.test(res.text) && /href="\/advisors\/groups#apply"/.test(res.text) && !SCHEDULER.test(res.text));
  res = fakeRes();
  await screen(req({ method: 'POST', headers: JSON_REQ, body: GOOD }), res);
  ok('with no database, a valid application is a 503 — never a false "received"',
    res.statusCode === 503 && /unavailable/.test(res.text) && !/"ok":true/.test(res.text), res.statusCode + ' ' + res.text);

  head('ROUTING');
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const idx = v.rewrites.findIndex((r) => r.source === '/advisors/groups/apply');
  ok('vercel.json routes /advisors/groups/apply to the Hub router', idx > -1 && v.rewrites[idx].destination === '/api/hub?screen=groupStudio');
  ok('…ahead of the Hub catch-all', idx > -1 && idx < v.rewrites.findIndex((r) => r.source === '/hub/:rest*'));
  ok('the router knows the screen', /groupStudio:\s*\(\)\s*=>\s*require\('\.\.\/_lib\/hub-screens\/groups\.js'\)/.test(
    fs.readFileSync(path.join(__dirname, '..', 'api', 'hub', 'index.js'), 'utf8')));
  const fnCount = (function walk(d) {
    return fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => {
      if (e.name.startsWith('_')) return n;
      return n + (e.isDirectory() ? walk(path.join(d, e.name)) : (e.name.endsWith('.js') ? 1 : 0));
    }, 0);
  })(path.join(__dirname, '..', 'api'));
  ok('no new serverless function: the count is unchanged by this feature', fnCount <= 13, 'non-underscored api/*.js files: ' + fnCount);

  /* ═══ 4 · THE WRITE PATH ═════════════════════════════════════════════ */
  head('THE WRITE PATH — against a fake database');

  function fakeDb(plan) {
    const calls = { inserted: [], counted: 0 };
    return {
      calls,
      from(table) {
        calls.table = calls.table || table;
        const q = {
          select(_c, opts) { q._head = opts && opts.head; return q; },
          eq() { return q; },
          gte() { calls.counted += 1; return Promise.resolve(plan.count || { count: 0, error: null }); },
          insert(row) { calls.inserted.push(row); return { select() { return { maybeSingle: () => Promise.resolve(plan.insert || { data: { id: 'g1', created_at: 'now' }, error: null }) }; } }; }
        };
        return q;
      }
    };
  }
  function withDb(plan, salt) {
    const fake = fakeDb(plan);
    core.db = () => fake;
    if (salt) process.env.IP_HASH_SALT = 'selftest-salt'; else delete process.env.IP_HASH_SALT;
    delete require.cache[require.resolve('../api/_lib/group-studio.js')];
    return { G2: require('../api/_lib/group-studio.js'), fake };
  }
  const R = { headers: { 'x-forwarded-for': '203.0.113.9' } };

  let t = withDb({ count: { count: 0, error: null } }, true);
  let r = await t.G2.submit(GOOD, R);
  ok('a valid application is inserted', r.ok === true && t.fake.calls.inserted.length === 1, JSON.stringify(r));
  const row = t.fake.calls.inserted[0] || {};
  ok('…into advisor_group_applications, never practitioner_applications', t.fake.calls.table === 'advisor_group_applications');
  ok('…stamped with the discriminator', row.submission_source === 'advisor_group_studio');
  ok('…with consent recorded and the honeypot field absent', row.contact_consent === true && !('company' in row));
  ok('…and an IP HASH, never an address', typeof row.ip_hash === 'string' && !/203\.0\.113\.9/.test(JSON.stringify(row)));

  t = withDb({ count: { count: 5, error: null } }, true);
  r = await t.G2.submit(GOOD, R);
  ok('the sixth submission in an hour is rate limited', r.ok === false && r.error === 'rate_limited');
  ok('…and nothing was written', t.fake.calls.inserted.length === 0);

  t = withDb({ count: { count: null, error: null } }, true);
  r = await t.G2.submit(GOOD, R);
  ok('FAILS CLOSED when the count cannot be known (count: null, error: null)',
    r.ok === false && r.error === 'unavailable' && t.fake.calls.inserted.length === 0,
    'this is the case `(count || 0) >= 5` would have waved through');

  t = withDb({ count: { count: null, error: { code: '42P01', message: 'relation does not exist' } } }, true);
  r = await t.G2.submit(GOOD, R);
  ok('a missing table (migration 029 not run) reads as unavailable, not as a crash', r.ok === false && r.error === 'unavailable');

  t = withDb({ count: { count: 0, error: null }, insert: { data: null, error: { code: 'PGRST205', message: 'not in schema cache' } } }, true);
  r = await t.G2.submit(GOOD, R);
  ok('a schema-cache miss on INSERT is also unavailable', r.ok === false && r.error === 'unavailable');

  t = withDb({ count: { count: 0, error: null }, insert: { data: null, error: { code: '23514', message: 'check violation' } } }, true);
  r = await t.G2.submit(GOOD, R);
  ok('any other insert failure is a server error, never a success', r.ok === false && r.error === 'server');

  t = withDb({}, true);
  r = await t.G2.submit(w(GOOD, { email: 'nope' }), R);
  ok('validation runs BEFORE the database: a typo never reads as an outage', r.ok === false && r.error === 'email_invalid' && t.fake.calls.counted === 0);

  console.log('\n  ' + (fail ? '✗' : '✓') + ` ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
