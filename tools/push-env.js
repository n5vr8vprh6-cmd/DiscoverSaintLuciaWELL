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

const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
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
  existing = execFileSync('vercel', ['env', 'ls'], { cwd: ROOT, encoding: 'utf8' });
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
      execFileSync('vercel', args, {
        cwd: ROOT,
        input: values[key],
        stdio: ['pipe', 'ignore', 'pipe']
      });
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
