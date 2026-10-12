-- ============================================================================
-- 029-advisor-group-applications.sql — WELL Group Studio applications
-- ----------------------------------------------------------------------------
-- /advisors/groups has one form: an experienced travel advisor or group
-- producer describing a group concept and asking DSW to consider a
-- collaboration. It is qualification, not booking. DSW reads the application
-- and, if there is a fit, writes back privately by email.
--
-- ── WHAT A ROW MEANS, AND WHAT IT DOES NOT ──────────────────────────────────
-- Somebody described a group concept and asked DSW to consider it. Nothing is
-- held, priced, promised or scheduled. `status` records review, and no state
-- means "accepted": `invited` records that DSW wrote back, not that a
-- departure, a rate or a commission exists.
--
-- ── WHY A TABLE OF ITS OWN, NOT practitioner_applications ──────────────────
-- A practitioner is asking to be considered for a retreat or a place in a
-- network. An advisor is asking to produce a group around an audience they
-- already sell to. Those are different people with different questions and
-- different answers to "who do you reach", and the brief is explicit that the
-- two must not blend. `submission_source` is therefore a column with a
-- constraint rather than a convention: a row that is not
-- 'advisor_group_studio' cannot be written here, and a row written here cannot
-- be mistaken for a practitioner's.
--
-- ── NOT UNIQUE ON EMAIL, ON PURPOSE ────────────────────────────────────────
-- One row per APPLICATION. The same advisor may apply for a different concept
-- later, and a second submission should not overwrite the first.
--
-- ── ERASURE IS NOT OPTIONAL ────────────────────────────────────────────────
-- Same rule as 018 and 028: a store of personal data that
-- api/_lib/subject-data.js does not know about survives an erasure request
-- while /hub/admin/subject reports success. That module is extended in the
-- same change as this file, and retention_months()/purge_expired() below gain
-- an arm for this table.
--
-- ── RUN THIS BEFORE TURNING THE FORM ON ────────────────────────────────────
-- /advisors/groups renders no form while SITE.groupStudio.intakeOpen is false
-- (content/site.js). Run this in the Supabase SQL editor, check the final
-- SELECT, THEN flip the flag and deploy. api/_lib/group-studio.js fails
-- closed ("unavailable") without the table, but the page should not invite
-- the attempt.
--
-- Additive and idempotent. The editor runs the whole script as ONE
-- transaction, so nothing here RAISEs — it warns, and the final SELECT is what
-- tells you it worked.
-- ============================================================================

create table if not exists advisor_group_applications (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Always 'advisor_group_studio'. A column and a constraint, not a habit.
  submission_source text not null default 'advisor_group_studio',

  -- About you
  first_name  text not null,
  last_name   text not null,
  email       text not null,
  phone       text,
  business    text not null,
  website     text,
  social      text,
  country     text not null,
  host_agency text,
  experience  text,
  group_experience text,

  -- What they are asking about: 'eclipse' | 'custom' | 'unsure'
  program_interest text not null,

  -- The concept
  concept     text not null,
  audience    text not null,
  audience_size text,
  expected_travellers text,
  departure_window text,
  budget_range text,

  -- Codes from the fixed list in api/_lib/group-studio.js. jsonb so that a
  -- new option is not a migration; the endpoint refuses anything off-list
  -- before it gets here.
  support_needed jsonb not null default '[]'::jsonb,

  how_you_sell text not null,
  notes       text,

  -- The brief requires consent to be contacted about THIS application, kept
  -- as a column so that an application without it cannot exist.
  contact_consent boolean not null,

  -- Where the form was opened from (?path=…), for the funnel.
  source      text,

  -- Review. Set by a human, never by the form.
  status      text not null default 'new',
  reviewed_at timestamptz,

  -- Salted hash, never an address. Also what the rate limit counts.
  ip_hash     text,

  constraint group_application_source_valid
    check (submission_source = 'advisor_group_studio'),
  constraint group_application_interest_valid
    check (program_interest in ('eclipse', 'custom', 'unsure')),
  constraint group_application_status_valid
    check (status in ('new', 'reviewing', 'invited', 'declined', 'archived')),
  constraint group_application_email_present
    check (length(trim(email)) > 0),
  constraint group_application_consent_given
    check (contact_consent is true)
);

create index if not exists advisor_group_applications_created_idx
  on advisor_group_applications (created_at desc);
create index if not exists advisor_group_applications_email_idx
  on advisor_group_applications (lower(email));
create index if not exists advisor_group_applications_iphash_idx
  on advisor_group_applications (ip_hash, created_at desc);

comment on table advisor_group_applications is
  'WELL Group Studio applications from /advisors/groups. Not a booking, a quote or a promise. Kept apart from practitioner_applications on purpose. Erasable through /hub/admin/subject.';

-- ── RLS ────────────────────────────────────────────────────────────────────
-- On, with zero policies: service role only. Every read goes through server
-- code behind requireAdmin.
alter table advisor_group_applications enable row level security;

-- ── Retention ──────────────────────────────────────────────────────────────
-- Both functions are re-stated IN FULL, because `create or replace` replaces
-- the whole body. This is 028's text — the latest to have defined them — with
-- one arm added to each. Starting from an older migration would silently drop
-- 'practitioner_applications', 'capture_rate' and 'design_generation' and the
-- itinerary-token sweep. If a later migration redefines either function,
-- start from THAT one, not from this file.
--
-- Same 24 months as every other store, so there is still one number to
-- explain.
create or replace function retention_months(what text)
returns integer
language sql
immutable
as $$
  select case what
    when 'journey_shares' then 24
    when 'campaign_visits' then 24
    when 'finder_completions' then 24
    when 'immersion_waitlist' then 24
    when 'capture_rate' then 1
    when 'design_generation' then 24
    when 'practitioner_applications' then 24
    when 'advisor_group_applications' then 24
    else 24
  end;
$$;

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
  n_gen    integer := 0;
  n_tokens integer := 0;
  n_pract  integer := 0;
  n_group  integer := 0;
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

  delete from design_generation
   where created_at < now() - (retention_months('design_generation') || ' months')::interval;
  get diagnostics n_gen = row_count;

  update journey_itineraries
     set share_token_hash = null
   where share_token_hash is not null
     and share_expires_at is not null
     and share_expires_at < now();
  get diagnostics n_tokens = row_count;

  delete from practitioner_applications
   where created_at < now() - (retention_months('practitioner_applications') || ' months')::interval;
  get diagnostics n_pract = row_count;

  -- New in 029.
  delete from advisor_group_applications
   where created_at < now() - (retention_months('advisor_group_applications') || ' months')::interval;
  get diagnostics n_group = row_count;

  -- Recorded even when nothing was removed. A run that deleted nothing is the
  -- normal case and is exactly the evidence that the job is alive.
  insert into admin_audit (admin_id, admin_email, action, detail)
  values (
    null,
    'system: retention',
    'retention_purge',
    jsonb_build_object(
      'journey_shares', n_shares,
      'campaign_visits', n_visits,
      'finder_completions', n_comps,
      'design_generation', n_gen,
      'itinerary_tokens_expired', n_tokens,
      'practitioner_applications', n_pract,
      'advisor_group_applications', n_group,
      'months', retention_months('journey_shares')
    )
  );

  return query
    select 'journey_shares'::text, n_shares
    union all select 'campaign_visits'::text, n_visits
    union all select 'finder_completions'::text, n_comps
    union all select 'design_generation'::text, n_gen
    union all select 'itinerary_tokens_expired'::text, n_tokens
    union all select 'practitioner_applications'::text, n_pract
    union all select 'advisor_group_applications'::text, n_group;
end;
$$;

-- purge_expired() is security definer and must not be callable by the public;
-- 006 revoked it, and re-creating a function does not always carry grants.
revoke all on function purge_expired() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from information_schema.tables
                  where table_name = 'advisor_group_applications') then
    raise warning 'advisor_group_applications was not created — read the error above this line.';
  end if;
end $$;

select
  exists (select 1 from information_schema.tables
           where table_name = 'advisor_group_applications')          as has_table,
  (select relrowsecurity from pg_class
    where relname = 'advisor_group_applications')                    as rls_on,
  retention_months('advisor_group_applications')                     as retention_months,
  retention_months('practitioner_applications')                      as practitioner_still_24,
  (select count(*) from advisor_group_applications)                  as rows_now;
