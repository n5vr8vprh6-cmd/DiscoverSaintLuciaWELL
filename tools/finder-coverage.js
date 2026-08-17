/* ============================================================================
   finder-coverage.js — can the Journey Finder actually reach every village?
   ----------------------------------------------------------------------------
     node tools/finder-coverage.js            the full report
     node tools/finder-coverage.js --check    exit non-zero if the quiz is skewed

   WHY THIS EXISTS
   Duncan ran the Finder several times by hand and never once got Longevity
   Village. Not a crash, not an error — an ABSENCE, which is the hardest kind of
   fault to notice and the only kind this quiz can have. A skewed Finder still
   returns a village, still renders, still looks like it works.

   Six questions at 5 × 6 × 4 × 3 × 3 × 2 is 2,160 combinations. That is small
   enough to enumerate exhaustively, so there is no reason to sample or to
   reason about it. Count them all.

   WEIGHTS ARE EXACTLY THE THING THAT GETS NUDGED AND NEVER RE-MEASURED. A copy
   pass moves an option, the balance shifts, and nothing anywhere says so. This
   turns "somebody should check" into one command, and --check into something a
   build can fail on.

   IT REPLICATES THE SCORER, IT DOES NOT RE-IMPLEMENT IT. rank() below is a
   transcription of score() in js/journey.js, tie-break included — `b.n - a.n
   || a.i - b.i`, which falls back to the villages array order. That fallback
   settles 17% of all combinations at the current weights, so a report that
   quietly resolved ties differently would describe a quiz nobody takes.

   And a transcription is only worth anything while it is still faithful, so
   this does not ask you to take that on trust: it lifts the real score() out
   of the shipped source and runs BOTH on all 2,160, refusing to print a single
   number if they ever disagree. See shippedScorer().
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { finderData: DATA } = require('../content/journey.js');
const { VILLAGES } = require('../content/villages.js');

const Q = DATA.questions;
const V = DATA.villages;

/* Floors and ceilings. Deliberately loose — this is a guard against a quiz
   going lopsided, not an argument that six villages must be exactly equal. */
const MIN_FIRST = 0.08;   /* every village wins at least 8% of the time */
const MAX_DOMINANCE = 0.90; /* no single question decides more than 90% */

/* ── The scorer, transcribed from js/journey.js:175 ───────────────────────── */
function rank(pick) {
  const totals = {};
  V.forEach((v) => { totals[v.key] = 0; });

  Q.forEach((q, qi) => {
    const opt = q.options[pick[qi]];
    if (!opt || !opt.weights) return;
    Object.keys(opt.weights).forEach((k) => {
      if (totals[k] !== undefined) totals[k] += opt.weights[k];
    });
  });

  const ordered = V
    .map((v, i) => ({ v, n: totals[v.key], i }))
    .sort((a, b) => b.n - a.n || a.i - b.i);

  /* Was first place decided by the weights, or by the array order? */
  const tied = ordered.length > 1 && ordered[0].n === ordered[1].n;
  return { top: ordered.slice(0, 3).map((r) => r.v.key), tied, lead: ordered[0].n };
}

/* ── Proof that the transcription is still a transcription ────────────────
   A copy of a scorer is only useful while it is still a copy, and nothing
   about `js/journey.js` forces this file to keep up. So don't trust the
   transcription: lift the REAL `score()` out of the shipped source as text,
   run it, and compare. If somebody edits the tie-break, adds a multiplier or
   changes how a missing answer is treated, this refuses to print a report
   rather than quietly describing a quiz nobody takes.

   Reading the source as text (rather than requiring it) is deliberate:
   js/journey.js is browser code inside an IIFE closed over `answers`, and it
   has no module boundary to import. Evaluating the one function is the only
   way to run the thing that actually ships. */
function shippedScorer() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'journey.js'), 'utf8');
  const start = src.indexOf('function score()');
  if (start < 0) {
    fail('js/journey.js no longer contains `function score()` — the Finder has been '
      + 'restructured and this report cannot know what it now scores.');
  }
  let depth = 0, end = -1;
  for (let i = src.indexOf('{', start); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (!depth) { end = i + 1; break; } }
  }
  const body = src.slice(start, end);
  /* eslint-disable no-new-func */
  const run = new Function('DATA', 'questions', 'answers', body + '\nreturn score();');
  return (pick) => {
    const answers = {};
    Q.forEach((q, qi) => { answers[q.id] = q.options[pick[qi]].value; });
    return run(DATA, Q, answers).map((v) => v.key);
  };
}

function fail(msg) {
  console.error('\n  REFUSING TO REPORT\n\n    ' + msg + '\n');
  process.exit(2);
}

function every(fn) {
  const pick = Q.map(() => 0);
  for (;;) {
    fn(pick.slice());
    let p = Q.length - 1;
    while (p >= 0) {
      pick[p] += 1;
      if (pick[p] < Q[p].options.length) break;
      pick[p] = 0; p -= 1;
    }
    if (p < 0) return;
  }
}

/* ── Agree with the shipped scorer, on every single combination ──────────── */
const shipped = shippedScorer();
const expected = Q.reduce((n, q) => n * q.options.length, 1);
{
  let n = 0, disagreed = null;
  every((pick) => {
    n += 1;
    if (disagreed) return;
    const mine = rank(pick).top.join(',');
    const theirs = shipped(pick).join(',');
    if (mine !== theirs) {
      disagreed = { pick, mine, theirs };
    }
  });
  if (disagreed) {
    fail('this report disagrees with js/journey.js.\n\n    answers:  '
      + Q.map((q, i) => q.id + '=' + q.options[disagreed.pick[i]].value).join(', ')
      + '\n    shipped:  ' + disagreed.theirs + '\n    here:     ' + disagreed.mine
      + '\n\n    Re-transcribe rank() from js/journey.js before trusting any number below.');
  }
  /* The enumeration must be exhaustive, not merely large — a walker that
     silently stopped early would make every village look fine. */
  if (n !== expected) {
    fail('enumerated ' + n + ' combinations, expected ' + expected
      + ' (' + Q.map((q) => q.options.length).join(' × ') + ').');
  }
}

/* ── Gather ───────────────────────────────────────────────────────────────── */
const first = {}, top3 = {};
V.forEach((v) => { first[v.key] = 0; top3[v.key] = 0; });

const perOption = {};
Q.forEach((q, qi) => q.options.forEach((o, oi) => {
  perOption[qi + '|' + oi] = { q: q.id, label: (o.label || o.value || '').trim(), n: 0, wins: {} };
}));

let total = 0, tieDecided = 0;
every((pick) => {
  const r = rank(pick);
  total += 1;
  if (r.tied) tieDecided += 1;
  first[r.top[0]] += 1;
  r.top.forEach((k) => { top3[k] += 1; });
  Q.forEach((q, qi) => {
    const s = perOption[qi + '|' + pick[qi]];
    s.n += 1;
    s.wins[r.top[0]] = (s.wins[r.top[0]] || 0) + 1;
  });
});

/* How much each question decides: change this answer alone, hold the rest. */
const dominance = Q.map((q, qi) => {
  let flips = 0, tries = 0;
  every((pick) => {
    const base = rank(pick).top[0];
    for (let o = 0; o < q.options.length; o += 1) {
      if (o === pick[qi]) continue;
      const alt = pick.slice(); alt[qi] = o; tries += 1;
      if (rank(alt).top[0] !== base) flips += 1;
    }
  });
  return { id: q.id, rate: flips / tries };
});

/* ── Report ───────────────────────────────────────────────────────────────── */
const pct = (n) => (n * 100).toFixed(1).padStart(5) + '%';
const bar = (n, w) => '█'.repeat(Math.round(n * w));

const anchors = {};
VILLAGES.forEach((v) => { anchors[v.key] = (v.anchors || []).map((a) => a.name); });

console.log('\n  JOURNEY FINDER · COVERAGE\n  ' + '─'.repeat(72));
console.log('  ' + Q.map((q) => q.id + '(' + q.options.length + ')').join(' × ')
  + '  =  ' + total + ' combinations, every one of them scored by js/journey.js\n');

console.log('  VILLAGE          FIRST            IN TOP 3   ANCHOR PROPERTIES');
console.log('  ' + '─'.repeat(72));
V.forEach((v) => {
  const props = (anchors[v.key] || []).join(', ') || '—';
  console.log('  ' + v.key.padEnd(15) + pct(first[v.key] / total) + ' ' +
    bar(first[v.key] / total, 22).padEnd(23) + pct(top3[v.key] / total) + '   ' + props.slice(0, 30));
});

console.log('\n  HOW MUCH EACH QUESTION DECIDES');
console.log('  (change one answer, hold the rest — how often does the village flip?)');
console.log('  ' + '─'.repeat(72));
dominance.forEach((d) => {
  console.log('  ' + d.id.padEnd(15) + pct(d.rate) + ' ' + bar(d.rate, 44));
});

console.log('\n  ANSWERS THAT MAKE A VILLAGE IMPOSSIBLE');
console.log('  ' + '─'.repeat(72));
let impossible = 0;
V.forEach((v) => {
  const dead = Object.values(perOption).filter((s) => !s.wins[v.key]);
  if (!dead.length) return;
  impossible += dead.length;
  console.log('  ' + v.key);
  dead.forEach((s) => console.log('      ' + s.q.padEnd(13) + s.label.slice(0, 46)));
});
if (!impossible) console.log('  none — every answer leaves every village reachable');

console.log('\n  STRONGEST ROUTE TO EACH VILLAGE');
console.log('  ' + '─'.repeat(72));
V.forEach((v) => {
  const best = Object.values(perOption)
    .map((s) => ({ s, r: (s.wins[v.key] || 0) / s.n }))
    .sort((a, b) => b.r - a.r)[0];
  console.log('  ' + v.key.padEnd(15) + pct(best.r) + '  ' + best.s.q + ': ' + best.s.label.slice(0, 40));
});

console.log('\n  Decided by the array-order tie-break rather than by weight: '
  + tieDecided + ' of ' + total + ' (' + (tieDecided / total * 100).toFixed(1) + '%)');

/* ── --check ──────────────────────────────────────────────────────────────── */
if (process.argv.includes('--check')) {
  const problems = [];
  V.forEach((v) => {
    const r = first[v.key] / total;
    if (r < MIN_FIRST) {
      problems.push(v.key + ' is the closest match only ' + (r * 100).toFixed(1)
        + '% of the time (floor ' + (MIN_FIRST * 100) + '%) — its anchor properties barely surface');
    }
  });
  dominance.forEach((d) => {
    if (d.rate > MAX_DOMINANCE) {
      problems.push(d.id + ' decides ' + (d.rate * 100).toFixed(0)
        + '% of results (ceiling ' + (MAX_DOMINANCE * 100) + '%) — the other questions are decoration');
    }
  });

  console.log('\n  ' + '─'.repeat(72));
  if (problems.length) {
    console.log('  FAILED\n');
    problems.forEach((p) => console.log('    · ' + p));
    console.log('');
    process.exit(1);
  }
  console.log('  OK — every village reachable, no question past the ceiling\n');
}
