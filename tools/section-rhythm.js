/* ============================================================================
   section-rhythm.js — where does one section end and the next begin?
   ----------------------------------------------------------------------------
     node tools/section-rhythm.js

   Duncan read /eclipse as over-spaced. It is not: every .section on the site
   pads the same amount. What Eclipse alone has is EIGHT CONSECUTIVE SECTIONS IN
   ONE SKIN, so the padding has no colour change to mark and reads as a hole.

   That distinction is invisible when you look at one page, which is why this
   exists: it lists every page's skin run lengths, so "this page has nothing but
   section--eclipse" is a number rather than an impression. Run it before and
   after touching the spacing rule and the effect is a diff, not a claim.

   It reads dist/, so it describes what actually shipped rather than what the
   content modules intended.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const SKINS = ['eclipse', 'paper', 'sand', 'ink'];

function pages(dir, out = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) pages(p, out);
    else if (e.name === 'index.html') out.push(p);
  });
  return out;
}

/* Section skins in document order. A section with no section--* class (the
   final CTA is `section dark`) counts as its own skin, because visually it
   is one — it just does not use the token naming. */
function skinsOf(html) {
  const out = [];
  const re = /<section class="([^"]*\bsection\b[^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    const cls = m[1];
    const skin = SKINS.find((s) => cls.includes('section--' + s));
    out.push(skin || (cls.includes('dark') ? 'dark' : 'none'));
  }
  return out;
}

function runs(list) {
  const out = [];
  list.forEach((s) => {
    const last = out[out.length - 1];
    if (last && last.skin === s) last.n += 1;
    else out.push({ skin: s, n: 1 });
  });
  return out;
}

console.log('\n  SECTION RHYTHM · consecutive sections sharing one skin\n  ' + '─'.repeat(66));
console.log('  A run of 1 means the next section changes colour and the boundary shows.');
console.log('  A run of 2+ means that many boundaries have no colour change to mark.\n');

let doubled = 0, pagesTouched = 0;
pages(DIST).sort().forEach((file) => {
  const rel = '/' + path.relative(DIST, path.dirname(file)).replace(/\\/g, '/');
  const r = runs(skinsOf(fs.readFileSync(file, 'utf8')));
  if (!r.length) return;
  const same = r.reduce((n, x) => n + (x.n - 1), 0);
  if (same) { doubled += same; pagesTouched += 1; }
  console.log('  ' + (rel === '/.' ? '/' : rel).padEnd(26)
    + r.map((x) => x.skin + (x.n > 1 ? '×' + x.n : '')).join(' · ')
    + (same ? '   ← ' + same + ' same-skin boundar' + (same === 1 ? 'y' : 'ies') : ''));
});

console.log('\n  ' + doubled + ' same-skin boundaries across ' + pagesTouched
  + ' pages — these are the ones the padding rule tightens.\n');
