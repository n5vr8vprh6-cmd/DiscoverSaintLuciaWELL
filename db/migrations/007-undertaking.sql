-- ============================================================================
-- 007-undertaking.sql — advisors record what they promised, and when
-- ----------------------------------------------------------------------------
-- The one place personal data leaves this system is an advisor receiving a
-- traveller's name, email, phone and free-text note. Until now nothing bound
-- them: registration said "you agree to our terms" and /terms is a consumer
-- document that says nothing about handling somebody's details.
--
-- content/advisor-undertaking.js is the document. These two columns are the
-- evidence that a particular person accepted a particular version of it — the
-- same pattern as journey_shares.consent_text, for the same reason. An
-- acceptance you cannot tie to wording is not an acceptance.
--
-- ── NOT BACKFILLED, DELIBERATELY ───────────────────────────────────────────
-- The eleven existing advisors are left NULL. It would be one UPDATE to stamp
-- them all as having accepted, and it would be a forgery: they have never seen
-- this document. They are gated at their next sign-in instead (api/_lib/auth.js),
-- which costs them one screen and makes the record true.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

alter table advisors add column if not exists undertaking_version text;
alter table advisors add column if not exists undertaking_at      timestamptz;

comment on column advisors.undertaking_version is
  'Version string of the Advisor Data Undertaking this advisor accepted. NULL means they have not accepted any version and are gated at sign-in. Never backfill this.';

-- ── The advisor may not write these ──────────────────────────────────────────
-- 004-admin.sql replaced the blanket UPDATE grant with an allow-list of profile
-- columns, precisely so that a new sensitive column is NOT silently writable.
-- That allow-list is re-stated here rather than amended, because a grant is
-- absolute: re-running the original GRANT would not remove anything, and the
-- only way to be certain these two columns are excluded is to say what IS
-- included. They are set through the service role, from the accept screen.
revoke update on advisors from authenticated;
grant update (
  first_name, last_name, business, host_agency, phone,
  website, socials, bio, market, photo_url
) on advisors to authenticated;

-- ── Reporting, NOT asserting ────────────────────────────────────────────────
-- This block used to RAISE EXCEPTION when a sensitive column was writable. In
-- the Supabase SQL editor the whole script is one transaction, so raising here
-- rolled back the ALTER TABLEs above it — and the migration reported failure by
-- silently not existing, which reads exactly like "I forgot to run it".
--
-- A check that can undo the change it is checking is worse than no check. So it
-- reports, and the real assertion lives in tools/check-migration.js where a
-- failure is a red test rather than a vanished migration.
do $$
declare
  leaked text;
begin
  select string_agg(column_name, ', ') into leaked
    from information_schema.column_privileges
   where table_name = 'advisors'
     and grantee = 'authenticated'
     and privilege_type = 'UPDATE'
     and column_name in ('undertaking_version', 'undertaking_at', 'role', 'is_master', 'status');

  if leaked is not null then
    raise warning 'SENSITIVE COLUMNS ARE ADVISOR-WRITABLE: % — the acceptance record would be self-certified. Fix the grants before trusting it.', leaked;
  else
    raise notice 'Column grants verified: advisors cannot write their own undertaking, role or status.';
  end if;
end $$;

-- Confirms the two columns are really here, in the same breath as the notice
-- above, so one glance at the output answers "did this work".
select
  count(*) filter (where column_name = 'undertaking_version') as has_version,
  count(*) filter (where column_name = 'undertaking_at')      as has_at
from information_schema.columns
where table_name = 'advisors';
