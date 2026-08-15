-- ============================================================================
-- 012-gtm-plan.sql — the generated 30-day plan and its assets
-- ----------------------------------------------------------------------------
-- 011 stored what we know about an advisor. This stores what we made from it.
--
-- ── WHY TWO TABLES ─────────────────────────────────────────────────────────
-- A plan is generated in PIECES, because Vercel's Hobby plan kills a function
-- at ten seconds and one request that writes thirty assets will not finish.
-- The skeleton lands first — channels and the shape of the month — and each
-- asset arrives in its own call afterwards. So a plan exists before its assets
-- do, and a failed asset must leave the rest of the plan intact. That is a
-- parent row with children, not one document.
--
-- ── canonical_body IS THE POINT OF THE ASSET TABLE ─────────────────────────
-- Spec §9 asks for "return to canonical version". Storing the first generated
-- text in its own column makes revert a SELECT. The alternative — regenerating
-- to get back — is not a revert at all: the model would return something
-- different, and an advisor who edited a caption, disliked the edit and hit
-- revert would land on a third caption they had never seen. Reverting must be
-- boring and exact.
--
-- ── rung_at_generation IS FROZEN ───────────────────────────────────────────
-- Copy is written under the claim rules that applied the day it was made. If
-- an advisor later completes Foundations, their OLD plan does not retroactively
-- become entitled to say "trained in the Well Destination method" — nobody
-- rewrote it. Storing the rung on the plan keeps the audit answerable: what was
-- this advisor permitted to claim at the moment this sentence was produced?
-- Deriving it live from advisors.foundations_at would quietly change the answer
-- to a question about the past.
--
-- ── NO CONSUMER DATA LIVES HERE ────────────────────────────────────────────
-- Nothing in this migration references journey_shares, and nothing should. The
-- campaign is about the advisor's business, not about the travellers who
-- shared a Journey with them. Those people consented to an introduction, not
-- to becoming training material.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

create table if not exists gtm_plan (
  id          uuid primary key default gen_random_uuid(),
  -- NOT unique: an advisor past Foundations refreshes as often as they like,
  -- and the old plan stays readable. "Current" is simply the newest row.
  advisor_id  uuid not null references advisors (id) on delete cascade,

  -- Frozen at generation. See the header — this answers a question about the
  -- past and must not be derived live.
  rung_at_generation text not null default 'registered',

  -- The shape of the month: which channels, which weeks, which actions.
  -- jsonb because it is read whole and never queried into.
  skeleton    jsonb,

  -- pending  — skeleton requested, not yet returned
  -- ready    — skeleton present; assets may still be arriving
  -- failed   — the skeleton call failed; there is nothing to show
  status      text not null default 'pending',

  -- Which model produced it, so a change in output quality is traceable to a
  -- change in model rather than guessed at.
  model       text,
  error       text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint gtm_plan_status_valid check (status in ('pending','ready','failed')),
  constraint gtm_plan_rung_valid   check (rung_at_generation in ('registered','foundations','immersion'))
);

create index if not exists gtm_plan_advisor_idx on gtm_plan (advisor_id, created_at desc);

create table if not exists gtm_asset (
  id        uuid primary key default gen_random_uuid(),
  plan_id   uuid not null references gtm_plan (id) on delete cascade,

  -- Denormalised from the plan. Every read in the Hub is scoped by advisor, and
  -- an asset that carries its own owner cannot be handed to the wrong one by a
  -- join written wrong later.
  advisor_id uuid not null references advisors (id) on delete cascade,

  channel   text not null,
  week      int  not null default 1,
  position  int  not null default 0,
  title     text,

  -- body is what the advisor sees and may edit.
  -- canonical_body is what the model first returned and is NEVER overwritten
  -- by an edit. Revert copies canonical_body back over body.
  body           text,
  canonical_body text,

  -- What the deterministic checker found, stored with the asset so a warning
  -- survives a page reload and can be audited later. The checker runs again on
  -- edit, so this is a cache of a verdict, not the verdict itself.
  flags     jsonb not null default '[]'::jsonb,
  severity  text  not null default 'none',

  status    text not null default 'pending',
  error     text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint gtm_asset_status_valid   check (status in ('pending','ready','failed')),
  constraint gtm_asset_severity_valid check (severity in ('none','low','high')),
  constraint gtm_asset_week_valid     check (week between 1 and 5)
);

create index if not exists gtm_asset_plan_idx    on gtm_asset (plan_id, week, position);
create index if not exists gtm_asset_advisor_idx on gtm_asset (advisor_id);

-- RLS on with zero policies: service role only, like every other table here.
-- The Hub reads through server-side code that scopes by advisor_id.
alter table gtm_plan  enable row level security;
alter table gtm_asset enable row level security;

comment on column gtm_plan.rung_at_generation is
  'What this advisor was permitted to claim WHEN THIS PLAN WAS MADE. Frozen on purpose — completing Foundations later does not retroactively license older copy.';
comment on column gtm_asset.canonical_body is
  'The model''s original text. Never overwritten by an edit; revert copies it back over body. Regenerating to "revert" would return different text, which is not a revert.';

-- ── Checks, as warnings ─────────────────────────────────────────────────────
-- Warnings, never exceptions. The Supabase SQL editor runs a script as ONE
-- transaction, so a RAISE EXCEPTION down here would roll back every statement
-- above it and report the migration as never applied. 006 and 007 both did
-- exactly that. The real assertions live in tools/check-migration.js.
do $$
declare
  leaked text;
begin
  select string_agg(table_name || '.' || column_name, ', ') into leaked
    from information_schema.column_privileges
   where table_name in ('gtm_plan', 'gtm_asset')
     and grantee = 'authenticated';
  if leaked is not null then
    raise warning 'GTM TABLES ARE DIRECTLY WRITABLE BY authenticated: % — they must be service-role only.', leaked;
  else
    raise notice 'gtm_plan and gtm_asset are service-role only, as intended.';
  end if;

  if not exists (select 1 from information_schema.columns
                  where table_name = 'gtm_asset' and column_name = 'canonical_body') then
    raise warning 'canonical_body is missing — revert would have to regenerate, which is not a revert.';
  end if;
end $$;

-- One glance answers "did this work".
select
  (select count(*) from information_schema.tables
    where table_name in ('gtm_plan','gtm_asset'))                      as tables_created,
  (select count(*) from information_schema.columns
    where table_name = 'gtm_asset' and column_name = 'canonical_body') as has_canonical_body,
  (select count(*) from information_schema.columns
    where table_name = 'gtm_plan' and column_name = 'rung_at_generation') as has_frozen_rung;
