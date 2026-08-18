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

   The follow-up was subtler. Fitting each side of the box independently left
   the ring at 54.6% of the figure rather than 50%, because CELEBRATE reaches
   much further west than anything reaches east. Nothing clipped, nothing
   errored — the mark was simply off-centre, which on concentric circles is the
   kind of wrong you feel before you can name it. The box is symmetric now, and
   SYMMETRY IS CHECKED HERE rather than trusted.

   The fix computes the viewBox from the labels (lib/components.js). That makes
   the box depend on the label FONT SIZE, and this is where the fragility now
   lives: the size is a `font-size` attribute on each <text> precisely so one
   file owns both halves. A single `font-size` declaration in CSS would win
   over the attribute, decouple the box from the type, and put the word back
   off the screen — with no error anywhere, because nothing here can throw.

   So that is what this checks, and it is a real check: it reads the built
   pages and the stylesheet and refuses if the coupling has been broken.

   WHAT IT CANNOT DO IS MEASURE TEXT. Node has no font engine, so the widths
   below come from the same glyph table the component uses — self-consistent,
   not independent. That table is real browser metrics written down, and it is
   true only for Hanken Grotesk uppercase at letter-spacing 0.14em, so both of
   those are guarded below. Confirming the numbers themselves is a browser job:
   paste the snippet this prints into DevTools, on / and on a finished Finder
   result. That is the measurement; this is the guard that stops it going
   quietly stale.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSS = path.join(ROOT, 'css', 'site.css');
const DIST = path.join(ROOT, 'dist');

const problems = [];
const note = (m) => problems.push(m);

const SPACING = '0.14em';   /* what the glyph table was measured at */
let spacingSeen = false;

/* ── 1 · the couplings: CSS must own neither the label size nor its spacing ── */
function checkCss() {
  const css = fs.readFileSync(CSS, 'utf8');
  /* Every rule whose selector mentions .compass-label, with its body. */
  const re = /([^{}]*\.compass-label[^{}]*)\{([^}]*)\}/g;
  let m, checked = 0;
  while ((m = re.exec(css))) {
    checked += 1;
    /* The capture reaches back past any preceding comment, so trim to the
       selector itself before quoting it — a guard whose message is mostly
       somebody else's paragraph is a guard people learn to skim. */
    const sel = m[1].replace(/[\s\S]*\*\//, '').trim().replace(/\s+/g, ' ');
    if (/(^|[;\s])font-size\s*:/.test(m[2])) {
      note('css/site.css sets font-size on `' + sel + '`.\n'
        + '      CSS beats the font-size attribute, so the type would no longer match the\n'
        + '      viewBox computed from it — which is how CELEBRATE ran off the screen.\n'
        + '      Pass labelSize to compass() instead.');
    }
    /* Every entry in the glyph table has letter-spacing baked in, because that
       is how the browser reported it. Change the spacing and every width is
       wrong by 0.14em per character — silently, in the direction that clips. */
    const ls = /(^|[;\s])letter-spacing\s*:\s*([^;]+)/.exec(m[2]);
    if (ls) {
      spacingSeen = true;
      if (ls[2].trim() !== SPACING) {
        note('css/site.css sets letter-spacing: ' + ls[2].trim() + ' on `'
          + sel + '`, but the glyph table in\n'
          + '      lib/components.js was measured at ' + SPACING + ', with the spacing baked\n'
          + '      into every entry. Regenerate the table — the recipe is in the comment\n'
          + '      beside it — or put the spacing back.');
      }
    }
  }
  if (!checked) note('css/site.css has no .compass-label rule at all — the selector has been '
    + 'renamed, and this check is now watching nothing.');
  if (!spacingSeen) note('no letter-spacing is declared on .compass-label, but the glyph table '
    + 'assumes ' + SPACING + ' and would now over-measure every label.');
  return checked;
}

/* ── 2 · the arithmetic: centred, and every label inside its own box ──────── */
/* Must match GLYPH in lib/components.js. Duplicated rather than imported: a
   checker that imports the thing it checks agrees with it by construction, and
   would go on agreeing while the component drifted. */
const GLYPH = {
  A: 0.777, B: 0.741, C: 0.844, D: 0.822, E: 0.725, F: 0.705, G: 0.871,
  H: 0.818, I: 0.386, J: 0.692, K: 0.774, L: 0.635, M: 0.979, N: 0.816,
  O: 0.888, P: 0.694, Q: 0.914, R: 0.733, S: 0.704, T: 0.727, U: 0.796,
  V: 0.796, W: 1.097, X: 0.781, Y: 0.742, Z: 0.722
};
const WIDEST = Math.max(...Object.values(GLYPH));
const CX = 310, CY = 310, R_TICK_OUT = 190;   /* the ring's centre; where ticks end */
const width = (label, fsz) => label.toUpperCase().split('')
  .reduce((n, c) => n + (GLYPH[c] === undefined ? WIDEST : GLYPH[c]), 0) * fsz;

function checkPage(file) {
  const html = fs.readFileSync(file, 'utf8');
  const svgs = html.match(/<svg viewBox="[^"]*" class="compass"[\s\S]*?<\/svg>/g) || [];
  return svgs.map((svg) => {
    const vb = svg.match(/viewBox="(-?[\d.]+) [\d.]+ ([\d.]+) [\d.]+"/);
    const x0 = parseFloat(vb[1]), w = parseFloat(vb[2]);
    const rows = [];
    const re = /<text x="(-?[\d.]+)" y="(-?[\d.]+)" text-anchor="(\w+)" font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g;
    let t;
    while ((t = re.exec(svg))) {
      const x = parseFloat(t[1]), y = parseFloat(t[2]);
      const anchor = t[3], fsz = parseFloat(t[4]), label = t[5];
      const lw = width(label, fsz);
      const x1 = anchor === 'end' ? x - lw : anchor === 'start' ? x : x - lw / 2;
      const x2 = x1 + lw;
      rows.push({ label, fsz, x1, x2, left: x1 - x0, right: (x0 + w) - x2 });
      if (x1 < x0 || x2 > x0 + w) {
        note(path.relative(ROOT, file) + ': "' + label + '" is drawn outside the viewBox '
          + '(' + x1.toFixed(0) + '…' + x2.toFixed(0) + ' against ' + x0 + '…' + (x0 + w) + ').');
      }
      /* A word sitting on its own tick reads as a collision, not a diagram.
         Measured RADIALLY, from the anchor point — which is the label's inner
         edge whichever way it is anchored, since every label reads outward
         from the ring. A first draft of this compared horizontal distance and
         failed all four diagonals, whose x-offset is 150 while their actual
         distance from the centre is 212. */
      const inner = Math.hypot(x - CX, y - CY);
      if (inner < R_TICK_OUT) {
        note(path.relative(ROOT, file) + ': "' + label + '" is anchored ' + inner.toFixed(0)
          + ' from the centre, inside the end of its own tick at ' + R_TICK_OUT + '.');
      }
    }
    if (!rows.length) note(path.relative(ROOT, file) + ': a compass with no font-size on its '
      + 'labels — the attribute has been dropped and CSS is sizing them again.');

    /* The point of this file's second half: everything can fit and still read
       wrong if the ring is not in the middle of what contains it. */
    const off = Math.abs((CX - x0) - ((x0 + w) - CX));
    if (off > 1) {
      note(path.relative(ROOT, file) + ': the ring sits ' + off.toFixed(0)
        + ' units off centre in its own viewBox (' + (CX - x0).toFixed(0) + ' left, '
        + ((x0 + w) - CX).toFixed(0) + ' right).\n'
        + '      Concentric circles in a lopsided box is the fault Duncan caught by eye.');
    }
    return { file: path.relative(ROOT, file), x0, w, rows, off };
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
    + '   labels at ' + (c.rows[0] ? c.rows[0].fsz : '?') + 'px   ring '
    + (c.off <= 1 ? 'centred' : c.off.toFixed(0) + ' OFF CENTRE'));
  console.log('  ' + '─'.repeat(68));
  console.log('  LABEL          ESTIMATED SPAN        SLACK LEFT   SLACK RIGHT');
  c.rows.forEach((r) => {
    console.log('  ' + r.label.padEnd(14)
      + (r.x1.toFixed(0) + ' … ' + r.x2.toFixed(0)).padEnd(21)
      + r.left.toFixed(0).padStart(8) + r.right.toFixed(0).padStart(14));
  });
  console.log('');
}));

console.log('  The spans above come from the glyph table, so they are self-consistent\n'
  + '  rather than independent. Confirm the table against the real font in DevTools,\n'
  + '  on / and on a finished Finder result — every real width must be equal to or\n'
  + '  a little under its estimate above, never over:\n');
console.log("    (()=>[...document.querySelectorAll('.compass-label')]\n"
  + "       .map(t=>t.textContent+' '+t.getComputedTextLength().toFixed(1)))()\n");

if (problems.length) {
  console.log('  ' + '─'.repeat(68));
  console.log('  FAILED\n');
  problems.forEach((p) => console.log('    · ' + p));
  console.log('');
  if (process.argv.includes('--check')) process.exit(1);
} else if (process.argv.includes('--check')) {
  console.log('  ' + '─'.repeat(68));
  console.log('  OK — ring centred, size living with the geometry, every label inside\n'
    + '       the box and clear of its tick\n');
}
