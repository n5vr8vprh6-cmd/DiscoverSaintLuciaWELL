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
   Gros Piton and Petit Piton as one continuous line, with the sun as a soft glow
   resting in the valley between them. Drawn from the supplied artwork (a 500px
   PNG): the peaks sit where the artwork puts them — measured from the pixels —
   but the line is SOFTENED, deliberately (2026-09-30). The first cut kept the
   artwork's hard angles, mitred tips and a solid coral dot, and read masculine
   for a brand that is not: Saint Lucia is a feminine, circular brand, and the
   concentric ring it replaced was both. So the tips are rounded, the flanks curve
   a little (not so far that the Pitons become rolling hills — a stronger version
   was tried and lost the place), the line is finer with round caps and joins, the
   sun is a glow with no hard edge, and on larger sizes one faint halo ring
   echoes the old circles.

   THE LINE IS currentColor. It inherits ink on the cream header and paper on
   every dark surface, so there is no per-placement colour logic to keep in step.
   Only the glow is fixed: coral core, warm gold falloff.

   `height` is what a caller cares about (the header has a height budget); width
   follows the 2.3:1 shape. Stroke is 2.6 user units below 30px tall (~1.4px at the
   22px header) and 2.2 above, so the line stays visible small and delicate large.
   The halo ring appears from 30px up: a hairline at 22px is just noise.

   `animate` adds what the draw-and-glow animation needs: pathLength=1 on the line
   (so one dasharray fits any size) and a blurred gold duplicate behind it. Without
   the class hooks css/site.css + js/motion.js key on, the mark is simply drawn —
   which is also the reduced-motion and no-JavaScript state. `sun: false` drops the
   glow for the tiniest renderings.

   Each mark needs its own gradient id (ids are document-wide), hence the counter. */
const PITON_PATH = 'M3 37 C13 27.5 21.5 15.5 27.8 7.2 Q30 4.2 32.2 7.2 C36.8 13 41.2 18.2 44.7 20.6 Q46 21.7 47.3 20.6 C51.6 17.8 57.6 11.4 62.9 4.6 Q65 2 67.1 4.6 C74.6 14 82 27 89 37';
let sunSeq = 0;
function pitonsMark({ height = 22, animate = false, breathe = false, sun = true, halo } = {}) {
  const width = Math.round(height * (92 / 40) * 10) / 10;
  const cls = ['piton-mark', animate ? 'piton-mark--animate' : '', breathe ? 'piton-mark--breathe' : '']
    .filter(Boolean).join(' ');
  const stroke = height < 30 ? 2.6 : 2.2;
  const showHalo = sun && (halo === undefined ? height >= 30 : halo);
  const gid = 'piton-sun-' + (++sunSeq);
  return `<svg class="${cls}" width="${width}" height="${height}" viewBox="0 0 92 40" aria-hidden="true" focusable="false">${
    sun ? `
  <defs><radialGradient id="${gid}"><stop offset="0" stop-color="#FFE2C2"/><stop offset=".18" stop-color="#F58A66" stop-opacity=".95"/><stop offset=".5" stop-color="#EF6A4A" stop-opacity=".32"/><stop offset="1" stop-color="#D9A03C" stop-opacity="0"/></radialGradient></defs>` : ''}${
    showHalo ? `
  <circle class="piton-halo" cx="46" cy="11.5" r="17" fill="none" stroke="#D9A03C" stroke-width=".6"/>` : ''}${
    sun ? `
  <circle class="piton-sun" cx="46" cy="11.5" r="13" fill="url(#${gid})"/>` : ''}${
    animate ? `
  <path class="piton-glow" d="${PITON_PATH}" pathLength="1" fill="none" stroke="#D9A03C" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
  <path class="piton-line" d="${PITON_PATH}" pathLength="1" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"/>
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

module.exports = { esc, pitonsMark, PITON_PATH, eclipseMark, wordmark, coordMark };
