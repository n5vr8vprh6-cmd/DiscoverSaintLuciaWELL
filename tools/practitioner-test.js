/* ============================================================================
   practitioner-test.js — /practitioners, the page and the form behind it
   ----------------------------------------------------------------------------
     node tools/practitioner-test.js

   THREE HALVES, and only the last one touches a database:

     1 · THE RENDERED PAGE   built exactly as build.js builds it, then read. This
                             is where the brief's negative rules are enforced —
                             no calendar, no booking, one H1, the honeypot's
                             name, the footer's shape — because they are easy to
                             break with one well-meaning button and invisible
                             until somebody reads the HTML.
     2 · THE ENDPOINT        validation and the screen, driven with a fake
                             request and NO database and NO mailer: the
                             environment is emptied first, so nothing here can
                             write a row or send a message however the machine
                             is configured.
     3 · THE REAL TABLE      only if .env has credentials AND migration 028 has
                             been applied. Writes selftest-*@example.com rows,
                             exercises the rate limit and the subject-rights
                             lookup and erasure, then deletes them. It never
                             sends mail and never runs DDL — if the table is
                             missing it says so and stops.
   ========================================================================== */
'use strict';

const path = require('path');
const fs = require('fs');

/* Read .env WITHOUT applying it. Halves 1 and 2 must run with an empty
   environment; half 3 applies it deliberately, and only after checking the table. */
const ENVFILE = {};
try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
    const t = l.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0) ENVFILE[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  });
} catch (e) { /* no .env: half 3 is skipped and reported */ }

['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'RESEND_API_KEY',
 'NOTIFY_FROM', 'PRACTITIONER_EMAIL', 'ADMIN_EMAIL', 'IP_HASH_SALT']
  .forEach((k) => { delete process.env[k]; });

const P = require('../api/_lib/practitioner.js');
const M = require('../api/_lib/practitioner-mail.js');
const { render } = require('../lib/page.js');
const { renderSections } = require('../lib/components.js');
const page = require('../content/practitioners.js');
const SITE = require('../content/site.js');

let pass = 0, fail = 0;
function ok(what, cond, detail) {
  if (cond) { pass += 1; console.log('  ✓ ' + what); }
  else { fail += 1; console.log('  ✗ ' + what + (detail ? '\n      ' + detail : '')); }
}

function fakeRes() {
  const r = { statusCode: 200, headers: {}, chunks: [] };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.send = (b) => { r.chunks.push(String(b)); r.ended = true; return r; };
  r.end = (b) => { if (b) r.chunks.push(String(b)); r.ended = true; return r; };
  Object.defineProperty(r, 'text', { get: () => r.chunks.join('') });
  return r;
}
const req = (o) => Object.assign({ method: 'GET', url: '/practitioners/apply', headers: {}, query: {} }, o);
const JSON_REQ = { 'content-type': 'application/json' };
const FORM_REQ = { 'content-type': 'application/x-www-form-urlencoded' };

const STAMP = Date.now().toString(36);
const EMAIL = `selftest-${STAMP}@example.com`;

const RETREAT = {
  pathway: 'retreat', first_name: 'ZZTest', last_name: 'Retreat', email: EMAIL,
  business: 'ZZTest Studio', website_url: 'https://example.com', country: 'Canada',
  modality: 'Breathwork', work: 'Breathwork for founders', serves: 'Founders',
  community: 'A newsletter', led_before: 'no', concept: 'idea', help_with: ['property', 'travel']
};
const VISITING = {
  pathway: 'visiting', first_name: 'ZZTest', last_name: 'Visiting', email: EMAIL,
  business: 'ZZTest Studio', social: 'https://instagram.com/zztest', country: 'Canada', modality: 'Bodywork',
  work: 'Bodywork', serves: 'Guests', community: 'Clients', led_before: 'yes',
  led_before_detail: 'Three retreats', credentials: 'Certified', experience_type: 'Morning sessions'
};
const w = (o, patch) => Object.assign({}, o, patch);

(async () => {
  /* ═══ 1 · THE RENDERED PAGE ═══════════════════════════════════════════════ */
  console.log('\n  THE PAGE\n  ' + '─'.repeat(62));
  const raw = render(page, renderSections(page.sections));
  /* U+00A0 is inside "Saint Lucia" and friends on purpose (lib/page.js glue). The
     assertions below read plain text; the glue is asserted on `raw` further down. */
  const html = raw.replace(/\u00a0/g, ' ');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));

  ok('exactly one <h1>', (html.match(/<h1[\s>]/g) || []).length === 1);
  ok('the H1 is the brief\'s', /<h1>Bring the work\. We’ll help build the retreat around it\.<\/h1>/.test(html));
  ok('the meta title is the brief\'s',
     html.includes('<title>Host a Wellness Retreat in Saint Lucia | Discover Saint Lucia WELL</title>'));
  ok('the canonical URL is /practitioners', html.includes('href="https://discoversaintluciawell.com/practitioners"'));
  ok('it is indexable', !/name="robots"/.test(html));
  ok('the practitioner surface is stamped for analytics', /data-surface="practitioner"/.test(html));

  /* THE NEGATIVE RULES — the brief says these six times. Checked on the body, the
     nav band and the footer, so a scheduler cannot arrive in any of them. */
  const SCHEDULER = /calendly|savvycal|cal\.com|acuity|hubspot\.com\/meetings|luma\.com|book a call|book a time|book now|schedule a call|schedule a time|scheduling|iframe|<script[^>]*calendar/i;
  ok('no calendar, scheduler or booking link anywhere in the page', !SCHEDULER.test(html),
     (html.match(SCHEDULER) || [])[0]);
  ok('the only next step offered is the application',
     /Build a Retreat in Saint Lucia/.test(main) && /Join the Practitioner Network/.test(main));
  ok('every section has an id (analytics location is derived from it)',
     (main.match(/<section\b/g) || []).length === (main.match(/<section\b[^>]*\sid="/g) || []).length);

  /* Anchors that the context band and the footer point at must exist. */
  ['build', 'how-it-works', 'network', 'apply', 'value', 'destination', 'top'].forEach((id) => {
    ok(`#${id} exists`, html.includes(` id="${id}"`));
  });

  console.log('\n  Typesetting');
  const textOnly = raw.slice(raw.indexOf('<body')).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]*>/g, ' ');
  ok('"Saint Lucia" never breaks across a line in body text', !/Saint Lucia/.test(textOnly)
     && /Saint\u00a0Lucia/.test(textOnly), (textOnly.match(/.{20}Saint Lucia.{10}/) || [])[0]);
  ok('"Saint Lucia WELL" is held together whole', !/Saint\u00a0Lucia WELL/.test(textOnly));
  ok('the <title> and meta description keep ordinary spaces (search snippets, tab titles)',
     /<title>Host a Wellness Retreat in Saint Lucia \| Discover Saint Lucia WELL<\/title>/.test(raw)
       && /<meta name="description" content="Bring your community and expertise to Saint Lucia\./.test(raw));
  ok('placeholders are examples ("e.g.") and none is on a name field',
     !/name="(first|last)_name"[^>]*placeholder/.test(raw) && (raw.match(/placeholder="e\.g\./g) || []).length >= 10);

  console.log('\n  Chrome');
  ok('the context band names the page and has the four anchors',
     /Practitioners &amp; Retreat Leaders/.test(html)
       && ['#build', '#how-it-works', '#network', '#apply'].every((a) => html.includes(`href="${a}"`)));
  ok('the band opts into the sideways-scrolling treatment', /pro-context pro-context--scroll/.test(html));
  const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  ok('the global header is unchanged — no Practitioners item in the main nav',
     !/practitioner/i.test(header.split('pro-context')[0]),
     'brief §01: "Do not add Practitioners to the main global navigation in V1."');
  ok('nothing in SITE.nav points at /practitioners', !SITE.nav.some((n) => /practitioner/.test(n.href)));

  const footer = html.slice(html.indexOf('<footer'), html.indexOf('</footer>'));
  const cols = footer.split('class="footer-col').slice(1);
  ok('the footer still has exactly four columns', cols.length === 4, `found ${cols.length}`);
  const stacked = cols.find((c) => />Retreat Leaders</.test(c)) || '';
  ok('Retreat Leaders is in the FOURTH column', stacked && cols.indexOf(stacked) === 3);
  ok('…directly above About',
     stacked.indexOf('>Retreat Leaders<') > -1
       && stacked.indexOf('>Retreat Leaders<') < stacked.indexOf('>About<'));
  ok('…with both links, on the two pathway anchors',
     stacked.includes('href="/practitioners#build"') && stacked.includes('href="/practitioners#network"'));
  ok('About\'s own links are all still there',
     ['#why-saint-lucia', '#approach', '#partners', '#contact'].every((a) => stacked.includes('/about' + a)));

  console.log('\n  The hero and the two pathways');
  ok('the primary button goes to the form', /data-pathway="retreat"[^>]*>Build a Retreat in Saint Lucia|href="#apply" data-pathway="retreat">Build a Retreat in Saint Lucia/.test(html));
  ok('the secondary goes to the network section, not the form',
     /href="#network" data-pathway="visiting">Join the Visiting Practitioner Network/.test(html));
  ok('the closing CTAs carry ?path= so they land on the form with a pathway chosen',
     html.includes('/practitioners?path=retreat#apply') && html.includes('/practitioners?path=visiting#apply'));

  console.log('\n  What the page says');
  ok('the network is described as always growing, not "in development"',
     /always growing and developing our Visiting Practitioner Network/.test(html) && !/in development/i.test(main));
  ok('and still says joining guarantees nothing',
     /does not guarantee a placement or residency/.test(html));
  ok('no partner is named', !/Tourism Authority|Wellness Tourism Association|SLTA|\bWTA\b/.test(html));
  ok('properties are never called "participating"', !/participating propert/i.test(html));
  ok('Eclipse is proof of thinking, not a promise of scope', /not a promise that every retreat/.test(html));
  ok('no health-outcome vocabulary',
     !/\b(cure|heal|healing|treat|treatment|therapeutic|clinical|medical|diagnos\w*|anxiety|depression|burnout|detox)\b/i.test(main),
     (main.match(/\b(cure|heal|healing|treat|treatment|therapeutic|clinical|medical|diagnos\w*|anxiety|depression|burnout|detox)\b/i) || [])[0]);
  ok('the six capability cards are there',
     ['Shape the offer', 'Find the right property', 'Build the travel layer', 'Design the wider journey',
      'Strengthen the practitioner team', 'Take it to market'].every((t) => main.includes(t)));
  ok('the four steps are there',
     ['Qualify', 'Design', 'Assemble', 'Activate'].every((t) => new RegExp(`<h3>${t}</h3>`).test(main)));
  ok('the six villages are labelled', ['Longevity', 'Nature &amp; Renewal', 'Ocean &amp; Restoration',
     'Heritage &amp; Nourishment', 'Movement &amp; Adventure', 'Connection &amp; Romance'].every((v) => main.includes(`>${v}</li>`)));
  ok('the hero and network photographs are in, with real derivatives on disk',
     /practitioners-hero-960.webp 960w/.test(html) && /practitioners-hero-2000.jpg 2000w/.test(html)
       && /practitioners-network-960.jpg/.test(main)
       && ['hero-960', 'hero-1440', 'hero-2000', 'network-640', 'network-960'].every((n) =>
            ['jpg', 'webp'].every((e) => fs.existsSync(path.join(__dirname, '..', 'assets', 'practitioners', `practitioners-${n}.${e}`)))));
  ok('no placeholder flag is left on the page', !/Art direction|Photography to come/.test(main));
  ok('the network photograph has descriptive alt text', /alt="A facilitator and a small group/.test(main));

  console.log('\n  The form markup');
  const form = main.slice(main.indexOf('<form'), main.indexOf('</form>'));
  ok('it posts to /practitioners/apply', /<form[^>]*method="POST"[^>]*action="\/practitioners\/apply"/.test(form));
  ok('the two link boxes are single-value: plain text inputs (so "example.com" submits without JS), url keyboard, no multi-value hint',
     /name="website_url"[^>]*inputmode="url"/.test(form) && /name="social"[^>]*inputmode="url"/.test(form)
       && !/one of the two|Instagram, LinkedIn or/.test(form)
       && /Each box takes a single link/.test(form));
  ok('every Step 1 field from the brief is present',
     ['first_name', 'last_name', 'email', 'phone', 'business', 'website_url', 'social', 'country', 'years', 'modality', 'pathway']
       .every((n) => form.includes(`name="${n}"`)));
  ok('every shared fit field from the brief is present',
     ['work', 'serves', 'community', 'led_before', 'led_before_detail', 'audience_size', 'notes']
       .every((n) => form.includes(`name="${n}"`)));
  ok('every Retreat field is present',
     ['concept', 'group_size', 'price_range', 'timing', 'previous_locations', 'help_with']
       .every((n) => form.includes(`name="${n}"`)));
  ok('every Visiting field is present',
     ['credentials', 'experience_type', 'session_capacity', 'availability', 'hospitality_experience']
       .every((n) => form.includes(`name="${n}"`)));
  ok('all eight "help with" options from the brief are offered',
     Object.keys(P.HELP_WITH).length === 8 && Object.values(P.HELP_WITH).every((l) => form.includes(l)));
  ok('all three pathways are offered', ['retreat', 'visiting', 'both'].every((v) => form.includes(`name="pathway" value="${v}"`)));
  ok('the three submit labels are the brief\'s',
     ['Submit Retreat Application', 'Submit Practitioner Profile', 'Submit Application'].every((l) => form.includes(l)));
  ok('the honeypot is named `company` and no real field is', (form.match(/name="company"/g) || []).length === 1);
  ok('branch-only fields are NOT natively required (JS-off visitors could not submit otherwise)',
     !/name="credentials"[^>]*\srequired|name="experience_type"[^>]*\srequired|name="concept"[^>]*\srequired/.test(form)
       && !/<input[^>]*name="help_with"[^>]*\srequired/.test(form));
  ok('the form is not novalidate in the markup (JS sets that when it takes over)', !/novalidate/.test(form));
  ok('the success copy in the markup is the brief\'s, verbatim',
     form.includes('Thank you. We’ll review your application and reach out by email if there appears to be a strong fit.')
       && /Your profile has been submitted for review for the Discover Saint Lucia WELL practitioner network\./.test(form));
  ok('the success state has no link and no button', !/<a\b|<button/.test(main.slice(main.indexOf('data-pf-done'), main.indexOf('data-pf-done') + 400)));

  /* ═══ 2 · THE ENDPOINT ════════════════════════════════════════════════════ */
  console.log('\n  THE ENDPOINT\n  ' + '─'.repeat(62));
  console.log('\n  Validation');
  ok('a complete retreat application validates', P.validate(RETREAT).ok);
  ok('a complete visiting application validates', P.validate(VISITING).ok);
  ok('"both" needs both branches', P.validate(w(RETREAT, { pathway: 'both' })).error === 'credentials_required');
  ok('…and passes when both are given',
     P.validate(w(RETREAT, { pathway: 'both', credentials: 'x', experience_type: 'y' })).ok);
  ok('an unknown pathway is refused', P.validate(w(RETREAT, { pathway: 'marketplace' })).error === 'pathway_required');
  ok('a missing name is refused, and names the field',
     JSON.stringify(P.validate(w(RETREAT, { first_name: '' }))) === JSON.stringify({ ok: false, error: 'name_required', field: 'first_name' }));
  ok('a broken address is refused', P.validate(w(RETREAT, { email: 'nope' })).error === 'email_invalid');
  ok('a link to a website or a profile is required — neither is refused',
     P.validate(w(RETREAT, { website_url: '', social: '' })).error === 'presence_required');
  ok('…and either one alone is enough',
     P.validate(w(RETREAT, { website_url: '', social: 'https://instagram.com/x' })).ok && P.validate(w(RETREAT, { social: '' })).ok);

  console.log('\n  One link per box');
  const linkErr = (patch) => P.validate(w(RETREAT, patch)).error;
  ok('a bare domain gets https:// added and is stored as one clean URL',
     P.validate(w(RETREAT, { website_url: 'example.com' })).fields.website === 'https://example.com/');
  ok('a full profile link is kept as given', P.validate(VISITING).fields.social === 'https://instagram.com/zztest');
  ok('a handle is refused in the social box (it names no platform)', linkErr({ social: '@yourname' }) === 'social_invalid');
  ok('two links in the website box are refused', linkErr({ website_url: 'a.com, b.com' }) === 'website_invalid');
  ok('…separated by a space too', linkErr({ website_url: 'a.com b.com' }) === 'website_invalid');
  ok('…and two profiles in the social box', linkErr({ social: 'instagram.com/x linkedin.com/in/y' }) === 'social_invalid');
  ok('words are not a link', linkErr({ website_url: 'not a link' }) === 'website_invalid');
  ok('a host with no dot is not a link', linkErr({ website_url: 'https://localhost' }) === 'website_invalid');
  ok('only http(s) is accepted', linkErr({ website_url: 'javascript:alert(1)' }) === 'website_invalid'
     && linkErr({ website_url: 'ftp://a.com' }) === 'website_invalid');
  ok('one bad box is refused even when the other is fine', linkErr({ website_url: 'https://example.com', social: '@x' }) === 'social_invalid');
  ok('the error names the box, so focus can go there',
     P.validate(w(RETREAT, { social: '@x' })).field === 'social');
  ok('the retreat concept must be a known option', P.validate(w(RETREAT, { concept: 'whatever' })).error === 'concept_required');
  ok('at least one "help with" is required', P.validate(w(RETREAT, { help_with: [] })).error === 'help_required');
  ok('an INVENTED "help with" option is refused outright', P.validate(w(RETREAT, { help_with: ['property', 'free-flights'] })).error === 'help_unknown');
  ok('a single ticked box arrives as a string and still works (native form post)', P.validate(w(RETREAT, { help_with: 'property' })).ok);
  ok('led_before must be yes or no', P.validate(w(RETREAT, { led_before: 'maybe' })).error === 'led_before_required');
  ok('"no" discards any detail typed before they changed their mind',
     P.validate(w(RETREAT, { led_before: 'no', led_before_detail: 'stale' })).fields.led_before_detail === null);
  ok('a retreat application ignores visiting fields rather than storing them',
     P.validate(w(RETREAT, { credentials: 'sneaky' })).fields.visiting === null);
  ok('a visiting application ignores retreat fields', P.validate(w(VISITING, { concept: 'idea' })).fields.retreat === null);
  ok('empty optionals are null, not ""', P.validate(RETREAT).fields.phone === null && P.validate(RETREAT).fields.notes === null);
  ok('the address is lower-cased', P.validate(w(RETREAT, { email: 'ABC@Example.COM' })).fields.email === 'abc@example.com');
  const huge = 'x'.repeat(50000);
  const capped = P.validate(w(RETREAT, { work: huge, business: huge }));
  ok('every field is length-capped',
     capped.ok && capped.fields.work.length === P.MAX.long && capped.fields.business.length === P.MAX.business);
  ok('a non-string value cannot get through as a field', P.validate(w(RETREAT, { first_name: { $ne: 1 } })).error === 'name_required');

  console.log('\n  The notification');
  const f = P.validate(RETREAT).fields;
  ok('the subject is the brief\'s format',
     M.subjectFor(f) === '[DSW Practitioner] Retreat - ZZTest Retreat - ZZTest Studio', M.subjectFor(f));
  ok('…for each pathway',
     /^\[DSW Practitioner\] Visiting - /.test(M.subjectFor(P.validate(VISITING).fields))
       && /^\[DSW Practitioner\] Both - /.test(M.subjectFor(P.validate(w(RETREAT, { pathway: 'both', credentials: 'x', experience_type: 'y' })).fields)));
  const injected = M.subjectFor(w(f, { business: 'X\r\nBcc: attacker@example.com', first_name: 'A\nB' }));
  ok('a newline in applicant text cannot inject a header', !/[\r\n]/.test(injected), JSON.stringify(injected));
  const mail = M.compose(P.validate(w(RETREAT, { work: '<img src=x onerror=alert(1)>' })).fields);
  ok('applicant markup arrives as text in the email', !/<img/.test(mail.html) && /&lt;img/.test(mail.html));
  ok('the email offers no scheduler and no booking link', !SCHEDULER.test(mail.html + mail.text));
  ok('the recipient defaults to the practitioner mailbox', M.recipient() === 'concierge@discoversaintluciawell.com', M.recipient());
  process.env.NOTIFY_FROM = 'Saint Lucia WELL <concierge@discoversaintluciawell.com>';
  ok('…but never to the sending identity (nobody reads a sender)', M.recipient() === '');
  delete process.env.NOTIFY_FROM;

  console.log('\n  The screen');
  const screen = require('../api/_lib/hub-screens/practitioner.js');
  let res = fakeRes();
  await screen(req(), res);
  ok('a GET sends the visitor to the form', res.statusCode === 302 && res.headers.location === '/practitioners#apply');
  res = fakeRes();
  await screen(req({ method: 'DELETE' }), res);
  ok('other methods are 405', res.statusCode === 405);

  res = fakeRes();
  await screen(req({ method: 'POST', headers: JSON_REQ, body: w(RETREAT, { company: 'http://spam' }) }), res);
  ok('a filled honeypot is answered as success', res.statusCode === 200 && /"ok":true/.test(res.text),
     'telling a bot it failed teaches whoever wrote it to stop filling the field');

  res = fakeRes();
  await screen(req({ method: 'POST', headers: JSON_REQ, body: w(RETREAT, { email: 'nope' }) }), res);
  const bad = JSON.parse(res.text || '{}');
  ok('a bad address is a 400 carrying a code, a field and a sentence',
     res.statusCode === 400 && bad.error === 'email_invalid' && bad.field === 'email' && /does not look right/.test(bad.message),
     res.statusCode + ' ' + res.text);

  res = fakeRes();
  await screen(req({ method: 'POST', headers: FORM_REQ, body: w(RETREAT, { email: 'nope' }) }), res);
  ok('without JavaScript the same error renders as a PAGE', /<h1>We could not send that\.<\/h1>/.test(res.text) && /does not look right/.test(res.text));
  ok('…and that page links back to the form, not to a scheduler', /href="\/practitioners#apply"/.test(res.text) && !SCHEDULER.test(res.text));

  res = fakeRes();
  await screen(req({ method: 'POST', headers: JSON_REQ, body: RETREAT }), res);
  ok('with no database, a valid application is a 503 — never a false "received"',
     res.statusCode === 503 && /unavailable/.test(res.text) && !/"ok":true/.test(res.text), res.statusCode + ' ' + res.text);

  /* ═══ routing ═════════════════════════════════════════════════════════════ */
  console.log('\n  Routing');
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const idx = v.rewrites.findIndex((r) => r.source === '/practitioners/apply');
  ok('vercel.json routes /practitioners/apply to the Hub router', idx > -1 && v.rewrites[idx].destination === '/api/hub?screen=practitioner');
  ok('…ahead of the Hub catch-all', idx > -1 && idx < v.rewrites.findIndex((r) => r.source === '/hub/:rest*'));
  ok('the router knows the screen', /practitioner:\s*\(\)\s*=>\s*require\('\.\.\/_lib\/hub-screens\/practitioner\.js'\)/.test(
    fs.readFileSync(path.join(__dirname, '..', 'api', 'hub', 'index.js'), 'utf8')));
  ok('no new top-level serverless function was added (the router carries it)',
     fs.readdirSync(path.join(__dirname, '..', 'api')).filter((n) => /\.js$/.test(n)).length === 7
       && !fs.existsSync(path.join(__dirname, '..', 'api', 'practitioner.js')));
  const sitemap = fs.existsSync(path.join(__dirname, '..', 'dist', 'sitemap.xml'))
    ? fs.readFileSync(path.join(__dirname, '..', 'dist', 'sitemap.xml'), 'utf8') : null;
  if (sitemap) ok('the built sitemap includes /practitioners', sitemap.includes('/practitioners</loc>'));

  /* ═══ 3 · THE REAL TABLE ══════════════════════════════════════════════════ */
  console.log('\n  THE DATABASE\n  ' + '─'.repeat(62));
  if (!ENVFILE.SUPABASE_URL || !ENVFILE.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('\n  No SUPABASE_* in .env — the database half is skipped.');
    return done();
  }
  process.env.SUPABASE_URL = ENVFILE.SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = ENVFILE.SUPABASE_SERVICE_ROLE_KEY;
  process.env.IP_HASH_SALT = ENVFILE.IP_HASH_SALT || 'selftest-salt';

  const { db } = require('../api/_lib/core.js');
  const supabase = db();
  const probe = await supabase.from('practitioner_applications').select('id', { count: 'exact', head: true });
  /* A head-count against a missing table can come back { count: null, error: null }
     (api/capture.js records the same trap), so "no error" is not "it exists". */
  if (probe.error || typeof probe.count !== 'number') {
    console.log('\n  practitioner_applications does not exist on this database — run\n'
      + '  db/migrations/028-practitioner-applications.sql in the Supabase SQL editor, then re-run.\n'
      + '  (This test never runs DDL, and never sends mail.)');
    /* Even so, what the code DOES when the table is missing is a property worth
       proving: it must refuse, loudly, rather than pretend. */
    const r = await P.submit(RETREAT, { headers: { 'x-forwarded-for': '203.0.113.9' } });
    ok('with the migration unrun, submit() refuses as "unavailable" instead of failing open', !r.ok && r.error === 'unavailable', JSON.stringify(r));
    return done();
  }

  const IP = '203.0.113.' + (1 + Math.floor(Math.random() * 250));
  const REQ = { headers: { 'x-forwarded-for': IP } };

  const first = await P.submit(RETREAT, REQ);
  ok('a valid application is written', first.ok, JSON.stringify(first));
  if (!first.ok) return done();

  const rows = (await P.listApplications(1000)).filter((r) => r.email === EMAIL);
  ok('it comes back, with its pathway-specific answers as data', rows.length === 1 && rows[0].retreat && rows[0].retreat.help_with.length === 2, JSON.stringify(rows[0]));
  ok('status starts as "new" and no review time is set', rows[0].status === 'new' && rows[0].reviewed_at === null);
  ok('the address itself is not stored in ip_hash', rows[0].ip_hash && !rows[0].ip_hash.includes(IP));

  const second = await P.submit(VISITING, REQ);
  ok('a second application from the same person is a second row, not an overwrite',
     second.ok && (await P.listApplications(1000)).filter((r) => r.email === EMAIL).length === 2);

  let refused = null, n = 2;
  while (n < 8 && !refused) { const r = await P.submit(w(RETREAT, { last_name: 'Rate' + n }), REQ); if (!r.ok) refused = r; n += 1; }
  ok('the sixth application in an hour from one origin is refused',
     refused && refused.error === 'rate_limited' && n === 6, `n=${n}: ${JSON.stringify(refused)}`);
  const other = await P.submit(w(RETREAT, { last_name: 'Elsewhere' }), { headers: { 'x-forwarded-for': '198.51.100.7' } });
  ok('…but a different origin is unaffected', other.ok, JSON.stringify(other));

  console.log('\n  Subject rights');
  const { findSubject, eraseSubject, accessExport } = require('../api/_lib/subject-data.js');
  const found = await findSubject(EMAIL);
  ok('the subject-rights lookup finds the applications',
     !!found && (found.practitionerApplications || []).length >= 2,
     'if this fails, /hub/admin/subject reports "nothing held" about people we hold');
  const exp = accessExport(found);
  ok('and the access response includes them', (exp.practitioner_applications || []).length >= 2);
  const erased = await eraseSubject(EMAIL);
  ok('erasing removes them, even with no Journey on file', erased.ok && erased.applications >= 2, JSON.stringify(erased));
  ok('and they are really gone', (await P.listApplications(1000)).every((r) => r.email !== EMAIL));

  await done();
})().catch(async (e) => { console.error('\n  threw:', e); await sweep(); process.exit(1); });

async function sweep() {
  if (!process.env.SUPABASE_URL) return;
  const { db } = require('../api/_lib/core.js');
  const supabase = db();
  if (!supabase) return;
  const { data, error } = await supabase.from('practitioner_applications').select('id, email');
  if (error || !data) return;
  const ids = data.filter((r) => /^selftest-.*@example\.com$/.test(r.email)).map((r) => r.id);
  if (ids.length) {
    await supabase.from('practitioner_applications').delete().in('id', ids);
    console.log(`\n  swept ${ids.length} leftover selftest row(s)`);
  }
}

async function done() {
  await sweep();
  console.log('\n  ' + '─'.repeat(62));
  console.log(`  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}
