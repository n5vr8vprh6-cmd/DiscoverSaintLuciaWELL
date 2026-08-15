-- ============================================================================
-- 011-gtm.sql — what we know about an advisor's business
-- ----------------------------------------------------------------------------
-- The inputs to the 30-day campaign plan. V2 spec §5 asks for advisor profile,
-- digital presence and audience context, and §16 says to extend the existing
-- schema rather than duplicate it — so this is one table hanging off advisors,
-- not a second identity.
--
-- ── BANDS, NOT COUNTS ──────────────────────────────────────────────────────
-- Audience size is stored as a range. Three reasons, and the third is the one
-- that matters: an exact number is stale the day after it is typed; nobody
-- knows their list size to the person anyway; and asking for a precise figure
-- invites a flattering one. A band is honest and it is all the generator needs
-- — the difference between "email a hundred past clients" and "run an event"
-- is an order of magnitude, not a number.
--
-- ── TWO DATES, ONE LADDER ──────────────────────────────────────────────────
-- foundations_at and immersion_at sit on the advisor row because they are
-- facts about the person, not about a campaign. Between them they decide what
-- an advisor may CLAIM (api/_lib/claims.js) and whether they may refresh their
-- plan. Enrolment happens off-platform, so an admin sets them; a ThriveCart
-- webhook can write the same columns later without changing anything else.
--
-- NEVER BACKFILL THESE. Same rule as undertaking_version in 007: stamping
-- somebody as trained is a factual claim about a qualification, and the claims
-- ladder is only worth anything if the dates are real.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

alter table advisors add column if not exists foundations_at timestamptz;
alter table advisors add column if not exists immersion_at   timestamptz;

comment on column advisors.foundations_at is
  'When this advisor completed Well Destination Foundations. Decides what they may claim in campaign copy AND whether they may regenerate a plan. Set by an admin or a future ThriveCart webhook — never backfilled.';

create table if not exists gtm_profile (
  id          uuid primary key default gen_random_uuid(),
  -- One profile per advisor. The unique constraint is what makes the intake
  -- screen an upsert rather than a create-or-find dance.
  advisor_id  uuid not null unique references advisors (id) on delete cascade,

  -- What they sell, in their own words. Free text on purpose: the whole point
  -- of C1's copy-paste prompt is that an advisor arrives with prose, and a
  -- dropdown would throw away the specificity that makes a plan worth reading.
  positioning     text,
  differentiator  text,
  icp             text,
  client_examples text,
  specialties     text,
  markets         text,

  -- Digital presence. URLs are stored as given and NEVER fetched by us — the
  -- advisor's own AI reads them from their own session, which sidesteps both
  -- the platform login walls and the SSRF surface.
  website     text,
  linkedin    text,
  instagram   text,
  facebook    text,
  tiktok      text,
  newsletter  text,

  -- Bands. Constrained so the generator can branch on them safely.
  email_band  text,
  social_band text,
  client_band text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint gtm_email_band_valid  check (email_band  is null or email_band  in ('none','under500','500to2k','2kto10k','over10k')),
  constraint gtm_social_band_valid check (social_band is null or social_band in ('none','under500','500to2k','2kto10k','over10k')),
  constraint gtm_client_band_valid check (client_band is null or client_band in ('none','under25','25to100','100to500','over500'))
);

create index if not exists gtm_profile_advisor_idx on gtm_profile (advisor_id);

-- RLS on with zero policies: service role only, like every other table here.
-- The Hub reads through server-side code that scopes by advisor_id, so an
-- advisor needs no direct grant and must not have one.
alter table gtm_profile enable row level security;

-- The column grant allow-list from 004/007 is re-stated because a grant is
-- absolute: the only way to be certain the two new date columns are NOT
-- advisor-writable is to say what IS writable. An advisor who could set their
-- own foundations_at could promote themselves up the claims ladder.
revoke update on advisors from authenticated;
grant update (
  first_name, last_name, business, host_agency, phone,
  website, socials, bio, market, photo_url
) on advisors to authenticated;

do $$
declare
  leaked text;
begin
  select string_agg(column_name, ', ') into leaked
    from information_schema.column_privileges
   where table_name = 'advisors'
     and grantee = 'authenticated'
     and privilege_type = 'UPDATE'
     and column_name in ('foundations_at', 'immersion_at', 'undertaking_version',
                         'undertaking_at', 'role', 'is_master', 'is_house', 'status');
  if leaked is not null then
    raise warning 'ADVISOR-WRITABLE SENSITIVE COLUMNS: % — an advisor could promote themselves up the claims ladder.', leaked;
  else
    raise notice 'Column grants verified: advisors cannot write their own training dates, role or status.';
  end if;
end $$;

select
  exists (select 1 from information_schema.tables where table_name = 'gtm_profile') as has_table,
  count(*) filter (where column_name = 'foundations_at') as has_foundations,
  count(*) filter (where column_name = 'immersion_at')   as has_immersion
from information_schema.columns where table_name = 'advisors';
