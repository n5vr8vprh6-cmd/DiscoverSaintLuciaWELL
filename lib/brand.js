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
   Gros Piton and Petit Piton as one continuous line, with golden-hour light
   rising out of the saddle between them.

   THE OUTLINE IS THE REAL SKYLINE. The first two cuts were drawn from the supplied
   artwork — a symmetric "M" with hard angles, then the same "M" softened — and
   the second read closer but still generic, because the real Pitons are not
   symmetric and that is most of their character. tools/derive-piton-path.py
   measures the actual skyline from a photograph of the Pitons and turns it into
   the path below: Gros tall, with a small shoulder on its left and a steep, almost
   straight right flank; a deep saddle; Petit about two-thirds the height with a
   short steep left side and a long gentle slope to the sea on its right. The
   softness the brand wants comes from smoothing that REAL profile (which rounds
   the tips), not from drawing curves over a made-up one. Round caps and joins,
   a fine line.

   THE LIGHT IS SUNRISE / SUNSET, NOT A DOT. A warm radial glow (gold core, amber,
   coral falloff) and a soft-edged sun disc sit in the saddle and are CLIPPED TO THE
   SKY ABOVE THE SKYLINE, so it reads as light coming from behind the mountains,
   with the sun half set into the valley — it never shows through the peaks. The
   clip is the outline closed off along the top edge. Nothing has a hard edge.

   THE LINE IS currentColor: ink on the cream header, paper on every dark surface,
   no per-placement colour logic. The light is fixed warm colour. The viewBox is
   96 x 36 (2.67:1); `height` is the argument callers care about. Stroke is 2.3
   user units below 30px tall and 2.0 above.

   `animate` adds what draw-and-glow needs: pathLength=1 on the line and a blurred
   gold duplicate behind it. The light group (`.piton-sun`) is what css/site.css
   raises out of the saddle. Without those hooks the mark is simply drawn with
   its light in place — also the reduced-motion and no-JavaScript state. Every mark
   needs its own gradient/clip ids (ids are document-wide), hence the counter and,
   for the markup pasted into the Foundations page, an explicit id suffix. */
const PITON_PATH = 'M9.0 32.0 C9.7 31.4 11.9 29.5 13.4 28.1 C14.9 26.6 16.3 24.8 17.8 23.2 C19.3 21.5 20.7 19.8 22.2 18.3 C23.7 16.7 25.1 15.3 26.6 13.8 C28.1 12.3 29.6 10.6 31.0 9.3 C32.4 8.0 33.6 5.6 35.1 6.0 C36.6 6.4 38.3 9.5 39.8 12.0 C41.3 14.5 42.9 19.1 44.2 21.1 C45.5 23.2 46.3 24.5 47.8 24.4 C49.3 24.2 51.4 21.6 53.0 20.2 C54.6 18.8 56.3 16.8 57.4 16.0 C58.5 15.1 59.0 15.3 59.8 15.2 C60.5 15.2 60.7 15.2 61.8 15.9 C62.9 16.5 64.7 17.9 66.2 18.9 C67.7 20.0 69.1 21.1 70.6 22.1 C72.1 23.2 73.5 24.2 75.0 25.3 C76.5 26.3 77.9 27.4 79.4 28.4 C80.9 29.4 82.7 30.7 83.8 31.4 C84.9 32.1 85.8 32.3 86.2 32.5';
const PITON_VALLEY = [47.8, 24.4];
const PITON_VIEWBOX = '0 0 96 36';
/* The sky above the skyline: the outline, then along the top edge and back. */
const PITON_SKY = PITON_PATH + ' L96 32.5 L96 0 L0 0 L0 32 Z';

/* Everything inside the <svg>, with the line in `color`. Shared by the page marks,
   the favicon tiles and the share image so they cannot drift. */
function pitonsMarkInner(uid, { stroke = 2.3, color = 'currentColor', animate = false, sun = true } = {}) {
  const [vx, vy] = PITON_VALLEY;
  const id = (k) => k + uid;
  return `${
    sun ? `<defs>
    <radialGradient id="${id('pa')}"><stop offset="0" stop-color="#FFD08A" stop-opacity=".95"/><stop offset=".35" stop-color="#F5A552" stop-opacity=".72"/><stop offset=".7" stop-color="#EF6A4A" stop-opacity=".3"/><stop offset="1" stop-color="#EF6A4A" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id('ps')}"><stop offset="0" stop-color="#FFF3D6"/><stop offset=".55" stop-color="#FFD68F" stop-opacity=".95"/><stop offset="1" stop-color="#F5A552" stop-opacity="0"/></radialGradient>
    <clipPath id="${id('pc')}"><path d="${PITON_SKY}"/></clipPath>
  </defs>
  <g clip-path="url(#${id('pc')})"><g class="piton-sun"><ellipse class="piton-aura" cx="${vx}" cy="${vy - 1}" rx="30" ry="20" fill="url(#${id('pa')})"/><circle class="piton-disc" cx="${vx}" cy="${vy - 0.4}" r="5.4" fill="url(#${id('ps')})"/></g></g>` : ''}${
    animate ? `
  <path class="piton-glow" d="${PITON_PATH}" pathLength="1" fill="none" stroke="#D9A03C" stroke-width="${stroke * 2.4}" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
  <path class="piton-line" d="${PITON_PATH}" pathLength="1" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

let pitonSeq = 0;
function pitonsMark({ height = 22, animate = false, breathe = false, sun = true, uid } = {}) {
  const width = Math.round(height * (96 / 36) * 10) / 10;
  const cls = ['piton-mark', animate ? 'piton-mark--animate' : '', breathe ? 'piton-mark--breathe' : '']
    .filter(Boolean).join(' ');
  const stroke = height < 30 ? 2.3 : 2.0;
  return `<svg class="${cls}" width="${width}" height="${height}" viewBox="${PITON_VIEWBOX}" aria-hidden="true" focusable="false">
  ${pitonsMarkInner(uid || '-' + (++pitonSeq), { stroke, animate, sun })}
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

module.exports = { esc, pitonsMark, pitonsMarkInner, PITON_PATH, PITON_SKY, PITON_VALLEY, PITON_VIEWBOX, eclipseMark, wordmark, coordMark };
