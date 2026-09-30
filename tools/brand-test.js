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

ok('the home hero keeps concentric rings as decoration beside the coordinates (not the logo)',
   /class="hero-signature"[^>]*>\s*<svg class="hero-rings"/.test(by('/')) && !/class="ring-mark"/.test(by('/')));

ok('the hero mark performs once per session: seen flag in sessionStorage, finished state in CSS, closing invitation unaffected',
   /closest\('\.hero-mark'\)/.test(read('js/motion.js')) && /sessionStorage\.setItem\(SEEN/.test(read('js/motion.js'))
   && /piton-mark--seen\.is-drawn \.piton-sun \{ transition: none; \}/.test(read('css/site.css'))
   && !/hero-mark[^>]*>[\s\S]{0,40}piton-mark--seen/.test(by('/')));

ok('the consumer footer carries the four channel links, exact URLs, new tab, rel=noopener me, accessible names',
   ['https://www.linkedin.com/showcase/discoversaintluciawell', 'https://www.instagram.com/discoversaintluciawell/', 'https://www.facebook.com/discoversaintluciawell', 'https://wa.me/16478745565']
     .every((u) => by('/').includes('href="' + u + '" target="_blank" rel="noopener me" aria-label="')));
ok('the restrained conversion footers do not carry the channel row', !/footer-social/.test(by('/advisors/foundations')));

const withMark = pages.filter((p) => /class="piton-mark/.test(p.html) && !/\/404$/.test(p.url));
const home = by('/');
ok('every content page carries the Pitons mark', withMark.length >= pages.length - 3,
   'missing on: ' + pages.filter((p) => !withMark.includes(p)).map((p) => p.url).join(', '));

const header = (h) => h.slice(h.indexOf('<header'), h.indexOf('</header>'));
const footer = (h) => h.slice(h.indexOf('<footer'), h.indexOf('</footer>'));
ok('the header lockup has the mark, static (a mark that performs on every page is noise)',
   /class="piton-mark"[^>]*height="28"/.test(header(home)) && !/piton-mark--animate/.test(header(home)));
ok('the footer has the mark, static', /class="piton-mark"/.test(footer(home)) && !/piton-mark--animate/.test(footer(home)));
ok('the home hero signature is animated and breathes', /piton-mark piton-mark--animate piton-mark--breathe/.test(home));
ok('the closing invitation on /practitioners is animated (and does not breathe)',
   /class="piton-mark piton-mark--animate"/.test(by('/practitioners')));
const adv = by('/advisors/intro');
ok('a conversion-layout page has the mark in header and footer', /piton-mark/.test(header(adv)) && /piton-mark/.test(footer(adv)));
ok('the Eclipse mark is untouched (a separate identity)', /eclipse-mark/.test(by('/eclipse')));
ok('the Foundations hero mark is the Pitons mark, with its glow layer',
   /hero-journeyline[\s\S]{0,4000}piton-glow/.test(by('/advisors/foundations')));
ok('the line flows cream→teal (the sunrise carries the warmth) with round joins and caps — softened, not mitred',
   /class="piton-line"[^>]*stroke="url\(#pl-[^"]*\)"[^>]*stroke-linejoin="round" stroke-linecap="round"/.test(home)
   && /id="pl-[^"]*"[^>]*>[\s\S]{0,400}#FBF8F1[\s\S]{0,300}#00A6A8/.test(home)
   && !/piton-(gold|coral)/.test(home));
ok('the light is golden-hour glow (gold core, amber, coral falloff), not a dot',
   /class="piton-aura"[^>]*fill="url\(#pa-[\w-]+\)"/.test(home) && /class="piton-disc"[^>]*fill="url\(#ps-[\w-]+\)"/.test(home)
     && /<radialGradient[\s\S]{0,500}#FFD08A[\s\S]{0,300}#EF6A4A/.test(home)
     && !/<circle class="piton-[^"]*"[^>]*fill="#EF6A4A"/.test(home));   // (the WELL Compass legitimately has a coral circle)
ok('the light is clipped to the sky above the skyline, so it reads as behind the mountains',
   /<g clip-path="url\(#pc-[\w-]+\)"><g class="piton-sun">/.test(home) && /<clipPath id="pc-[\w-]+"><path d="M9\.0 41\.3[^"]* Z"\/>/.test(home));
ok('there is no halo ring any more (the sunrise replaced the circle motif)', !pages.some((pg) => /piton-halo/.test(pg.html)));
ok('gradient and clip ids are unique within every page (ids are document-wide; a clash would blank a mark)',
   pages.every((pg) => { const ids = (pg.html.match(/id="p[asc]-[\w-]+"/g) || []); return new Set(ids).size === ids.length; }));
ok('marks are decorative to assistive tech (the wordmark text names the brand)', !/piton-mark[^>]*role="img"/.test(home) && /class="piton-mark[^>]*aria-hidden="true"/.test(home));

/* ── 2 · one geometry ─────────────────────────────────────────────────── */
console.log('\n  One geometry');
const brand = require('../lib/brand.js');
const svg = brand.pitonsMark({ height: 24 });
const D = brand.PITON_PATH;
const svgFull = brand.pitonsMark({ height: 36, animate: true });
ok('lib/brand.js exports pitonsMark and no longer exports ringMark', typeof brand.pitonsMark === 'function' && brand.ringMark === undefined);
ok('the mark is 2.09:1 (width follows height)', /width="50\.1" height="24" viewBox="0 0 96 46"/.test(svg), svg.slice(0, 120));
ok('a mark with no animation has no glow-trail layer; an animated one has', !/piton-glow/.test(svg) && /piton-glow/.test(brand.pitonsMark({ animate: true })));
ok('the light can be dropped for the tiniest renderings', !/piton-sun/.test(brand.pitonsMark({ sun: false })));
ok('the icon generator gets the mark from lib/brand.js and holds no copy of the drawing',
   /pitonsMarkInner/.test(read('tools/build-brand-marks.py')) && !/PATH = '/.test(read('tools/build-brand-marks.py')));
ok('the share-image template holds no copy either (a placeholder, filled at build)', /\{\{MARK\}\}/.test(read('tools/brand/og.html')) && !/<path/.test(read('tools/brand/og.html')));
ok('the favicon is drawn from the same path', read('assets/favicon.svg').includes(`d="${D}"`));
ok('the Foundations favicon is the same file', read('assets/favicon.svg') === read('advisors/foundations/assets/favicon.svg'));
ok('the Foundations page\'s inline marks use the same path',
   (read('advisors/foundations/index.src.html').split(`class="piton-line" d="${D}"`).length - 1) === 3);

/* THE SHAPE IS THE REAL PITONS. These are the properties that make it them — and
   not a generic "M" — checked on the path itself. */
const nums = D.match(/-?\d+(\.\d+)?/g).map(Number);
const anchors = []; for (let i = 0; i < nums.length; i += 2) anchors.push([nums[i], nums[i + 1]]);
const pts = [anchors[0]]; for (let i = 1; i + 2 < anchors.length; i += 3) pts.push(anchors[i + 2]);   // M, then each C's end point
const [vx, vy] = brand.PITON_VALLEY;
const left = pts.filter((q) => q[0] < vx), right = pts.filter((q) => q[0] > vx);
const gros = left.reduce((m, q) => (q[1] < m[1] ? q : m)), petit = right.reduce((m, q) => (q[1] < m[1] ? q : m));
const foot = Math.max(...pts.map((q) => q[1]));
ok('the path is one smooth cubic curve: no straight segments, no hard corners', /^M[\d.]+ [\d.]+( C[\d. ]+)+$/.test(D) && !/[LHVZlhvzQ]/.test(D), D.slice(0, 60));
ok('Gros Piton (left) is the taller: its tip sits well above Petit\'s', petit[1] - gros[1] > 0.2 * (foot - gros[1]), `gros ${gros}, petit ${petit}`);
ok('Petit is roughly two-thirds the height of Gros (measured 0.67)', (() => { const r = (foot - petit[1]) / (foot - gros[1]); return r > 0.55 && r < 0.8; })());
ok('there is a deep saddle between them, well below Petit\'s tip', vy - petit[1] > 6 && Math.abs(vx - (gros[0] + petit[0]) / 2) < 8, `valley ${vx},${vy}`);
ok('Petit\'s right slope is gentler than Gros\'s right flank (the long slope to the sea)', (() => {
  const gr = pts.filter((q) => q[0] > gros[0] && q[0] < vx), pr = pts.filter((q) => q[0] > petit[0]);
  const slope = (a) => (a[a.length - 1][1] - a[0][1]) / (a[a.length - 1][0] - a[0][0]);
  return slope(pr) < 0.6 * slope(gr);
})());
ok('the light sits in the saddle, half set into the valley', (() => { const m = /class="piton-disc" cx="([\d.]+)" cy="([\d.]+)"/.exec(svgFull); return m && Math.abs(+m[1] - vx) < 0.5 && Math.abs(+m[2] - vy) < 1.5; })());

/* MAJESTY. The faithful profile measured about a third as tall as it is wide and
   read as flat; heights were stretched 1.4x. Pin that so nobody "corrects" it back. */
const markW = Math.max(...pts.map((q) => q[0])) - Math.min(...pts.map((q) => q[0]));
const markH = foot - gros[1];
ok('the mark is tall enough to feel like spires, not hills (height at least 45% of its width)', markH / markW > 0.45, `height ${markH.toFixed(1)} / width ${markW.toFixed(1)} = ${(markH / markW).toFixed(2)}`);
ok('Gros\'s right flank is steep (a spire, not a slope): steeper than 1.3', (() => {
  const a = pts.filter((q) => q[0] > gros[0] + 1 && q[0] < vx - 2); const dy = a[a.length - 1][1] - a[0][1], dx = a[a.length - 1][0] - a[0][0]; return dy / dx > 1.3;
})());

/* THE SIGNATURE. The line is written, not faded in: brisk strokes for the peaks, a
   lift at Petit's tip, then Petit's long right slope as a slow flourish. */
const segs = [...D.matchAll(/([MC])([^MC]+)/g)].map((m) => m[2].trim().split(/\s+/).map(Number));
const cub = (a, b, c, d, t) => [0, 1].map((i) => (1 - t) ** 3 * a[i] + 3 * (1 - t) ** 2 * t * b[i] + 3 * (1 - t) * t * t * c[i] + t ** 3 * d[i]);
const dense = [segs[0]]; let from = segs[0];
segs.slice(1).forEach((sg) => { for (let k = 1; k <= 50; k++) dense.push(cub(from, [sg[0], sg[1]], [sg[2], sg[3]], [sg[4], sg[5]], k / 50)); from = [sg[4], sg[5]]; });
const cum = [0]; for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
const fracAt = (pt) => { let bi = 0, bd = 1e9; dense.forEach((q, i) => { const d = Math.hypot(q[0] - pt[0], q[1] - pt[1]); if (d < bd) { bd = d; bi = i; } }); return cum[bi] / cum[cum.length - 1]; };
const W = brand.PITON_WRITE;
ok('PITON_WRITE matches the path: fractions at Gros, the saddle and Petit are within 0.01 of the drawing',
   Math.abs(fracAt(gros) - W.gros) < 0.01 && Math.abs(fracAt([vx, vy]) - W.valley) < 0.01 && Math.abs(fracAt(petit) - W.petit) < 0.01,
   `computed ${fracAt(gros).toFixed(3)} ${fracAt([vx, vy]).toFixed(3)} ${fracAt(petit).toFixed(3)} vs ${JSON.stringify(W)}`);
const kf = (file) => {
  const css = read(file).replace(/\r\n/g, '\n'); const i = css.indexOf('@keyframes piton-write'); if (i < 0) return null;
  const body = css.slice(i, css.indexOf('\n}', i));
  return [...body.matchAll(/(\d+)%\s*\{\s*stroke-dashoffset:\s*([\d.]+)/g)].map((m) => [+m[1] / 100, +m[2]]);
};
const frames = kf('css/site.css');
ok('the writing keyframes exist and land on the measured features (1 − fraction)', !!frames && [[W.gros], [W.valley], [W.petit]].every(([f]) => frames.some(([, o]) => Math.abs(o - (1 - f)) < 0.01)), JSON.stringify(frames));
ok('the Foundations page uses the same keyframes', JSON.stringify(kf('advisors/foundations/css/site.css')) === JSON.stringify(frames));
ok('the pen lifts a beat at Petit\'s tip (a hold between two keyframes at the same offset)', !!frames && frames.some((f, i) => i > 0 && f[1] === frames[i - 1][1] && f[1] > 0.1 && f[1] < 0.6));
ok('Petit\'s long slope is written SLOWER than the peaks (a flourish, not a rush)', (() => {
  if (!frames) return false;
  const hold = frames.findIndex((f, i) => i > 0 && f[1] === frames[i - 1][1] && f[1] > 0.1 && f[1] < 0.6);
  const speed = (a, b) => Math.abs(frames[b][1] - frames[a][1]) / (frames[b][0] - frames[a][0]);
  return speed(hold, frames.length - 1) < 0.65 * speed(0, hold - 1);
})());
ok('the animation is slow enough to read as handwriting (a few seconds, not a flick)', /piton-write 3\.8s linear/.test(read('css/site.css')));
ok('the light still rises as before (same translate + opacity), just timed to the slower pen',
   /is-drawn \.piton-sun \{\s*opacity: 1; translate: 0 0;\s*transition: opacity 1\.8s var\(--ease-out-quint\) 3\.5s, translate 2\.8s var\(--ease-out-expo\) 3\.5s/.test(read('css/site.css')));

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
   /body\[data-motion="ready"\] \.piton-mark--animate \.piton-sun \{ opacity: 0; translate: 0 7px; \}/.test(css));
ok('the un-drawn line is also transparent (a round cap would otherwise draw a dot)',
   /body\[data-motion="ready"\] \.piton-mark--animate \.piton-line \{ opacity: 0; \}/.test(css));
ok('the base rule leaves the glow invisible (a static mark has no halo)', /\.piton-mark \.piton-glow \{ opacity: 0; \}/.test(read('css/chrome.css')));
ok('the hero rings are still (no ping) and nothing pings anywhere else', !/sig-ping/.test(css) && !/cta-ping|cta-bump/.test(read('css/practitioners.css')));
ok('the Foundations page drops every animation under reduced motion (mark stays drawn)',
   /prefers-reduced-motion: reduce\)[\s\S]{0,400}animation: none !important/.test(read('advisors/foundations/css/site.css')));
ok('the narrow-phone header steps the mark down so the row still fits',
   /max-width: 420px[\s\S]{0,700}\.piton-mark \{ height: 22px/.test(read('css/chrome.css')) && /max-width: 360px[\s\S]{0,200}\.piton-mark \{ height: 20px/.test(read('css/chrome.css')));

console.log('\n  ' + '─'.repeat(62));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
