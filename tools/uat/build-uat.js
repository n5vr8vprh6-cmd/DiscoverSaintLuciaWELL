/* ============================================================================
   build-uat.js — emits the regression tracker
   ----------------------------------------------------------------------------
     node tools/uat/build-uat.js

   ── THE ROWS ARE SERVER-RENDERED, ON PURPOSE ──────────────────────────────
   It would be shorter to embed the cases as JSON and build the rows in the
   browser. It would also mean that one JavaScript error produces a blank page
   that still looks like a successful build — the exact failure this project's
   field-guide build exists to prevent.

   So every case is written into the HTML as markup. JavaScript adds the
   status buttons, filters and export. If it breaks, Duncan still has a
   readable 135-case checklist he can work from on paper.

   ── THE BUILD REFUSES TO WRITE ────────────────────────────────────────────
   Same rule as the field guide. If a case is missing steps, an expectation or
   a `why`; if two cases share an id; if a role or priority is unknown; or if
   any case id fails to appear in the emitted HTML — nothing is written and it
   says why. A tracker missing twenty cases looks exactly like a complete one.

   ── RESULTS SURVIVE A REBUILD ─────────────────────────────────────────────
   Results live in localStorage keyed by case id, so regenerating this file
   keeps them. Each case also carries a hash of its own text; if a case is
   edited after Duncan tested it, his result renders as STALE rather than
   silently claiming coverage of a case that no longer says the same thing.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { CASES, ROLES, SITE } = require('./cases.js');

const OUT = path.join(__dirname, 'regression.html');

/* ── Audit ────────────────────────────────────────────────────────────────
   Collect every problem rather than throwing on the first, so one run tells
   you everything that needs fixing. */
const problems = [];
const seen = new Set();
const ROLE_KEYS = ROLES.map((r) => r.key);

CASES.forEach((c, i) => {
  const at = c.id || `#${i}`;
  if (!c.id || !/^[A-Z]-\d{2}$/.test(c.id)) problems.push(`${at}: id must look like A-01`);
  if (seen.has(c.id)) problems.push(`${at}: duplicate id`);
  seen.add(c.id);
  if (ROLE_KEYS.indexOf(c.role) === -1) problems.push(`${at}: unknown role "${c.role}"`);
  if ([1, 2, 3].indexOf(c.priority) === -1) problems.push(`${at}: priority must be 1, 2 or 3`);
  if (!c.title) problems.push(`${at}: no title`);
  if (!c.area) problems.push(`${at}: no area`);
  if (!Array.isArray(c.steps) || !c.steps.length) problems.push(`${at}: no steps`);
  if (!c.expect) problems.push(`${at}: no expectation — a case with no expected result cannot fail`);
  if (!c.why) problems.push(`${at}: no "why" — this file is also how Duncan learns the system`);
});

if (problems.length) {
  console.error('\n  The tracker was NOT written. ' + problems.length + ' problem(s):\n');
  problems.forEach((p) => console.error('    · ' + p));
  console.error('\n  Fix tools/uat/cases.js and run again.\n');
  process.exit(1);
}

/* ── Bits ─────────────────────────────────────────────────────────────── */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* djb2. Not cryptographic — it only has to change when the text changes. */
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
/* Every distinct area, in the order the cases declare them — which is the
   order of the file, which is the order somebody would work through them. */
const AREAS = CASES.map((c) => c.area).filter((a, i, all) => a && all.indexOf(a) === i);

/* A PASS IS A RELEASE, AN AREA IS A PLACE IN THE PRODUCT, and they cut across
   each other. The ASK WELL pass is twenty cases spanning "Before you start",
   "ASK WELL", "Playbook" and "Cleanup" — filtering by area shows fifteen of
   them and hides the migration that has to run first and the teardown that has
   to run last, which is the worst possible subset to hand somebody.

   Optional. A case with no `pass` belongs to the standing regression and
   simply never appears under a pass filter. */
const PASSES = CASES.map((c) => c.pass).filter((p, i, all) => p && all.indexOf(p) === i);

const caseHash = (c) => hash([c.title, c.expect, c.steps.join('|'), c.why].join('~'));

const PRI_LABEL = { 1: 'P1 · smoke', 2: 'P2', 3: 'P3' };

/* ── Rows ─────────────────────────────────────────────────────────────── */
function caseHTML(c) {
  return `
<article class="case" id="case-${esc(c.id)}" data-id="${esc(c.id)}" data-role="${esc(c.role)}"
   data-pri="${c.priority}" data-hash="${caseHash(c)}"
   data-title="${esc(c.title)}" data-expect="${esc(c.expect)}" data-area="${esc(c.area)}" data-pass="${esc(c.pass || '')}"${
   c.blocked ? ` data-blocked="${esc(c.blocked)}"` : ''}>
  <div class="case-head">
    <span class="cid">${esc(c.id)}</span>
    <h4>${esc(c.title)}</h4>
    <span class="pri pri--${c.priority}">${esc(PRI_LABEL[c.priority])}</span>
    <span class="stale" hidden title="This case was edited after you recorded a result">edited since you tested it</span>
  </div>

  ${c.needs && c.needs.length ? `<p class="needs"><strong>Needs first:</strong> ${esc(c.needs.join(' · '))}</p>` : ''}
  ${c.blocked ? `<p class="blocked-note"><strong>Blocked:</strong> ${esc(c.blocked)}</p>` : ''}

  <ol class="steps">${c.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>

  <p class="expect"><strong>Expect</strong> ${esc(c.expect)}</p>
  <p class="why"><strong>Why this matters</strong> ${esc(c.why)}</p>

  <div class="marks" role="group" aria-label="Result for ${esc(c.id)}">
    <button type="button" class="mark mark--pass"    data-mark="pass">Pass</button>
    <button type="button" class="mark mark--fail"    data-mark="fail">Fail</button>
    <button type="button" class="mark mark--blocked" data-mark="blocked">Blocked</button>
    <button type="button" class="mark mark--na"      data-mark="na">N/A</button>
    <button type="button" class="mark mark--clear"   data-mark="">Clear</button>
  </div>

  <label class="note-wrap">
    <span>Suggestion or what went wrong</span>
    <textarea class="note" rows="2" placeholder="Anything you would change, however small — this is the most useful thing you will produce today."></textarea>
  </label>
</article>`;
}

function roleHTML(role) {
  const mine = CASES.filter((c) => c.role === role.key);
  if (!mine.length) return '';

  const areas = [];
  mine.forEach((c) => { if (areas.indexOf(c.area) === -1) areas.push(c.area); });

  return `
<section class="role" id="role-${esc(role.key)}" data-role="${esc(role.key)}">
  <div class="role-head">
    <h2>${esc(role.label)}</h2>
    <p class="role-note">${esc(role.note)}</p>
    <div class="bar" aria-hidden="true"><span class="bar-fill" style="width:0%"></span></div>
    <p class="role-count"><span class="done">0</span> of ${mine.length} recorded</p>
  </div>
  ${areas.map((a) => `
  <details class="area" open>
    <summary>${esc(a)} <span class="area-n">${mine.filter((c) => c.area === a).length}</span></summary>
    ${mine.filter((c) => c.area === a).map(caseHTML).join('')}
  </details>`).join('')}
</section>`;
}

/* ── The page ─────────────────────────────────────────────────────────── */
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>UAT · Discover Saint Lucia WELL</title>
<style>
:root {
  --ink: #133239; --teal: #00A6A8; --gold: #8A5E15; --coral: #EF6A4A;
  --cream: #FBF8F1; --paper: #fff; --line: #d9d5cc; --muted: #586c71;
  --pass: #1d7a4f; --fail: #c33a20; --blocked: #8A5E15; --na: #7d8a8d;
  --sans: "Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--cream); color: var(--ink);
  font-family: var(--sans); font-size: 15px; line-height: 1.55;
  -webkit-text-size-adjust: 100%;
}
.wrap { max-width: 1180px; margin: 0 auto; padding: 0 1.25rem 6rem; }
a { color: var(--teal); }

/* ── Sticky control bar ───────────────────────────────────────────────── */
header.top {
  position: sticky; top: 0; z-index: 20;
  background: var(--ink); color: #fff; border-bottom: 3px solid var(--teal);
}
.top-in { max-width: 1180px; margin: 0 auto; padding: 0.85rem 1.25rem; }
.top h1 { margin: 0; font-size: 1.05rem; letter-spacing: 0.02em; }
.top h1 small { font-weight: 400; opacity: 0.72; margin-left: 0.5rem; font-size: 0.8rem; }
.totals { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; margin: 0.6rem 0 0; font-size: 0.82rem; }
.totals b { font-weight: 700; }
.t-pass b { color: #7fe0ac; } .t-fail b { color: #ff9d85; }
.t-blocked b { color: #f3c877; } .t-left b { color: #cfe6e8; }
.controls { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.7rem; }
.controls button, .controls a.btn {
  font: inherit; font-size: 0.8rem; cursor: pointer;
  background: rgba(255,255,255,0.08); color: #fff; text-decoration: none;
  border: 1px solid rgba(255,255,255,0.28); border-radius: 3px; padding: 0.34rem 0.7rem;
}
.controls button[aria-pressed="true"] { background: var(--teal); border-color: var(--teal); color: #06282c; font-weight: 700; }
.controls button:hover, .controls a.btn:hover { border-color: var(--teal); }
.controls .sep { flex: 1 1 1rem; }

/* ── Preamble ─────────────────────────────────────────────────────────── */
.preamble { background: var(--paper); border: 1px solid var(--line); border-left: 3px solid var(--coral);
  padding: 1rem 1.15rem; margin: 1.5rem 0 0; border-radius: 3px; }
.preamble h2 { margin: 0 0 0.4rem; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); }
.preamble ul { margin: 0.5rem 0 0; padding-left: 1.15rem; }
.preamble li { margin-bottom: 0.3rem; }
.preamble code { background: var(--cream); padding: 0.1em 0.35em; border-radius: 2px; font-size: 0.9em; }

/* ── Roles ────────────────────────────────────────────────────────────── */
.role { margin-top: 2.5rem; }
.role-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.6rem; margin-bottom: 1rem; }
.role-head h2 { margin: 0; font-size: 1.3rem; }
.role-note { margin: 0.2rem 0 0.6rem; color: var(--muted); font-size: 0.85rem; max-width: 62ch; }
.bar { height: 5px; background: var(--line); border-radius: 3px; overflow: hidden; }
.bar-fill { display: block; height: 100%; background: var(--teal); transition: width 0.2s ease; }
.role-count { margin: 0.35rem 0 0; font-size: 0.78rem; color: var(--muted); }

.area { margin: 0 0 0.5rem; }
.area > summary {
  cursor: pointer; list-style: none; padding: 0.5rem 0;
  font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--muted); font-weight: 700; border-bottom: 1px solid var(--line);
}
.area > summary::-webkit-details-marker { display: none; }
.area > summary::before { content: '▸ '; color: var(--teal); }
.area[open] > summary::before { content: '▾ '; }
.area-n { float: right; font-weight: 400; letter-spacing: 0; text-transform: none; }

/* ── A case ───────────────────────────────────────────────────────────── */
.case {
  background: var(--paper); border: 1px solid var(--line); border-left: 3px solid var(--line);
  border-radius: 3px; padding: 0.9rem 1.05rem; margin: 0.75rem 0;
}
.case[data-status="pass"]    { border-left-color: var(--pass); }
.case[data-status="fail"]    { border-left-color: var(--fail); background: #fffaf8; }
.case[data-status="blocked"] { border-left-color: var(--blocked); }
.case[data-status="na"]      { border-left-color: var(--na); opacity: 0.72; }
.case.is-focus { outline: 2px solid var(--teal); outline-offset: 2px; }

.case-head { display: flex; align-items: baseline; gap: 0.55rem; flex-wrap: wrap; }
.cid { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--teal); font-size: 0.82rem; }
.case-head h4 { margin: 0; font-size: 1rem; flex: 1 1 16rem; }
.pri { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em; padding: 0.1rem 0.4rem;
  border: 1px solid var(--line); border-radius: 2px; color: var(--muted); white-space: nowrap; }
.pri--1 { border-color: var(--coral); color: #a8331a; font-weight: 700; }
.target { margin: 0 0 1rem; padding: 0.7rem 0.9rem; border: 1px solid var(--line); border-radius: 3px; }
.target label { font-size: 0.85rem; font-weight: 600; display: block; }
.target input { font: inherit; font-size: 0.85rem; width: min(100%, 34rem); margin-top: 0.3rem;
  padding: 0.35rem 0.45rem; border: 1px solid var(--line); border-radius: 3px; }
.target button { margin-top: 0.4rem; font-size: 0.78rem; }
.target--off { border-color: var(--gold); background: rgba(217,160,60,0.09); }
#target-warn { margin: 0.5rem 0 0; font-size: 0.82rem; color: var(--ink); }
.area-pick { font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.35rem; }
.area-pick select { font: inherit; font-size: 0.8rem; padding: 0.2rem 0.3rem; }
.showing { font-size: 0.75rem; opacity: 0.7; margin-left: 0.4rem; }
.stale { font-size: 0.68rem; background: var(--gold); color: #fff; padding: 0.1rem 0.4rem; border-radius: 2px; }

.needs, .blocked-note { margin: 0.5rem 0 0; font-size: 0.82rem; color: var(--muted); }
.blocked-note { color: #7a5310; }
.steps { margin: 0.6rem 0 0; padding-left: 1.3rem; font-size: 0.9rem; }
.steps li { margin-bottom: 0.2rem; }
.expect, .why { margin: 0.55rem 0 0; font-size: 0.88rem; }
.expect strong, .why strong {
  display: block; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.12em;
  color: var(--muted); margin-bottom: 0.1rem;
}
.why { color: var(--muted); border-left: 2px solid var(--line); padding-left: 0.7rem; }

.marks { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.8rem; }
.mark { font: inherit; font-size: 0.8rem; cursor: pointer; background: var(--paper); color: var(--ink);
  border: 1px solid var(--line); border-radius: 3px; padding: 0.3rem 0.75rem; }
.mark:hover { border-color: var(--teal); }
.mark:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
.mark--clear { margin-left: auto; color: var(--muted); }
.case[data-status="pass"]    .mark--pass    { background: var(--pass);    color: #fff; border-color: var(--pass); font-weight: 700; }
.case[data-status="fail"]    .mark--fail    { background: var(--fail);    color: #fff; border-color: var(--fail); font-weight: 700; }
.case[data-status="blocked"] .mark--blocked { background: var(--blocked); color: #fff; border-color: var(--blocked); font-weight: 700; }
.case[data-status="na"]      .mark--na      { background: var(--na);      color: #fff; border-color: var(--na); font-weight: 700; }

.note-wrap { display: block; margin-top: 0.6rem; }
.note-wrap span { display: block; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin-bottom: 0.2rem; }
.note { width: 100%; font: inherit; font-size: 0.88rem; padding: 0.45rem 0.6rem;
  border: 1px solid var(--line); border-radius: 3px; background: var(--cream); resize: vertical; }
.note:focus { outline: 2px solid var(--teal); outline-offset: 1px; background: #fff; }
.case.has-note .note { background: #fff; border-color: var(--teal); }

.hidden { display: none !important; }
.keys { margin-top: 2.5rem; font-size: 0.8rem; color: var(--muted); border-top: 1px solid var(--line); padding-top: 0.8rem; }
.keys kbd { background: var(--paper); border: 1px solid var(--line); border-bottom-width: 2px;
  border-radius: 3px; padding: 0.05em 0.4em; font-family: inherit; font-size: 0.9em; }

/* On a phone the sticky bar was 217px of a 900px viewport — a quarter of the
   screen permanently spent on chrome, on the device Duncan is most likely to
   hold while testing the site on a laptop. The controls become one
   horizontally scrollable row instead of three wrapped ones, the totals
   tighten, and the site URL drops out of the title. */
@media (max-width: 620px) {
  .wrap { padding: 0 0.8rem 5rem; }
  .top-in { padding: 0.55rem 0.8rem; }
  .top h1 { font-size: 0.95rem; }
  .top h1 small { display: none; }
  .totals { gap: 0.2rem 0.7rem; margin-top: 0.4rem; font-size: 0.76rem; }
  .controls {
    flex-wrap: nowrap; overflow-x: auto; margin-top: 0.5rem;
    padding-bottom: 0.2rem; scrollbar-width: none;
  }
  .controls::-webkit-scrollbar { display: none; }
  .controls button, .controls a.btn { white-space: nowrap; flex: 0 0 auto; }
  .controls .sep { display: none; }
  .case { padding: 0.8rem 0.75rem; }
  .mark { flex: 1 1 auto; text-align: center; }
  .mark--clear { margin-left: 0; }
  .case-head h4 { flex-basis: 100%; }
}
</style>
</head>
<body>

<header class="top">
  <div class="top-in">
    <h1>UAT · Discover Saint Lucia WELL <small>${CASES.length} cases ·
      <a id="target-link" href="${SITE}" target="_blank" rel="noopener"
         style="color:#7fd6d8">${esc(SITE.replace('https://', ''))}</a></small></h1>
    <div class="totals">
      <span class="t-pass">Pass <b id="n-pass">0</b></span>
      <span class="t-fail">Fail <b id="n-fail">0</b></span>
      <span class="t-blocked">Blocked <b id="n-blocked">0</b></span>
      <span>N/A <b id="n-na">0</b></span>
      <span class="t-left">Untested <b id="n-left">${CASES.length}</b></span>
      <span>Suggestions <b id="n-notes">0</b></span>
    </div>
    <div class="controls">
      <button type="button" data-filter="all" aria-pressed="true">All</button>
      <button type="button" data-filter="p1" aria-pressed="false">P1 only</button>
      <button type="button" data-filter="untested" aria-pressed="false">Untested</button>
      <button type="button" data-filter="failures" aria-pressed="false">Failures</button>
      <span class="sep"></span>
      ${/* AREA, NOT ROLE. The role sections are already on the page and can be
           scrolled to; what nobody can do without this is run ONE FEATURE's
           cases, which is what a pass after a release actually is. ASK WELL
           alone is twenty cases inside a tracker holding nearly two hundred,
           and scrolling past the other 172 to find them is how a pass gets
           abandoned halfway.

           Derived from the cases, so a new area appears here without anybody
           remembering to add it. */''}
      <label class="area-pick">Show
        <select id="area-filter">
          <option value="">Everything</option>
          ${PASSES.length ? `<optgroup label="Pass">${PASSES.map((p) => `<option value="pass:${
            esc(p)}">${esc(p)} (${CASES.filter((c) => c.pass === p).length})</option>`).join('')}
          </optgroup>` : ''}
          <optgroup label="Area">
          ${AREAS.map((a) => `<option value="area:${esc(a)}">${esc(a)} (${
            CASES.filter((c) => c.area === a).length})</option>`).join('')}
          </optgroup>
        </select>
      </label>
      <span class="showing" id="showing"></span>
      <span class="sep"></span>
      <button type="button" id="export-md">Export ⇢ markdown</button>
      <button type="button" id="export-json">Backup JSON</button>
      <button type="button" id="import-json">Restore</button>
    </div>
  </div>
</header>

<div class="wrap">

  ${/* WHICH DEPLOYMENT AM I LOOKING AT. A pass run against a preview and a
       pass run against production are different facts, and the tracker used to
       record them identically — same localStorage, same export, no mention of
       where any of it happened. A green row that turns out to have been a
       preview is worse than an untested one, because nobody re-runs it.

       The results are keyed by case id and NOT by target, deliberately: one
       set of results, and the export names the target it was gathered against.
       Two parallel result sets would be a way to lose half of them. */''}
  <div class="target" data-target>
    <label>Testing against
      <input type="url" id="target-url" value="${esc(SITE)}" spellcheck="false">
    </label>
    <button type="button" id="target-reset">Production</button>
    <p id="target-warn" hidden>Not production. Results below were gathered here, and the
      export says so — but nothing on a preview proves anything about the live site.</p>
  </div>

  <div class="preamble">
    ${/* Reacts to the target. A heading that insists "this is production" while
          the field above it says otherwise teaches somebody to stop reading
          both. The warnings underneath stay true either way: a preview shares
          the live database, the live Resend account and the live OpenAI key,
          so the emails, the rows and the spend are all real wherever it runs. */''}
    <h2 id="preamble-h">Before you start — this is production</h2>
    <ul>
      <li><strong>Real emails send</strong> through Resend, and Encharge events fire on registration and approval.</li>
      <li><strong>Every plan build costs real money</strong> at OpenAI. Budget a few dollars for the Campaign group.</li>
      <li>Register test advisors as <code>concierge+uat1@discoversaintluciawell.com</code>, <code>+uat2</code> … — they deliver to the concierge inbox and stay greppable. We send <em>from</em> <code>journeys@</code>, so there is no collision.</li>
      <li>Give every test traveller the first name <code>ZZTest</code>. It sorts to the bottom of every list and matches nothing real.</li>
      <li><strong>Do the Teardown group at the end.</strong> This project has already had to purge six test Journeys once.</li>
    </ul>
  </div>

  ${ROLES.map(roleHTML).join('')}

  <p class="keys">
    <kbd>j</kbd> / <kbd>k</kbd> move between cases · <kbd>p</kbd> pass · <kbd>f</kbd> fail ·
    <kbd>b</kbd> blocked · <kbd>n</kbd> not applicable · <kbd>c</kbd> clear ·
    <kbd>Enter</kbd> jump to the suggestion box · <kbd>Esc</kbd> leave it.
    Results save in this browser as you go — nothing is sent anywhere.
  </p>
</div>

<script>
(function () {
  'use strict';
  var KEY = 'slw-uat-v1';
  var cases = [].slice.call(document.querySelectorAll('.case'));
  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { state = {}; }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function apply(el) {
    var id = el.dataset.id;
    var rec = state[id];
    if (rec && rec.status) el.dataset.status = rec.status; else el.removeAttribute('data-status');
    var note = el.querySelector('.note');
    note.value = (rec && rec.note) || '';
    el.classList.toggle('has-note', !!note.value.trim());
    /* STALE: the case text changed after this result was recorded, so the
       result no longer proves what it appears to prove. */
    var stale = !!(rec && rec.status && rec.hash && rec.hash !== el.dataset.hash);
    el.querySelector('.stale').hidden = !stale;
  }

  function mark(el, status) {
    var id = el.dataset.id;
    var rec = state[id] || {};
    if (!status) { delete state[id]; }
    else {
      rec.status = status; rec.hash = el.dataset.hash; rec.at = new Date().toISOString();
      state[id] = rec;
    }
    save(); apply(el); tally();
  }

  function tally() {
    var n = { pass: 0, fail: 0, blocked: 0, na: 0, notes: 0 };
    cases.forEach(function (el) {
      var r = state[el.dataset.id];
      if (r && r.status) n[r.status]++;
      if (r && r.note && r.note.trim()) n.notes++;
    });
    document.getElementById('n-pass').textContent = n.pass;
    document.getElementById('n-fail').textContent = n.fail;
    document.getElementById('n-blocked').textContent = n.blocked;
    document.getElementById('n-na').textContent = n.na;
    document.getElementById('n-left').textContent = cases.length - n.pass - n.fail - n.blocked - n.na;
    document.getElementById('n-notes').textContent = n.notes;

    [].forEach.call(document.querySelectorAll('.role'), function (sec) {
      var mine = [].slice.call(sec.querySelectorAll('.case'));
      var done = mine.filter(function (el) { var r = state[el.dataset.id]; return r && r.status; }).length;
      sec.querySelector('.bar-fill').style.width = mine.length ? (done / mine.length * 100) + '%' : '0%';
      sec.querySelector('.done').textContent = done;
    });
  }

  /* ── Events ───────────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.mark');
    if (btn) { mark(btn.closest('.case'), btn.dataset.mark); return; }
  });

  document.addEventListener('input', function (e) {
    if (!e.target.classList.contains('note')) return;
    var el = e.target.closest('.case');
    var rec = state[el.dataset.id] || {};
    rec.note = e.target.value;
    if (!rec.note.trim() && !rec.status) delete state[el.dataset.id]; else state[el.dataset.id] = rec;
    el.classList.toggle('has-note', !!e.target.value.trim());
    save(); tally();
  });

  /* ── Filters ──────────────────────────────────────────────────────── */
  var filter = 'all';
  var area = '';

  /* The two filters are INDEPENDENT and AND together. "ASK WELL, untested" is
     the query somebody actually has halfway through a pass, and a single
     mutually-exclusive filter cannot express it. */
  function refilter() {
    var shown = 0;
    cases.forEach(function (el) {
      var r = state[el.dataset.id];
      var status = r && r.status;
      var byStatus = filter === 'all'
        || (filter === 'p1' && el.dataset.pri === '1')
        || (filter === 'untested' && !status)
        || (filter === 'failures' && (status === 'fail' || status === 'blocked'));
      /* The value carries its own kind — "pass:ASK WELL" or "area:Campaign" —
         so a pass and an area that happen to share a name cannot collide. */
      var byArea = !area
        || (area.slice(0, 5) === 'pass:' && el.dataset.pass === area.slice(5))
        || (area.slice(0, 5) === 'area:' && el.dataset.area === area.slice(5));
      var show = byStatus && byArea;
      if (show) shown++;
      el.classList.toggle('hidden', !show);
    });

    /* Say how many are on screen. Without it, a filter that matches nothing
       looks identical to a page that failed to render. */
    var s = document.getElementById('showing');
    if (s) {
      s.textContent = (filter === 'all' && !area)
        ? '' : 'showing ' + shown + ' of ' + cases.length;
    }
    /* Hide an area or a role once everything inside it is filtered out —
       otherwise "Failures" shows a page of empty headings. */
    [].forEach.call(document.querySelectorAll('.area'), function (a) {
      a.classList.toggle('hidden', !a.querySelector('.case:not(.hidden)'));
    });
    [].forEach.call(document.querySelectorAll('.role'), function (s) {
      s.classList.toggle('hidden', !s.querySelector('.case:not(.hidden)'));
    });
  }
  /* ── Which deployment ─────────────────────────────────────────────── */
  var PROD = ${JSON.stringify(SITE)};
  var targetBox = document.querySelector('[data-target]');
  var targetIn = document.getElementById('target-url');
  var targetLink = document.getElementById('target-link');
  var targetWarn = document.getElementById('target-warn');

  /* THESE BACKSLASHES ARE DOUBLED BECAUSE THIS LINE IS INSIDE A TEMPLATE
     LITERAL. A single \/ is consumed as an escape on the way out and the page
     receives //+$/, which is a syntax error that kills the WHOLE tracker script
     — every filter, every status button — while node --check on this file still
     passes, because the fault is in the string rather than in the source. */
  function target() { return (targetIn && targetIn.value || PROD).replace(/\\/+$/, ''); }

  function paintTarget() {
    var v = target();
    var off = v !== PROD;
    if (targetBox) targetBox.classList.toggle('target--off', off);
    if (targetWarn) targetWarn.hidden = !off;
    var ph = document.getElementById('preamble-h');
    if (ph) {
      ph.textContent = off
        ? 'Before you start — this is a preview, on the live database'
        : 'Before you start — this is production';
    }
    if (targetLink) {
      targetLink.href = v;
      targetLink.textContent = v.replace(/^https?:\\/\\//, '');
    }
    try { localStorage.setItem(KEY + '.target', v); } catch (e) {}
  }

  if (targetIn) {
    try { targetIn.value = localStorage.getItem(KEY + '.target') || PROD; } catch (e) {}
    targetIn.addEventListener('input', paintTarget);
    var reset = document.getElementById('target-reset');
    if (reset) reset.addEventListener('click', function () { targetIn.value = PROD; paintTarget(); });
    paintTarget();
  }

  var areaSel = document.getElementById('area-filter');
  if (areaSel) {
    /* Remembered across reloads, like the results themselves: a pass is not
       one sitting, and re-picking the area every time is the kind of friction
       that makes somebody stop filtering and start scrolling. */
    try { areaSel.value = localStorage.getItem(KEY + '.area') || ''; } catch (e) {}
    area = areaSel.value;
    areaSel.addEventListener('change', function () {
      area = areaSel.value;
      try { localStorage.setItem(KEY + '.area', area); } catch (e) {}
      refilter();
    });
  }

  [].forEach.call(document.querySelectorAll('[data-filter]'), function (b) {
    b.addEventListener('click', function () {
      filter = b.dataset.filter;
      [].forEach.call(document.querySelectorAll('[data-filter]'), function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      refilter();
    });
  });

  /* ── Keyboard ─────────────────────────────────────────────────────── */
  var focus = -1;
  function visible() { return cases.filter(function (el) { return !el.classList.contains('hidden'); }); }
  function setFocus(i) {
    var v = visible(); if (!v.length) return;
    focus = Math.max(0, Math.min(i, v.length - 1));
    cases.forEach(function (el) { el.classList.remove('is-focus'); });
    v[focus].classList.add('is-focus');
    v[focus].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'TEXTAREA') { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var v = visible();
    var cur = v[focus];
    var k = e.key.toLowerCase();
    if (k === 'j') { setFocus(focus + 1); e.preventDefault(); }
    else if (k === 'k') { setFocus(focus - 1); e.preventDefault(); }
    else if (cur && 'pfbnc'.indexOf(k) !== -1) {
      mark(cur, { p: 'pass', f: 'fail', b: 'blocked', n: 'na', c: '' }[k]);
      e.preventDefault();
    } else if (k === 'enter' && cur) { cur.querySelector('.note').focus(); e.preventDefault(); }
  });

  /* ── Export ───────────────────────────────────────────────────────── */
  function markdown() {
    var when = new Date().toISOString().slice(0, 16).replace('T', ' ');
    var n = { pass: [], fail: [], blocked: [], na: [], untested: [], notes: [] };
    cases.forEach(function (el) {
      var r = state[el.dataset.id] || {};
      (r.status ? n[r.status] : n.untested).push(el);
      if (r.note && r.note.trim() && r.status !== 'fail') n.notes.push(el);
    });
    var out = [];
    out.push('# UAT results — Discover Saint Lucia WELL');
    out.push('');
    out.push('Exported ' + when + ' · ' + (cases.length - n.untested.length) + ' of ' + cases.length + ' recorded');
    out.push('');
    /* Named, always. A reader who cannot tell a preview result from a
       production one will treat both as production, which is the failure this
       line exists to prevent. */
    out.push('Tested against: **' + target() + '**' +
      (target() === PROD ? '' : '  — NOT production. Nothing here proves anything about the live site.'));
    out.push('');
    out.push('| Result | n |');
    out.push('|---|---|');
    ['pass', 'fail', 'blocked', 'na', 'untested'].forEach(function (k) {
      out.push('| ' + k + ' | ' + n[k].length + ' |');
    });

    function block(title, list, withNote) {
      if (!list.length) return;
      out.push(''); out.push('## ' + title + ' (' + list.length + ')'); out.push('');
      list.forEach(function (el) {
        var r = state[el.dataset.id] || {};
        out.push('### ' + el.dataset.id + ' · ' + el.dataset.title);
        out.push('- **Area:** ' + el.dataset.area + ' (' + el.dataset.role + ', P' + el.dataset.pri + ')');
        out.push('- **Expected:** ' + el.dataset.expect);
        if (withNote) out.push('- **Duncan:** ' + ((r.note || '').trim() || '_no note_'));
        out.push('');
      });
    }
    block('Failures', n.fail, true);
    block('Blocked', n.blocked, true);
    block('Suggestions on cases that otherwise passed', n.notes, true);

    if (n.untested.length) {
      out.push(''); out.push('## Not tested (' + n.untested.length + ')'); out.push('');
      /* Sorted, not in DOM order. On the page cases are grouped by area, which
         is right for working through them and wrong for a list somebody scans
         to see what they missed. */
      out.push(n.untested.map(function (el) { return el.dataset.id; }).sort().join(', '));
    }
    out.push('');
    return out.join('\\n');
  }

  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* The export is the artifact that leaves this page and gets pasted into a
     conversation. If it does not say which deployment produced it, nobody
     downstream can tell. */
  document.getElementById('export-md').addEventListener('click', function () {
    var md = markdown();
    if (navigator.clipboard) navigator.clipboard.writeText(md).catch(function () {});
    download('uat-results.md', md, 'text/markdown');
    this.textContent = 'Copied + downloaded ✓';
    var b = this; setTimeout(function () { b.textContent = 'Export ⇢ markdown'; }, 2200);
  });

  document.getElementById('export-json').addEventListener('click', function () {
    download('uat-results.json', JSON.stringify(state, null, 1), 'application/json');
  });

  document.getElementById('import-json').addEventListener('click', function () {
    var i = document.createElement('input');
    i.type = 'file'; i.accept = '.json,application/json';
    i.addEventListener('change', function () {
      var f = i.files && i.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var got = JSON.parse(fr.result);
          if (got && typeof got === 'object') {
            state = got; save(); cases.forEach(apply); tally(); refilter();
          }
        } catch (e) { alert('That file could not be read as saved results.'); }
      };
      fr.readAsText(f);
    });
    i.click();
  });

  cases.forEach(apply);
  tally();
})();
</script>
</body>
</html>`;

/* ── The check that catches a quietly truncated document ─────────────────
   Everything above can succeed and still emit a page missing half the cases.
   Nothing is written until every id is actually in the markup. */
const missing = CASES.filter((c) => html.indexOf(`data-id="${c.id}"`) === -1).map((c) => c.id);
if (missing.length) {
  console.error('\n  NOT WRITTEN — ' + missing.length + ' case(s) never reached the page:');
  console.error('    ' + missing.join(', ') + '\n');
  process.exit(1);
}

/* ── THE EMITTED SCRIPT MUST PARSE ───────────────────────────────────────
   node --check on THIS file proves the builder is valid JavaScript. It says
   nothing about the script this file writes into the page, which is a string
   here and only becomes code in a browser.

   That gap shipped a broken tracker: a single-backslash escape inside the
   template literal was consumed on the way out, the page received a malformed
   regex, and ONE syntax error killed the entire script — every filter, every
   status button, the export. The page still rendered perfectly, because the
   markup was fine. It looked like a working tracker that had simply stopped
   responding to clicks.

   Same lesson as the field guide, where a typo in render.js produced a blank
   120-page PDF that measured as a passing proof. Parse it here, refuse to
   write if it fails, and name the line. */
const scriptSrc = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1];
if (!scriptSrc) {
  console.error('\n  NOT WRITTEN — the page has no script block at all.\n');
  process.exit(1);
}
try {
  new (require('vm').Script)(scriptSrc);
} catch (e) {
  const line = (String(e.stack).match(/evalmachine[^:]*:(\d+)/) || [])[1];
  console.error('\n  NOT WRITTEN — the tracker script does not parse.');
  console.error('    ' + e.message);
  if (line) {
    const src = scriptSrc.split('\n');
    console.error('    line ' + line + ':  ' + (src[Number(line) - 1] || '').trim());
  }
  console.error('');
  process.exit(1);
}

fs.writeFileSync(OUT, html);

const byRole = ROLES.map((r) => r.label + ' ' + CASES.filter((c) => c.role === r.key).length).join(' · ');
console.log('\n  tools/uat/regression.html — ' + CASES.length + ' cases, ' +
  Math.round(html.length / 1024) + ' KB');
console.log('  ' + byRole);
console.log('  P1 smoke: ' + CASES.filter((c) => c.priority === 1).length + ' cases\n');
console.log('  Serve it:  preview_start { name: "uat" }   →  http://localhost:4604/regression.html\n');
