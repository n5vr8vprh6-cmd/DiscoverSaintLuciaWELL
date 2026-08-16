/* ============================================================================
   disclosure-test.js — this week is the default, and nothing important hides
   ----------------------------------------------------------------------------
     node tools/disclosure-test.js

   Progressive disclosure has one failure mode that matters and it is not
   "the fold does not open". It is HIDING THE WRONG THING. A collapse that
   buries this week's actions, or the report, or somebody waiting for a reply,
   has made the product worse while every structural check still passes — the
   page renders, the markup is valid, the tests are green and the advisor
   never sees the thing they came for.

   So these assertions are mostly about what must stay OUT of a <details>.

   The second guard is inherited from D5a and gets stricter here, not looser:
   <details> hides content from the eye but not from the document, so folding
   something is not a way to make a Foundations mention "not count". The grep
   runs on the whole rendered string, collapsed content included.
   ========================================================================== */
'use strict';

const { planSection, waitingLine } = require('../api/_lib/campaign-blocks.js');

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  — ' + d : '')); } };

console.log('\n  PROGRESSIVE DISCLOSURE\n  ' + '─'.repeat(60) + '\n');

/* ── A plan to render ───────────────────────────────────────────────────── */
const asset = (id, body) => ({ id, status: 'ready', body, canonical_body: body, severity: 'low', angle: null });
const week = (n) => ({
  week: n,
  theme: `Theme for week ${n}`,
  actions: [
    { position: 1, title: `Post ${n}`, channel: 'instagram', assetKind: 'caption',
      why: '', asset: asset('as-' + n + '-1', `Caption body for week ${n}. WEEKMARK${n}A`) },
    { position: 2, title: `Email ${n}`, channel: 'email', assetKind: 'email',
      why: '', asset: asset('as-' + n + '-2', `Email body for week ${n}. WEEKMARK${n}B`) }
  ]
});
const rows = [week(1), week(2), week(3), week(4)];
const advisor = { id: 'a1', public_code: 'ABC123', first_name: 'Sam' };

const render = (o) => planSection(rows, Object.assign({
  advisor, planId: 'p1', premise: 'A premise.', mayRefresh: true, strip: '', report: ''
}, o));

/* Everything inside a top-level <details>, and everything outside one.

   THE FOLDS NEST: every ready asset carries its own <details class="gtm-angles">
   for "try another angle". The first version of this used a non-greedy regex
   and so cut each fold short at the first </details> it met — which was an
   angle block three levels in. Week 3 then "passed" on a truncated string
   while week 4 failed, and the test was wrong about the page rather than the
   page being wrong. Depth-counting instead. */
function split(html) {
  const re = /<details\b|<\/details>/g;
  let depth = 0, start = 0, m;
  const folds = [];
  while ((m = re.exec(html))) {
    if (m[0] === '</details>') {
      depth--;
      if (depth === 0) folds.push([start, re.lastIndex]);
    } else {
      if (depth === 0) start = m.index;
      depth++;
    }
  }
  let folded = '', open = '', at = 0;
  folds.forEach(([a, b]) => { open += html.slice(at, a); folded += html.slice(a, b); at = b; });
  open += html.slice(at);
  return { folded, open };
}

/* ══ MID-MONTH: this week is open, the rest is one click away ════════════ */
console.log('  Week 2 of 4 — this week leads');
const mid = render({ currentWeek: 2 });
const s = split(mid);

ok('this week\'s copy is visible without a click',
  /WEEKMARK2A/.test(s.open) && /WEEKMARK2B/.test(s.open),
  'the whole point is that Monday morning shows you what Monday asks for');
ok('and it is marked as this week', /this week/.test(s.open));

ok('next week is behind a fold', /WEEKMARK3A/.test(s.folded) && !/WEEKMARK3A/.test(s.open));
ok('so is week 4', /WEEKMARK4A/.test(s.folded) && !/WEEKMARK4A/.test(s.open));
ok('and last week is too', /WEEKMARK1A/.test(s.folded) && !/WEEKMARK1A/.test(s.open));

/* HIDDEN IS NOT GONE. */
ok('every week is still IN the document',
  [1, 2, 3, 4].every((n) => mid.indexOf('WEEKMARK' + n + 'A') !== -1),
  'details hides from the eye, not from Ctrl-F, a screen reader or the printer');

ok('the fold says how much is behind it',
  /Weeks 3–4/.test(mid) && /Week 1/.test(mid),
  'a summary reading only "show more" makes somebody spend a click to find out if the click was worth it');
ok('what is coming and what is done are separate folds',
  (mid.match(/<details/g) || []).length >= 2,
  'a week already behind you and a week ahead of you are not the same thing');

/* ══ THINGS THAT MUST NEVER BE FOLDED ════════════════════════════════════ */
console.log('\n  What a fold must never swallow');
const withReport = render({
  currentWeek: 2,
  report: '<section class="hub-card gtm-report"><h2>What happened</h2>REPORTMARK</section>',
  strip: '<p class="gtm-provenance">Built from: STRIPMARK</p>',
  waiting: 3
});
const r = split(withReport);

ok('the report is NOT inside a fold', /REPORTMARK/.test(r.open) && !/REPORTMARK/.test(r.folded),
  'it is the only thing in the product that tells an advisor whether any of this worked');
ok('the confidence strip is NOT inside a fold', /STRIPMARK/.test(r.open),
  'provenance the advisor has to click to see is provenance they will not see');
ok('people waiting are NOT inside a fold',
  /waiting to hear from you/.test(r.open) && !/waiting to hear from you/.test(r.folded),
  'someone who asked to be contacted outranks every action in the plan');
ok('and they are ABOVE this week\'s actions',
  withReport.indexOf('waiting to hear from you') < withReport.indexOf('WEEKMARK2A'),
  'a campaign that keeps posting while the replies pile up has failed at the thing it was for');

/* ══ ORDER ═══════════════════════════════════════════════════════════════
   Measured at 380px, the first arrangement of this card put this week 1717px
   down — under the strip and a 727px report. Everything was present, nothing
   was folded that should not have been, and every assertion above passed.
   Collapsing three weeks and then burying the fourth is the same scroll with
   extra steps, so the order itself needs a guard. */
console.log('\n  The order the card is read in');
const at = (mark) => withReport.indexOf(mark);
ok('this week comes before "what happened"', at('WEEKMARK2A') < at('REPORTMARK'),
  'what to do now, then whether the last thing worked — that is the order the questions arrive in');
ok('this week comes before the provenance strip', at('WEEKMARK2A') < at('STRIPMARK'),
  'provenance is the quietest thing on the card and must not sit on top of the loudest');
ok('and before "build a new plan"', at('WEEKMARK2A') < at('gtm-plan-actions'),
  'rebuilding is not a Monday-morning act');
ok('the folds sit with this week, not after the report',
  at('What is coming') < at('REPORTMARK'),
  'the rest of the plan belongs beside the plan');

/* ══ THE MONTH IS OVER ═══════════════════════════════════════════════════ */
console.log('\n  When there is no "this week"');
const over = render({ currentWeek: null });
const o = split(over);
ok('nothing is folded at all', !/<details class="gtm-more"/.test(over),
  'with no current week there is nothing to focus on, and showing all of it is never wrong — only longer');
ok('every week is open', [1, 2, 3, 4].every((n) => new RegExp('WEEKMARK' + n + 'A').test(o.open)));

/* Week 1 with nothing behind it yet. */
console.log('\n  Week 1 — nothing is behind you yet');
const first = render({ currentWeek: 1 });
ok('there is no "already behind you" fold', !/Already behind you/.test(first),
  'an empty fold labelled with the past is a click that leads nowhere');
ok('but what is coming still folds', /What is coming/.test(first));
ok('this week is open', /WEEKMARK1A/.test(split(first).open));

/* ══ THE INHERITED GUARD, MADE STRICTER ══════════════════════════════════ */
console.log('\n  Folding is not a way to smuggle Foundations in');
const quiet = render({ currentWeek: 2, report: '', waiting: 0 });
ok('no Foundations mention anywhere in the plan before a result',
  !/advisors\/foundations/.test(quiet.replace(/gtm-locked[\s\S]*?<\/p>/g, '')),
  'the grep runs on the WHOLE string, collapsed content included — hiding it is not the same as not saying it');

/* ══ waitingLine ═════════════════════════════════════════════════════════ */
console.log('\n  The waiting line counts properly');
ok('nobody waiting renders nothing', waitingLine(0) === '' && waitingLine(null) === '',
  '"0 people are waiting" is a sentence nobody needs to read');
ok('one is singular', /One person is waiting/.test(waitingLine(1)));
ok('two is plural', /2 people are waiting/.test(waitingLine(2)));
ok('it points at the Journeys screen', /href="\/hub\/journeys"/.test(waitingLine(1)));

console.log('\n  ' + '─'.repeat(60));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
