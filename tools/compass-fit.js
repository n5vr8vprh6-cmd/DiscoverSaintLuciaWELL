/* ============================================================================
   compass-fit.js — does the WELL Compass fit inside its own viewBox?
   ----------------------------------------------------------------------------
     node tools/compass-fit.js          the table
     node tools/compass-fit.js --check  exit non-zero if a label escapes

   C-21: on a phone the compass ran off the side of the screen and took
   CELEBRATE with it. The cause was structural — the viewBox was the box the
   RING needs, while the labels are placed outside the ring by design, and
   `overflow: visible` let the difference spill off the page. On a wide screen
   it spilled harmlessly into the grid gap, which is why it survived this long.

   The fix computes the viewBox from the labels (lib/components.js). That makes
   the box depend on the label FONT SIZE, and this is where the fragility now
   lives: the size is a `font-size` attribute on each <text> precisely so one
   file owns both halves. A single `font-size` declaration in CSS would win
   over the attribute, decouple the box from the type, and put the word back
   off the screen — with no error anywhere, because nothing here can throw.

   So that is what this checks, and it is a real check: it reads the built
   pages and the stylesheet and refuses if the coupling has been broken.

   WHAT IT CANNOT DO IS MEASURE TEXT. Node has no font engine, so the widths
   below are the same estimate the component uses — self-consistent, not
   independent. The estimate was calibrated against getBBox() in a browser, and
   confirming it is a browser job. Paste the snippet this prints into DevTools
   on / and on a finished Finder result; that is the measurement, this is the
   guard that stops the measurement quietly going stale.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSS = path.join(ROOT, 'css', 'site.css');
const DIST = path.join(ROOT, 'dist');

const problems = [];
const note = (m) => problems.push(m);

/* ── 1 · the coupling: CSS must not set the label size ────────────────────── */
function checkCss() {
  const css = fs.readFileSync(CSS, 'utf8');
  /* Every rule whose selector mentions .compass-label, with its body. */
  const re = /([^{}]*\.compass-label[^{}]*)\{([^}]*)\}/g;
  let m, checked = 0;
  while ((m = re.exec(css))) {
    checked += 1;
    if (/(^|[;\s])font-size\s*:/.test(m[2])) {
      note('css/site.css sets font-size on `' + m[1].trim().replace(/\s+/g, ' ') + '`.\n'
        + '      CSS beats the font-size attribute, so the type would no longer match the\n'
        + '      viewBox computed from it — which is how CELEBRATE ran off the screen.\n'
        + '      Pass labelSize to compass() instead.');
    }
  }
  if (!checked) note('css/site.css has no .compass-label rule at all — the selector has been '
    + 'renamed, and this check is now watching nothing.');
  return checked;
}

/* ── 2 · the arithmetic: every label inside the box it was drawn with ─────── */
const CHAR = 0.84;   /* must match labelWidth() in lib/components.js */

function checkPage(file) {
  const html = fs.readFileSync(file, 'utf8');
  const svgs = html.match(/<svg viewBox="[^"]*" class="compass"[\s\S]*?<\/svg>/g) || [];
  return svgs.map((svg) => {
    const vb = svg.match(/viewBox="(-?[\d.]+) [\d.]+ ([\d.]+) [\d.]+"/);
    const x0 = parseFloat(vb[1]), w = parseFloat(vb[2]);
    const rows = [];
    const re = /<text x="(-?[\d.]+)"[^>]*text-anchor="(\w+)" font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g;
    let t;
    while ((t = re.exec(svg))) {
      const x = parseFloat(t[1]), anchor = t[2], fsz = parseFloat(t[3]), label = t[4];
      const lw = label.length * fsz * CHAR;
      const x1 = anchor === 'end' ? x - lw : anchor === 'start' ? x : x - lw / 2;
      const x2 = x1 + lw;
      rows.push({ label, fsz, x1, x2, left: x1 - x0, right: (x0 + w) - x2 });
      if (x1 < x0 || x2 > x0 + w) {
        note(path.relative(ROOT, file) + ': "' + label + '" is drawn outside the viewBox '
          + '(' + x1.toFixed(0) + '…' + x2.toFixed(0) + ' against ' + x0 + '…' + (x0 + w) + ').');
      }
    }
    if (!rows.length) note(path.relative(ROOT, file) + ': a compass with no font-size on its '
      + 'labels — the attribute has been dropped and CSS is sizing them again.');
    return { file: path.relative(ROOT, file), x0, w, rows };
  });
}

function pages() {
  const out = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html') && fs.readFileSync(p, 'utf8').includes('class="compass"')) out.push(p);
    });
  }(DIST));
  return out;
}

/* ── Report ───────────────────────────────────────────────────────────────── */
if (!fs.existsSync(DIST)) {
  console.error('\n  dist/ is missing — run `node build.js` first.\n');
  process.exit(2);
}

const rules = checkCss();
const found = pages();
if (!found.length) note('no built page contains a compass — dist/ is stale, or the component '
  + 'has stopped rendering, and everything below is vacuously fine.');

console.log('\n  THE WELL COMPASS · DOES IT FIT\n  ' + '─'.repeat(68));
console.log('  ' + rules + ' .compass-label rule(s) in css/site.css, none of them sizing type\n');

found.forEach((f) => checkPage(f).forEach((c) => {
  console.log('  ' + c.file + '   viewBox ' + c.x0 + ' … ' + (c.x0 + c.w)
    + '   labels at ' + (c.rows[0] ? c.rows[0].fsz : '?') + 'px');
  console.log('  ' + '─'.repeat(68));
  console.log('  LABEL          ESTIMATED SPAN        SLACK LEFT   SLACK RIGHT');
  c.rows.forEach((r) => {
    console.log('  ' + r.label.padEnd(14)
      + (r.x1.toFixed(0) + ' … ' + r.x2.toFixed(0)).padEnd(21)
      + r.left.toFixed(0).padStart(8) + r.right.toFixed(0).padStart(14));
  });
  console.log('');
}));

console.log('  The spans above are ESTIMATED — Node cannot lay out text. Measure the real\n'
  + '  thing in DevTools, on / and on a finished Finder result:\n');
console.log("    (()=>{const s=document.querySelector('.compass'),v=s.viewBox.baseVal;\n"
  + "     const b=[...s.querySelectorAll('.compass-label')].map(t=>[t.textContent,t.getBBox()]);\n"
  + "     return b.filter(([,r])=>r.x<v.x||r.x+r.width>v.x+v.width).map(([n])=>n)\n"
  + "       .concat('— empty array means every label is inside the box');})()\n");

if (problems.length) {
  console.log('  ' + '─'.repeat(68));
  console.log('  FAILED\n');
  problems.forEach((p) => console.log('    · ' + p));
  console.log('');
  if (process.argv.includes('--check')) process.exit(1);
} else if (process.argv.includes('--check')) {
  console.log('  ' + '─'.repeat(68));
  console.log('  OK — the size lives with the geometry, and every label is inside the box\n');
}
