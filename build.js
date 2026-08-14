/* ============================================================================
   build.js — compose content + layouts into a deployable static site
   ----------------------------------------------------------------------------
   Run:  node build.js            → dist/
         node build.js --clean    → wipe dist/ first

   Output is plain static HTML with clean URLs (dir/index.html). No runtime
   dependency on this build: any static host serves dist/ as-is.

   Edit source, never dist/ — the same rule the brochure follows.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const SITE = require('./content/site.js');
const { render } = require('./lib/page.js');
const { renderSections } = require('./lib/components.js');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

/* ── The page registry ────────────────────────────────────────────────────
   Add a page here and it builds. Each module declares its own `layout`;
   nothing in this file infers chrome from the path.                        */
const PAGES = [
  require('./content/home.js'),
  require('./content/journey.js'),
  require('./content/explore.js'),
  require('./content/eclipse.js'),
  require('./content/about.js'),
  require('./content/advisors.js'),
  require('./content/advisor-hub.js'),
  require('./content/advisor-intro.js'),
  require('./content/advisor-immersion.js'),
  require('./content/advisor-foundations.js'),
  require('./content/privacy.js'),
  require('./content/terms.js'),
  require('./content/accessibility.js')
];

/* ── fs helpers ─────────────────────────────────────────────────────────── */
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  mkdirp(to);
  let n = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) { n += copyDir(src, dst); }
    else { fs.copyFileSync(src, dst); n++; }
  }
  return n;
}

function outPathFor(routePath) {
  return routePath === '/'
    ? path.join(DIST, 'index.html')
    : path.join(DIST, routePath.replace(/^\//, ''), 'index.html');
}

/* ── Build one page ─────────────────────────────────────────────────────── */
function buildPage(page) {
  /* A page may supply pre-rendered markup instead of a section list. Only
     Foundations does: its body is lifted verbatim from the existing hand-built
     page so its scroll choreography survives the move intact. */
  let body = page.rawBody !== undefined ? page.rawBody : renderSections(page.sections);

  /* Finder data travels to the client as JSON rather than being inlined into
     a script — keeps the payload inspectable and the logic in one file. */
  if (page.finderData) {
    body += `\n<script type="application/json" id="finder-data">${
      JSON.stringify(page.finderData).replace(/</g, '\\u003c')
    }</script>`;
  }

  const html = render(page, body);

  /* THE LITERAL STRING "undefined" MUST NEVER REACH A PAGE.
     A renderer reading a field a page did not supply produces `esc(undefined)`
     → the word "undefined", rendered at full size and full confidence. It
     shipped once from the pathway renderer and looked exactly like design until
     someone read it. Cheap to catch here, and it fails the build rather than
     the reader.

     It matches text between tags only, so an attribute value like
     data-x="undefined" is ignored. It does NOT distinguish a stray token from
     the word used deliberately in copy — if a page ever needs to say
     "undefined" in a sentence, this will stop the build and the sentence should
     be rephrased. That trade is worth it: the word appears in prose roughly
     never, and appears as a bug more than once. */
  const stray = html.match(/>[^<]*\bundefined\b[^<]*</i);
  if (stray) {
    throw new Error(
      `Page "${page.path}" renders the literal string "undefined":\n` +
      `  …${stray[0].slice(0, 120).replace(/\s+/g, ' ')}…\n` +
      '  A section is reading a field it was not given.'
    );
  }

  const out = outPathFor(page.path);
  mkdirp(path.dirname(out));
  fs.writeFileSync(out, html, 'utf8');
  return { out, bytes: Buffer.byteLength(html) };
}

/* ── Redirect stub ────────────────────────────────────────────────────────
   Brief §2 allows /foundations as a short link, but the canonical URL must
   preserve the advisor hierarchy. Meta-refresh + canonical + a real visible
   link, so it works on a dumb static host and for a visitor with no JS.    */
function buildRedirect(from, to) {
  const url = SITE.domain + to;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Redirecting to ${to}</title>
<link rel="canonical" href="${url}">
<meta name="robots" content="noindex,follow">
<meta http-equiv="refresh" content="0; url=${to}">
</head>
<body>
<p>This page has moved to <a href="${to}">${url}</a>.</p>
</body>
</html>
`;
  const out = outPathFor(from);
  mkdirp(path.dirname(out));
  fs.writeFileSync(out, html, 'utf8');
  return out;
}

function buildSitemap(pages) {
  const urls = pages
    .filter((p) => !p.noindex)
    .map((p) => `  <url><loc>${SITE.domain}${p.path === '/' ? '/' : p.path}</loc></url>`)
    .join('\n');
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`, 'utf8');

  fs.writeFileSync(path.join(DIST, 'robots.txt'),
`User-agent: *
Allow: /

Sitemap: ${SITE.domain}/sitemap.xml
`, 'utf8');
}

/* ── Run ────────────────────────────────────────────────────────────────── */
function main() {
  if (process.argv.includes('--clean') && fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
  }
  mkdirp(DIST);

  /* Guard the one rule the brief is most explicit about. A typo'd layout
     should fail the build, not silently ship a page with the wrong chrome. */
  const VALID = ['destination', 'professional', 'conversion'];
  for (const p of PAGES) {
    if (!VALID.includes(p.layout)) {
      console.error(`✗ ${p.path} declares layout "${p.layout}" (expected ${VALID.join(' | ')})`);
      process.exit(1);
    }
  }

  console.log('Discover Saint Lucia WELL — build\n');

  let total = 0;
  for (const page of PAGES) {
    const { out, bytes } = buildPage(page);
    total += bytes;
    const rel = path.relative(ROOT, out).replace(/\\/g, '/');
    console.log(`  ${page.layout.padEnd(12)} ${page.path.padEnd(22)} → ${rel}  (${Math.round(bytes / 1024)} KB)`);
  }

  const css = copyDir(path.join(ROOT, 'css'), path.join(DIST, 'css'));
  const js = copyDir(path.join(ROOT, 'js'), path.join(DIST, 'js'));
  const assets = copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));

  /* Foundations keeps its own css/js/assets alongside its page, so its many
     relative references (assets/hero-pitons.jpg and friends) resolve without
     rewriting a 1,000-line document. index.src.html is the SOURCE for the page
     body and must not be published. */
  const fnd = ['css', 'js', 'assets'].reduce((n, dir) => n + copyDir(
    path.join(ROOT, 'advisors', 'foundations', dir),
    path.join(DIST, 'advisors', 'foundations', dir)), 0);

  buildRedirect('/foundations', '/advisors/foundations');
  buildSitemap(PAGES);

  console.log(`\n  css ${css} · js ${js} · assets ${assets} files copied`);
  console.log(`  ${PAGES.length} pages, ${Math.round(total / 1024)} KB HTML → dist/\n`);
}

main();
