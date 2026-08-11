/* ============================================================================
   BRAND PRIMITIVES — the marks that carry identity across every layout
   ----------------------------------------------------------------------------
   The V4 brief allows a page to drop the global navigation entirely. What keeps
   such a page unmistakably part of the brand is this file plus css/tokens.css:
   the concentric ring, the gold journey line, the coordinates.

   Ring mark colours are hard-coded rather than tokenized on purpose. This is
   the ONE place full-saturation deck teal/gold/coral is allowed — the rule
   carried over from the printed edition. Tokenizing them would invite reuse.
   ========================================================================== */
'use strict';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* The concentric ring: outer teal, middle gold, inner coral. */
function ringMark(size = 26, stroke = 1.6) {
  return `<svg class="ring-mark" width="${size}" height="${size}" viewBox="0 0 26 26" aria-hidden="true" focusable="false">
  <circle cx="13" cy="13" r="11.5" fill="none" stroke="#00A6A8" stroke-width="${stroke}"/>
  <circle cx="13" cy="13" r="7" fill="none" stroke="#D9A03C" stroke-width="${stroke}"/>
  <circle cx="13" cy="13" r="2.6" fill="#EF6A4A"/>
</svg>`;
}

/* Wordmark lockup. `context` adds the professional qualifier the brief
   specifies for advisor conversion pages ("… · Professional Education"). */
function wordmark({ href = '/', context = '', label = 'Discover Saint Lucia WELL — home' } = {}) {
  return `<a class="brand-lockup" href="${esc(href)}" aria-label="${esc(label)}">
  ${ringMark(26)}
  <span class="brand-words">
    <b>Discover Saint&nbsp;Lucia WELL</b>${context ? `<i>${esc(context)}</i>` : ''}
  </span>
</a>`;
}

/* Saint Lucia's real coordinates — "a real place you can go." */
function coordMark(text = '13°54′N  60°58′W') {
  return `<p class="coords">${esc(text)}</p>`;
}

module.exports = { esc, ringMark, wordmark, coordMark };
