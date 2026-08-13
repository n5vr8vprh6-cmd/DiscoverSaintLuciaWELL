-- ===========================================================================
-- 002-hub.sql — Advisor Hub V2, release 1
-- ---------------------------------------------------------------------------
-- ADDITIVE ONLY. Nothing is dropped, nothing is renamed, no existing column
-- changes type or meaning. V2 spec §20 requires existing advisor links, Journey
-- ownership and consent evidence to survive, and the safest way to guarantee
-- that is to never touch them.
--
-- Safe to run more than once: every statement is guarded.
--
-- Run in the Supabase SQL editor after db/schema.sql.
-- ===========================================================================

-- ── Advisors: auth linkage, opaque public code, profile ───────────────────
alter table advisors add column if not exists auth_user_id   uuid references auth.users (id) on delete set null;
alter table advisors add column if not exists public_code    text;
alter table advisors add column if not exists photo_url      text;
alter table advisors add column if not exists host_agency    text;
alter table advisors add column if not exists phone          text;
alter table advisors add column if not exists website        text;
alter table advisors add column if not exists socials        jsonb not null default '{}'::jsonb;
alter table advisors add column if not exists bio            text;
-- 'invited' | 'profile' | 'presence' | 'audience' | 'active'
alter table advisors add column if not exists onboarding_state text not null default 'invited';

-- THE OPAQUE CODE (spec §6).
-- The existing scheme is ?advisor=<slug>, and slugs were documented as
-- human-readable ("diana-lee"), which puts an advisor's name in every consumer
-- URL. §6 forbids that. The slug column STAYS and keeps resolving forever, so
-- no deployed link can break; new links use the code.
--
-- Crockford's base32 minus I, L, O and U: no character pairs that a person can
-- misread when a code is on a printed QR card or read down a phone.
-- `code`, not `out`: OUT is a parameter-mode keyword in PL/pgSQL and using it
-- as a variable name is asking for a parse error on some server versions.
create or replace function gen_public_code() returns text language plpgsql as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  code text := '';
  i int;
begin
  for i in 1..8 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end $$;

-- Backfill every existing advisor, retrying on the vanishingly unlikely clash.
do $$
declare
  r record;
  candidate text;
begin
  for r in select id from advisors where public_code is null loop
    loop
      candidate := gen_public_code();
      exit when not exists (select 1 from advisors where public_code = candidate);
    end loop;
    update advisors set public_code = candidate where id = r.id;
  end loop;
end $$;

create unique index if not exists advisors_public_code_idx on advisors (public_code);
create index if not exists advisors_auth_user_idx on advisors (auth_user_id);

-- ── Journey shares: pipeline stage and a normalised travel window ─────────
-- 'new' | 'contacted' | 'discovery' | 'planning' | 'booked' | 'closed'
alter table journey_shares add column if not exists stage text not null default 'new';
alter table journey_shares add column if not exists last_activity_at timestamptz;
alter table journey_shares add column if not exists travel_window text;

-- THE TRAVEL WINDOW IS A MIGRATION, NOT A RENAME (spec §11 vs what we collect).
-- The Finder asks "Within 3 months / 3-6 months / 6-12 months / More than a
-- year away". §11 wants "<=30d | 31-90d | 3-6mo | 6-12mo | 12+/exploring".
-- Those do not line up: there is no <=30-day bucket, and "Within 3 months"
-- spans the first TWO spec buckets.
--
-- So legacy "Within 3 months" maps to 31-90d, never to <=30d. Mapping it to
-- the sooner bucket would invent urgency the consumer never expressed, and
-- "Travel Soonest" would put people at the top of an advisor's list on the
-- strength of a guess. Under-claiming is the safe direction.
update journey_shares set travel_window = case
    when timing is null or btrim(timing) = '' then 'exploring'
    when timing ilike '%within 3%'    then '31-90d'
    when timing ilike '%3%6%'         then '3-6mo'
    when timing ilike '%6%12%'        then '6-12mo'
    when timing ilike '%more than a year%' then '12mo+'
    when timing ilike '%30 day%'      then '30d'
    else 'exploring'
  end
  where travel_window is null;

create index if not exists journey_shares_stage_idx on journey_shares (advisor_id, stage, created_at desc);
create index if not exists journey_shares_window_idx on journey_shares (advisor_id, travel_window);

-- ── Advisor notes ─────────────────────────────────────────────────────────
create table if not exists advisor_notes (
  id         uuid primary key default gen_random_uuid(),
  share_id   uuid not null references journey_shares (id) on delete cascade,
  advisor_id uuid not null references advisors (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists advisor_notes_share_idx on advisor_notes (share_id, created_at desc);

-- ── Row Level Security ────────────────────────────────────────────────────
-- Until now every table was RLS-on with ZERO policies: deny everything except
-- the service role. That is the safest possible posture and it is why the
-- public endpoints are safe today.
--
-- V2 adds authenticated advisors, so they need to read their own rows and
-- nothing else. These policies are the highest-risk change in the release:
-- a mistake here means one advisor reads another's consumer PII. Every policy
-- below is scoped through advisors.auth_user_id = auth.uid(), never through a
-- value the client can supply.
--
-- The service role bypasses all of this and continues to serve the public,
-- unauthenticated endpoints (/api/share, /api/visit, /api/advisor).

alter table advisor_notes enable row level security;

-- Helper: the advisor row belonging to the current authenticated user.
create or replace function current_advisor_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from advisors where auth_user_id = auth.uid() limit 1
$$;

drop policy if exists advisors_self_select on advisors;
create policy advisors_self_select on advisors
  for select to authenticated using (auth_user_id = auth.uid());

drop policy if exists advisors_self_update on advisors;
create policy advisors_self_update on advisors
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists shares_own_select on journey_shares;
create policy shares_own_select on journey_shares
  for select to authenticated using (advisor_id = current_advisor_id());

-- An advisor may move a Journey through the pipeline. They may not reassign it
-- to themselves: `with check` pins advisor_id to their own on the way out.
drop policy if exists shares_own_update on journey_shares;
create policy shares_own_update on journey_shares
  for update to authenticated
  using (advisor_id = current_advisor_id())
  with check (advisor_id = current_advisor_id());

drop policy if exists visits_own_select on campaign_visits;
create policy visits_own_select on campaign_visits
  for select to authenticated using (advisor_id = current_advisor_id());

drop policy if exists completions_own_select on finder_completions;
create policy completions_own_select on finder_completions
  for select to authenticated using (advisor_id = current_advisor_id());

drop policy if exists notes_own_all on advisor_notes;
create policy notes_own_all on advisor_notes
  for all to authenticated
  using (advisor_id = current_advisor_id())
  with check (advisor_id = current_advisor_id());

-- ── What an advisor may NOT do, stated by omission ────────────────────────
-- There is no insert policy on advisors, journey_shares, campaign_visits or
-- finder_completions. Advisors cannot mint their own advisor record, invent a
-- Journey, or fabricate campaign traffic. Those rows are only ever written by
-- the service role, from server code that has already checked consent.
