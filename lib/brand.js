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

   HEIGHTS ARE EXAGGERATED 1.4x. The faithful profile is low and wide and read as
   flat next to how the Pitons actually feel — they are spires — so the same
   proportions are stretched vertically for majesty. And it is meant to be WRITTEN:
   the animation draws it like a signature — two brisk strokes for the peaks, the
   pen lifting a beat at Petit's tip, then Petit's long right slope as a slow
   flourish that trails off (PITON_WRITE marks where those fall along the line).

   THE LIGHT IS SUNRISE / SUNSET, NOT A DOT. A warm radial glow (gold core, amber,
   coral falloff) and a soft-edged sun disc sit in the saddle and are CLIPPED TO THE
   SKY ABOVE THE SKYLINE, so it reads as light coming from behind the mountains,
   with the sun half set into the valley — it never shows through the peaks. The
   clip is the outline closed off along the top edge. Nothing has a hard edge.

   THE LINE IS currentColor: ink on the cream header, paper on every dark surface,
   no per-placement colour logic. The light is fixed warm colour. The viewBox is
   96 x 46 (2.09:1); `height` is the argument callers care about. Stroke is 2.3
   user units below 30px tall and 2.0 above.

   `animate` adds what draw-and-glow needs: pathLength=1 on the line and a blurred
   gold duplicate behind it. The light group (`.piton-sun`) is what css/site.css
   raises out of the saddle. Without those hooks the mark is simply drawn with
   its light in place — also the reduced-motion and no-JavaScript state. Every mark
   needs its own gradient/clip ids (ids are document-wide), hence the counter and,
   for the markup pasted into the Foundations page, an explicit id suffix. */
const PITON_PATH = 'M9.0 41.3 C9.7 40.4 11.9 37.9 13.4 35.8 C14.9 33.7 16.3 31.2 17.8 28.9 C19.3 26.7 20.7 24.3 22.2 22.1 C23.7 19.9 25.1 18.0 26.6 15.9 C28.1 13.8 29.6 11.5 31.0 9.6 C32.4 7.8 33.6 4.4 35.1 5.0 C36.6 5.6 38.3 9.8 39.8 13.3 C41.3 16.9 42.9 23.2 44.2 26.1 C45.5 29.0 46.3 30.9 47.8 30.7 C49.3 30.4 51.4 26.8 53.0 24.8 C54.6 22.8 56.3 20.0 57.4 18.9 C58.5 17.7 59.0 17.9 59.8 17.9 C60.5 17.9 60.7 17.9 61.8 18.8 C62.9 19.6 64.7 21.6 66.2 23.1 C67.7 24.5 69.1 26.1 70.6 27.5 C72.1 29.0 73.5 30.4 75.0 31.9 C76.5 33.3 77.9 34.8 79.4 36.2 C80.9 37.7 82.7 39.4 83.8 40.4 C84.9 41.4 85.8 41.7 86.2 42.0';
const PITON_VALLEY = [47.8, 30.7];
const PITON_VIEWBOX = '0 0 96 46';
/* How far along the line (0..1, by length) the pen is at each feature. The signature-style
   animation in css/site.css is timed against these; tools/brand-test.js recomputes them
   from the path and fails if the CSS keyframes no longer agree. */
const PITON_WRITE = { gros: 0.351, valley: 0.58, petit: 0.72 };
/* The sky above the skyline: the outline, then along the top edge and back. */
const PITON_SKY = PITON_PATH + ' L96 42 L96 0 L0 0 L0 41.3 Z';

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
  <g clip-path="url(#${id('pc')})"><g class="piton-sun"><ellipse class="piton-aura" cx="${vx}" cy="${vy - 1.6}" rx="31" ry="26" fill="url(#${id('pa')})"/><circle class="piton-disc" cx="${vx}" cy="${vy - 0.4}" r="5.8" fill="url(#${id('ps')})"/></g></g>` : ''}${
    animate ? `
  <path class="piton-glow" d="${PITON_PATH}" pathLength="1" fill="none" stroke="#D9A03C" stroke-width="${stroke * 2.4}" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
  <path class="piton-line" d="${PITON_PATH}" pathLength="1" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

let pitonSeq = 0;
function pitonsMark({ height = 22, animate = false, breathe = false, sun = true, uid } = {}) {
  const width = Math.round(height * (96 / 46) * 10) / 10;
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
  ${pitonsMark({ height: 24 })}
  <span class="brand-words">
    <b>Discover Saint&nbsp;Lucia WELL</b>${context ? `<i>${esc(context)}</i>` : ''}
  </span>
</a>`;
}

/* Saint Lucia's real coordinates — "a real place you can go." */
function coordMark(text = '13°54′N  60°58′W') {
  return `<p class="coords">${esc(text)}</p>`;
}

module.exports = { esc, pitonsMark, pitonsMarkInner, PITON_PATH, PITON_SKY, PITON_VALLEY, PITON_VIEWBOX, PITON_WRITE, eclipseMark, wordmark, coordMark };
