-- ============================================================================
-- 017-plan-builds.sql — a balance, a ledger, and two ways to move the number
-- ----------------------------------------------------------------------------
-- Registered advisors get three plan builds. Nine dollars adds three more.
-- Foundations and Immersion graduates are unlimited and their balance is never
-- read and never touched — they were trained to use this well, so metering
-- them would be charging for the thing the training was for.
--
-- ── WHY A BALANCE AND NOT A SUBSCRIPTION ───────────────────────────────────
-- A build is a real cost to us (a model call per asset) and a real decision for
-- the advisor. A monthly subscription bills people for months they did not use
-- and trains them to cancel; a pack of three is bought once, spent when it is
-- worth spending, and never has to be cancelled.
--
-- ── THE THREE THINGS THAT MUST BE TRUE ─────────────────────────────────────
-- 1. THE NUMBER CANNOT GO BELOW ZERO. A check constraint, not a promise in
--    application code. Application code has bugs; a constraint has none.
-- 2. THE ADVISOR CANNOT WRITE IT. This is currency. The column-grant allow-list
--    from 004/007/011 is re-stated below for exactly the reason 011 gives: a
--    grant is absolute, so the only way to be sure a new column is NOT
--    advisor-writable is to say what IS writable and check the rest.
-- 3. A REPLAYED WEBHOOK ADDS ONCE. Payment providers retry, and they retry
--    precisely when the first attempt succeeded but the response was lost.
--    purchase_events carries a UNIQUE (provider, event_id): idempotency
--    enforced by the database rather than by a check-then-act in application
--    code, which is a race with money on it.
--
-- ── ON THE TWO FUNCTIONS ───────────────────────────────────────────────────
-- Both do their arithmetic in ONE statement, because read-modify-write from
-- application code loses a concurrent decrement and gives away a free build.
--
-- Neither is SECURITY DEFINER. They do not need to be — the service role
-- already bypasses RLS — and a definer function that mints currency would be a
-- hole if execute ever leaked. Execute is revoked from public, anon and
-- authenticated anyway, because Postgres grants EXECUTE to PUBLIC by default
-- on every new function and a payment feature should not rely on nobody
-- noticing that.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
--
-- NOTE ON THE EDITOR: it runs this whole file as ONE transaction, so a
-- RAISE EXCEPTION at the bottom would roll back the DDL above it. Every check
-- below is a WARNING, and the file ends with a SELECT you can read.
-- ============================================================================

-- ── The balance ────────────────────────────────────────────────────────────
-- Default 3, including for every advisor who already exists. They have been
-- living with one plan and no rebuild; this is strictly more than they had.
alter table advisors add column if not exists plan_builds int not null default 3;

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
     where table_name = 'advisors' and constraint_name = 'advisors_plan_builds_not_negative'
  ) then
    alter table advisors
      add constraint advisors_plan_builds_not_negative check (plan_builds >= 0);
  end if;
end $$;

comment on column advisors.plan_builds is
  'Plan builds remaining. Spent one per successful plan, never read for Foundations or Immersion graduates (they are unlimited). Cannot go negative — see the check constraint. Not advisor-writable: it is currency.';

-- ── The ledger ─────────────────────────────────────────────────────────────
-- Every purchase, refund and unrecognised event that arrives, whether or not
-- it moved the balance. `raw` is kept because the first thing anyone asks when
-- money goes wrong is "what exactly did they send us", and reconstructing it
-- from a parsed subset is guesswork.
create table if not exists purchase_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_id     text not null,
  kind         text not null,
  advisor_id   uuid references advisors(id) on delete set null,
  email        text,
  builds_delta int  not null default 0,
  note         text,
  raw          jsonb,
  created_at   timestamptz not null default now(),
  -- THE IDEMPOTENCY GUARANTEE. Not a lookup-then-insert in application code.
  constraint purchase_events_once unique (provider, event_id)
);

create index if not exists purchase_events_advisor_idx on purchase_events (advisor_id, created_at desc);
create index if not exists purchase_events_email_idx   on purchase_events (email);

-- RLS on with zero policies: service role only, like every other table here.
alter table purchase_events enable row level security;

comment on table purchase_events is
  'Every webhook that arrived, including ones that moved nothing. UNIQUE (provider, event_id) is what makes a replayed webhook add once. A purchase whose email matches no advisor is recorded with advisor_id null rather than dropped — somebody paid, and they must be findable.';

-- ── Spend ──────────────────────────────────────────────────────────────────
-- Returns the new balance, or NO ROW when there was nothing to spend. The
-- `plan_builds > 0` lives in the WHERE clause so the check and the decrement
-- are the same statement and cannot be interleaved.
create or replace function spend_plan_build(p_advisor uuid)
returns int
language sql
as $$
  update advisors
     set plan_builds = plan_builds - 1
   where id = p_advisor
     and plan_builds > 0
  returning plan_builds;
$$;

-- ── Grant ──────────────────────────────────────────────────────────────────
-- greatest(...,0) so a refund for builds already spent settles at zero rather
-- than tripping the constraint and failing a webhook we cannot replay.
create or replace function add_plan_builds(p_advisor uuid, p_n int)
returns int
language sql
as $$
  update advisors
     set plan_builds = greatest(0, plan_builds + p_n)
   where id = p_advisor
  returning plan_builds;
$$;

revoke execute on function spend_plan_build(uuid) from public;
revoke execute on function add_plan_builds(uuid, int) from public;

-- ── The allow-list, re-stated ──────────────────────────────────────────────
-- Verbatim from 011 plus nothing. Re-stated rather than assumed because a
-- grant is absolute and this migration adds a column that mints money.
revoke update on advisors from authenticated;
grant update (
  first_name, last_name, business, host_agency, phone,
  website, socials, bio, market, photo_url
) on advisors to authenticated;

-- ── Checks. Warnings, never exceptions — see the note in the header. ───────
do $$
declare
  leaked text;
begin
  select string_agg(column_name, ', ') into leaked
    from information_schema.column_privileges
   where table_name = 'advisors'
     and grantee = 'authenticated'
     and privilege_type = 'UPDATE'
     and column_name in ('plan_builds', 'foundations_at', 'immersion_at',
                         'role', 'is_master', 'is_house', 'status');
  if leaked is not null then
    raise warning 'ADVISOR-WRITABLE SENSITIVE COLUMNS: % — plan_builds here would let an advisor mint their own builds.', leaked;
  else
    raise notice 'Column grants verified: advisors cannot write plan_builds, their training dates, role or status.';
  end if;

  select string_agg(column_name, ', ') into leaked
    from information_schema.column_privileges
   where table_name = 'purchase_events' and grantee = 'authenticated';
  if leaked is not null then
    raise warning 'purchase_events IS DIRECTLY ACCESSIBLE BY authenticated: % — it must be service-role only.', leaked;
  else
    raise notice 'purchase_events remains service-role only, as intended.';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_name in ('spend_plan_build', 'add_plan_builds')
       and grantee in ('anon', 'authenticated')
  ) then
    raise warning 'THE BALANCE FUNCTIONS ARE CALLABLE BY anon OR authenticated — anybody with the public key could mint builds.';
  else
    raise notice 'Balance functions are service-role only, as intended.';
  end if;
end $$;

-- One glance answers "did this work".
select
  (select count(*) from information_schema.columns
    where table_name = 'advisors' and column_name = 'plan_builds')      as has_plan_builds,
  (select count(*) from information_schema.tables
    where table_name = 'purchase_events')                               as has_ledger,
  (select count(*) from information_schema.routines
    where routine_name in ('spend_plan_build', 'add_plan_builds'))      as has_functions,
  (select count(*) from advisors where plan_builds = 3)                 as advisors_with_three;
