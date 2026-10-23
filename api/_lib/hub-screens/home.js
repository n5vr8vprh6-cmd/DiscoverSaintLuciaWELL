/* ============================================================================
   GET /hub — Home
   ----------------------------------------------------------------------------
   V2 §8: an action surface, not a vanity dashboard. The Hub UX lift (brief v2,
   23 Oct 2026) kept that and gave it an order an advisor can read in one pass:

     1  where you are          a hero that is big for a new advisor and a slim
                               band for a returning one
     2  who needs you          the people waiting, by name, one click from
                               their briefing — not a count in an empty panel
     3  how the link is doing  three honest numbers beside the link itself
     4  what you can do        the tools, with their real state on each
     5  people, then growth    inquiries beside a training card that never
                               interrupts
     6  the island             the six Villages as planning lenses

   The body is built by buildBody(model), a pure function, so
   tools/hub-preview.js renders THIS screen against fixtures rather than a copy
   of it that drifts.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { hubPage, esc, wellLinkFor, ago } = require('../hub-render.js');
const { journeysFor, funnelFor, needsAttention, waitingCount } = require('../hub-data.js');
const { maskJourneys } = require('../hub-mask.js');
const { rung } = require('../gtm.js');
const { isDemo, showsAsActive } = require('../demo.js');
const UI = require('../hub-ui.js');
/* The Finder's own count, so the advice an advisor reads here cannot
   describe a different Finder from the one their link points at. */
const { countWord } = require('../../../content/journey.js');

const DAY = 86400000;

module.exports = async function handler(req, res) {
  const advisor = await requireAdvisor(req, res, '/hub');
  if (!advisor) return;

  const url = new URL(req.url, 'http://x');
  const range = url.searchParams.get('range') === 'all' ? 'all' : '30d';
  const since = new Date(Date.now() - 30 * DAY).toISOString();

  /* All-time AND the window: "is this advisor new" is an all-time question,
     and the pulse row shows whichever window was asked for. Head counts only. */
  const [journeys, waiting, all, recent] = await Promise.all([
    journeysFor(advisor.id, { limit: 100 }),
    waitingCount(advisor.id),
    funnelFor(advisor.id),
    range === 'all' ? null : funnelFor(advisor.id, { since })
  ]);

  const body = buildBody({
    advisor,
    journeys,
    waiting,
    funnel: recent || all,
    funnelAll: all,
    range,
    link: wellLinkFor(advisor)
  });

  hubPage(res, { path: '/hub', title: 'Home', advisor, body });
};

/* ── The model → the page ─────────────────────────────────────────────── */
function buildBody({ advisor, journeys, waiting, funnel, funnelAll, range, link }) {
  /* Ranked on the real rows, then masked for display — the ordering must not
     change just because staff are the ones looking. */
  const ranked = needsAttention(journeys);
  const attention = maskJourneys(ranked.slice(0, 5), advisor.viewingAs);
  const waitingRows = maskJourneys(ranked.filter((j) => j.stage === 'new').slice(0, 3), advisor.viewingAs);
  /* The uncapped head count when it answered; the 100 rows only when it
     could not. They disagree once an advisor has more than 100 Journeys. */
  const nWaiting = waiting == null ? journeys.filter((j) => j.stage === 'new').length : waiting;

  const isNew = !journeys.length && !funnelAll.visits && !funnelAll.completions;
  const pending = !showsAsActive(advisor);

  return `<div class="hub-main hub-home">
  ${isNew ? heroNew(advisor, pending) : heroBack(advisor, nWaiting, funnel, range, pending)}
  <div class="wrap hub-stack">
    ${nextAction({ nWaiting, waitingRows, funnel: funnelAll, isNew })}

    <div class="hub-split hub-split--pulse">
      ${isNew ? pulseNew() : pulse(funnel, range)}
      ${UI.linkCard(link, { pending })}
    </div>

    <section class="hub-block" aria-labelledby="tools-title">
      ${UI.sectionHead('Your tools', { id: 'tools-title', lead: 'Everything you need to design, present and grow your Saint Lucia wellness work.' })}
      <div class="hub-tiles">
        ${tools()}
      </div>
    </section>

    <div class="hub-split hub-split--people">
      ${inquiries(attention, journeys.length, link)}
      ${training(advisor)}
    </div>

    <section class="hub-block" aria-labelledby="villages-title">
      ${UI.sectionHead('Destination inspiration', {
        id: 'villages-title',
        lead: 'The six Wellness Villages: planning lenses for a client conversation, not places or property certifications.',
        action: { label: 'Explore Saint Lucia', href: '/hub/explore' }
      })}
      <div class="hub-villages-rail">
        ${UI.VILLAGES.map((v) => UI.villageCard(v)).join('')}
      </div>
    </section>
  </div>
</div>`;
}

/* ── 1 · Hero ─────────────────────────────────────────────────────────────
   NEW: the full editorial welcome and two equal ways in. An advisor may arrive
   with a client already in mind, so "find new clients" must not be the only
   door (brief v2: acquisition is not the only entry point).
   RETURNING: a slim band. The work is below it, and the greeting should not
   push the people waiting off the first screen.

   The greeting is rendered neutral on the server and given its time of day by
   js/hub.js in the advisor's own clock. It used to be computed in UTC, which
   wished a Toronto advisor good evening at 2pm. */
function greetingAttrs(advisor) {
  return `data-greet="${esc(advisor.first_name || '')}"`;
}

function pendingNote(pending) {
  return pending ? `<p class="hub-hero-note">Your account is being confirmed. Explore the Hub and get your link
        ready; clients can share Journeys with you once it is active.</p>` : '';
}

function heroNew(advisor, pending) {
  return `<section class="hub-hero hub-hero--full" aria-labelledby="hero-title">
    <div class="hub-hero-media">${UI.picture('hero', { priority: true, sizes: '100vw' })}</div>
    <div class="wrap hub-hero-inner">
      <p class="hub-hero-hello" ${greetingAttrs(advisor)}>Welcome, ${esc(advisor.first_name || '')}.</p>
      <h1 id="hero-title">Design wellness journeys that move people.</h1>
      <p class="hub-hero-lead">Everything you need to understand, design and present Saint Lucia
        wellness journeys, and to find the people they are for.</p>
      ${pendingNote(pending)}
      <div class="hub-paths">
        <a class="hub-path" href="#well-link-card">
          <span class="hub-path-k">Find new clients</span>
          <span class="hub-path-t">Share your WELL link. People who take the Journey Finder through it
            arrive here with what they asked for.</span>
          <span class="hub-path-cta">Get my WELL link<span class="hub-arrow" aria-hidden="true">→</span></span>
        </a>
        <a class="hub-path" href="/hub/explore">
          <span class="hub-path-k">I have a client</span>
          <span class="hub-path-t">Start from the island: the six Wellness Villages, places and
            experiences, read the way advisors plan.</span>
          <span class="hub-path-cta">Explore Saint Lucia<span class="hub-arrow" aria-hidden="true">→</span></span>
        </a>
      </div>
    </div>
  </section>`;
}

function heroBack(advisor, nWaiting, funnel, range, pending) {
  const window = range === 'all' ? 'in total' : 'in the last 30 days';
  const status = nWaiting
    ? (nWaiting === 1 ? 'One person shared a Journey and is waiting for your reply.'
                      : `${nWaiting} people shared a Journey and are waiting for your reply.`)
    : funnel.visits
      ? `Your link brought ${funnel.visits} ${funnel.visits === 1 ? 'visit' : 'visits'} ${window}.`
      : 'Here is where things stand.';
  return `<section class="hub-hero hub-hero--band" aria-labelledby="hero-title">
    <div class="hub-hero-media">${UI.picture('hero', { priority: true, sizes: '100vw', decorative: true })}</div>
    <div class="wrap hub-hero-inner">
      <h1 id="hero-title" class="hub-hero-hello" ${greetingAttrs(advisor)}>Welcome back, ${esc(advisor.first_name || '')}.</h1>
      <p class="hub-hero-status">${esc(status)}</p>
      ${pendingNote(pending)}
    </div>
  </section>`;
}

/* ── 2 · Next action ──────────────────────────────────────────────────────
   When people are waiting, the card IS them: names, what they leaned
   towards, how long they have waited, and a button that opens the first
   one's briefing — not a list to find them in. ("Open the newest" used to
   open the ranked list, which is neither the newest nor one person.)
   Otherwise it is the one piece of advice that fits where the advisor is. */
function nextAction({ nWaiting, waitingRows, funnel, isNew }) {
  if (nWaiting && waitingRows.length) {
    const first = waitingRows[0];
    const firstName = (first.consumer_first || 'their').trim();
    const title = nWaiting === 1
      ? `${UI.personName(first)} is waiting to hear from you.`
      : `${nWaiting} people are waiting to hear from you.`;
    return `<section class="hub-next" aria-labelledby="next-title">
      <div class="hub-next-copy">
        <p class="hub-eyebrow">Next</p>
        <h2 id="next-title">${esc(title)}</h2>
        <p>They shared a Journey deliberately. A reply in the first day or two is what turns it into a conversation.</p>
        <div class="hub-next-actions">
          <a class="hub-btn hub-btn--gold" href="/hub/journeys/${esc(first.id)}">Open ${esc(firstName)}'s briefing</a>
          <a class="hub-btn hub-btn--onink" href="/hub/journeys/${esc(first.id)}/design">Design this journey</a>
        </div>
        ${nWaiting > waitingRows.length || nWaiting > 1
          ? `<a class="hub-next-all" href="/hub/journeys?view=attention">See all ${nWaiting} waiting<span class="hub-arrow" aria-hidden="true">→</span></a>` : ''}
      </div>
      <ul class="hub-next-people">
        ${waitingRows.map((j) => UI.inquiryRow(j)).join('')}
      </ul>
    </section>`;
  }

  let title, note, cta;
  if (isNew) {
    return '';   /* the hero's two paths are the next action */
  } else if (funnel.completions > 0 && funnel.shares === 0) {
    title = 'People are finishing the Finder but not sharing.';
    note = `They are interested enough to answer ${countWord} questions. Try putting the link somewhere it comes with your recommendation rather than on its own.`;
    cta = { label: 'Copy your WELL link', copy: '#well-link' };
  } else if (funnel.visits === 0) {
    title = 'Your link has not been used yet.';
    note = 'Start with ten people you already know. It works better than a broadcast, and it is quicker.';
    cta = { label: 'Copy your WELL link', copy: '#well-link' };
  } else {
    title = 'Nobody is waiting on you. Keep the link moving.';
    note = 'Traffic is arriving. The next Journey usually comes from the next place you put it.';
    cta = { label: 'Open your campaign', href: '/hub/campaign' };
  }
  /* A button that says copy must copy — the S-09 lesson. */
  return `<section class="hub-next hub-next--quiet" aria-labelledby="next-title">
    <div class="hub-next-copy">
      <p class="hub-eyebrow">Next</p>
      <h2 id="next-title">${esc(title)}</h2>
      <p>${esc(note)}</p>
    </div>
    <div class="hub-next-actions">
      ${cta.copy
        ? `<button class="hub-btn hub-btn--gold" type="button" data-copy="${esc(cta.copy)}">${esc(cta.label)}</button>`
        : `<a class="hub-btn hub-btn--gold" href="${esc(cta.href)}">${esc(cta.label)}</a>`}
    </div>
  </section>`;
}

/* ── 3 · Campaign pulse ───────────────────────────────────────────────────
   Three numbers that mean what they say. Each carries its definition in the
   page, because "why are completions higher than visits?" was a real question
   with a real answer (repeat runs were counted; see api/visit.js), and an
   advisor should not need to ask it. The window switch is a link, so it works
   without script and the URL says which view you are looking at. */
function pulse(funnel, range) {
  const seg = (key, label) => `<a href="${key === '30d' ? '/hub' : '/hub?range=all'}#pulse-title"${range === key ? ' aria-current="true"' : ''}>${esc(label)}</a>`;
  return `<section class="hub-card hub-pulse" aria-labelledby="pulse-title">
    <div class="hub-card-headrow">
      <h2 class="hub-card-title" id="pulse-title">Your campaign</h2>
      <nav class="hub-seg" aria-label="Period">${seg('30d', 'Last 30 days')}${seg('all', 'All time')}</nav>
    </div>
    <div class="hub-kpis">
      ${UI.stat('Link visits', funnel.visits, 'people who arrived through your link, once per visit')}
      ${UI.stat('Finder completions', funnel.completions, 'of those, finished the Journey Finder')}
      ${UI.stat('Shared with you', funnel.shares, 'chose to send you their Journey')}
    </div>
    <p class="hub-card-note">${funnel.lastVisitAt
      ? `Last visit ${esc(ago(funnel.lastVisitAt))}. ` : ''}Your own visits and previews are not counted, and
      a Finder run counts once per visit. Totals from before October 2026 may include repeats.</p>
    <a class="hub-card-link" href="/hub/campaign">Your 30-day campaign<span class="hub-arrow" aria-hidden="true">→</span></a>
  </section>`;
}

function pulseNew() {
  return `<section class="hub-card hub-pulse" aria-labelledby="pulse-title">
    <div class="hub-card-headrow"><h2 class="hub-card-title" id="pulse-title">How your campaign fills</h2></div>
    <ol class="hub-steps">
      <li class="hub-step"><b>Someone opens your link</b><span>A link visit, counted once per visit.</span></li>
      <li class="hub-step"><b>They take the Journey Finder</b><span>${esc(countWord.charAt(0).toUpperCase() + countWord.slice(1))} questions about what they need from a trip.</span></li>
      <li class="hub-step"><b>They share it with you</b><span>They arrive in Inquiries with their answers, ready for a conversation.</span></li>
    </ol>
    <a class="hub-card-link" href="/hub/campaign">Plan your first 30 days<span class="hub-arrow" aria-hidden="true">→</span></a>
  </section>`;
}

/* ── 4 · Tools ────────────────────────────────────────────────────────────
   Every tile opens something real. The Designer is live — ASK WELL designs a
   journey from a client's shared Finder result today — and is presented as
   such; Group Studio is an application, not a launch; the Field Guide tool is
   coming, and its tile opens the place it will live and says so. */
function tools() {
  return [
    UI.tile({ href: '/hub/designer', image: 'pitons', title: 'Journey Designer',
      body: 'Turn a client’s shared Journey into a designed week, then issue the itinerary.' }),
    UI.tile({ href: '/hub/explore', image: 'sulphur', title: 'Explore Saint Lucia',
      body: 'Villages, places and experiences, read the way advisors plan.' }),
    UI.tile({ href: '/hub/marketing', image: 'market', title: 'Marketing',
      body: 'Your WELL link, a 30-day campaign, the Playbook and prize draws.' }),
    UI.tile({ href: '/advisors/groups?path=hub', image: 'dawn', title: 'WELL Group Studio',
      badge: { label: 'By application', kind: 'apply' },
      body: 'Bring a group or retreat concept. Every application is read, and replied to privately.' }),
    UI.tile({ href: '/hub/explore#field-guide', image: 'shallows', title: 'Field Guide',
      badge: { label: 'Coming soon', kind: 'soon' },
      body: 'The advisor reference, searchable by intention, Village or property.' })
  ].join('');
}

/* ── 5 · Inquiries + training ─────────────────────────────────────────── */
function inquiries(attention, total, link) {
  const head = UI.sectionHead('Inquiries', {
    id: 'inquiries-title',
    lead: 'People who shared their Journey with you, ranked by who needs you first.',
    action: total ? { label: `All clients (${total}${total >= 100 ? '+' : ''})`, href: '/hub/journeys' } : null
  });
  let inner;
  if (attention.length) {
    inner = `<ul class="hub-rows">${attention.map((j) => UI.inquiryRow(j)).join('')}</ul>`;
  } else if (total) {
    inner = empty('Nothing waiting on you.', 'Every Journey has been picked up. New ones appear here first.',
      `<a class="hub-btn hub-btn--quiet" href="/hub/journeys">See all clients</a>`);
  } else {
    inner = empty('No inquiries yet.',
      'When someone completes the Finder through your link and chooses to share it, they arrive here with what they asked for, not just their contact details.',
      link ? `<button class="hub-btn hub-btn--primary" type="button" data-copy="#well-link">Copy your WELL link</button>` : '');
  }
  return `<section class="hub-card hub-inquiries" aria-labelledby="inquiries-title">${head}${inner}</section>`;
}

function empty(title, body, action) {
  return `<div class="hub-empty">
    <h3>${esc(title)}</h3>
    <p>${esc(body)}</p>
    ${action || ''}
  </div>`;
}

/* Professional training, offered beside the work and never over it: no
   modal, nothing on sign-in (brief v2 §8). What it offers follows what the
   Hub actually knows — rung() reads the dates an admin records — and an
   advisor with no recorded training is NOT told they have not trained: the
   data cannot know about a briefing they attended. Dismissal is per browser
   (js/hub.js, localStorage), which is enough until a preference is stored. */
function training(advisor) {
  const r = rung(advisor);
  let offer;
  if (r === 'immersion') return '';
  if (r === 'foundations' || advisor.foundations_paid_at) {
    offer = {
      key: 'immersion', title: 'Take it to the island.',
      body: 'The Saint Lucia WELL Immersion is applied, on-island field learning for advisors who have completed Foundations.',
      cta: { label: 'About the Immersion', href: '/advisors/immersion' }
    };
  } else {
    offer = {
      key: 'briefing', title: 'Design WELL journeys with more confidence.',
      body: 'A free 60-minute live briefing on turning client wellness needs into Saint Lucia WELL Journey proposals, and the Foundations program after it.',
      cta: { label: 'Explore professional training', href: '/advisors/intro' },
      more: { label: 'Well Destination Foundations', href: '/advisors/foundations' }
    };
  }
  return `<aside class="hub-train" data-dismissable="train-${esc(offer.key)}" aria-labelledby="train-title">
    <div class="hub-train-media">${UI.picture('golden', { sizes: '(min-width: 1100px) 420px, 92vw', decorative: true })}</div>
    <div class="hub-train-body">
      <button class="hub-train-close" type="button" data-dismiss aria-label="Hide this suggestion">×</button>
      <p class="hub-eyebrow">Professional training</p>
      <h2 id="train-title">${esc(offer.title)}</h2>
      <p>${esc(offer.body)}</p>
      <a class="hub-btn hub-btn--gold" href="${esc(offer.cta.href)}">${esc(offer.cta.label)}</a>
      ${offer.more ? `<a class="hub-train-more" href="${esc(offer.more.href)}">${esc(offer.more.label)}<span class="hub-arrow" aria-hidden="true">→</span></a>` : ''}
    </div>
  </aside>`;
}

module.exports.buildBody = buildBody;
