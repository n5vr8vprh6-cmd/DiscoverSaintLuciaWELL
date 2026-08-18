-- ============================================================================
-- 018-immersion-waitlist.sql — people waiting for Immersion dates
-- ----------------------------------------------------------------------------
-- /advisors/immersion offers three routes and the third one used to be the
-- string "[ to be confirmed ]" — honest about the dates, but it made the only
-- question an interested advisor actually has ("when, and how much?") the one
-- place on the page where nothing happens. Cohort dates, price and group size
-- are still genuinely unset, so this does not invent them. It captures the
-- people who want to be told.
--
-- ── WHAT THIS IS NOT ────────────────────────────────────────────────────────
-- Not a booking, not a deposit, not a place held. Nobody on this list has been
-- promised anything, and the confirmation email says so in those words. If that
-- ever changes, it changes here first — a `status` column and a real offer —
-- not by the marketing copy quietly starting to imply it.
--
-- ── THESE ARE ADVISORS, NOT TRAVELLERS ──────────────────────────────────────
-- Which is why this is its own table rather than a flag on journey_shares. A
-- journey_share is a consumer's answers shared with an advisor; a row here is a
-- professional asking to hear about a trade programme. Same shape, different
-- relationship, different retention conversation, different erase path.
--
-- ── ERASURE IS NOT OPTIONAL ─────────────────────────────────────────────────
-- This is the first new store of personal data since the privacy work (P1–P5).
-- api/_lib/subject-data.js searches journey_shares, advisors and advisor_notes;
-- a table it does not know about is a table that survives a deletion request
-- while /hub/admin/subject reports success. So the module is extended in the
-- same change as this migration, and retention_months() below gets an entry.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
--
-- NOTE ON `raise`: the editor runs the whole script as ONE transaction, so a
-- RAISE EXCEPTION anywhere would roll back the DDL above it and leave you with
-- a clean-looking error and no table. Everything here warns and continues, and
-- the final SELECT is what tells you it worked.
-- ============================================================================

create table if not exists immersion_waitlist (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  first_name  text not null,
  last_name   text not null,
  email       text not null,
  phone       text,

  -- The advisor's own business, and the host agency they sell under. Optional
  -- because plenty of independents have neither, and a required field nobody
  -- can answer truthfully is a field that collects fiction.
  company     text,
  host_agency text,

  -- Which page sent them. One value today; a column rather than an assumption
  -- so a second waiting list does not need a second table.
  source      text not null default 'immersion',

  -- Salted hash, never an address — same rule as everywhere else in this
  -- schema. Null when IP_HASH_SALT is unset, which is a legitimate state.
  ip_hash     text,

  constraint immersion_waitlist_email_present check (length(trim(email)) > 0)
);

-- Case-insensitive uniqueness. Somebody who fills the form twice — because they
-- were not sure it worked, which is the most common reason — must not become
-- two people on a list Duncan later emails.
create unique index if not exists immersion_waitlist_email_key
  on immersion_waitlist (lower(email));

create index if not exists immersion_waitlist_created_idx
  on immersion_waitlist (created_at desc);

comment on table immersion_waitlist is
  'Advisors asking to be told when Saint Lucia WELL Immersion dates exist. Not a booking and not a held place. Erasable through /hub/admin/subject.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- On, with zero policies: service role only. Every read of this table goes
-- through api/_lib/waitlist.js behind requireAdmin. No advisor, signed in or
-- otherwise, has any business reading the list — including their own row.
alter table immersion_waitlist enable row level security;

-- ── Retention ────────────────────────────────────────────────────────────────
-- Re-stated in full because a `create or replace` replaces the whole body: this
-- is the 006 function with one arm added. Leaving it out would mean the new
-- table falls to the `else` default, which happens to be the same number today
-- and would silently stop being if 006 ever changes.
create or replace function retention_months(what text)
returns integer
language sql
immutable
as $$
  select case what
    when 'journey_shares' then 24
    when 'campaign_visits' then 24
    when 'finder_completions' then 24
    -- A waiting list for dates that do not exist yet has to outlive the wait.
    -- Same 24 months as everything else, so there is still one number to
    -- explain rather than four.
    when 'immersion_waitlist' then 24
    else 24
  end;
$$;

do $$
begin
  if not exists (select 1 from information_schema.tables
                  where table_name = 'immersion_waitlist') then
    raise warning 'immersion_waitlist was not created — read the error above this line.';
  end if;
end $$;

select
  exists (select 1 from information_schema.tables
           where table_name = 'immersion_waitlist')                as has_table,
  exists (select 1 from pg_indexes
           where indexname = 'immersion_waitlist_email_key')       as has_unique_email,
  (select relrowsecurity from pg_class
    where relname = 'immersion_waitlist')                          as rls_on,
  retention_months('immersion_waitlist')                           as retention_months,
  (select count(*) from immersion_waitlist)                        as rows_now;
