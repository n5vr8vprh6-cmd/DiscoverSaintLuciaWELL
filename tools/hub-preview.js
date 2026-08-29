/* ============================================================================
   hub-preview.js — render the Hub screens to static files, with fixture data
   ----------------------------------------------------------------------------
   The Hub is server-rendered from serverless functions, so the only way to look
   at it is normally to deploy it. That is a poor way to iterate on layout, and
   a worse way to check it at 380px.

   This renders each screen against a fixture advisor and fixture Journeys, with
   no database and no session, straight into dist/ so the ordinary preview
   server can serve them. The page bodies come from the real handlers' own
   builders where possible; where a handler is a single function that also does
   auth and I/O, the body is rebuilt here from the same helpers.

   THE FIXTURES ARE OBVIOUSLY FAKE ON PURPOSE — invented names, example.com
   addresses. Nothing here should ever be mistaken for a real consumer, and
   nothing real should ever be pasted in.

     node tools/hub-preview.js      → dist/_hub-preview/*.html

   These files are written under dist/, which is a build artefact, so they never
   reach the repository and never deploy.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const { render } = require('../lib/page.js');
const {
  esc, pageHead, emptyState, STAGES, STAGE_LABEL, WINDOW_LABEL, since
} = require('../api/_lib/hub-render.js');
const { authForm, field } = require('../api/_lib/hub-forms.js');
const { brief, fullName, answerLabel } = require('../api/_lib/hub-brief.js');
const { needsAttention } = require('../api/_lib/hub-data.js');

const OUT = path.join(__dirname, '..', 'dist', '_hub-preview');

const ADVISOR = {
  id: 'fixture', first_name: 'Wren', last_name: 'Adeyemi',
  email: 'wren@example.com', authEmail: 'wren@example.com',
  business: 'Adeyemi Travel Studio', host_agency: '', phone: '+1 416 555 0142',
  website: 'https://example.com', market: 'Toronto and southern Ontario',
  public_code: '8K4PX7', slug: null, status: 'active'
};

const day = (n) => new Date(Date.now() - n * 86400000).toISOString();

const JOURNEYS = [
  {
    id: 'j1', consumer_first: 'Marguerite', consumer_last: 'Okonkwo',
    consumer_email: 'm.okonkwo@example.com', consumer_phone: '+1 647 555 0198',
    timing: 'Within the next month', travel_window: '30d', stage: 'new',
    context: 'I have not taken more than four consecutive days off in three years and '
      + 'I would like to come back able to think again. Travelling with my sister.',
    answers: { intention: 'reflect', companions: 'family', pace: 'gentle', recognition: 'yes' },
    villages: ['Rainforest', 'Ocean', 'Longevity'],
    created_at: day(0), last_activity_at: null, source: 'email'
  },
  {
    id: 'j2', consumer_first: 'Tobias', consumer_last: 'Lindqvist',
    consumer_email: 't.lindqvist@example.com', consumer_phone: '',
    timing: '3–6 months', travel_window: '3-6mo', stage: 'contacted',
    context: '', answers: { intention: 'move', companions: 'partner', pace: 'active', recognition: 'no' },
    villages: ['Movement', 'Ocean'], created_at: day(5), last_activity_at: day(3), source: 'social'
  },
  {
    id: 'j3', consumer_first: 'Priya', consumer_last: 'Raman',
    consumer_email: 'p.raman@example.com', consumer_phone: '+44 20 7946 0321',
    timing: '1–3 months', travel_window: '31-90d', stage: 'new',
    context: '', answers: { intention: 'restore', companions: 'solo', pace: 'still', recognition: 'no' },
    villages: ['Longevity', 'Ocean'], created_at: day(9), last_activity_at: null, source: 'referral'
  },
  {
    id: 'j4', consumer_first: 'Delphine', consumer_last: 'Aubert',
    consumer_email: 'd.aubert@example.com', consumer_phone: '',
    timing: 'More than a year away', travel_window: '12mo+', stage: 'booked',
    context: '', answers: { intention: 'nourish', companions: 'friends', pace: 'gentle', recognition: 'no' },
    villages: ['Heritage', 'Connection'], created_at: day(60), last_activity_at: day(12), source: 'event'
  }
];

const NOTES = [
  { id: 'n1', body: 'Called Thursday. Sister is the one with the mobility question —\nwants to know about the rainforest walks specifically.', created_at: day(2) },
  { id: 'n2', body: 'Left a voicemail.', created_at: day(4) }
];

const FUNNEL = { visits: 214, completions: 38, shares: 4 };

/* ── Bodies ──────────────────────────────────────────────────────────────── */
const row = (j) => {
  const name = `${j.consumer_first} ${j.consumer_last}`.trim();
  const villages = (j.villages || []).slice(0, 3).join(' · ');
  return `<li class="hub-journey">
    <a href="./journey.html">
      <span class="hub-journey-name">${esc(name)}</span>
      <span class="hub-journey-meta">
        <span class="hub-stage" data-stage="${esc(j.stage)}">${esc(STAGE_LABEL[j.stage])}</span>
        ${j.travel_window ? `<span>${esc(WINDOW_LABEL[j.travel_window])}</span>` : ''}
        <span>Shared ${esc(since(j.created_at))}</span>
      </span>
      ${villages ? `<span class="hub-journey-villages">${esc(villages)}</span>` : ''}
    </a>
  </li>`;
};

const stat = (label, n, note) => `<div class="hub-stat">
    <span class="hub-stat-n">${n}</span>
    <span class="hub-stat-label">${esc(label)}</span>
    <span class="hub-stat-note">${esc(note)}</span>
  </div>`;

function home() {
  const attention = needsAttention(JOURNEYS).slice(0, 5);
  const link = 'https://discoversaintluciawell.com/well/' + ADVISOR.public_code;
  return `<div class="hub-main"><div class="wrap">
    <div class="hub-greeting">
      <p class="eyebrow">Travel Advisor Hub</p>
      <h1>Good morning, ${esc(ADVISOR.first_name)}.</h1>
    </div>
    <section class="hub-nba">
      <p class="eyebrow eyebrow--gold">Next</p>
      <h2>2 people are waiting to hear from you.</h2>
      <p>They shared a Journey deliberately. A reply in the first day or two is what turns it into a conversation.</p>
      <a class="btn btn--gold" href="./journeys.html">Open the newest</a>
    </section>
    <section class="hub-section">
      <h2>Your campaign</h2>
      <div class="hub-funnel">
        ${stat('Visits', FUNNEL.visits, 'people arrived through your link')}
        ${stat('Finder completions', FUNNEL.completions, 'finished the Journey Finder')}
        ${stat('Journeys shared', FUNNEL.shares, 'chose to share with you')}
      </div>
      <div class="hub-link">
        <label class="hub-field-label" for="well-link">Your WELL link</label>
        <div class="hub-link-row">
          <input id="well-link" value="${esc(link)}" readonly>
          <button class="btn btn--ghost btn--sm" type="button" data-copy="#well-link">Copy</button>
          <button class="btn btn--ghost btn--sm" type="button" data-qr="${esc(link)}">QR code</button>
        </div>
        <p class="hub-hint">This link identifies you without putting your name in the address.</p>
      </div>
    </section>
    <section class="hub-section">
      <h2>Needs attention</h2>
      <ul class="hub-journeys">${attention.map(row).join('')}</ul>
      <p class="hub-more"><a href="./journeys.html">All Journeys (${JOURNEYS.length})</a></p>
    </section>
  </div></div>`;
}

function journeys() {
  const views = [['attention', 'Needs attention'], ['soonest', 'Travelling soonest'],
                 ['newest', 'Newest'], ['stage', 'By stage']];
  return `<div class="hub-main"><div class="wrap">
    ${pageHead('Journeys', `${JOURNEYS.length} Journeys`,
      'People who completed the Finder through your link and chose to share the result.')}
    <nav class="hub-views" aria-label="View">
      ${views.map(([id, label], i) =>
        `<a href="#${id}"${i === 0 ? ' aria-current="true" class="is-current"' : ''}>${esc(label)}</a>`).join('')}
    </nav>
    <ul class="hub-journeys">${needsAttention(JOURNEYS).map(row).join('')}</ul>
    <p class="hub-more">One Journey is booked or closed and is not shown here.
      <a href="./journeys.html">Show everything</a></p>
  </div></div>`;
}

function journeyDetail() {
  const j = JOURNEYS[0];
  const b = brief(j);
  const answer = (label, q, value) =>
    value ? `<dt>${esc(label)}</dt><dd>${esc(q ? answerLabel(q, value) : value)}</dd>` : '';
  return `<div class="hub-main hub-main--detail"><div class="wrap">
    <p class="hub-back"><a href="./journeys.html">← All Journeys</a></p>
    <header class="hub-detail-head">
      <p class="eyebrow">Shared ${esc(since(j.created_at))} · ${esc(WINDOW_LABEL[j.travel_window])}</p>
      <h1>${esc(fullName(j))}</h1>
      <div class="hub-actions">
        <a class="btn btn--gold" href="mailto:${esc(j.consumer_email)}">Email ${esc(j.consumer_first)}</a>
        <a class="btn btn--ghost" href="tel:${esc(j.consumer_phone)}">Call</a>
      </div>
      <p class="hub-contact"><span>${esc(j.consumer_email)}</span><span>${esc(j.consumer_phone)}</span></p>
    </header>
    <div class="hub-detail-grid">
      <div class="hub-detail-main">
        <section class="hub-card hub-card--brief">
          <h2>The briefing</h2>
          ${b.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
          <figure class="hub-quote">
            <blockquote>${esc(b.quote)}</blockquote>
            <figcaption>${esc(j.consumer_first)}, in their own words</figcaption>
          </figure>
          <div class="hub-eclipse">
            <p class="eyebrow">Eclipse appeared in their results</p>
            <p>${esc(b.eclipse)}</p>
          </div>
        </section>
        <section class="hub-card">
          <h2>Worth asking</h2>
          <ul class="hub-prompts">${b.prompts.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
          <p class="hub-hint">Questions, not a script. Their answers are a starting point for a
            conversation, not a brief to be fulfilled.</p>
        </section>
        <section class="hub-card">
          <h2>Notes</h2>
          <form class="hub-note-form" method="POST" action="#">
            <label class="hub-field hub-field--wide" for="note">
              <span class="hub-field-label">Add a note</span>
              <textarea id="note" name="note" rows="3"
                placeholder="What you agreed, what to follow up, what they said."></textarea>
            </label>
            <button class="btn btn--ghost btn--sm" type="submit">Save note</button>
          </form>
          <ul class="hub-notes">${NOTES.map((n) => `<li>
            <p>${esc(n.body)}</p><span class="hub-note-when">${esc(since(n.created_at))}</span></li>`).join('')}</ul>
        </section>
      </div>
      <aside class="hub-detail-side">
        <section class="hub-card">
          <h2>Stage</h2>
          <form method="POST" action="#">
            <div class="hub-stages">
              ${STAGES.map((s) => `<label class="hub-stage-opt">
                <input type="radio" name="stage" value="${s}"${s === j.stage ? ' checked' : ''}>
                <span>${esc(STAGE_LABEL[s])}</span></label>`).join('')}
            </div>
            <button class="btn btn--ghost btn--sm" type="submit">Update</button>
          </form>
        </section>
        <section class="hub-card">
          <h2>Villages matched</h2>
          <ul class="hub-villages">${j.villages.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>
        </section>
        <section class="hub-card">
          <h2>Their answers</h2>
          <dl class="hub-answers">
            ${answer('Needed most', 'intention', j.answers.intention)}
            ${answer('Travelling', 'companions', j.answers.companions)}
            ${answer('Pace', 'pace', j.answers.pace)}
            ${answer('Recognised the description', 'recognition', j.answers.recognition)}
            ${answer('Timing, as they gave it', null, j.timing)}
            ${answer('Arrived from', null, j.source)}
          </dl>
        </section>
      </aside>
    </div>
  </div></div>`;
}

function account() {
  const link = 'https://discoversaintluciawell.com/well/' + ADVISOR.public_code;
  return `<div class="hub-main"><div class="wrap wrap--narrow">
    ${pageHead('Account', 'Your details',
      'These appear where a consumer is asked whether to share their Journey with you.')}
    <form class="hub-form hub-card" method="POST" action="#">
      <div class="hub-form-grid">
        ${field({ name: 'first_name', label: 'First name', value: ADVISOR.first_name })}
        ${field({ name: 'last_name', label: 'Last name', value: ADVISOR.last_name })}
        ${field({ name: 'business', label: 'Business or agency name', required: false, value: ADVISOR.business, wide: true, optional: true })}
        ${field({ name: 'host_agency', label: 'Host agency', required: false, optional: true })}
        ${field({ name: 'phone', label: 'Phone', type: 'tel', required: false, value: ADVISOR.phone, optional: true })}
        ${field({ name: 'website', label: 'Website', type: 'url', required: false, value: ADVISOR.website, optional: true, wide: true, hint: 'Include https://' })}
        ${field({ name: 'market', label: 'Where your clients are', required: false, value: ADVISOR.market, optional: true, wide: true, hint: 'A city, a region, or the kind of traveller you work with.' })}
      </div>
      <button class="btn btn--gold" type="submit">Save</button>
    </form>
    <section class="hub-card">
      <h2>Your WELL link</h2>
      <div class="hub-link-row">
        <input id="well-link" value="${esc(link)}" readonly>
        <button class="btn btn--ghost btn--sm" type="button" data-copy="#well-link">Copy</button>
        <button class="btn btn--ghost btn--sm" type="button" data-qr="${esc(link)}">QR code</button>
      </div>
      <p class="hub-hint">Fixed for the life of your account. Anything already printed keeps working.</p>
    </section>
  </div></div>`;
}

function empty() {
  return `<div class="hub-main"><div class="wrap">
    ${pageHead('Journeys', 'No Journeys yet', 'People who completed the Finder through your link and chose to share the result.')}
    ${emptyState('No Journeys yet.',
      'When someone completes the Finder through your link and chooses to share it, they arrive here — with what they asked for, not just their contact details.',
      { label: 'Get your WELL link', href: './index.html' })}
  </div></div>`;
}

function login() {
  return authForm({
    title: 'Sign in.',
    lead: 'Your Journeys, your campaign link and your account.',
    action: '#', submit: 'Sign in',
    fields: [
      { name: 'email', label: 'Email', type: 'email', autocomplete: 'email', wide: true },
      { name: 'password', label: 'Password', type: 'password', autocomplete: 'current-password', wide: true }
    ],
    alt: '<a href="#">Forgotten your password?</a> &nbsp;·&nbsp; No account yet? <a href="#">Create one</a>.'
  });
}

/* ── ASK WELL ─────────────────────────────────────────────────────────────
   Rendered from the SCREEN'S OWN builder, not from a copy of it here. The
   shortlist is computed for real against the knowledge bank, from the fixture
   Journey's own Finder answers — so what this shows is what an advisor sees,
   including the mismatch sentences, rather than a mock-up that agrees with the
   design until somebody changes one of them. */
async function designWorkspace() {
  const K = require('../api/_lib/well-knowledge.js');
  const N = require('../api/_lib/need-state.js');
  const M = require('../api/_lib/design-match.js');
  const { buildBody } = require('../api/_lib/hub-screens/design.js');

  const j = JOURNEYS[0];
  const need = await N.seedFrom(j.answers || {});
  const bank = await K.version();
  const shortlist = bank.ready ? await M.shortlistFor(need) : [];
  const vocab = await N.vocabulary();
  const topVillage = Object.keys(need.villages || {})
    .sort((a, b) => need.villages[b] - need.villages[a])[0] || null;
  const also = topVillage ? await K.alsoInVillage(topVillage) : { supporting: [], basecamps: [] };

  return buildBody({
    id: j.id, name: fullName(j), need, seeded: need, stored: null,
    vocab, shortlist, also, topVillage, frameworks: await K.frameworks(),
    caps: { database: true, consultation: true, itinerary: true, ledger: true },
    bank
  });
}

/* ── Write ───────────────────────────────────────────────────────────────
   The path is passed through as the real route, not as the preview filename,
   so the nav's current-page state is the one the deployed Hub will show. */
const PAGES = [
  ['index.html',    'Home',       '/hub',          ADVISOR, home()],
  ['journeys.html', 'Journeys',   '/hub/journeys', ADVISOR, journeys()],
  ['journey.html',  'Marguerite Okonkwo', '/hub/journeys', ADVISOR, journeyDetail()],
  ['account.html',  'Account',    '/hub/account',  ADVISOR, account()],
  ['empty.html',    'Journeys',   '/hub/journeys', ADVISOR, empty()],
  ['login.html',    'Sign in',    '/hub/login',    null,    login()]
];

fs.mkdirSync(OUT, { recursive: true });

/* The design workspace is async — it scores against the knowledge bank — so
   the write runs inside an IIFE rather than at module top level. */
(async () => {
PAGES.push(['design.html', 'Design · Marguerite Okonkwo', '/hub/journeys', ADVISOR, await designWorkspace()]);
PAGES.forEach(([file, title, routePath, advisor, body]) => {
  const html = render({
    key: 'hub', path: routePath, layout: 'hub', surface: 'advisor',
    title: title + ' — Saint Lucia WELL', description: 'Private advisor workspace.',
    noindex: true, scripts: false, styles: ['/css/hub.css'], advisor,
    js: file === 'design.html' ? ['/js/hub.js', '/js/hub-design.js'] : ['/js/hub.js']
  }, body);
  fs.writeFileSync(path.join(OUT, file), html);
  console.log('  ' + path.relative(process.cwd(), path.join(OUT, file)));
});
console.log('\nFixture data only. Serve dist/ and open /_hub-preview/.');
})();
