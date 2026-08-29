-- ============================================================================
-- 022-journey-design.sql — the consultation, the workspace, and the artifact
-- ----------------------------------------------------------------------------
-- Stages 5 to 7 of the advisor's revenue loop. Everything before them already
-- exists: a campaign link brings somebody to the Journey Finder, the Finder
-- produces a result, sharing it creates a journey_shares row, and the advisor
-- reaches out. This is what happens on the call that follows.
--
-- Five tables, and every one of them hangs off a Journey. That is the whole
-- shape of this feature: it is an extension of a record that already exists,
-- not a second system beside it.
--
-- ── NO FREE TEXT IN journey_consultations. NONE. ───────────────────────────
-- Every column there is a code from content/marketing-playbook.js, a key from
-- content/well-knowledge.generated.js, or a number. There is no notes field and
-- there must never be one.
--
-- That is not tidiness. api/_lib/design-generate.js will compose model prompts
-- from this row, and a table with no prose makes that projection a COLUMN LIST
-- rather than a filter — the same argument gtm-generate.js makes about its own
-- allow-list: "a filter can be written wrong; an absent parameter cannot." Add
-- a text column here and the guarantee that no consumer's words reach a model
-- stops being structural and starts being somebody's discipline.
--
-- Where the advisor needs to write about a person in their own words, that goes
-- in advisor_notes, which already exists, already cascades, and is already in
-- the subject-rights export.
--
-- ── WHY THERE ARE NO NEW retention_months() ARMS FOR FOUR OF THE FIVE ──────
-- journey_consultations, design_sessions, design_candidates and
-- journey_itineraries all cascade from journey_shares. They follow their
-- Journey, including its exemption for stage 'booked' — a booked trip is a
-- transaction record, and the itinerary that produced it should not evaporate
-- while the booking stays.
--
-- 006 already made this argument about advisor_notes: "Deleting them separately
-- would hide a broken cascade rather than surface it." Same reasoning, same
-- decision. The verification block at the foot proves the cascades exist rather
-- than trusting that they were typed correctly.
--
-- design_generation is the exception. It is a cost and rate-limit ledger with
-- no consumer data in it at all, it must outlive the sessions it describes, and
-- so it gets an arm of its own.
--
-- ── CHECK CONSTRAINTS: STRUCTURAL YES, EDITORIAL NO ────────────────────────
-- 014 drew this line and it is the right one. Constrained here: session stage
-- and status, itinerary version, and the continuum rungs — the last because the
-- Field Guide's Appendix A explicitly locks the six-rung ladder, which makes it
-- structural in exactly the way C1-C4 is.
--
-- NOT constrained: village, compass and pillar keys inside jsonb, and the
-- single-valued need-state codes (trigger, uncertainty, readiness, party,
-- budget, orientation). Those are validated in api/_lib/need-state.js against
-- the generated bank, because a CHECK would silently reject a need-state the
-- moment the research added an option, and the failure would surface as a save
-- that does nothing rather than as an error anybody could read.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

-- ── The consultation ────────────────────────────────────────────────────────
-- One per Journey. What the advisor learned on the call, as codes.
create table if not exists journey_consultations (
  id          uuid primary key default gen_random_uuid(),
  share_id    uuid not null unique references journey_shares (id) on delete cascade,
  -- Denormalised from the Journey. Every read is scoped by advisor, and a row
  -- carrying its own owner cannot be handed to the wrong one by a join written
  -- wrong later — 012's argument, and it applies with more force here because
  -- api/_lib/introductions.js MOVES a Journey between advisors and must move
  -- this with it.
  advisor_id  uuid not null references advisors (id) on delete cascade,

  -- Weighted maps: {"restore": 1, "reflect": 0.6}. jsonb because they are read
  -- whole and dot-producted whole; nothing queries into them.
  current_states  jsonb not null default '{}'::jsonb,
  desired_states  jsonb not null default '{}'::jsonb,
  village_weights jsonb not null default '{}'::jsonb,
  compass_weights jsonb not null default '{}'::jsonb,
  pillar_weights  jsonb not null default '{}'::jsonb,

  -- Single codes. Unconstrained on purpose: see the header.
  trigger      text,
  uncertainty  text,
  readiness    text,
  party        text,
  orientation  text,
  budget       text,
  mobility     text,

  -- The depth asked for. Normalised and CHECKed because the ladder is locked.
  continuum_floor   text,
  continuum_ceiling text,

  -- Continuous dimensions, 0-1.
  rhythm     real,
  activity   real,
  social     real,
  experience real,

  adults   integer,
  children integer,
  nights   integer,
  constraints text[] not null default '{}',

  -- What the Finder proposed, before the advisor touched it, and which fields
  -- they changed. Two columns, and the only thing that will ever answer "is the
  -- Finder reading people correctly?" Without them a year of consultations
  -- teaches nothing.
  seeded_from      jsonb,
  advisor_overrode text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint consult_floor_valid check (
    continuum_floor is null or continuum_floor in
    ('relax','restore','reconnect','recover','transform','sustain')),
  constraint consult_ceiling_valid check (
    continuum_ceiling is null or continuum_ceiling in
    ('relax','restore','reconnect','recover','transform','sustain')),
  constraint consult_scales_valid check (
    (rhythm is null or rhythm between 0 and 1) and
    (activity is null or activity between 0 and 1) and
    (social is null or social between 0 and 1) and
    (experience is null or experience between 0 and 1)),
  constraint consult_counts_valid check (
    (adults is null or adults >= 0) and
    (children is null or children >= 0) and
    (nights is null or nights >= 0))
);

create index if not exists journey_consultations_advisor_idx
  on journey_consultations (advisor_id, created_at desc);

-- ── The workspace ───────────────────────────────────────────────────────────
-- NOT unique per consultation. An advisor may redesign after a second call, and
-- "current" is simply the newest row — 012's rule: a flag is a second fact that
-- can disagree with the timestamps, and there would be nothing to arbitrate it.
create table if not exists design_sessions (
  id              uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references journey_consultations (id) on delete cascade,
  share_id        uuid not null references journey_shares (id) on delete cascade,
  advisor_id      uuid not null references advisors (id) on delete cascade,

  stage       text not null default 'read',
  status      text not null default 'draft',
  recipe_key  text,

  shortlist jsonb,
  day_plan  jsonb,
  narrative jsonb,

  -- FROZEN at session start. An itinerary issued in August must stay
  -- explainable against the facts that were true in August; deriving this live
  -- would quietly change the answer to a question about the past. Exactly
  -- gtm_plan.rung_at_generation, for exactly the same reason.
  knowledge_version text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint design_stage_valid check (stage in
    ('read','direction','shortlist','rhythm','narrative','issued')),
  constraint design_status_valid check (status in ('draft','issued','abandoned'))
);

create index if not exists design_sessions_advisor_idx on design_sessions (advisor_id, created_at desc);
create index if not exists design_sessions_share_idx   on design_sessions (share_id, created_at desc);

-- ── The candidates ──────────────────────────────────────────────────────────
-- One row per property CONSIDERED, not per property chosen. Normalised out of
-- design_sessions.shortlist for one reason: its aggregate is the product
-- question. "What do we keep shortlisting and never issuing" is a GROUP BY
-- here and a full-table scan plus a JS reducer if it lives in a blob.
--
-- declined_reason costs one radio button and is the only signal that will ever
-- tell us the Village and Compass mapping is wrong.
create table if not exists design_candidates (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references design_sessions (id) on delete cascade,
  advisor_id uuid not null references advisors (id) on delete cascade,

  property_slug text not null,
  source        text not null default 'deep',
  rank          integer not null default 0,

  -- Words, not numbers: {"place":"strong","direction":"partial",...}. The raw
  -- values live in score_detail and exist to reproduce an order, never to be
  -- shown. There is no composite score anywhere in this feature.
  bands        jsonb not null default '{}'::jsonb,
  score_detail jsonb not null default '{}'::jsonb,
  mismatches   jsonb not null default '[]'::jsonb,

  verified_at     date,
  chosen          boolean not null default false,
  declined_reason text,

  created_at timestamptz not null default now(),

  constraint design_candidate_once unique (session_id, property_slug)
);

create index if not exists design_candidates_advisor_idx on design_candidates (advisor_id, created_at desc);

-- ── The artifact ────────────────────────────────────────────────────────────
create table if not exists journey_itineraries (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references design_sessions (id) on delete cascade,
  share_id   uuid not null references journey_shares (id) on delete cascade,
  advisor_id uuid not null references advisors (id) on delete cascade,

  version  integer not null default 1,
  document jsonb not null,

  knowledge_version text,

  -- A SNAPSHOT, not a join. An advisor who changes agencies must not silently
  -- re-brand a document a client is already holding.
  brand jsonb not null default '{}'::jsonb,

  -- sha256 of the share token, never the token. It is shown to the advisor once
  -- on issue and never again; a database dump yields no working links.
  share_token_hash text,
  share_expires_at timestamptz,
  revoked_at       timestamptz,

  -- Counted, not logged. "Opened three times, last Tuesday" is useful to an
  -- advisor and identifies nobody. No IP, no user agent, no session.
  view_count     integer not null default 0,
  last_viewed_at timestamptz,

  issued_at  timestamptz,
  created_at timestamptz not null default now(),

  constraint itinerary_version_once unique (session_id, version),
  constraint itinerary_version_valid check (version >= 1),
  constraint itinerary_views_valid check (view_count >= 0)
);

create index if not exists journey_itineraries_advisor_idx on journey_itineraries (advisor_id, created_at desc);
create unique index if not exists journey_itineraries_token_idx
  on journey_itineraries (share_token_hash) where share_token_hash is not null;

-- ── Issued means issued ─────────────────────────────────────────────────────
-- A trigger, not a convention. RLS protects these tables from the anon and
-- authenticated keys, but our own code IS the service role and bypasses RLS
-- entirely — so the only thing between a careless .update() and a rewritten
-- document somebody is already holding is this.
--
-- Three columns stay mutable after issue, because they are facts ABOUT the
-- artifact rather than the artifact: whether it was withdrawn, and how often it
-- has been opened. Issuing "v2" writes a new row.
create or replace function itinerary_frozen()
returns trigger
language plpgsql
as $$
begin
  if old.issued_at is null then
    return new;
  end if;
  if new.document          is distinct from old.document
  or new.brand             is distinct from old.brand
  or new.version           is distinct from old.version
  or new.session_id        is distinct from old.session_id
  or new.share_id          is distinct from old.share_id
  or new.knowledge_version is distinct from old.knowledge_version
  or new.issued_at         is distinct from old.issued_at then
    raise exception
      'journey_itineraries % is issued and immutable. Issue a new version instead.', old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists journey_itineraries_frozen on journey_itineraries;
create trigger journey_itineraries_frozen
  before update on journey_itineraries
  for each row execute function itinerary_frozen();

-- ── The ledger ──────────────────────────────────────────────────────────────
-- Rate-limit counter, cost ledger and failure log, in one table.
--
-- It is the counter because day notes live inside design_sessions.day_plan as
-- jsonb, so without a row per generation there is nothing to count — a real
-- cost of that jsonb choice, named here rather than discovered later when a
-- runaway loop is unbounded.
--
-- It carries ms and prompt_chars because gtm.js records that the failure reason
-- alone was not enough: three rows saying 'timeout' took comparing profile
-- sizes to diagnose. Inherit that finding rather than earning it again.
--
-- session_id is SET NULL, not cascade: a cost record must outlive the session
-- it describes, the same way purchase_events keeps a payment whose advisor is
-- gone.
create table if not exists design_generation (
  id         uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references advisors (id) on delete cascade,
  session_id uuid references design_sessions (id) on delete set null,

  kind         text not null,
  model        text,
  ms           integer,
  prompt_chars integer,
  tokens_in    integer,
  tokens_out   integer,
  reason       text,

  created_at timestamptz not null default now()
);

create index if not exists design_generation_advisor_idx on design_generation (advisor_id, created_at desc);

-- ── The advisor's own priority traveller ────────────────────────────────────
-- The same need-state vocabulary, one instance up. gtm_profile already carries
-- traveller_orientation and compass_needs; these complete Day 2 of the Advisor
-- Playbook, which docs/bible-feedback.md §2.1 identifies as the gap capping
-- campaign quality: "It consumes inputs that nobody produces."
--
-- Unconstrained for the same reason 014 left expr_primary unconstrained.
alter table gtm_profile add column if not exists icp_current_states jsonb;
alter table gtm_profile add column if not exists icp_desired_states jsonb;
alter table gtm_profile add column if not exists icp_trigger        text;
alter table gtm_profile add column if not exists icp_uncertainty    text;
alter table gtm_profile add column if not exists icp_readiness      text;
alter table gtm_profile add column if not exists icp_party          text;
alter table gtm_profile add column if not exists icp_budget         text;
alter table gtm_profile add column if not exists icp_at             timestamptz;

comment on column gtm_profile.icp_current_states is
  'What the advisor''s priority traveller is moving away from, as weighted codes from the same vocabulary a consultation uses. One vocabulary, two instances — so a campaign can target the need-states this advisor actually converts.';
comment on column gtm_profile.icp_trigger is
  'Why travel becomes relevant for them. The dimension an advisor almost always knows and the system never captured.';

comment on column journey_consultations.seeded_from is
  'The need-state the Journey Finder proposed, before the advisor edited it. Kept beside advisor_overrode so "did the Finder read this person right?" stays answerable.';
comment on column design_sessions.knowledge_version is
  'The knowledge bank in force when this session opened. Frozen on purpose — regenerating the bank later must not change the answer to a question about the past.';
comment on column journey_itineraries.share_token_hash is
  'sha256 of the share token. The token itself is shown to the advisor once and never stored, so a database dump yields no working links.';
comment on column journey_itineraries.brand is
  'Advisor identity as it was at issue. A snapshot, so changing agencies cannot re-brand a document a client already holds.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- On, with zero policies: service role only, like every table from 011 on. The
-- Hub reads through server-side code that scopes by advisor_id, so an advisor
-- needs no direct grant and must not have one.
alter table journey_consultations enable row level security;
alter table design_sessions       enable row level security;
alter table design_candidates     enable row level security;
alter table journey_itineraries   enable row level security;
alter table design_generation     enable row level security;

-- ── Retention ───────────────────────────────────────────────────────────────
-- Re-stated in full because `create or replace` replaces the whole body. This
-- is 019's function with one arm added.
--
-- Only design_generation appears. The other four cascade from journey_shares
-- and follow their Journey, including its 'booked' exemption. See the header.
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
    else 24
  end;
$$;

-- Re-stated in full, for the same reason. Two additions to 006's body: the
-- ledger sweep, and the expired-token sweep.
--
-- THE TOKEN SWEEP IS NOT REDUNDANT WITH THE APPLICATION CHECK. The itinerary
-- screen already refuses an expired link. That check is one deploy away from
-- being skipped, reordered or wrapped in a condition that is wrong on a
-- Tuesday; a nulled hash cannot resolve no matter what the application does.
-- Belt and braces on the one thing here that is a live URL pointing at a real
-- person's trip.
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
      'months', retention_months('journey_shares')
    )
  );

  return query
    select 'journey_shares'::text, n_shares
    union all select 'campaign_visits'::text, n_visits
    union all select 'finder_completions'::text, n_comps
    union all select 'design_generation'::text, n_gen
    union all select 'itinerary_tokens_expired'::text, n_tokens;
end;
$$;

-- ── Verification ────────────────────────────────────────────────────────────
-- Warnings, never exceptions. The Supabase SQL editor runs this file as ONE
-- transaction, so a RAISE EXCEPTION down here would roll back every statement
-- above it and report the migration as never applied. 006 and 007 both did
-- exactly that.
--
-- The offline assertions live in tools/design-data-test.js, which proves what
-- this feature does BEFORE this file is applied — the state production is in
-- between a push and somebody opening this editor. tools/check-migration.js is
-- specific to 002 and does not cover these tables; the blocks below are the
-- check for them, and they are warnings you have to read rather than a suite
-- that goes green on its own.
do $$
declare
  leaked text;
begin
  select string_agg(table_name || '.' || column_name, ', ') into leaked
    from information_schema.column_privileges
   where grantee = 'authenticated'
     and table_name in ('journey_consultations','design_sessions','design_candidates',
                        'journey_itineraries','design_generation');
  if leaked is not null then
    raise warning 'DIRECTLY WRITABLE BY authenticated: % — these must be service-role only.', leaked;
  else
    raise notice 'the five design tables remain service-role only, as intended.';
  end if;
end $$;

-- The cascades are the retention policy for four of the five tables. Prove they
-- exist rather than trusting they were typed right — a missing cascade here
-- would leave a consultation behind after its Journey was erased, and the
-- subject-rights screen would report success.
do $$
declare
  missing text;
begin
  select string_agg(t, ', ') into missing from (
    select unnest(array['journey_consultations','design_sessions',
                        'design_candidates','journey_itineraries']) as t
  ) w
  where not exists (
    select 1
      from information_schema.referential_constraints rc
      join information_schema.key_column_usage k
        on k.constraint_name = rc.constraint_name
     where k.table_name = w.t
       and rc.delete_rule = 'CASCADE'
  );
  if missing is not null then
    raise warning 'NO CASCADE FOUND ON: % — erasure will leave rows behind.', missing;
  else
    raise notice 'all four design tables cascade, so they follow their Journey.';
  end if;
end $$;

-- One glance answers "did this work".
select
  (select count(*) from information_schema.tables
    where table_name in ('journey_consultations','design_sessions','design_candidates',
                         'journey_itineraries','design_generation'))          as tables_of_5,
  (select count(*) from information_schema.columns
    where table_name = 'gtm_profile' and column_name like 'icp\_%')           as icp_columns_of_8,
  exists (select 1 from pg_trigger
           where tgname = 'journey_itineraries_frozen')                        as issued_is_frozen,
  retention_months('design_generation')                                        as ledger_months;
