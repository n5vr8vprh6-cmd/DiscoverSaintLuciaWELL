/* ============================================================================
   GET /hub/explore — Explore Saint Lucia
   ----------------------------------------------------------------------------
   The destination, read the way an advisor plans: start from the person, then
   the Village, then the property (the Field Guide's own rule, brief v2
   Appendix A). Its own destination rather than a corner of Marketing, because
   finding clients and knowing the island are different jobs.

   A LAUNCHPAD, NOT A SECOND COPY. Villages, places and experiences already
   live on /explore with their imagery and provenance; this screen frames them
   for a professional and links there, so the two can never describe the
   island differently. The one thing that belongs here and nowhere else — the
   Field Guide's lookup tool — is marked as coming, honestly, until it exists.

   Duty of care is stated on the page, once, in plain words: a Village mapping
   is an editorial judgment, and nothing here is a rate, an availability or a
   clinical recommendation.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { hubPage, esc } = require('../hub-render.js');
const { rung } = require('../gtm.js');
const UI = require('../hub-ui.js');

module.exports = async function handler(req, res) {
  const advisor = await requireAdvisor(req, res, '/hub/explore');
  if (!advisor) return;
  hubPage(res, { path: '/hub/explore', title: 'Explore Saint Lucia', advisor, body: buildBody({ advisor }) });
};

/* The four layers, as related but distinct (brief v2 §10). One line each;
   the full explanation is on /about and in the Field Guide. */
const LAYERS = [
  { k: 'The WELL Compass', role: 'Direction', t: 'How your client wants to feel: Restore, Reconnect, Move, Nourish, Explore and the rest. Where the conversation starts.' },
  { k: 'The Wellness Continuum', role: 'Depth', t: 'From Relax to Sustain: how deep an experience goes. Position it honestly, then sequence it well.' },
  { k: 'The Eight WELL Pillars', role: 'Ingredients', t: 'What a journey is made of, the vocabulary for building one with a partner.' },
  { k: 'The Six Wellness Villages', role: 'Destination worlds', t: 'Planning lenses that gather the island’s places and experiences around a need.' }
];

function buildBody({ advisor }) {
  const r = rung(advisor);
  const done = { foundations: r === 'foundations' || r === 'immersion', immersion: r === 'immersion' };
  const ladder = [
    { k: 'Complimentary Briefing', t: 'A free 60-minute live briefing on turning client wellness needs into Saint Lucia WELL Journey proposals.', href: '/advisors/intro' },
    { k: 'Well Destination Foundations', t: 'Discovery, matching, journey architecture, presentation and going to market.', href: '/advisors/foundations', done: done.foundations },
    { k: 'Saint Lucia WELL Immersion', t: 'Applied, on-island field learning for advisors who have completed Foundations.', href: '/advisors/immersion', done: done.immersion }
  ];

  return `<div class="hub-main hub-explore">
  <section class="hub-hero hub-hero--band hub-hero--page" aria-labelledby="hero-title">
    <div class="hub-hero-media">${UI.picture('hero', { priority: true, sizes: '100vw', decorative: true })}</div>
    <div class="wrap hub-hero-inner">
      <p class="hub-eyebrow">Explore Saint Lucia</p>
      <h1 id="hero-title">Start with the person, not the property.</h1>
      <p class="hub-hero-status">The island, read the way advisors plan: the need, then the Village, then the place.</p>
    </div>
  </section>
  <div class="wrap hub-stack">

    <section class="hub-block" aria-labelledby="villages-title">
      ${UI.sectionHead('The six Wellness Villages', {
        id: 'villages-title',
        lead: 'Planning lenses for a client conversation. Each opens on the public site, with its anchor places and signature experiences.'
      })}
      <div class="hub-villages-rail">
        ${UI.VILLAGES.map((v) => UI.villageCard(v)).join('')}
      </div>
    </section>

    <section class="hub-block" aria-labelledby="places-title">
      ${UI.sectionHead('Places and experiences', { id: 'places-title' })}
      <div class="hub-tiles hub-tiles--three">
        ${UI.tile({ href: '/explore#places', external: true, image: 'shallows', title: 'Places and properties',
          body: 'The anchor properties, with their wellness offer and how each one maps to a Village.' })}
        ${UI.tile({ href: '/explore#experiences', external: true, image: 'market', title: 'Signature experiences',
          body: 'Excursions grouped by intention: what to do on the island, and why it helps.' })}
        ${UI.tile({ href: '/explore#campus', external: true, image: 'sulphur', title: 'Sulphur Springs',
          body: 'The island’s volcanic wellness landscape near Soufrière.' })}
      </div>
    </section>

    <div class="hub-split hub-split--even">
      <section class="hub-card hub-fieldguide" id="field-guide" aria-labelledby="fg-title">
        <span class="hub-badge" data-badge="soon">Coming soon</span>
        <h2 class="hub-card-title" id="fg-title">The Field Guide, as a tool</h2>
        <p>The Travel Advisor Field Guide, searchable the way discovery calls actually go: by your client’s
          intention, by Village, or by a property they already have in mind. It will live here.</p>
        <p class="hub-card-note">Until then, the Field Guide reaches advisors after the complimentary briefing.</p>
      </section>
      <section class="hub-card" aria-labelledby="layers-title">
        <h2 class="hub-card-title" id="layers-title">The framework, in four layers</h2>
        <dl class="hub-layers">
          ${LAYERS.map((l) => `<div><dt>${esc(l.k)} <span>${esc(l.role)}</span></dt><dd>${esc(l.t)}</dd></div>`).join('')}
        </dl>
        <a class="hub-card-link" href="/about#approach" target="_blank" rel="noopener">Read the approach<span class="hub-arrow" aria-hidden="true">→</span></a>
      </section>
    </div>

    <section class="hub-block" aria-labelledby="learn-title">
      ${UI.sectionHead('Professional learning', { id: 'learn-title', lead: 'Each step builds on the one before it. None is required to use the Hub.' })}
      <ol class="hub-ladder">
        ${ladder.map((s) => `<li>
          <a href="${esc(s.href)}">
            <span class="hub-ladder-k">${esc(s.k)}${s.done ? ' <span class="hub-badge" data-badge="live">Completed</span>' : ''}</span>
            <span class="hub-ladder-t">${esc(s.t)}</span>
          </a>
        </li>`).join('')}
      </ol>
    </section>

    <p class="hub-duty">Village mappings are editorial judgments, not property classifications or certifications.
      Inclusions, schedules, rates and availability change: confirm them for your client’s dates. Specialist and
      clinical services need provider-specific due diligence, and nothing here is a diagnosis or a health claim.</p>

  </div>
</div>`;
}

module.exports.buildBody = buildBody;
