/* ============================================================================
   WALKTHROUGH TEST — the cosmetic pass after the first full walk of the live site
   ----------------------------------------------------------------------------
   Reads the BUILT site (dist/). Pins:
     · sentence lines (lib/page.js sentenceLines) — applied where intended, and
       NOT applied to long passages or to pages that don't load site.css
     · the property photo lightbox — triggers, JSON island, script, dialog CSS,
       progressive fallback
     · the Journey Finder result CTA wording, and that the consent copy still
       names the thing the visitor is agreeing to
   Run `node build.js` first.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); }
};
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const page = (u) => {
  const f = path.join(DIST, u === '/' ? 'index.html' : u.replace(/^\//, '') + '/index.html');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
};

console.log('\n  WALKTHROUGH COSMETICS');
console.log('  ' + '─'.repeat(62));

/* ── Sentence lines ───────────────────────────────────────────────────── */
console.log('\n  Sentence lines');
const explore = page('/explore');
const eclipse = page('/eclipse');
const hub = page('/advisors/hub');
const sentences = (html, startsWith) => {
  const i = html.indexOf(startsWith);
  if (i < 0) return [];
  const open = html.lastIndexOf('<', i);
  const tag = html.slice(open, html.indexOf('</p>', i)).match(/<span class="s">[\s\S]*$/);
  return tag ? (tag[0].match(/<span class="s">/g) || []) : [];
};
ok('the explore lead breaks into three sentence lines',
   (explore.match(/<p class="lines lead"><span class="s">A property may belong to more than one village\.<\/span> <span class="s">An experience may connect several\.<\/span> <span class="s">Together they reveal/g) || []).length === 1);
ok('"You don’t visit the wellness. You move through it." is two lines',
   /<h2 id="campus-title"><span class="s">You don’t visit the wellness\.<\/span> <span class="s">You move through it\.<\/span><\/h2>/.test(explore));
ok('a one-sentence pull quote with a dash breaks after the dash',
   /<p class="lines pullquote"><span class="s">What Saint(?:&nbsp;| | )Lucia(?:&nbsp;| | )WELL adds is sequence —<\/span> <span class="s">the order things happen in/.test(explore));
ok('the Eclipse "Rainforest before…" quote is four lines, one per sentence', sentences(eclipse, 'Rainforest before deeper reflection.').length === 4);
ok('"The recovery journey is curated. The travel experience remains personal." is two lines',
   /pullquote pullquote--center"><span class="s">The recovery journey is curated\.<\/span> <span class="s">The travel experience remains personal\.<\/span>/.test(eclipse));
ok('the advisor Hub caveat (a long footnote) breaks by sentence, the long one wrapping balanced inside its line',
   /<p class="lines section-footnote"><span class="s">One honest caveat: you get the Hub[^<]*<\/span> <span class="s">It is a short conversation, not a queue\.<\/span>/.test(hub));
ok('the footnotes on Eclipse break by sentence',
   sentences(eclipse, 'Illustrative only.').length === 2 && sentences(eclipse, 'Experiences are sequenced to the arc').length === 2);
ok('a LONG lead is left as a paragraph (a long sentence among short ones is not a line)',
   !/class="lines lead"><span class="s">Not by region/.test(explore) && /<p class="lead">Not by region/.test(explore));
ok('the copy is unchanged: spans are separated by real spaces, so text reads the same',
   explore.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').includes('A property may belong to more than one village. An experience may connect several. Together they reveal'));
ok('site.css gives a sentence its own line and balances the short passages',
   /\.lines \.s \{ display: block; text-wrap: balance; \}/.test(read('css/site.css'))
   && /\.lead, \.section-footnote, \.cta-note, \.pullquote \{ text-wrap: balance; \}/.test(read('css/site.css')));

/* ── Village photograph to copy spacing ───────────────────────────────── */
console.log('\n  Spacing');
ok('the wide village bands leave room between photograph and copy (was 40px at desktop)',
   /\.village-block--wide \{[^}]*gap: clamp\(2\.5rem, 4\.5vw, 4\.5rem\)/.test(read('css/site.css')));

/* ── Lightbox ─────────────────────────────────────────────────────────── */
console.log('\n  Property photo lightbox');
const triggers = [...explore.matchAll(/<a class="prop-open" href="([^"]+)" data-gallery="([^"]+)"/g)];
const island = (explore.match(/<script type="application\/json" id="prop-gallery-data">([\s\S]*?)<\/script>/) || [])[1];
let data = null; try { data = JSON.parse(island); } catch (e) { /* fails below */ }
ok('every property with more than one photograph has a trigger (14 of the 15)', triggers.length === 14, 'found ' + triggers.length);
ok('the JSON island parses and has exactly the triggers\' keys',
   !!data && JSON.stringify(Object.keys(data).sort()) === JSON.stringify(triggers.map((t) => t[2]).sort()));
ok('each gallery carries its frames with kind, base, widths and alt',
   !!data && Object.values(data).every((g) => g.name && g.images.length > 1 && g.images.every((i) => i.kind && i.base && i.widths.length && typeof i.alt === 'string')));
ok('the trigger is a real link to the hero image (no-JavaScript fallback)', triggers.every((t) => /^\/assets\/properties\/.+\.jpg$/.test(t[1])));
ok('the trigger names the property and the count for assistive tech',
   /aria-haspopup="dialog" aria-label="View 7 photographs of Anse Chastanet"/.test(explore));
ok('a property with a single photograph is a plain picture, not a trigger',
   !explore.includes('photographs of Zoëtry') && explore.includes('Zoëtry Marigot Bay'));
ok('the script is loaded on /explore only', explore.includes('/js/property-lightbox.js') && !page('/').includes('property-lightbox') && !page('/eclipse').includes('property-lightbox'));
ok('no island or dialog markup leaks onto other pages', !page('/').includes('prop-gallery-data') && !page('/about').includes('prop-gallery-data'));
const lb = read('js/property-lightbox.js');
ok('the lightbox is a native modal <dialog> that Lenis leaves alone', /createElement\('dialog'\)/.test(lb) && /data-lenis-prevent/.test(lb) && /showModal\(\)/.test(lb));
ok('keyboard: arrows, Home, End; Esc is the dialog\'s own', /ArrowLeft/.test(lb) && /ArrowRight/.test(lb) && /'Home'/.test(lb) && /'End'/.test(lb));
ok('focus goes back to the card that opened it', /state\.trigger\.focus/.test(lb));
ok('"open in new tab" still works on the trigger (modified clicks are not hijacked)', /e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey/.test(lb));
ok('the island cannot break out of its <script> (a "<" is escaped)', /replace\(\/<\/g, '\\\\u003c'\)/.test(read('lib/components.js')));
const css = read('css/site.css');
ok('the dialog fills the viewport, scrolls nothing behind it, and drops its motion under reduced motion',
   /\.lb \{[^}]*width: 100vw; height: 100dvh/.test(css) && /html\.lb-open \{ overflow: hidden; \}/.test(css) && /prefers-reduced-motion: reduce\) \{\s*\.lb\[open\] \{ animation: none; \}/.test(css));
ok('nothing in the gallery says a photograph is uncleared (that paperwork is ours, not the visitor\'s)', !/not yet cleared|uncleared/i.test(lb));

/* ── Result CTA ───────────────────────────────────────────────────────── */
console.log('\n  Journey Finder result CTA');
const fj = read('js/journey.js');
ok('the result button reads "Help me plan this" (unattributed and house)',
   /data-share-primary>Help me plan this<\/a>/.test(fj) && /primary\.textContent = 'Help me plan this';/.test(fj));
ok('with an advisor it reads "Help me plan this with <first name>"', /'Help me plan this with ' \+ advisorName/.test(fj));
ok('the old labels are gone', !/Speak with a Saint Lucia WELL Advisor/.test(fj) && !/primary\.textContent = 'Share my WELL Journey/.test(fj));
ok('the consent still sits behind the button: the panel\'s own submit says "Share my Journey"',
   /type="submit">Share my Journey<\/button>/.test(fj) && /By choosing “Share my Journey,” you agree/.test(fj));
ok('the privacy notice names the new button and the consenting step',
   /<em>Help me plan this<\/em> and then <em>Share my Journey<\/em>/.test(read('content/privacy.js')));

/* ── Foundations and Immersion fixes ─────────────────────────────────── */
console.log('\n  Foundations and Immersion');
const fnd = page('/advisors/foundations');
const imm = page('/advisors/immersion');
ok('Foundations Saint Lucia is $500 to reserve and about $5,000 all in — everywhere it appears',
   /<p class="price">\$500 <small>USD to reserve<\/small><\/p>/.test(fnd) && /Budget around <b>\$5,000 all in<\/b>/.test(fnd)
   && /Saint(?:&nbsp;| | )Lucia from \$500 to reserve/.test(fnd) && /Foundations Saint(?:&nbsp;| | )Lucia is \$500 to reserve, with around \$5,000/.test(fnd)
   && (fnd.match(/Reserve · Saint(?:&nbsp;| |\u00a0)Lucia · \$500/g) || []).length === 2);
ok('no stale $300 or $3,000 is left on the Foundations page', !/\$300\b|\$3,000/.test(fnd));
ok('Day two carries a Group travel topic with an icon',
   /<li class="has-icon"><svg[^>]*aria-hidden="true"[\s\S]*?<\/svg>Group travel<\/li>/.test(fnd));
ok('the Immersion waiting-list link has one arrow (the CSS adds it; the copy must not)',
   /<a class="contact-link" href="\/advisors\/immersion\/waitlist">Join the waiting list<\/a>/.test(imm) && !/waiting list →/.test(imm));
ok('the Immersion sub-navigation and footer say what each section is',
   /<li><a href="#outcomes">What it covers<\/a><\/li>/.test(imm) && /<li><a href="#fit">Foundations first<\/a><\/li>/.test(imm)
   && !/>You will<\/a>|>Prerequisite<\/a>/.test(imm));
ok('a one-line closing statement is not squeezed to the quote column',
   /\.section-closing \{ max-width: min\(44rem, 100%\); \}/.test(read('css/chrome.css')));

console.log('\n  ' + '─'.repeat(62));
console.log('  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
