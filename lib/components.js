/* ============================================================================
   SECTION RENDERERS
   ----------------------------------------------------------------------------
   Each content module lists sections as `{ type, ...props }`; this file turns
   them into HTML. One renderer per type, no inheritance, no cleverness — a
   section you can read top to bottom is worth more than a section you can
   configure infinitely.

   IMAGE DISCIPLINE — `figure()` accepts an art direction and no source, and
   renders a labelled placeholder panel carrying that direction. This is the
   same convention the brochure uses (`content/copy.js` → `img.dir`), and it
   means the whole site can be built, reviewed and corrected before a single
   new photograph exists. A placeholder is visibly a placeholder; it never
   pretends to be a photo we have.
   ========================================================================== */
'use strict';

const { esc, ringMark, eclipseMark, coordMark } = require('./brand.js');
const SITE = require('../content/site.js');

/* ── helpers ─────────────────────────────────────────────────────────────── */

const paras = (body) => []
  .concat(body || [])
  .map((p) => `<p>${p}</p>`)
  .join('\n        ');

function btn(cta, variant = 'gold') {
  if (!cta) return '';
  const ext = /^https?:/.test(cta.href);
  return `<a class="btn btn--${variant}" href="${esc(cta.href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(cta.label)}</a>`;
}

/* The primary consumer CTA, from one definition (content/site.js). */
const finderBtn = (variant = 'gold') => btn(SITE.primaryCta, variant);

/* An ambient cinemagraph layered over an always-present still. The <img> stays
   in the DOM and remains the LCP element; the video is pure enhancement and is
   skipped entirely for reduced-motion, Save-Data and narrow viewports by
   js/ambient-video.js. */
function ambientVideo(v, poster) {
  if (!v) return '';
  /* `webm` is optional. VP9 is usually the smaller file, but not always: on the
     high-motion portrait loops (churning water, a waterfall) it came out
     20–30% LARGER than H.264 at matched quality. Shipping a webm there would
     make every Chrome visitor download the worse file, since the first source
     a browser can play is the one it takes. So each loop declares webm only
     where webm actually won — measured per file, not assumed. */
  return `<video class="ambient-video" muted loop playsinline preload="none"${poster ? ` poster="${esc(poster)}"` : ''} aria-hidden="true" tabindex="-1">
        ${v.webm ? `<source src="${esc(v.webm)}" type="video/webm">
        ` : ''}<source src="${esc(v.mp4)}" type="video/mp4">
      </video>`;
}

/* Photograph, or an honest art-directed placeholder if we don't have it yet. */
function figure(img, { className = '', priority = false } = {}) {
  if (!img) return '';
  const cls = ['photo', className].filter(Boolean).join(' ');

  if (!img.src) {
    return `<figure class="${cls} photo--placeholder" data-tone="${esc(img.tone || 'ocean')}">
      <div class="photo-frame">
        <p class="photo-flag">Art direction</p>
        <p class="photo-dir">${esc(img.dir || '')}</p>
        ${img.ratio ? `<p class="photo-ratio">${esc(img.ratio)}</p>` : ''}
      </div>
      ${img.caption ? `<figcaption>${esc(img.caption)}</figcaption>` : ''}
    </figure>`;
  }

  const base = img.src.replace(/\.(jpg|jpeg|png)$/i, '');
  const dims = img.w && img.h ? ` width="${img.w}" height="${img.h}"` : '';
  const load = priority
    ? ' fetchpriority="high" decoding="async"'
    : ' loading="lazy" decoding="async"';

  return `<figure class="${cls}">
      <div class="photo-frame-media">
        <picture>
          <source srcset="${esc(base)}.webp" type="image/webp">
          <img src="${esc(img.src)}" alt="${esc(img.alt || '')}"${dims}${load}>
        </picture>
        ${ambientVideo(img.video, img.src)}
      </div>
      ${img.caption ? `<figcaption>${esc(img.caption)}</figcaption>` : ''}
    </figure>`;
}

/* `as` lets a section own the page's <h1>. Pages without a pageHeader — the
   Journey Finder is the only one — would otherwise ship with no h1 at all. */
function sectionHead({ eyebrow, headline, lead, id, as = 'h2' }) {
  return `<div class="section-head">
      ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
      ${headline ? `<${as}${id ? ` id="${esc(id)}-title"` : ''}>${headline}</${as}>` : ''}
      ${lead ? `<p class="lead">${lead}</p>` : ''}
    </div>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   HERO
   ══════════════════════════════════════════════════════════════════════════ */
/* The hero image is the LCP element, so it gets a real srcset rather than one
   oversized file. `widths` lists the derivatives that exist on disk; we never
   upscale past the source, so the largest entry is the native width. */
function heroPicture(img) {
  const base = img.src.replace(/\.(jpg|jpeg|png)$/i, '');
  const widths = img.widths || [];
  const dims = img.w && img.h ? ` width="${img.w}" height="${img.h}"` : '';

  if (!widths.length) {
    return `<picture><source srcset="${esc(base)}.webp" type="image/webp"><img src="${esc(img.src)}" alt=""${dims} fetchpriority="high" decoding="async"></picture>`;
  }
  const set = (ext) => widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(', ');
  return `<picture>
      <source type="image/webp" srcset="${esc(set('webp'))}" sizes="100vw">
      <source type="image/jpeg" srcset="${esc(set('jpg'))}" sizes="100vw">
      <img src="${esc(base)}-${widths[widths.length - 1]}.jpg" alt=""${dims} fetchpriority="high" decoding="async">
    </picture>`;
}

function hero(s) {
  return `<section class="hero ${esc(s.skin || 'dark')}" id="top">
  <div class="hero-media" aria-hidden="true">
    ${s.img && s.img.src
      ? heroPicture(s.img)
      : `<div class="hero-placeholder" data-tone="${esc((s.img && s.img.tone) || 'twilight')}"><p class="photo-flag">Art direction — hero</p><p class="photo-dir">${esc((s.img && s.img.dir) || '')}</p></div>`}
    ${ambientVideo(s.video, s.img && s.img.src)}
  </div>
  <div class="hero-veil" aria-hidden="true"></div>

  <div class="wrap hero-wrap">
    <div class="hero-inner">
      ${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ''}
      <h1>${s.headline}</h1>
      ${s.lead ? `<p class="lead">${s.lead}</p>` : ''}
      <div class="hero-ctas">
        ${finderBtn('gold')}
        ${btn(s.secondary, 'ghost')}
      </div>
      ${s.note ? `<p class="hero-note">${esc(s.note)}</p>` : ''}
    </div>
    <div class="hero-signature" aria-hidden="true">
      ${ringMark(34, 1.4)}
      <div class="thread"></div>
      ${coordMark(SITE.coords)}
      ${s.scrollCue ? `<p class="scroll-cue">${esc(s.scrollCue)}</p>` : ''}
    </div>
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   LENS — the island's six elements
   ══════════════════════════════════════════════════════════════════════════ */
function lens(s) {
  /* An item may carry an href. Naming a destination without letting the reader
     go there is a dead end, which is exactly what /journey's exit section was. */
  const items = s.items.map((it) => `<li class="lens-item${it.href ? ' lens-item--link' : ''}">
        <h3>${it.href ? `<a href="${esc(it.href)}">${esc(it.title)}</a>` : esc(it.title)}</h3>
        <p>${esc(it.text)}</p>
      </li>`).join('\n      ');

  /* `sequence` opts a lens into being read as an ordered range rather than a
     set. Only the Wellness Continuum is one — Relax through Sustain is a
     spectrum you move along, where the homepage's six environments are six
     equal things. It earns the numbering and the scroll-linked light-up; the
     other five uses of this component would be misled by both. */
  const seq = s.sequence ? ' lens--sequence' : '';

  return `<section class="section section--paper lens${seq}" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    ${sectionHead(s)}
    <ul class="lens-grid reveal-group">
      ${items}
    </ul>
    ${s.closing ? `<p class="section-closing">${s.closing}</p>` : ''}
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   THE WELL COMPASS
   Eight directions around the ring mark. SVG so the geometry is guaranteed at
   every width; type sized in viewBox units so it scales proportionally rather
   than colliding. role="img" + aria-label carries the content to screen
   readers as one clean sentence instead of eight orphaned <text> nodes.
   ══════════════════════════════════════════════════════════════════════════ */
function compass(s) {
  /* Points accept a bare string (a direction with no gloss) or {label, note}.
     The string form is kept so the deck and any future page can render the
     same diagram without being forced to invent descriptions for it. */
  const pts = s.points.map((p) => (typeof p === 'string' ? { label: p } : p));
  const cx = 310, cy = 310, rLabel = 232, rTick = 168, rTickOut = 190;
  const anyNotes = pts.some((p) => p.note);

  const nodes = pts.map((p, i) => {
    const ang = (-90 + i * (360 / pts.length)) * Math.PI / 180;
    const x = cx + rLabel * Math.cos(ang);
    const y = cy + rLabel * Math.sin(ang);
    const x1 = cx + rTick * Math.cos(ang), y1 = cy + rTick * Math.sin(ang);
    const x2 = cx + rTickOut * Math.cos(ang), y2 = cy + rTickOut * Math.sin(ang);

    const cosA = Math.cos(ang);
    const anchor = Math.abs(cosA) < 0.25 ? 'middle' : (cosA > 0 ? 'start' : 'end');
    /* nudge the top and bottom labels off the tick so they sit optically level */
    const dy = Math.sin(ang) < -0.9 ? -6 : (Math.sin(ang) > 0.9 ? 16 : 6);

    /* The hit target is a circle straddling the tick and its label, not the
       glyphs themselves — 14px of letterform is a miserable thing to aim at,
       and the gap between tick and word would otherwise drop the hover. */
    const hx = cx + (rTickOut + 26) * Math.cos(ang);
    const hy = cy + (rTickOut + 26) * Math.sin(ang);

    return `<g class="compass-point" data-i="${i}"${p.note ? ` data-note="${esc(p.note)}"` : ''}>
      <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="compass-tick"/>
      <text x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${anchor}" class="compass-label">${esc(p.label)}</text>
      <circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="58" class="compass-hit"/>
    </g>`;
  }).join('\n        ');

  /* The readout is the hover surface; the legend is the same content as plain
     copy. On a pointer device the legend is hidden from sight but left in the
     accessibility tree, so a screen-reader user reads all eight descriptions
     without having to hover anything. Where there is no hover — touch — the
     positions swap and the legend is simply shown. */
  const readout = anyNotes ? `
      <p class="compass-readout" aria-hidden="true"><span class="compass-readout-inner"></span></p>` : '';

  const legend = anyNotes ? `
      <dl class="compass-legend">
        ${pts.filter((p) => p.note).map((p) => `<div class="compass-legend-row">
          <dt>${esc(p.label)}</dt>
          <dd>${esc(p.note)}</dd>
        </div>`).join('\n        ')}
      </dl>` : '';

  return `<section class="section section--ink compass-section" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap compass-wrap">
    <div class="compass-figure">
      <svg viewBox="0 0 620 620" class="compass" role="img"
           aria-label="The WELL Compass. Eight directions: ${esc(pts.map((p) => p.label).join(', '))}.">
        <circle cx="${cx}" cy="${cy}" r="${rTick}" class="compass-ring"/>
        <circle cx="${cx}" cy="${cy}" r="${rTick - 46}" class="compass-ring compass-ring--inner"/>
        ${nodes}
        <g class="compass-mark" transform="translate(${cx - 26} ${cy - 40})">
          <circle cx="26" cy="26" r="23" fill="none" stroke="#00A6A8" stroke-width="1.6"/>
          <circle cx="26" cy="26" r="14" fill="none" stroke="#D9A03C" stroke-width="1.6"/>
          <circle cx="26" cy="26" r="5.2" fill="#EF6A4A"/>
        </g>
        <text x="${cx}" y="${cy + 44}" text-anchor="middle" class="compass-center">${esc(s.center)}</text>
      </svg>${readout}${legend}
    </div>
    <div class="compass-copy">
      ${sectionHead(s)}
      ${s.sidebar ? `<aside class="note-card">
        <h3>${esc(s.sidebar.title)}</h3>
        <p>${esc(s.sidebar.text)}</p>
      </aside>` : ''}
    </div>
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   VILLAGES — six cards, each in its own accent
   ══════════════════════════════════════════════════════════════════════════ */
function villages(s) {
  const cards = s.villages.map((v) => `<li class="village-card reveal-item" style="--v:${v.color};--v-ink:${v.ink}">
        <a class="village-link" href="${esc(s.hrefBase || '/explore')}#village-${esc(v.key)}">
          <span class="village-rule" aria-hidden="true"></span>
          <h3>${esc(v.name)}</h3>
          <p class="village-subline">${esc(v.subline)}</p>
          <p class="village-body">${esc(v.body)}</p>
          <span class="village-more">${esc(s.moreLabel || 'Explore this village')}</span>
        </a>
      </li>`).join('\n      ');

  return `<section class="section section--sand villages" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    ${sectionHead(s)}
    <ul class="village-grid reveal-group">
      ${cards}
    </ul>
    ${s.footnote ? `<p class="section-footnote">${s.footnote}</p>` : ''}
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   JOURNEY FINDER PROMO — the personalization engine, introduced
   ══════════════════════════════════════════════════════════════════════════ */
function finder(s) {
  const steps = (s.steps || []).map((st, i) => `<li>
        <span class="finder-step-n">${String(i + 1).padStart(2, '0')}</span>
        <h3>${esc(st.title)}</h3>
        <p>${esc(st.text)}</p>
      </li>`).join('\n      ');

  return `<section class="section section--paper finder-promo" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    ${sectionHead(s)}
    <ol class="finder-steps reveal-group">
      ${steps}
    </ol>
    <div class="section-cta">
      ${finderBtn('gold')}
      ${s.note ? `<p class="cta-note">${esc(s.note)}</p>` : ''}
    </div>
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   ECLIPSE FEATURE — the one fully designed signature journey
   Its own midnight/copper world, as in the printed edition.
   ══════════════════════════════════════════════════════════════════════════ */
function eclipse(s) {
  const phases = (s.phases || []).map((p) => `<li>
          <span class="arc-key">${esc(p.k)}</span>
          <span class="arc-sub">${esc(p.s)}</span>
        </li>`).join('\n        ');

  return `<section class="section section--eclipse eclipse-feature" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    <div class="eclipse-grid">
      <div class="eclipse-copy">
        <p class="eyebrow eyebrow--copper">${esc(s.eyebrow)}</p>
        <h2 id="${esc(s.id)}-title" class="eclipse-title">${s.headline}</h2>
        ${paras(s.body)}
        <div class="section-cta section-cta--left">
          ${btn(s.cta, 'copper')}
          ${btn(s.secondary, 'ghost-dark')}
        </div>
      </div>
      <div class="eclipse-arc">
        <p class="arc-label">${esc(s.arcLabel || 'The journey architecture')}</p>
        <ol class="arc-list">
        ${phases}
        </ol>
      </div>
    </div>
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   SPLIT — editorial argument beside a photograph
   ══════════════════════════════════════════════════════════════════════════ */
function split(s) {
  return `<section class="section section--${esc(s.skin || 'paper')} split-section" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    <div class="split ${s.flip ? 'split--flip' : ''}">
      <div class="split-media">
        ${figure(s.img)}
      </div>
      <div class="split-copy">
        ${sectionHead(s)}
        ${paras(s.body)}
        ${s.list ? `<ul class="tick-list">
          ${s.list.map((l) => `<li>${esc(l)}</li>`).join('\n          ')}
        </ul>` : ''}
        ${s.closing ? `<p class="pullquote">${s.closing}</p>` : ''}
        ${s.cta ? `<div class="section-cta section-cta--left">${btn(s.cta, s.ctaVariant || 'ghost')}</div>` : ''}
      </div>
    </div>
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   EXPERTISE — the advisor, introduced without turning the page B2B
   ══════════════════════════════════════════════════════════════════════════ */
function expertise(s) {
  const roles = (s.roles || []).map((r) => `<li>
        <h3>${esc(r.role)}</h3>
        <p>${esc(r.text)}</p>
      </li>`).join('\n      ');

  /* Skinnable. This section hardcoded `section--ink` (#12302F, the brand's
     rainforest ink), which is right on the homepage but put a teal-ink band
     between two midnight bands halfway down /eclipse — a colour break in the
     middle of a page whose whole point is that it holds one mood. */
  return `<section class="section section--${esc(s.skin || 'ink')} expertise" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    ${sectionHead(s)}
    <ul class="expertise-grid reveal-group">
      ${roles}
    </ul>
    ${s.pullquote ? `<p class="pullquote pullquote--center">${s.pullquote}</p>` : ''}
    ${s.cta ? `<div class="section-cta">${btn(s.cta, 'ghost-dark')}</div>` : ''}
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   CREDIBILITY — institutional proof, stated plainly
   ══════════════════════════════════════════════════════════════════════════ */
function credibility(s) {
  const items = s.partners.map((p) => `<li>${esc(p)}</li>`).join('\n        ');
  return `<section class="section section--paper credibility" id="${esc(s.id)}" aria-label="${esc(s.label || 'Partners')}">
  <div class="wrap">
    <p class="cred-label">${esc(s.eyebrow)}</p>
    <ul class="cred-list">
        ${items}
    </ul>
    ${s.note ? `<p class="section-footnote">${s.note}</p>` : ''}
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   FINAL CTA — repeat the primary conversion before the global footer
   ══════════════════════════════════════════════════════════════════════════ */
function finalCta(s) {
  return `<section class="section dark final-cta" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="final-cta-media" aria-hidden="true">
    ${ambientVideo(s.video, s.img && s.img.src)}
    ${s.img && s.img.widths
      ? mediaPicture(s.img, { sizes: '100vw' })
      : s.img && s.img.src
        ? `<picture><source srcset="${esc(s.img.src.replace(/\.(jpg|jpeg|png)$/i, ''))}.webp" type="image/webp"><img src="${esc(s.img.src)}" alt="" loading="lazy" decoding="async"></picture>`
        : `<div class="hero-placeholder" data-tone="${esc((s.img && s.img.tone) || 'twilight')}"></div>`}
  </div>
  <div class="hero-veil" aria-hidden="true"></div>
  <div class="wrap">
    <div class="final-cta-inner">
      ${ringMark(38, 1.4)}
      <h2 id="${esc(s.id)}-title">${s.headline}</h2>
      ${s.lead ? `<p class="lead">${s.lead}</p>` : ''}
      <div class="hero-ctas">
        ${s.primaryOverride ? btn(s.primaryOverride, 'gold') : finderBtn('gold')}
        ${btn(s.secondary, 'ghost')}
      </div>
      ${coordMark(SITE.coords)}
    </div>
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE HEADER — the opener for pages that are not the homepage
   Lighter than a hero: a band of ink, a title, a lead. No full-bleed image and
   no competing CTA, because these pages are read rather than landed on.
   ══════════════════════════════════════════════════════════════════════════ */
/* `img` is optional. Given one, the header goes full-bleed behind the type —
   which is how /eclipse stops being the only page on the site whose first
   screen is flat colour.

   Deliberately NOT reusing hero(): that component hardcodes the Journey Finder
   button and the coordinate signature, neither of which belongs on a page whose
   single job is to make one journey feel considered. */
function pageHeader(s) {
  const hasMedia = !!s.img;
  const cls = ['page-header', 'section--ink', hasMedia ? 'page-header--media' : '']
    .filter(Boolean).join(' ');

  const media = hasMedia ? `
  <div class="page-header-media" aria-hidden="true">
    ${s.img.src
      ? heroPicture(s.img)
      : `<div class="hero-placeholder" data-tone="${esc(s.img.tone || 'twilight')}"><p class="photo-flag">Art direction — ${esc(s.id || 'header')}</p><p class="photo-dir">${esc(s.img.dir || '')}</p></div>`}
    ${ambientVideo(s.video, s.img.src)}
  </div>
  <div class="page-header-veil" aria-hidden="true"></div>` : '';

  return `<section class="${cls}" id="top">${media}
  <div class="wrap">
    ${s.mark ? eclipseMark({ variant: 'sign' }) : ''}
    <p class="eyebrow">${esc(s.eyebrow)}</p>
    <h1>${s.headline}</h1>
    ${s.lead ? `<p class="lead">${s.lead}</p>` : ''}
    ${s.meta ? `<ul class="page-header-meta">${s.meta.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
  </div>
</section>`;
}

/* Responsive <picture> for library imagery. Same srcset discipline as the hero:
   never upscale, so the widest candidate is whatever the source could give. */
function mediaPicture(img, { sizes = '100vw', priority = false } = {}) {
  if (!img) return '';
  const set = (ext) => img.widths.map((w) => `${img.base}-${w}.${ext} ${w}w`).join(', ');
  const last = img.widths[img.widths.length - 1];
  const load = priority ? ' fetchpriority="high"' : ' loading="lazy"';
  return `<picture>
        <source type="image/webp" srcset="${esc(set('webp'))}" sizes="${esc(sizes)}">
        <source type="image/jpeg" srcset="${esc(set('jpg'))}" sizes="${esc(sizes)}">
        <img src="${esc(img.base)}-${last}.jpg" alt="${esc(img.alt || '')}"${load} decoding="async">
      </picture>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   VILLAGE BLOCKS — the six villages, one editorial band each
   Alternating image side so the page has a rhythm rather than a rail. Each
   carries the id the homepage cards deep-link to.
   ══════════════════════════════════════════════════════════════════════════ */
function villageBlocks(s) {
  /* RHYTHM, not a metronome.
     Six consecutive alternating image/text rows is the classic zigzag tell —
     the eye learns the pattern by row three and stops reading. So every third
     village breaks to a full-width band: photograph across the measure, copy
     in two columns beneath. Pattern becomes split · split · WIDE · split ·
     split · WIDE, which also gives two villages a genuinely bigger moment. */
  const blocks = s.villages.map((v, i) => {
    const wide = i % 3 === 2;
    const flip = !wide && i % 2 === 1;
    const cls = ['village-block', wide ? 'village-block--wide' : '', flip ? 'village-block--flip' : '']
      .filter(Boolean).join(' ');

    return `<article class="${cls}" id="village-${esc(v.key)}" style="--v:${v.color};--v-ink:${v.ink}">
    <div class="village-block-media">
      ${v.image ? mediaPicture(v.image, {
        sizes: wide ? '100vw' : '(max-width: 940px) 100vw, 50vw'
      }) : ''}
      ${ambientVideo(v.video, v.image && `${v.image.base}-960.jpg`)}
    </div>
    <div class="village-block-copy">
      <div class="village-intro">
        <span class="village-rule" aria-hidden="true"></span>
        <h3>${esc(v.name)}</h3>
        <p class="village-subline">${esc(v.subline)}</p>
        <p>${esc(v.body)}</p>
      </div>
      <div class="village-themes">
        <h4 class="village-themes-title">${esc(v.themesTitle)}</h4>
        <ul class="tick-list">
          ${v.themes.map((t) => `<li>${esc(t)}</li>`).join('\n          ')}
        </ul>
        ${v.note ? `<p class="village-note">${esc(v.note)}</p>` : ''}
        ${v.eclipseRole ? `<p class="village-eclipse"><a href="/eclipse">${esc(v.eclipseRole)}</a></p>` : ''}
      </div>
    </div>
  </article>`;
  }).join('\n\n  ');

  return `<section class="section section--paper villages-detail" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    ${sectionHead(s)}
  </div>
  <div class="wrap village-blocks">
  ${blocks}
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   EXPERIENCE GROUPS — grouped by what they do for you, not where they are
   ══════════════════════════════════════════════════════════════════════════ */
function experienceGroups(s) {
  const groups = s.groups.map((g) => {
    const v = s.villageOf(g.villageKey);
    return `<section class="exp-group" style="--v:${v.color};--v-ink:${v.ink}">
      <div class="exp-group-head">
        <span class="village-rule" aria-hidden="true"></span>
        <h3>${esc(g.intention)}</h3>
        <p class="exp-group-village">Mostly <a href="#village-${esc(v.key)}">${esc(v.short)}</a></p>
      </div>
      <ul class="exp-list">
        ${g.items.map((it) => `<li>
          <h4>${esc(it.title)}</h4>
          <p>${esc(it.note)}</p>
        </li>`).join('\n        ')}
      </ul>
    </section>`;
  }).join('\n    ');

  return `<section class="section section--sand experiences" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    ${sectionHead(s)}
    <div class="exp-groups">
    ${groups}
    </div>
    ${s.footnote ? `<p class="section-footnote">${s.footnote}</p>` : ''}
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   PROPERTY DIRECTORY — the anchors, grouped by village
   Properties without photography render as typographic cards in the village
   accent. That is a deliberate treatment, not a gap: it reads as editorial
   rather than as a missing image, and photography drops in later untouched.
   ══════════════════════════════════════════════════════════════════════════ */
function propertyDirectory(s) {
  const groups = s.villages.map((v) => `<section class="prop-group" style="--v:${v.color};--v-ink:${v.ink}">
      <h3 class="prop-group-title">
        <span class="village-rule" aria-hidden="true"></span>
        <a href="#village-${esc(v.key)}">${esc(v.name)}</a>
      </h3>
      <ul class="prop-grid">
        ${v.anchors.map((a) => `<li class="prop-card${a.image ? '' : ' prop-card--text'}">
          ${a.image ? `<div class="prop-card-media">${mediaPicture(a.image, { sizes: '(max-width: 700px) 100vw, (max-width: 1080px) 50vw, 33vw' })}</div>` : ''}
          <div class="prop-card-body">
            <h4>${esc(a.name)}</h4>
            <p class="prop-role">${esc(a.role)}</p>
          </div>
        </li>`).join('\n        ')}
      </ul>
    </section>`).join('\n    ');

  return `<section class="section section--paper properties" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    ${sectionHead(s)}
    <div class="prop-groups">
    ${groups}
    </div>
    ${s.footnote ? `<p class="section-footnote">${s.footnote}</p>` : ''}
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   ECLIPSE COMPONENTS
   Eclipse keeps the printed edition's midnight/copper world rather than the
   destination palette. The shift from bright island to deep Eclipse is a
   deliberate signal that you have moved into something different in kind —
   not a drift, and not to be "harmonised" with the rest of the site.
   ══════════════════════════════════════════════════════════════════════════ */

/* Two columns of claims, set against each other. */
function comparison(s) {
  const col = (c, mark) => `<div class="cmp-col${mark ? ' cmp-col--ours' : ''}">
        <h3>${esc(c.head)}</h3>
        <ul>
          ${c.items.map((i) => `<li>${esc(i)}</li>`).join('\n          ')}
        </ul>
      </div>`;
  return `<section class="section section--eclipse comparison" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    ${sectionHead(s)}
    <div class="cmp">
      ${col(s.colA, false)}
      ${col(s.colB, true)}
    </div>
    ${s.closing ? `<p class="pullquote pullquote--eclipse">${s.closing}</p>` : ''}
  </div>
</section>`;
}

/* The six-phase arc, given the whole width it deserves. */
function journeyArc(s) {
  const phases = s.phases.map((p, i) => `<li>
        <span class="arc-n">${String(i + 1).padStart(2, '0')}</span>
        <span class="arc-key">${esc(p.k)}</span>
        <span class="arc-sub">${esc(p.s)}</span>
      </li>`).join('\n      ');
  /* One atmospheric band above the phases, when there is art for it. A single
     wide frame rather than six — the arc already animates as a lit path, and
     six competing photographs would turn a progression into a gallery. */
  const band = s.img ? `
    <div class="arc-band" aria-hidden="true">
      ${s.img.src
        ? heroPicture(s.img)
        : `<div class="hero-placeholder" data-tone="${esc(s.img.tone || 'twilight')}"><p class="photo-flag">Art direction — arc band</p><p class="photo-dir">${esc(s.img.dir || '')}</p></div>`}
      ${ambientVideo(s.video, s.img.src)}
    </div>` : '';

  return `<section class="section section--eclipse arc-section" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  ${s.mark ? eclipseMark({ variant: 'watermark', widths: [440, 1100] }) : ''}
  <div class="wrap">
    ${sectionHead(s)}${band}
    <ol class="arc-track">
      ${phases}
    </ol>
    ${s.footnote ? `<p class="section-footnote">${s.footnote}</p>` : ''}
  </div>
</section>`;
}

/* Illustrative day plan — explicitly not a fixed itinerary. */
/* A VERTICAL timeline, not a row of columns.

   The arc immediately above this is six phases read across. Five days read
   across directly beneath it made the page two horizontal ladders back to
   back, and squeezed each day's four or five items into about 200px. Turning
   this one down the page separates the two rhythms — the arc is the overview
   across, the days are the detail down — and lets the items breathe.

   The spine and its nodes reuse the arc's `is-lit` vocabulary rotated to the Y
   axis, so the two sections read as one idea at two scales rather than as two
   different devices. */
function dayPlan(s) {
  const days = s.days.map((d) => `<li>
        <div class="day-rail"><p class="day-n">${esc(d.d)}</p></div>
        <div class="day-body">
          <h3>${esc(d.t)}</h3>
          <ul>${d.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
        </div>
      </li>`).join('\n      ');
  return `<section class="section section--eclipse dayplan" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    ${sectionHead(s)}
    <ol class="day-track">
      ${days}
    </ol>
    <p class="section-footnote">${esc(s.footer)}</p>
  </div>
</section>`;
}

/* The nine signature experiences. */
/* Tiles take an optional photograph and an optional village chip.

   The chip is the point: Eclipse used to read as a product parked beside the
   six villages. Tagging each experience with the village it happens in makes
   Eclipse the proof that the village system works, using the accent colour that
   village already owns — no new vocabulary, no new claims.

   A tile with no `img` renders as type alone rather than as a grey box. That is
   the same honest degradation the property directory uses, so art can arrive
   one experience at a time without a layout change. */
function tileGrid(s) {
  const tiles = s.tiles.map((t) => {
    const v = t.village;
    const style = v ? ` style="--v:${v.color};--v-ink:${v.ink}"` : '';
    return `<li class="${t.img ? 'tile--media' : 'tile--type'}"${style}>
        ${t.img ? `<div class="tile-media">${
          t.img.base
            ? mediaPicture(t.img, { sizes: '(max-width: 700px) 100vw, (max-width: 1080px) 50vw, 33vw' })
            : `<div class="tile-placeholder" data-tone="${esc(t.img.tone || 'twilight')}"><p class="photo-flag">Art direction</p><p class="photo-dir">${esc(t.img.dir || '')}</p></div>`
        }${ambientVideo(t.video, t.img.base ? `${t.img.base}-960.jpg` : null)}</div>` : ''}
        <div class="tile-copy">
          ${v ? `<span class="tile-village">${esc(v.short)}</span>` : ''}
          <h3>${esc(t.t)}</h3>
          <p>${esc(t.s)}</p>
        </div>
      </li>`;
  }).join('\n      ');

  return `<section class="section section--eclipse tiles" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    ${sectionHead(s)}
    <ul class="tile-grid${s.tiles.some((t) => t.img) ? ' tile-grid--media' : ''}">
      ${tiles}
    </ul>
    ${s.footnote ? `<p class="section-footnote">${s.footnote}</p>` : ''}
  </div>
</section>`;
}

/* "This may be for you if…" — with the safety note it must always carry. */
function checklist(s) {
  return `<section class="section section--eclipse checklist" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  ${s.mark ? eclipseMark({ variant: 'watermark', widths: [440, 1100] }) : ''}
  <div class="wrap checklist-wrap">
    <div>
      ${sectionHead(s)}
      <ul class="check-list">
        ${s.items.map((i) => `<li>${esc(i)}</li>`).join('\n        ')}
      </ul>
    </div>
    <aside class="safety-note">
      <h3>${esc(s.noteTitle)}</h3>
      <p>${esc(s.note)}</p>
    </aside>
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   PATHWAY — a numbered professional progression
   A step with `status` instead of `cta` is one that does not exist yet. It
   renders as a labelled state rather than a button, so the page can describe
   the whole pathway honestly without offering a link into nothing.
   ══════════════════════════════════════════════════════════════════════════ */
function pathway(s) {
  const steps = s.steps.map((st, i) => `<li class="path-step${st.cta ? '' : ' path-step--future'}">
        <span class="path-n">${String(i + 1).padStart(2, '0')}</span>
        <div class="path-body">
          <h3>${esc(st.title)}</h3>
          <p>${esc(st.text)}</p>
          ${st.cta
            ? `<a class="contact-link" href="${esc(st.cta.href)}">${esc(st.cta.label)}</a>`
            : `<span class="path-status">${esc(st.status)}</span>`}
        </div>
      </li>`).join('\n      ');

  return `<section class="section section--sand pathway" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    ${sectionHead(s)}
    <ol class="path-list">
      ${steps}
    </ol>
    ${s.footnote ? `<p class="section-footnote">${s.footnote}</p>` : ''}
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   CONTACT — the one place the site asks to be written to
   Any detail we do not actually have renders as a marked placeholder rather
   than an invented address. A wrong contact route is worse than a visible gap.
   ══════════════════════════════════════════════════════════════════════════ */
function contact(s) {
  const routes = s.routes.map((r) => `<li>
        <h3>${esc(r.title)}</h3>
        <p>${esc(r.text)}</p>
        ${r.href
          ? `<a class="contact-link" href="${esc(r.href)}"${/^https?:/.test(r.href) ? ' target="_blank" rel="noopener"' : ''}>${esc(r.label)}</a>`
          : `<span class="ph">${esc(r.label)}</span>`}
      </li>`).join('\n      ');

  return `<section class="section section--sand contact" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    ${sectionHead(s)}
    <ul class="contact-grid">
      ${routes}
    </ul>
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   FINDER APP — the Journey Finder itself
   Two mutually exclusive views in one section:

     .finder-static  — the full six-village explainer. Visible by default, so a
                       visitor with no JavaScript gets real content and real
                       routes rather than a dead form.
     .finder-app     — the interactive quiz. `hidden` until js/journey.js
                       confirms it can run, then it swaps with the static view.

   Building it this way round (static visible, app hidden) is deliberate: the
   failure mode of a broken script is a complete page, not a blank one.
   ══════════════════════════════════════════════════════════════════════════ */
function finderApp(s) {
  const q = (question, qi) => {
    const opts = question.options.map((o, oi) => `<li>
            <input type="radio" id="q${qi}-${oi}" name="${esc(question.id)}" value="${esc(o.value)}"${oi === 0 ? '' : ''}>
            <label for="q${qi}-${oi}">
              ${o.compass ? `<span class="opt-compass">${esc(o.compass)}</span>` : ''}
              <span class="opt-label">${esc(o.label)}</span>
              ${o.note ? `<span class="opt-note">${esc(o.note)}</span>` : ''}
            </label>
          </li>`).join('\n          ');

    return `<fieldset class="finder-q" data-q="${qi}"${qi === 0 ? '' : ' hidden'}>
        <legend>
          <span class="finder-q-n">${esc((s.steps && s.steps[qi]) || `Question ${qi + 1}`)}</span>
          <span class="finder-q-text">${esc(question.question)}</span>
          ${question.help ? `<span class="finder-q-help">${esc(question.help)}</span>` : ''}
        </legend>
        <ul class="finder-opts finder-opts--${question.options.length}">
          ${opts}
        </ul>
      </fieldset>`;
  };

  const questions = s.questions.map(q).join('\n      ');

  const staticVillages = s.villages.map((v) => `<li class="village-card" style="--v:${v.color};--v-ink:${v.ink}">
          <span class="village-rule" aria-hidden="true"></span>
          <h3>${esc(v.name)}</h3>
          <p class="village-subline">${esc(v.subline)}</p>
          <p class="village-body">${esc(v.body)}</p>
          <ul class="chip-list">${v.themes.slice(0, 3).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        </li>`).join('\n        ');

  /* The four step names, lit one at a time. Replaces "Question 2 of 4", which
     told the visitor where they were but nothing about what was being asked.
     Named in content/journey.js — see the note there on why the fourth is not
     called "Depth". */
  const steps = (s.steps || []).map((label, i) =>
    `<li data-step="${i}"><span>${esc(label)}</span></li>`).join('');

  return `<section class="section section--paper finder-section" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <!-- The wash. One element, one custom property, cross-faded by js/journey.js
       to the accent of whichever village is currently leading. It is the whole
       of the "environmental response" — no per-answer photography, no new
       assets. Outside .wrap because it is the full bleed of the shell. -->
  <div class="finder-wash" id="finder-wash" aria-hidden="true"></div>

  <!-- Tool chrome. Only ever visible in app mode; the static page keeps the
       global header instead, which is why this carries no navigation of its
       own beyond the one way out. -->
  <div class="finder-bar" id="finder-bar" hidden>
    <span class="finder-bar-brand">${esc(s.toolName || 'Journey Finder')}</span>
    <!-- finder-rail, NOT finder-steps: that class is already the homepage's
         "find your way through the island" 1-2-3 list, and it is registered in
         js/motion.js LIT_TRACKS for scroll-lighting. Reusing the name here
         would inherit its borders and let the scroll observer drive this rail. -->
    <ol class="finder-rail" id="finder-rail">${steps}</ol>
    <button type="button" class="finder-exit" id="finder-exit">
      <span aria-hidden="true">&times;</span> Exit
    </button>
  </div>

  <div class="wrap">
    ${sectionHead(s)}

    <!-- No-JS / pre-hydration view.
         DO NOT DELETE THIS TO "clean up the launch screen". It is the entire
         fallback: without JavaScript this is the page, and it has to stand on
         its own as a complete explainer with real routes out. js/journey.js
         hides it the moment it confirms it can run, so no visitor with a
         working script has ever seen it. -->
    <div class="finder-static" id="finder-static">
      <p class="finder-static-intro">${esc(s.staticIntro)}</p>
      <ul class="village-grid">
        ${staticVillages}
      </ul>
      <div class="section-cta">
        ${btn(s.exploreCta, 'gold')}
        ${btn(s.advisorCta, 'ghost')}
      </div>
    </div>

    <!-- Interactive tool, revealed by js/journey.js -->
    <div class="finder-app" id="finder-app" hidden>

      <!-- STATE 0 · launch. The only screen that offers a way out other than
           Exit: once they have started, the escape hatches go away. -->
      <div class="finder-launch" id="finder-launch">
        <p class="eyebrow">${esc(s.toolName || 'The WELL Journey Finder')}</p>
        <h3 class="finder-launch-title">${esc(s.launchHeadline)}</h3>
        <p class="finder-launch-lead">${esc(s.launchLead)}</p>
        <div class="finder-launch-actions">
          <button type="button" class="btn btn--gold" id="finder-begin">${esc(s.beginLabel || 'Begin')}</button>
        </div>
        <p class="finder-privacy">${esc(s.privacy)}</p>
        <p class="finder-launch-alt">${esc(s.altPrefix || 'Not ready?')}
          <a href="${esc(s.exploreCta.href)}">${esc(s.altLabel || 'Explore Saint Lucia WELL instead')} &rarr;</a>
        </p>
      </div>

      <!-- STATES 1–4 · one question per screen -->
      <form class="finder-form" id="finder-form" novalidate hidden>
      ${questions}
        <div class="finder-actions">
          <button type="button" class="btn btn--ghost" data-finder-back hidden>Back</button>
          <button type="submit" class="btn btn--gold" data-finder-next disabled>Continue</button>
        </div>
      </form>

      <!-- STATE 5 · shaping. Named beats that settle while the result builds.
           Not a timer pretending to compute — see js/journey.js. -->
      <div class="finder-shaping" id="finder-shaping" hidden aria-hidden="true">
        <ol class="shaping-beats">
          ${(s.shapingBeats || []).map((b) => `<li>${esc(b)}</li>`).join('')}
        </ol>
      </div>

      <!-- STATES 6–7 · result and capture -->
      <div class="finder-result" id="finder-result" hidden tabindex="-1">
        <!-- built by js/journey.js -->
      </div>
    </div>
  </div>
</section>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   DISPATCH
   ══════════════════════════════════════════════════════════════════════════ */
const RENDERERS = {
  hero, pageHeader, lens, compass, villages, villageBlocks, experienceGroups,
  propertyDirectory, finder, finderApp, eclipse, split, expertise,
  credibility, finalCta, comparison, journeyArc, dayPlan, tileGrid, checklist,
  contact, pathway
};

function renderSections(sections) {
  return sections.map((s) => {
    const fn = RENDERERS[s.type];
    if (!fn) throw new Error(`Unknown section type "${s.type}"`);
    return fn(s);
  }).join('\n\n');
}

module.exports = { renderSections, RENDERERS, figure, btn, sectionHead, paras, esc };
