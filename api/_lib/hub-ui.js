/* ============================================================================
   HUB UI — the small pieces every Hub screen is built from
   ----------------------------------------------------------------------------
   Added with the Hub UX lift (brief v2, 23 Oct 2026). Home, Clients, the
   Designer runway, Explore and Marketing all show the same things — a person
   who shared a Journey, a Village, a tool, the WELL link — and each used to
   spell them out in its own markup. One builder each means a person looks the
   same on every screen, and a fix to how a Village chip reads lands everywhere.

   Pure functions of their arguments: no I/O, no session. That is what lets
   tools/hub-preview.js render them against fixtures and get exactly what an
   advisor sees.

   PEOPLE ARE NEVER ILLUSTRATED. A person is shown as their initials on the
   accent of the Village their answers leaned towards — information, not
   decoration. A stock landscape beside a real client's name (the mockup's
   choice) says nothing true about them.
   ========================================================================== */
'use strict';

const { esc, STAGE_LABEL, WINDOW_LABEL, since } = require('./hub-render.js');
const { VILLAGES } = require('../../content/villages.js');
const MEDIA = require('../../content/properties-media.js');
const { mediaPicture } = require('../../lib/components.js');

/* ── Villages ─────────────────────────────────────────────────────────────
   journey_shares.villages holds whatever the Finder sent at the time: full
   names today ("Nature & Renewal Village"), and short or older names on
   earlier rows ("Rainforest"). Resolve all of them to the one Village. */
function villageOf(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return null;
  return VILLAGES.find((x) => x.key === s || x.name.toLowerCase() === s || x.short.toLowerCase() === s)
    || VILLAGES.find((x) => s.startsWith(x.key) || x.name.toLowerCase().startsWith(s))
    || null;
}

const villagesOf = (j) => (j && j.villages || []).map(villageOf).filter(Boolean);

function villageChips(j, max = 2) {
  const vs = villagesOf(j).slice(0, max);
  if (!vs.length) return '';
  return `<span class="hub-chips">${vs.map((v) =>
    `<span class="hub-chip" data-v="${esc(v.key)}">${esc(v.short)}</span>`).join('')}</span>`;
}

/* ── People ───────────────────────────────────────────────────────────── */
function personName(j) {
  return `${j.consumer_first || ''} ${j.consumer_last || ''}`.trim() || 'Someone';
}

function avatar(j, size = '') {
  const first = String(j.consumer_first || '').trim();
  const last = String(j.consumer_last || '').trim();
  const initials = ((first[0] || '?') + (last[0] || '')).toUpperCase();
  const v = villagesOf(j)[0];
  return `<span class="hub-avatar${size ? ' hub-avatar--' + size : ''}"${v ? ` data-v="${esc(v.key)}"` : ''} aria-hidden="true">${esc(initials)}</span>`;
}

function stagePill(stage) {
  return `<span class="hub-stage" data-stage="${esc(stage)}">${esc(STAGE_LABEL[stage] || stage)}</span>`;
}

/* How long someone has been waiting, in words — only for `new`, the one stage
   that means nobody has answered. "Contacted 3 days ago" would be a claim
   about the advisor's diary that the data does not hold. */
function waitingFor(j) {
  if (j.stage !== 'new') return '';
  const days = Math.floor((Date.now() - new Date(j.created_at).getTime()) / 86400000);
  if (days <= 0) return 'Shared today';
  return days === 1 ? 'Waiting 1 day' : `Waiting ${days} days`;
}

/* One clickable row per person. `href` defaults to their briefing; `action`
   adds a secondary control at the end of the row (the Designer's "Design"). */
function inquiryRow(j, { href, action } = {}) {
  const to = href || `/hub/journeys/${encodeURIComponent(j.id)}`;
  const when = waitingFor(j) || `Shared ${since(j.created_at)}`;
  return `<li class="hub-row${action ? ' hub-row--action' : ''}">
    <a class="hub-row-main" href="${esc(to)}">
      ${avatar(j)}
      <span class="hub-row-who">
        <span class="hub-row-name">${esc(personName(j))}</span>
        ${villageChips(j)}
      </span>
      <span class="hub-row-meta">
        ${j.travel_window ? `<span class="hub-row-window">${esc(WINDOW_LABEL[j.travel_window] || j.travel_window)}</span>` : ''}
        ${/* Marked because it changes how you open the conversation: somebody
              who came in through a giveaway is warmer about the prize than
              about the trip. */''}
        ${j.sweepstakes_id ? '<span class="hub-tag" data-tag="draw">Prize draw</span>' : ''}
        ${stagePill(j.stage)}
        <span class="hub-row-when${j.stage === 'new' ? ' is-waiting' : ''}">${esc(when)}</span>
      </span>
    </a>
    ${action || ''}
  </li>`;
}

/* ── Imagery ──────────────────────────────────────────────────────────────
   Atmosphere frames the site already owns and ships (assets/), never a named
   property: a tool tile is not a hotel, and the property imagery is still
   recorded as not cleared (content/properties-media.js). Each entry is a
   single-width JPEG with a WebP twin, except the hero, which has three widths. */
const IMAGES = {
  hero:     { base: '/assets/hero-saint-lucia', widths: [768, 1152, 1456],
              alt: 'The Pitons seen through a rainforest window, a path leading down to the bay.' },
  wide:     { file: '/assets/sea-cliff-wide', alt: 'Surf breaking on dark rock below Petit Piton.' },
  pitons:   { file: '/assets/hero-pitons', alt: 'The Pitons framed by leaves above still water.' },
  golden:   { file: '/assets/pitons-golden-wave', alt: 'The Pitons at golden hour above a breaking wave.' },
  market:   { file: '/assets/cocoa-market', alt: 'Cocoa pods, spices and woven cloth at a Saint Lucia market.' },
  dawn:     { file: '/assets/dawn-horizon', alt: 'The Pitons on the horizon at dawn across calm water.' },
  shallows: { file: '/assets/sea-shallows', alt: 'Clear turquoise shallows over sand.' },
  sulphur:  { file: '/assets/sulphur-springs', alt: 'Steam rising from the sulphur springs near Soufrière.' }
};

function picture(key, { sizes = '100vw', priority = false, decorative = false } = {}) {
  const img = IMAGES[key];
  if (!img) return '';
  const alt = decorative ? '' : img.alt;
  const load = priority ? ' fetchpriority="high"' : ' loading="lazy"';
  if (img.widths) {
    return mediaPicture({ base: img.base, widths: img.widths, alt }, { sizes, priority });
  }
  return `<picture>
        <source type="image/webp" srcset="${esc(img.file)}.webp">
        <img src="${esc(img.file)}.jpg" alt="${esc(alt)}"${load} decoding="async">
      </picture>`;
}

/* ── Tool tiles ───────────────────────────────────────────────────────────
   `badge` is the truth about the tool's state, in the tile itself: a tile
   that opens a working tool carries none. */
function tile({ href, image, title, body, badge, external, cls = '' }) {
  return `<a class="hub-tile${cls ? ' ' + cls : ''}" href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>
    <span class="hub-tile-media">${picture(image, { sizes: '(min-width: 1100px) 260px, (min-width: 640px) 45vw, 92vw', decorative: true })}</span>
    <span class="hub-tile-body">
      ${badge ? `<span class="hub-badge" data-badge="${esc(badge.kind || 'soon')}">${esc(badge.label)}</span>` : ''}
      <span class="hub-tile-title">${esc(title)}<span class="hub-arrow" aria-hidden="true">→</span></span>
      <span class="hub-tile-text">${esc(body)}</span>
    </span>
  </a>`;
}

/* The six Villages as planning lenses. Each opens the Village on /explore —
   the destination material — and claims nothing about a match: there is no
   recommendation engine behind this rail, and it must not imply one. */
function villageCard(v, { href } = {}) {
  const img = MEDIA.villages[v.key];
  return `<a class="hub-village" data-v="${esc(v.key)}" href="${esc(href || `/explore#village-${v.key}`)}" target="_blank" rel="noopener">
    <span class="hub-village-media">${img ? mediaPicture(img, { sizes: '(min-width: 1100px) 220px, 60vw' }) : ''}</span>
    <span class="hub-village-body">
      <span class="hub-village-name">${esc(v.short)}</span>
      <span class="hub-village-line">${esc(v.subline)}</span>
    </span>
  </a>`;
}

/* ── Section head ─────────────────────────────────────────────────────── */
function sectionHead(title, { lead, action, id } = {}) {
  return `<div class="hub-sec-head">
    <div>
      <h2 class="hub-sec-title"${id ? ` id="${esc(id)}"` : ''}>${esc(title)}</h2>
      ${lead ? `<p class="hub-sec-lead">${esc(lead)}</p>` : ''}
    </div>
    ${action ? `<a class="hub-sec-action" href="${esc(action.href)}">${esc(action.label)}<span class="hub-arrow" aria-hidden="true">→</span></a>` : ''}
  </div>`;
}

/* ── The WELL link card ───────────────────────────────────────────────────
   Home and Marketing both carry it, so it is built once. The QR is drawn by
   js/hub.js (its own encoder, see README) into [data-qr-inline]; the download
   buttons export that same drawing, so the file and the screen cannot differ.

   PREVIEW opens the link with ?preview=1, which api/well.js passes through and
   js/attribution.js reads as "do not count this" — an advisor checking their
   own link no longer adds a visit and a completion to their own numbers. */
function linkCard(link, { pending = false, inputId = 'well-link' } = {}) {
  if (!link) return '';
  const preview = link + (link.includes('?') ? '&' : '?') + 'preview=1';
  return `<section class="hub-card hub-linkcard" id="${esc(inputId)}-card" aria-labelledby="${esc(inputId)}-title">
    <div class="hub-linkcard-main">
      <h2 class="hub-card-title" id="${esc(inputId)}-title">Your WELL link</h2>
      <p class="hub-card-sub">Share it anywhere you talk to clients: email signature, social bio, a printed card.</p>
      <div class="hub-copyfield">
        <input id="${esc(inputId)}" value="${esc(link)}" readonly aria-label="Your WELL link">
        <button class="hub-btn hub-btn--primary" type="button" data-copy="#${esc(inputId)}">Copy link</button>
      </div>
      <div class="hub-linkcard-actions">
        <button class="hub-btn hub-btn--quiet" type="button" data-qr-download="svg" data-qr-for="${esc(inputId)}-qr">Download QR (SVG)</button>
        <button class="hub-btn hub-btn--quiet" type="button" data-qr-download="png" data-qr-for="${esc(inputId)}-qr">PNG</button>
        <a class="hub-btn hub-btn--quiet" href="${esc(preview)}" target="_blank" rel="noopener">Preview<span class="hub-arrow" aria-hidden="true">↗</span></a>
      </div>
      ${pending
        ? `<p class="hub-card-note hub-card-note--warn">Your account is still being confirmed, so this link does not credit visits to you yet. You can share it now; nothing you print will need to change.</p>`
        : `<p class="hub-card-note">It identifies you without your name in the address. Previews and your own visits are not counted.</p>`}
    </div>
    <div class="hub-linkcard-qr">
      <div class="hub-qr-frame" id="${esc(inputId)}-qr" data-qr-inline="${esc(link)}" data-qr-size="168" role="img" aria-label="QR code for your WELL link"></div>
      <span class="hub-qr-caption">Scan to test</span>
    </div>
  </section>`;
}

/* ── Marketing's tabs ──────────────────────────────────────────────────────
   Campaign, Playbook and Draws are the same job — finding the people the
   journeys are for — so they sit under one destination with one strip of
   tabs, and every one of them keeps the URL it always had. hubPage() renders
   the strip above any Marketing screen (see `subnav` in hub-render.js). */
const MARKETING_TABS = [
  { key: 'overview', label: 'Overview',      href: '/hub/marketing' },
  { key: 'campaign', label: '30-day campaign', href: '/hub/campaign' },
  { key: 'playbook', label: 'Playbook',      href: '/hub/campaign/playbook' },
  { key: 'draws',    label: 'Prize draws',   href: '/hub/sweepstakes' }
];
function marketingTabs(current) {
  return `<nav class="hub-subnav" aria-label="Marketing">
  <div class="wrap hub-subnav-inner">
    ${MARKETING_TABS.map((t) => `<a href="${t.href}"${t.key === current ? ' aria-current="page"' : ''}>${esc(t.label)}</a>`).join('')}
  </div>
</nav>`;
}

function stat(label, n, note) {
  return `<div class="hub-kpi">
    <span class="hub-kpi-n">${esc(n == null ? '—' : n)}</span>
    <span class="hub-kpi-label">${esc(label)}</span>
    <span class="hub-kpi-note">${esc(note)}</span>
  </div>`;
}

module.exports = {
  villageOf, villagesOf, villageChips, personName, avatar, stagePill, waitingFor,
  inquiryRow, IMAGES, MARKETING_TABS, marketingTabs, picture, tile, villageCard, sectionHead, linkCard, stat, VILLAGES
};
