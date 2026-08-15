/* ============================================================================
   retention.js — run the retention sweep, and say whether it is needed at all
   ----------------------------------------------------------------------------
   db/migrations/006-retention.sql schedules purge_expired() with pg_cron when
   the extension is available. This is the fallback for when it is not, and the
   way to check the sweep by hand either way.

     node tools/retention.js            report only — nothing is deleted
     node tools/retention.js --run      call purge_expired()

   THE REPORT IS THE POINT, not the runner. A retention policy fails silently:
   the job stops, nothing errors, every test still passes, and §12 of the policy
   quietly becomes untrue. So this prints the two signals that fail differently
   — when the sweep last ran, and how old the oldest Journey is against the
   limit — and says plainly which state it is in.

   Consumer addresses are never printed. Ages and counts only.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ENV = path.join(__dirname, '..', '.env');
if (fs.existsSync(ENV)) {
  fs.readFileSync(ENV, 'utf8').split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  });
}

const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });
const RUN = process.argv.includes('--run');

const days = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

(async () => {
  /* Migration 006 landing is the precondition for everything else here, so it
     is checked first and reported as itself rather than as a confusing failure
     three queries later. */
  const { data: months, error: noFn } = await db.rpc('retention_months', { what: 'journey_shares' });
  if (noFn) {
    console.log('\n  Migration 006 has not been applied.');
    console.log('  purge_expired() does not exist, so NOTHING EXPIRES and §12 of the');
    console.log('  privacy policy is not true yet. Run db/migrations/006-retention.sql.\n');
    process.exit(1);
  }

  const limitDays = Math.round(months * 30.44);

  const [{ data: oldest }, { data: last }, { count: total }] = await Promise.all([
    db.from('journey_shares').select('created_at').neq('stage', 'booked')
      .order('created_at', { ascending: true }).limit(1),
    db.from('admin_audit').select('created_at, detail').eq('action', 'retention_purge')
      .order('created_at', { ascending: false }).limit(1),
    db.from('journey_shares').select('id', { count: 'exact', head: true })
  ]);

  const o = (oldest || [])[0];
  const l = (last || [])[0];

  console.log('');
  console.log('  Retention limit        ' + months + ' months (' + limitDays + ' days)');
  console.log('  Journeys held          ' + (total || 0));
  console.log('  Oldest (not booked)    ' + (o ? days(o.created_at) + ' days' : 'none held'));
  console.log('  Last sweep             ' + (l ? days(l.created_at) + ' days ago' : 'NEVER'));
  if (l && l.detail) {
    console.log('    that run removed     ' + JSON.stringify(l.detail));
  }
  console.log('');

  /* The three states worth telling apart. "Nothing was deleted" is the healthy
     answer almost every day, and must not read like a failure — while a sweep
     that has silently stopped must not read like success. */
  if (o && days(o.created_at) > limitDays) {
    console.log('  ✗ A Journey is PAST the limit. The sweep is not running.');
    console.log('    Until it is fixed, the retention promise is words only.');
  } else if (!l) {
    console.log('  ! No sweep has ever run. Normal immediately after the migration.');
    console.log('    If pg_cron was unavailable, schedule this script instead.');
  } else if (days(l.created_at) > 3) {
    console.log('  ! The last sweep was ' + days(l.created_at) + ' days ago. It runs daily,');
    console.log('    so something has stopped it. Nothing is over the limit yet.');
  } else {
    console.log('  ✓ Sweeping, and nothing is over the limit.');
  }
  console.log('');

  if (!RUN) {
    console.log('  Nothing was deleted. Pass --run to sweep.\n');
    return;
  }

  const { data, error } = await db.rpc('purge_expired');
  if (error) {
    console.error('  Sweep FAILED:', error.message, '\n');
    process.exit(1);
  }
  console.log('  Swept:');
  (data || []).forEach((r) => console.log('    ' + String(r.what).padEnd(20) + r.removed + ' removed'));
  console.log('');
})();
