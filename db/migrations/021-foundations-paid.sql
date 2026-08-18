-- ============================================================================
-- 021-foundations-paid.sql — paying for Foundations is not completing it
-- ----------------------------------------------------------------------------
-- One column was carrying two different facts, and this separates them.
--
-- ── THE PROBLEM ────────────────────────────────────────────────────────────
-- `foundations_at` means COMPLETED THE TRAINING. It drives the claims ladder in
-- content/campaign-facts.js: an advisor with that date set may have their
-- generated copy say "trained in the Well Destination method". It is set by an
-- admin, deliberately, because recording it is a factual assertion about a
-- qualification (see setTraining in api/_lib/admin-data.js).
--
-- It ALSO drives unmetered() in api/_lib/builds.js — unlimited campaigns.
--
-- Those are not the same fact. Unlimited campaigns are bought. The right to say
-- you were trained is earned. Fusing them left exactly one bad option: grant
-- `foundations_at` on payment, and let somebody who bought the programme and
-- never attended publish "trained in the Well Destination method" under their
-- own name — the precise failure the claims checker exists to prevent.
--
-- ── SO ─────────────────────────────────────────────────────────────────────
--   foundations_paid_at   they paid          → unlimited campaigns, immediately
--   foundations_at        they completed it  → the claims ladder, admin-set
--
-- The webhook sets the first. Only a human sets the second. An advisor can sit
-- in between for as long as it takes them to turn up, and during that time they
-- have everything they bought and no claim they have not earned.
--
-- ── WHY A DATE AND NOT A BOOLEAN ───────────────────────────────────────────
-- Same reason as foundations_at: "when" answers questions that "whether"
-- cannot, and a refund needs somewhere to write null.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
--
-- NOTE ON THE EDITOR: it runs this whole file as ONE transaction, so a
-- RAISE EXCEPTION at the bottom would roll back the DDL above it. Every check
-- below is a WARNING, and the file ends with a SELECT you can read.
-- ============================================================================

alter table advisors add column if not exists foundations_paid_at timestamptz;

comment on column advisors.foundations_paid_at is
  'When this advisor PAID for Foundations. Grants unlimited campaigns and '
  'nothing else. It does NOT grant the claims ladder — that is foundations_at, '
  'which means they completed the training and is set by an admin. A person '
  'may hold this and not that for as long as it takes them to attend.';

-- ── The advisor must not be able to write it ───────────────────────────────
-- Restating the rule from 011/017: a grant is absolute, so the only way to be
-- sure a NEW column is not advisor-writable is to say what IS writable and then
-- check that nothing else leaked in.
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
     and grantee in ('authenticated', 'anon', 'public')
     and privilege_type = 'UPDATE'
     and column_name in ('plan_builds', 'foundations_at', 'immersion_at',
                         'foundations_paid_at',
                         'role', 'is_master', 'is_house', 'status');

  if leaked is not null then
    raise warning 'ADVISOR-WRITABLE SENSITIVE COLUMNS: % — foundations_paid_at here would let an advisor grant themselves unlimited campaigns.', leaked;
  else
    raise notice 'Column grants verified: advisors cannot write their own entitlements or training dates.';
  end if;
end $$;

-- ── Nobody should already be paid-and-not-trained ──────────────────────────
-- On a fresh apply this is zero, because the column has just been created. It
-- is here so that re-running the file later tells you who is waiting to be
-- marked complete, which is the state this migration creates.
do $$
declare
  waiting int;
begin
  select count(*) into waiting from advisors
   where foundations_paid_at is not null and foundations_at is null;

  if waiting > 0 then
    raise notice 'PAID BUT NOT YET MARKED TRAINED: % — they have unlimited campaigns and cannot claim to be trained. Mark them complete in the Hub once they have attended.', waiting;
  else
    raise notice 'Nobody is currently waiting to be marked as trained.';
  end if;
end $$;

-- ── What you should see ────────────────────────────────────────────────────
select
  (select count(*) from information_schema.columns
    where table_name = 'advisors' and column_name = 'foundations_paid_at')  as has_column,
  (select count(*) from advisors where foundations_paid_at is not null)     as paid,
  (select count(*) from advisors where foundations_at is not null)          as completed,
  (select count(*) from advisors
    where foundations_paid_at is not null and foundations_at is null)       as paid_awaiting_training,
  (select count(*) from advisors
    where foundations_at is not null and foundations_paid_at is null)       as trained_without_a_recorded_payment;
