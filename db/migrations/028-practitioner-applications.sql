-- ============================================================================
-- 028-practitioner-applications.sql — practitioners and retreat leaders
-- ----------------------------------------------------------------------------
-- /practitioners has one form and two pathways: Retreat Collaboration (someone
-- with a community who wants to lead a group in Saint Lucia) and the Visiting
-- Practitioner Network (someone whose work may complement a property's
-- programme). Both are qualification, not booking: DSW reads the application
-- and, if there is a fit, writes back privately by email.
--
-- ── WHAT A ROW MEANS, AND WHAT IT DOES NOT ──────────────────────────────────
-- Somebody described their work and asked DSW to consider it. Nothing is held,
-- promised or placed. `status` exists because review is a real process with real
-- states — unlike the Immersion waiting list, which deliberately has none — but
-- no state here means "accepted": `invited` records that DSW wrote back, not
-- that any programme, residency or placement exists.
--
-- ── ONE TABLE, TWO PATHWAYS ─────────────────────────────────────────────────
-- Shared fit fields are columns. The pathway-specific answers are jsonb, so a
-- third pathway or a reworded question does not need a migration and does not
-- leave a column nobody fills. The endpoint validates every value against a
-- fixed list before it gets here (api/_lib/practitioner.js).
--
-- ── NOT UNIQUE ON EMAIL, ON PURPOSE ─────────────────────────────────────────
-- The waiting list is one row per person. This is one row per APPLICATION: the
-- same person may apply for a retreat now and the network later, and a second
-- submission with better answers should not overwrite the first — DSW may want
-- to read both.
--
-- ── ERASURE IS NOT OPTIONAL ─────────────────────────────────────────────────
-- Same rule as migration 018: a store of personal data that api/_lib/
-- subject-data.js does not know about survives an erasure request while
-- /hub/admin/subject reports success. That module and retention_months() below
-- are extended in the same change as this file.
--
-- Run in the Supabase SQL editor. Additive and idempotent. The editor runs the
-- whole script as ONE transaction, so nothing here RAISEs — it warns, and the
-- final SELECT is what tells you it worked.
-- ============================================================================

create table if not exists practitioner_applications (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- 'retreat' | 'visiting' | 'both' — what the person said they are here for.
  pathway     text not null,

  -- Step 1 · about you
  first_name  text not null,
  last_name   text not null,
  email       text not null,
  phone       text,
  business    text not null,
  website     text,
  social      text,
  country     text not null,
  years       text,
  modality    text not null,

  -- Step 2 · shared fit fields
  work        text not null,
  serves      text not null,
  community   text not null,
  led_before  boolean not null default false,
  led_before_detail text,
  audience_size text,
  notes       text,

  -- Step 2 · pathway-specific. Null when the pathway does not apply.
  retreat     jsonb,
  visiting    jsonb,

  -- Where the form was opened from (?path=…), for the funnel. Free of anything
  -- identifying.
  source      text,

  -- Review. Set by a human, never by the form.
  status      text not null default 'new',
  reviewed_at timestamptz,

  -- Salted hash, never an address. Also what the rate limit counts: five
  -- applications an hour from one origin is a script, not a practitioner.
  ip_hash     text,

  constraint practitioner_pathway_valid
    check (pathway in ('retreat', 'visiting', 'both')),
  constraint practitioner_status_valid
    check (status in ('new', 'reviewing', 'invited', 'declined', 'archived')),
  constraint practitioner_email_present
    check (length(trim(email)) > 0)
);

create index if not exists practitioner_applications_created_idx
  on practitioner_applications (created_at desc);
create index if not exists practitioner_applications_email_idx
  on practitioner_applications (lower(email));
create index if not exists practitioner_applications_iphash_idx
  on practitioner_applications (ip_hash, created_at desc);

comment on table practitioner_applications is
  'Practitioner and retreat-leader applications from /practitioners. Not a booking, a placement or a promise. Erasable through /hub/admin/subject.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- On, with zero policies: service role only. Every read goes through server
-- code behind requireAdmin. Nobody signed in as an advisor has any business
-- reading who else has applied.
alter table practitioner_applications enable row level security;

-- ── Retention ────────────────────────────────────────────────────────────────
-- Both functions are re-stated IN FULL, because `create or replace` replaces the
-- whole body and 022 is the latest to have done so. This is 022's text with one
-- arm added to each. Writing it from 018's version instead would have silently
-- dropped 'capture_rate' (1 month) and 'design_generation' and the whole
-- itinerary-token sweep — so if a later migration redefines either function,
-- start from THAT one, not from this file.
--
-- Same 24 months as every other store, so there is still one number to explain.
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

  -- New in 028.
  delete from practitioner_applications
   where created_at < now() - (retention_months('practitioner_applications') || ' months')::interval;
  get diagnostics n_pract = row_count;

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
      'months', retention_months('journey_shares')
    )
  );

  return query
    select 'journey_shares'::text, n_shares
    union all select 'campaign_visits'::text, n_visits
    union all select 'finder_completions'::text, n_comps
    union all select 'design_generation'::text, n_gen
    union all select 'itinerary_tokens_expired'::text, n_tokens
    union all select 'practitioner_applications'::text, n_pract;
end;
$$;

-- purge_expired() is security definer and must not be callable by the public;
-- 006 revoked it, and re-creating a function does not always carry grants.
revoke all on function purge_expired() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from information_schema.tables
                  where table_name = 'practitioner_applications') then
    raise warning 'practitioner_applications was not created — read the error above this line.';
  end if;
end $$;

select
  exists (select 1 from information_schema.tables
           where table_name = 'practitioner_applications')          as has_table,
  (select relrowsecurity from pg_class
    where relname = 'practitioner_applications')                    as rls_on,
  retention_months('practitioner_applications')                     as retention_months,
  (select count(*) from practitioner_applications)                  as rows_now;
