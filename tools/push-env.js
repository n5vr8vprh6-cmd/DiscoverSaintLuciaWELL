/* ============================================================================
   push-env.js — put the five secrets into Vercel without anyone reading them
   ----------------------------------------------------------------------------
   Reads a local .env (gitignored) and pushes each value to the Vercel project
   for Production and Preview.

   THE POINT IS THAT THE VALUES ARE NEVER DISPLAYED.
   They go from the file, down a pipe, into `vercel env add`. This script never
   prints a value, never writes one to a log, and never puts one in a chat
   transcript. It reports names and outcomes only. A service-role key bypasses
   every row-level-security policy on the database, so the fewer places it is
   ever rendered as text, the better.

   Run:  node tools/push-env.js          (add missing, skip existing)
         node tools/push-env.js --force  (overwrite existing)
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');
const FORCE = process.argv.includes('--force');
const TARGETS = ['production', 'preview'];

/* On Windows the Vercel CLI is a .cmd shim, and since the CVE-2024-27980 fix
   Node refuses to execFile one without a shell — it throws EINVAL, which reads
   exactly like "not installed" if you are not expecting it.

   So Windows gets `shell: true`. That is safe here specifically because the
   ARGUMENTS are literals we control — variable names and the words
   "production"/"preview" — and the SECRETS never appear among them. They
   arrive on stdin, which no shell ever sees. */
const WIN = process.platform === 'win32';
const VERCEL = WIN ? 'vercel.cmd' : 'vercel';
const SPAWN = { shell: WIN };

const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  /* New in V2. Phase 1 genuinely did not need this — the browser never spoke
     to Supabase. Auth changes that: the anon key is what exchanges an email and
     password for a session. It is safe to expose in principle, but it still
     lives server-side here because the browser talks only to our endpoints. */
  'SUPABASE_ANON_KEY',
  'RESEND_API_KEY',
  'NOTIFY_FROM',
  'IP_HASH_SALT'
];

if (!fs.existsSync(ENV_FILE)) {
  console.error('No .env found. Copy .env.example to .env and fill it in first.');
  process.exit(1);
}

/* Deliberately simple: KEY=value, ignore blanks and comments. Values are not
   unquoted or transformed beyond trimming, so whatever is in the file is
   exactly what Vercel receives. */
const values = {};
fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).forEach((line) => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const i = t.indexOf('=');
  if (i < 1) return;
  values[t.slice(0, i).trim()] = t.slice(i + 1).trim();
});

const missing = REQUIRED.filter((k) => !values[k]);
if (missing.length) {
  console.error('Still empty in .env:\n  ' + missing.join('\n  '));
  console.error('\nFill those in and run again. Nothing has been sent.');
  process.exit(1);
}

/* What already exists, so a re-run is safe rather than duplicating. */
let existing = '';
try {
  existing = execFileSync(VERCEL, ['env', 'ls'], Object.assign({ cwd: ROOT, encoding: 'utf8' }, SPAWN));
} catch (e) {
  console.error('Could not reach Vercel. Is the CLI logged in and the project linked?');
  process.exit(1);
}

let added = 0, skipped = 0, failed = 0;

for (const key of REQUIRED) {
  for (const target of TARGETS) {
    const already = new RegExp('^\\s*' + key + '\\s', 'm').test(existing);
    if (already && !FORCE) {
      console.log(`  skip   ${key} (${target}) — already set, use --force to replace`);
      skipped++;
      continue;
    }
    try {
      const args = ['env', 'add', key, target];
      if (FORCE) args.push('--force');
      /* The value arrives on stdin. It is never an argument, so it cannot
         appear in a process list or a shell history. */
      execFileSync(VERCEL, args, Object.assign({
        cwd: ROOT,
        input: values[key],
        stdio: ['pipe', 'ignore', 'pipe']
      }, SPAWN));
      console.log(`  added  ${key} (${target})`);
      added++;
    } catch (e) {
      const msg = String((e.stderr && e.stderr.toString()) || e.message)
        .split('\n').find((l) => l.trim()) || 'unknown error';
      console.log(`  FAILED ${key} (${target}) — ${msg.trim()}`);
      failed++;
    }
  }
}

console.log(`\n  ${added} added, ${skipped} skipped, ${failed} failed`);
if (added) console.log('  Redeploy for them to take effect: vercel redeploy');
process.exit(failed ? 1 : 0);
