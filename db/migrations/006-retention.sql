-- ============================================================================
-- 006-retention.sql — things stop being kept forever
-- ----------------------------------------------------------------------------
-- Privacy Policy §12 says personal information is retained "only as long as
-- reasonably necessary." Until this migration, nothing expired: a Journey
-- shared in 2026 — name, email, phone, and a free-text note about somebody's
-- wellbeing — would still be sitting in the table in 2036.
--
-- A policy that promises a limit the software does not enforce is the exact
-- discrepancy the Implementation Guide asks to have flagged, and the direction
-- of error that matters: claiming restraint we do not practise.
--
-- ── TWENTY-FOUR MONTHS, AND WHY BOOKED IS DIFFERENT ────────────────────────
-- Long enough that an advisor can revisit a traveller who went quiet and that a
-- Journey survives a full planning cycle; short enough to be a real limit
-- rather than a gesture.
--
-- A Journey at `booked` is excluded. It is no longer a lead, it is the record
-- of a transaction, and §12 already says transaction records are kept for tax,
-- accounting and legal purposes. Deleting those on a marketing clock would be
-- destroying business records, which is a different mistake in the opposite
-- direction.
--
-- ── THE FAILURE THIS IS DESIGNED AGAINST ───────────────────────────────────
-- A scheduled job that silently stops running. Nothing errors, nothing alerts,
-- and the retention promise quietly becomes false while every test still
-- passes — this project's recurring failure shape.
--
-- Two things guard it. Every run writes to admin_audit, so a job that stopped
-- leaves a visible gap rather than nothing at all. And the admin dashboard
-- shows the oldest Journey's age against the limit, so a dead job makes a
-- number climb past 24 months on the screen Duncan already opens.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

-- ── The limits, in one place ─────────────────────────────────────────────────
-- A function rather than a constant so the number is queryable from the
-- application, which is what lets the dashboard say "24 months" without a
-- second copy of it in JavaScript that can drift.
create or replace function retention_months(what text)
returns integer
language sql
immutable
as $$
  select case what
    when 'journey_shares' then 24
    -- Pseudonymous: no IP hash, no answers, no contact details. A session id
    -- and a timestamp. Kept the same length purely so there is one number to
    -- explain rather than three.
    when 'campaign_visits' then 24
    when 'finder_completions' then 24
    else 24
  end;
$$;

-- ── The purge ────────────────────────────────────────────────────────────────
-- SECURITY DEFINER so it can be scheduled by pg_cron and still write to
-- admin_audit, which is RLS-on with zero policies.
--
-- advisor_notes are not deleted here. They do not need to be: advisor_notes
-- .share_id is ON DELETE CASCADE (002-hub.sql), so they follow their Journey.
-- Deleting them separately would hide a broken cascade rather than surface it.
create or replace function purge_expired()
returns table (what text, removed integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  n_shares integer := 0;
  n_visits integer := 0;
  n_comps  integer := 0;
begin
  delete from journey_shares
   where created_at < now() - (retention_months('journey_shares') || ' months')::interval
     and coalesce(stage, 'new') <> 'booked';
  get diagnostics n_shares = row_count;

  delete from campaign_visits
   where created_at < now() - (retention_months('campaign_visits') || ' months')::interval;
  get diagnostics n_visits = row_count;

  delete from finder_completions
   where created_at < now() - (retention_months('finder_completions') || ' months')::interval;
  get diagnostics n_comps = row_count;

  -- Recorded even when nothing was removed. A run that deleted nothing is the
  -- normal case and is exactly the evidence that the job is alive — logging
  -- only non-empty runs would make a healthy system indistinguishable from a
  -- dead one.
  insert into admin_audit (admin_id, admin_email, action, detail)
  values (
    null,
    'system: retention',
    'retention_purge',
    jsonb_build_object(
      'journey_shares', n_shares,
      'campaign_visits', n_visits,
      'finder_completions', n_comps,
      'months', retention_months('journey_shares')
    )
  );

  return query
    select 'journey_shares'::text, n_shares
    union all select 'campaign_visits'::text, n_visits
    union all select 'finder_completions'::text, n_comps;
end;
$$;

revoke all on function purge_expired() from public, anon, authenticated;

-- ── Scheduling ───────────────────────────────────────────────────────────────
-- pg_cron if it is available. WRAPPED IN AN EXCEPTION HANDLER, because in the
-- Supabase SQL editor the whole script is one transaction: an error scheduling
-- the job would roll back purge_expired() itself, and the migration would report
-- failure by silently not existing.
--
-- Scheduling is the part most likely to fail (the extension may be unavailable,
-- or cron may live in a schema this role cannot reach), and it is also the least
-- important part — the function is what matters, and tools/retention.js can call
-- it. So a scheduling problem is a warning to act on, never a reason to lose the
-- function.
--
-- READ WHAT THIS PRINTS. An unscheduled purge is a retention policy that never
-- runs, and §12 of the privacy policy is only true while it does.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule('dslw-retention')
        where exists (select 1 from cron.job where jobname = 'dslw-retention');
      perform cron.schedule('dslw-retention', '17 3 * * *', 'select purge_expired();');
      raise notice 'RETENTION SCHEDULED: daily at 03:17 UTC as job dslw-retention.';
    exception when others then
      raise warning 'pg_cron is available but scheduling FAILED (%). purge_expired() exists and is unaffected — schedule tools/retention.js instead, or the retention policy never runs.', sqlerrm;
    end;
  else
    raise warning 'PG_CRON NOT AVAILABLE — purge_expired() exists but NOTHING WILL CALL IT. Run tools/retention.js on a schedule, or the retention policy is words only.';
  end if;
end $$;

-- One glance at the output answers "did this work".
select
  exists (select 1 from pg_proc where proname = 'purge_expired')    as has_purge,
  exists (select 1 from pg_proc where proname = 'retention_months') as has_limit,
  retention_months('journey_shares')                                as months;
