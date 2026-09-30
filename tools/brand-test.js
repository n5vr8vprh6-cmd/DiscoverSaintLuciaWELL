/* ============================================================================
   brand-test.js — the Pitons mark: where it is, what it is made of, what it does
   ----------------------------------------------------------------------------
     node build.js && node tools/brand-test.js

   Reads the BUILT site (dist/), because "the ring is gone everywhere" is a claim
   about output, not about source. Four things worth pinning:

     1. THE RING IS GONE from every page's logo slots, and the Pitons mark is in
        the header, the footer and — animated — the hero and closing invitation.
     2. THE GEOMETRY HAS ONE SOURCE. The mark is drawn in five places (brand.js,
        the favicon SVG, the share-image template, the icon generator, the
        Foundations page's inline copies). They must be the same five points.
     3. THE ASSETS EXIST at the sizes the <head> promises, and the head links them.
     4. REDUCED MOTION IS COMPLETE. The hidden-until-drawn state may exist only
        under body[data-motion="ready"], so a visitor with no script, no motion
        gate or a reduced-motion setting sees the finished mark, not a blank.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

let pass = 0, fail = 0;
function ok(what, cond, detail) {
  if (cond) { pass += 1; console.log('  ✓ ' + what); }
  else { fail += 1; console.log('  ✗ ' + what + (detail ? '\n      ' + detail : '')); }
}
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/ is empty — run `node build.js` first.');
  process.exit(1);
}

/* Every built HTML page. */
function walk(dir, out = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'index.html') out.push(p);
  });
  return out;
}
const pages = walk(DIST).map((p) => ({ url: '/' + path.relative(DIST, path.dirname(p)).replace(/\\/g, '/'), html: fs.readFileSync(p, 'utf8') }))
  /* Not redirect stubs, and not dev-only previews (dist/_hub-preview is written by
     tools/hub-preview.js and is never deployed as part of the site). */
  .filter((p) => !/Redirecting to/.test(p.html) && !p.url.startsWith('/_'));
const by = (u) => (pages.find((p) => p.url === u) || {}).html || '';

/* PNG and JPEG dimensions without a dependency. */
function pngSize(f) { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
function jpgSize(f) {
  const b = fs.readFileSync(f); let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xFF) { i += 1; continue; }
    const m = b[i + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

console.log('\n  THE PITONS MARK\n  ' + '─'.repeat(62));

/* ── 1 · the ring is gone, the mark is in ─────────────────────────────── */
console.log('\n  Placement');
ok(`${pages.length} built pages scanned`, pages.length >= 14);
const ringLeft = pages.filter((p) => /class="ring-mark"/.test(p.html));
ok('no page still renders the concentric ring as its logo', ringLeft.length === 0, ringLeft.map((p) => p.url).join(', '));
ok('no page still carries the ring mark\'s three-circle markup (teal r=11.5, gold r=7)',
   !pages.some((p) => /r="11\.5"[^>]*stroke="#00A6A8"[\s\S]{0,200}r="7"[^>]*stroke="#D9A03C"/.test(p.html)));

const withMark = pages.filter((p) => /class="piton-mark/.test(p.html) && !/\/404$/.test(p.url));
const home = by('/');
ok('every content page carries the Pitons mark', withMark.length >= pages.length - 3,
   'missing on: ' + pages.filter((p) => !withMark.includes(p)).map((p) => p.url).join(', '));

const header = (h) => h.slice(h.indexOf('<header'), h.indexOf('</header>'));
const footer = (h) => h.slice(h.indexOf('<footer'), h.indexOf('</footer>'));
ok('the header lockup has the mark, static (a mark that performs on every page is noise)',
   /class="piton-mark"[^>]*height="22"/.test(header(home)) && !/piton-mark--animate/.test(header(home)));
ok('the footer has the mark, static', /class="piton-mark"/.test(footer(home)) && !/piton-mark--animate/.test(footer(home)));
ok('the home hero signature is animated and breathes', /piton-mark piton-mark--animate piton-mark--breathe/.test(home));
ok('the closing invitation on /practitioners is animated (and does not breathe)',
   /class="piton-mark piton-mark--animate"/.test(by('/practitioners')));
const adv = by('/advisors/intro');
ok('a conversion-layout page has the mark in header and footer', /piton-mark/.test(header(adv)) && /piton-mark/.test(footer(adv)));
ok('the Eclipse mark is untouched (a separate identity)', /eclipse-mark/.test(by('/eclipse')));
ok('the Foundations hero mark is the Pitons mark, with its glow layer',
   /hero-journeyline[\s\S]{0,1400}piton-glow/.test(by('/advisors/foundations')));
ok('the line is currentColor (so it is right on any surface) with round joins and caps — softened, not mitred',
   /class="piton-line"[^>]*stroke="currentColor"[^>]*stroke-linejoin="round" stroke-linecap="round"/.test(home));
ok('the sun is a soft glow (radial gradient, coral core), NOT a hard dot',
   /class="piton-sun"[^>]*fill="url\(#piton-sun-\d+\)"/.test(home) && /<radialGradient[\s\S]{0,400}#EF6A4A/.test(home)
     && !/<circle class="piton-sun"[^>]*fill="#EF6A4A"/.test(home));
ok('gradient ids are unique within every page (ids are document-wide; a clash would blank a mark)',
   pages.every((pg) => { const ids = (pg.html.match(/id="piton-sun-[\w-]+"/g) || []); return new Set(ids).size === ids.length; }));
ok('the halo ring is on the large marks and not on the header (a hairline at 22px is noise)',
   /class="piton-halo"/.test(home.slice(home.indexOf('hero-signature'))) && !/piton-halo/.test(header(home)));
ok('marks are decorative to assistive tech (the wordmark text names the brand)', !/piton-mark[^>]*role="img"/.test(home) && /class="piton-mark[^>]*aria-hidden="true"/.test(home));

/* ── 2 · one geometry ─────────────────────────────────────────────────── */
console.log('\n  One geometry');
const brand = require('../lib/brand.js');
const svg = brand.pitonsMark({ height: 22 });
const D = brand.PITON_PATH;
ok('lib/brand.js exports pitonsMark and no longer exports ringMark', typeof brand.pitonsMark === 'function' && brand.ringMark === undefined);
ok('the mark is 2.3:1 (width follows height)', /width="50\.6" height="22" viewBox="0 0 92 40"/.test(svg), svg.slice(0, 120));
ok('a mark with no animation has no glow layer; an animated one has', !/piton-glow/.test(svg) && /piton-glow/.test(brand.pitonsMark({ animate: true })));
ok('sun can be dropped for tiny sizes', !/piton-sun/.test(brand.pitonsMark({ sun: false })));
ok('the icon generator uses the same path', read('tools/build-brand-marks.py').includes(`PATH = '${D}'`));
ok('the share-image template uses the same path', read('tools/brand/og.html').includes(`d="${D}"`));
ok('the favicon uses the same path', read('assets/favicon.svg').includes(`d="${D}"`));
ok('the Foundations favicon is the same file', read('assets/favicon.svg') === read('advisors/foundations/assets/favicon.svg'));
ok('the Foundations page\'s inline marks use the same path',
   (read('advisors/foundations/index.src.html').split(`class="piton-line" d="${D}"`).length - 1) === 3);
ok('the path is soft: rounded tips and valley (three quadratic curves), no hard straight segments',
   /^M3 37 /.test(D) && / 89 37$/.test(D) && (D.match(/Q/g) || []).length === 3 && !/[LHVZlhvz]/.test(D), D);
ok('the peaks are where the supplied artwork puts them (tips near x 30 and 65, valley near x 46)',
   (() => { const q = D.match(/Q(\S+) (\S+) (\S+) (\S+)/g).map((m) => m.slice(1).split(' ').map(Number)); return Math.abs(q[0][0] - 30) < 1.5 && Math.abs(q[1][0] - 46) < 1.5 && Math.abs(q[2][0] - 65) < 1.5; })(), D);

/* ── 3 · assets and the head ──────────────────────────────────────────── */
console.log('\n  Assets and <head>');
const dim = (rel, fn) => { try { return fn(path.join(ROOT, rel)); } catch (e) { return null; } };
ok('favicon-32.png is 32×32', String(dim('assets/favicon-32.png', pngSize)) === '32,32');
ok('apple-touch-icon.png is 180×180', String(dim('assets/apple-touch-icon.png', pngSize)) === '180,180');
ok('icon-192.png is 192×192', String(dim('assets/icon-192.png', pngSize)) === '192,192');
ok('og-default.jpg is 1200×630', String(dim('assets/og-default.jpg', jpgSize)) === '1200,630');
ok('the head links the SVG favicon, the PNG fallback and the apple-touch icon',
   /rel="icon" type="image\/svg\+xml" href="\/assets\/favicon\.svg"/.test(home)
     && /rel="icon" type="image\/png" sizes="32x32" href="\/assets\/favicon-32\.png"/.test(home)
     && /rel="apple-touch-icon" href="\/assets\/apple-touch-icon\.png"/.test(home));
ok('every linked icon file exists in dist/', ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'og-default.jpg']
   .every((f) => fs.existsSync(path.join(DIST, 'assets', f))));

/* ── 4 · reduced motion is complete ───────────────────────────────────── */
console.log('\n  Reduced motion and no-script');
const css = read('css/site.css').replace(/\r\n/g, '\n');
const hiders = css.split('\n').map((l, i) => [l, i]).filter(([l]) => /stroke-dashoffset:\s*1\b/.test(l));
ok('the hidden-until-drawn state exists only under body[data-motion="ready"]',
   hiders.length > 0 && hiders.every(([, i]) => /data-motion="ready"/.test(css.split('\n').slice(Math.max(0, i - 3), i + 1).join('\n'))),
   hiders.map(([l]) => l.trim()).join(' | '));
ok('the sun\'s hidden state is gated the same way',
   /body\[data-motion="ready"\] \.piton-mark--animate \.piton-sun \{\s*opacity: 0;/.test(css));
ok('the un-drawn line is also transparent (a round cap would otherwise draw a dot)',
   /body\[data-motion="ready"\] \.piton-mark--animate \.piton-line \{ opacity: 0; \}/.test(css));
ok('the base rule leaves the glow invisible (a static mark has no halo)', /\.piton-mark \.piton-glow \{ opacity: 0; \}/.test(read('css/chrome.css')));
ok('the ring\'s sonar-ping animation is gone', !/sig-ping/.test(css) && !/cta-ping|cta-bump/.test(read('css/practitioners.css')));
ok('the Foundations page drops every animation under reduced motion (mark stays drawn)',
   /prefers-reduced-motion: reduce\)[\s\S]{0,400}animation: none !important/.test(read('advisors/foundations/css/site.css')));
ok('the narrow-phone header steps the mark down so the row still fits',
   /max-width: 420px[\s\S]{0,700}\.piton-mark \{ height: 18px/.test(read('css/chrome.css')) && /max-width: 360px[\s\S]{0,200}\.piton-mark \{ height: 16px/.test(read('css/chrome.css')));

console.log('\n  ' + '─'.repeat(62));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
