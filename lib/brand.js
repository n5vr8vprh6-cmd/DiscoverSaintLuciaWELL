/* ============================================================================
   BRAND PRIMITIVES — the marks that carry identity across every layout
   ----------------------------------------------------------------------------
   The V4 brief allows a page to drop the global navigation entirely. What keeps
   such a page unmistakably part of the brand is this file plus css/tokens.css:
   the Pitons mark, the gold journey line, the coordinates.

   The mark's accent colours are hard-coded rather than tokenized on purpose.
   This is the ONE place full-saturation deck colour (coral sun, gold glow) is
   allowed — the rule carried over from the printed edition, where it belonged to
   the concentric ring this mark replaced (2026-09-30). Tokenizing them would
   invite reuse.
   ========================================================================== */
'use strict';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* ── The Pitons mark ───────────────────────────────────────────────────────
   Gros Piton and Petit Piton as one continuous line, with the sun resting in the
   valley between them. Rebuilt as a vector from the supplied artwork (500px
   PNG): the line is a five-point polyline, measured from the pixels rather than
   eyeballed — (0,74) (53,9) (85,42) (123,0) (176,74) in the artwork's own units,
   halved and padded into a 92 x 40 box. Sharp peaks are the point of it, so the
   join is mitred, not rounded.

   THE LINE IS currentColor. It inherits ink on the cream header and paper on
   every dark surface (footer, hero, closing invitation), so there is no
   per-placement colour logic to keep in step. Only the sun is fixed: coral.

   `height` is what a caller cares about (the header has a height budget); the
   width follows the 2.3:1 shape. Stroke is 3 user units, which is ~1.6px at the
   22px header size and ~2.7px at the 36px hero size — heavier as it grows, the
   way a printed mark is.

   `animate` adds the pieces the draw-and-glow animation needs: pathLength=1 on
   the line (so one dasharray fits any size), and a blurred gold duplicate behind
   it. Without the class hooks css/site.css + js/motion.js key on, the mark is
   simply drawn — which is also the reduced-motion and no-JavaScript state. Use
   `sun: false` below ~20px, where a dot is a smudge. */
const PITON_POINTS = '3,37 30,4.5 46,21.5 65,2.5 89,37';
function pitonsMark({ height = 22, animate = false, breathe = false, sun = true } = {}) {
  const width = Math.round(height * (92 / 40) * 10) / 10;
  const cls = ['piton-mark', animate ? 'piton-mark--animate' : '', breathe ? 'piton-mark--breathe' : '']
    .filter(Boolean).join(' ');
  return `<svg class="${cls}" width="${width}" height="${height}" viewBox="0 0 92 40" aria-hidden="true" focusable="false">${
    animate ? `
  <polyline class="piton-glow" points="${PITON_POINTS}" pathLength="1" fill="none" stroke="#D9A03C" stroke-width="6" stroke-linejoin="round"/>` : ''}
  <polyline class="piton-line" points="${PITON_POINTS}" pathLength="1" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter" stroke-miterlimit="6"/>${
    sun ? `
  <circle class="piton-sun" cx="46" cy="11.5" r="3.2" fill="#EF6A4A"/>` : ''}
</svg>`;
}

/* The ECLIPSE mark — a separate identity from the Pitons mark above.
   The Pitons mark is the parent brand; this thin ring with light raking around
   it belongs to Eclipse alone. They must not be swapped: the header keeps the
   parent mark even on /eclipse.

   Raster rather than inline SVG, unlike every other mark in this file. The
   supplied .svg contains no vector geometry at all — it is a PNG in an SVG
   wrapper — and the ring is subtly irregular, so redrawing it as a perfect
   circle would lose the hand-made quality that is the point of it.
   Derivatives come from tools/build-eclipse-images.py.

   `variant` is 'sign' (a signature-sized mark) or 'watermark' (very large,
   very faint, bled off the edge of a section). */
function eclipseMark({ variant = 'sign', widths = [220, 440] } = {}) {
  const set = (ext) => widths.map((w) => `/assets/eclipse/eclipse-mark-${w}.${ext} ${w}w`).join(', ');
  const sizes = variant === 'watermark' ? '(max-width: 900px) 90vw, 46rem' : '110px';
  const reveal = variant === 'sign' ? ' reveal-item' : '';
  return `<span class="eclipse-mark eclipse-mark--${esc(variant)}${reveal}" aria-hidden="true">
    <picture>
      <source type="image/webp" srcset="${esc(set('webp'))}" sizes="${sizes}">
      <img src="/assets/eclipse/eclipse-mark-${widths[widths.length - 1]}.png" alt="" loading="lazy" decoding="async">
    </picture>
  </span>`;
}

/* Wordmark lockup. `context` adds the professional qualifier the brief
   specifies for advisor conversion pages ("… · Professional Education"). */
function wordmark({ href = '/', context = '', label = 'Discover Saint Lucia WELL — home' } = {}) {
  return `<a class="brand-lockup" href="${esc(href)}" aria-label="${esc(label)}">
  ${pitonsMark({ height: 22 })}
  <span class="brand-words">
    <b>Discover Saint&nbsp;Lucia WELL</b>${context ? `<i>${esc(context)}</i>` : ''}
  </span>
</a>`;
}

/* Saint Lucia's real coordinates — "a real place you can go." */
function coordMark(text = '13°54′N  60°58′W') {
  return `<p class="coords">${esc(text)}</p>`;
}

module.exports = { esc, pitonsMark, PITON_POINTS, eclipseMark, wordmark, coordMark };
