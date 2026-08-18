-- ============================================================================
-- 020-free-campaign.sql — the free tier becomes ONE complete campaign
-- ----------------------------------------------------------------------------
-- 017 gave every advisor three plan builds and defaulted new ones to three.
-- This changes the DEFAULT to one. It changes nothing else, and in particular
-- it takes nothing away from anybody.
--
-- ── WHY ONE ───────────────────────────────────────────────────────────────
-- The free campaign is COMPLETE, not sampled: every asset written, and every
-- edit, rewrite and angle after that, free and uncounted, forever. Measured
-- against the real prompts, a whole campaign costs between one and three cents
-- and a rewrite costs 0.18 of a cent — so the generosity is inside the
-- campaign, where an advisor feels it, rather than in a count of campaigns
-- they were never going to reach.
--
-- Three was also never spendable. Until the session query was fixed (see
-- api/_lib/auth.js), plan_builds was not among the columns the Hub selected, so
-- every screen read `undefined`, treated the balance as unknowable, and showed
-- no meter, no rebuild button and no pack. Nobody has ever spent one of these.
--
-- ── WHY THIS DOES NOT CLAW ANYTHING BACK ──────────────────────────────────
-- ALTER COLUMN ... SET DEFAULT applies to rows inserted AFTER it. Every
-- existing advisor keeps the balance they already have — three for anybody
-- registered before today, more for anybody who bought a pack. Rewriting live
-- balances downward to save nine cents would be indefensible, so this file
-- contains no UPDATE at all.
--
-- The pack is unchanged: three campaigns for $9, and it is the DOWNSELL from
-- Foundations rather than the offer. Three-for-nine has to read as generous at
-- the moment somebody has just declined the training.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
--
-- NOTE ON THE EDITOR: it runs this whole file as ONE transaction, so a
-- RAISE EXCEPTION at the bottom would roll back the change above it. Every
-- check below is a WARNING, and the file ends with a SELECT you can read.
-- ============================================================================

alter table advisors alter column plan_builds set default 1;

comment on column advisors.plan_builds is
  'Campaigns this advisor may still build. New registrations get 1 (020); '
  'advisors who registered before 2026-08-18 keep the 3 that 017 gave them. '
  'A pack adds 3. Foundations and Immersion graduates are unlimited and this '
  'number is never read for them. Editing, regenerating and re-angling any '
  'piece of an existing campaign are free and spend nothing.';

-- ── Did anybody lose anything? ─────────────────────────────────────────────
-- They cannot have — there is no UPDATE here — but the check is cheap and the
-- reassurance is the point of running the file rather than trusting it.
do $$
declare
  poorer int;
begin
  select count(*) into poorer from advisors where plan_builds < 1;

  if poorer > 0 then
    raise warning 'ADVISORS AT ZERO: % — expected if they spent them, alarming if this file did it. 020 contains no UPDATE.', poorer;
  else
    raise notice 'No advisor is below one campaign. 020 changed a default, not a balance.';
  end if;
end $$;

-- ── Is the default actually one? ───────────────────────────────────────────
do $$
declare
  d text;
begin
  select column_default into d
    from information_schema.columns
   where table_name = 'advisors' and column_name = 'plan_builds';

  if d is null or d not like '1%' then
    raise warning 'PLAN_BUILDS DEFAULT IS % — a new registration will not get one campaign.', coalesce(d, 'null');
  else
    raise notice 'New registrations now start with one complete campaign.';
  end if;
end $$;

-- ── What you should see ────────────────────────────────────────────────────
select
  (select column_default from information_schema.columns
    where table_name = 'advisors' and column_name = 'plan_builds')  as new_registrations_get,
  (select count(*) from advisors where plan_builds = 0)             as advisors_at_zero,
  (select count(*) from advisors where plan_builds = 1)             as advisors_with_one,
  (select count(*) from advisors where plan_builds >= 3)            as advisors_with_three_or_more,
  (select count(*) from advisors
    where foundations_at is not null or immersion_at is not null)   as unmetered_graduates;
