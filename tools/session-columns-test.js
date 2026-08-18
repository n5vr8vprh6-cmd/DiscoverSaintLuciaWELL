/* ============================================================================
   session-columns-test.js — can the Hub actually SEE the column it gates on?
   ----------------------------------------------------------------------------
     node tools/session-columns-test.js

   ── WHY THIS EXISTS ────────────────────────────────────────────────────────
   auth.js loads the signed-in advisor with an explicit column list. That is the
   right call — select('*') would ship every column to every screen — but it has
   one failure mode, and the codebase hit it three times running:

     A COLUMN MISSING FROM THE LIST IS `undefined`, NOT AN ERROR.

   017 added `plan_builds`. Nobody added it here. `balance()` read `undefined`,
   returned null, and every caller treats null as "do not gate" — so the $9
   pack never rendered for anybody, from the day it shipped until Duncan asked
   why he could not rebuild a plan.

   `foundations_at` and `immersion_at` were worse. rung() reads ONLY those two
   dates, so in the Hub every advisor was `registered`: a Foundations graduate
   generated copy forbidden from claiming they had been trained — the exact
   thing the training entitles them to say. It under-claimed rather than
   over-claimed, so nothing looked broken, so it survived.

   tools/builds-test.js passes throughout. It builds its own fixture objects and
   never loads a real session, so it proves the arithmetic and cannot see that
   the number never arrives. THIS is the test that can.

   ── WHAT IT DOES ───────────────────────────────────────────────────────────
   Reads every property accessed off a variable named advisor/self/target across
   api/, and asserts each snake_case one appears in SESSION_COLUMNS. Not clever,
   and it does not need to be: the failure it catches is a column name that
   nobody typed in a second place.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const API = path.join(ROOT, 'api');

let failed = 0;
function ok(what, cond, detail) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + what + (cond || !detail ? '' : '\n          ' + detail));
  if (!cond) failed++;
}

/* ── The list, read from the source rather than restated ──────────────────
   Restating it here would create the very thing this test exists to prevent:
   a second copy of a column list, drifting quietly from the first. */
const AUTH = fs.readFileSync(path.join(API, '_lib', 'auth.js'), 'utf8');
const declared = AUTH.match(/const SESSION_COLUMNS = '([^']+)'/);

ok('auth.js declares SESSION_COLUMNS', Boolean(declared),
  'the two loaders must share one list, or they drift');
if (!declared) process.exit(1);

const COLUMNS = declared[1].split(',').map((c) => c.trim()).filter(Boolean);

ok('and both loaders use it', (AUTH.match(/\.select\(SESSION_COLUMNS\)/g) || []).length === 2,
  'advisorFor() and the view-as lookup must read the same columns — an admin ' +
  'viewing as somebody must see what that person sees');
ok('with no literal column list left behind',
  !/\.select\('id, slug, public_code/.test(AUTH),
  'a hard-coded copy is how the two fell out of step in the first place');

/* ── Properties that are NOT session columns, and why ─────────────────────
   Every entry is a real read that this scan finds and must not fail on. Named
   individually with a reason, because a bare ignore-list grows until it
   silences the thing it was meant to catch.

   camelCase is excluded wholesale by the scan below: Postgres columns here are
   snake_case, so `viewingAs`, `authUserId` and `authEmail` are self-evidently
   values JavaScript attached after the query, not columns. */
const NOT_A_COLUMN = {
  auth_user_id: 'admin-advisor.js reads the ADMIN query (admin-data.js), which has its own select',
  created_at:   'same — the admin advisor detail screen, not the session',
  data:         'subject-data.js — a result envelope named advisor, not an advisor',
  js:           'api/hub/index.js — the string "advisor.js", a filename inside a route table'
};

/* ── The scan ─────────────────────────────────────────────────────────────── */
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((all, e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return all.concat(walk(p));
    return e.name.endsWith('.js') ? all.concat(p) : all;
  }, []);
}

const READ = /\b(?:advisor|self|target)\.([A-Za-z_][A-Za-z0-9_]*)/g;
const found = new Map();

walk(API).forEach((file) => {
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = READ.exec(src)) !== null) {
    const prop = m[1];
    if (/[A-Z]/.test(prop)) continue;            /* computed in JS, not a column */
    if (!found.has(prop)) found.set(prop, path.relative(ROOT, file));
  }
});

const missing = [];
found.forEach((where, prop) => {
  if (COLUMNS.indexOf(prop) !== -1) return;
  if (NOT_A_COLUMN[prop]) return;
  missing.push(prop + '   first read in ' + where);
});

console.log('\n  ' + found.size + ' properties read off an advisor · ' +
  COLUMNS.length + ' columns selected\n');

ok('every column the Hub reads is a column the Hub selects', missing.length === 0,
  'MISSING FROM SESSION_COLUMNS in api/_lib/auth.js:\n          ' + missing.join('\n          ') +
  '\n\n          Each one is `undefined` on every Hub page right now, and reads' +
  '\n          as "absent" rather than as an error.');

/* The three that were actually missing. Named explicitly, because a generic
   test passing tells you less than a specific one passing, and these three are
   the reason the file exists. */
['plan_builds', 'foundations_at', 'immersion_at'].forEach((c) => {
  ok('SESSION_COLUMNS carries ' + c, COLUMNS.indexOf(c) !== -1,
    c === 'plan_builds'
      ? 'without it the build balance is null and the pack never renders'
      : 'without it rung() returns "registered" for graduates and their copy under-claims');
});

/* ── The consequence, not just the string ─────────────────────────────────
   The column being in a SELECT is the mechanism; what matters is that the two
   functions reading it give the right answer. Cheap to assert, and it fails
   loudly if somebody "simplifies" the list later. */
const BUILDS = require('../api/_lib/builds.js');
const { rung } = require('../api/_lib/gtm.js');

const graduate = { id: 'g', foundations_at: '2026-01-01' };
const registered = { id: 'r', plan_builds: 3 };
const blind = { id: 'b' };   /* what every advisor looked like until today */

ok('a graduate is unmetered', BUILDS.unmetered(graduate) === true);
ok('a graduate is on the foundations rung', rung(graduate) === 'foundations',
  'this is what lets their copy say "trained in the Well Destination method"');
ok('a registered advisor has a readable balance', BUILDS.balance(registered) === 3);
ok('an advisor loaded without the columns still fails CLOSED',
  BUILDS.balance(blind) === null && BUILDS.mayBuild(blind) === null && rung(blind) === 'registered',
  'null means "cannot tell", callers fall back, and nobody is over-claimed for — ' +
  'which is why this bug was invisible and why that part was right');

console.log('\n  ' + (failed ? failed + ' FAILED\n' : 'All good.\n'));
process.exit(failed ? 1 : 0);
