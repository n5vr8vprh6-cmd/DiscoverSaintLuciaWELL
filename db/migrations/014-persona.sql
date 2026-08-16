-- ============================================================================
-- 014-persona.sql — five answers, a derived read, and the correction
-- ----------------------------------------------------------------------------
-- D1 and D3 both established that campaign output is input-limited, and that a
-- longer intake form is not the fix. This stores the five-question persona that
-- replaces it: what the advisor has done, what clients thank them for, which
-- trips went best, which two needs their travellers have, and what they can
-- actually sustain in a week.
--
-- ── WHY THE RAW ANSWERS ARE KEPT ───────────────────────────────────────────
-- persona_answers holds what was actually chosen, not just what was derived
-- from it. Three reasons, and the third is the one that matters: the capture is
-- resumable mid-way; the scoring in api/_lib/persona.js will change as the
-- marketing field guide matures, and stored answers can be re-derived while a
-- stored conclusion cannot; and when an advisor says the read is wrong, the
-- answers are the only way to find out whether the questions or the scoring
-- were at fault.
--
-- ── WHY expr_confirmed IS SEPARATE, AND USUALLY NULL ───────────────────────
-- It is written ONLY when the advisor changes the read. Accepting leaves it
-- null, and persona_at records that they saw it and agreed.
--
-- That asymmetry is deliberate. A correction is stronger evidence than the five
-- answers behind the original — Section 6 §6 of the Strategist Bible ranks
-- observed behaviour above self-description, and an advisor rejecting a
-- generated label is the most direct observation available. Collapsing the two
-- columns into one would make every advisor look corrected and throw away the
-- signal entirely.
--
-- ── NO CHECK CONSTRAINT ON THE PROFILE KEYS ────────────────────────────────
-- expr_primary, expr_secondary, expr_confirmed and traveller_orientation are
-- validated in the application against content/marketing-playbook.js, which is
-- generated from a field guide Duncan edits. A CHECK here would silently reject
-- a profile the moment the research added one, and the failure would surface as
-- a save that does nothing rather than as an error anybody could read.
--
-- capacity_class IS constrained, because C1-C4 comes from the Bible's own
-- capacity classes and is structural rather than editorial.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

alter table gtm_profile add column if not exists persona_answers      jsonb;
alter table gtm_profile add column if not exists expr_primary         text;
alter table gtm_profile add column if not exists expr_secondary       text;
alter table gtm_profile add column if not exists expr_confirmed       text;
alter table gtm_profile add column if not exists traveller_orientation text;
alter table gtm_profile add column if not exists compass_needs        jsonb;
alter table gtm_profile add column if not exists capacity_class       text;
alter table gtm_profile add column if not exists persona_at           timestamptz;

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
     where table_name = 'gtm_profile' and constraint_name = 'gtm_capacity_class_valid'
  ) then
    alter table gtm_profile add constraint gtm_capacity_class_valid
      check (capacity_class is null or capacity_class in ('C1', 'C2', 'C3', 'C4'));
  end if;
end $$;

comment on column gtm_profile.persona_answers is
  'The five raw answers. Kept so the capture is resumable, so a changed scoring model can be re-derived over old answers, and so a wrong read can be traced to the question or the scoring.';
comment on column gtm_profile.expr_confirmed is
  'Written ONLY when the advisor changed the derived read. Accepting leaves this null and persona_at records the agreement. A correction outranks the derivation and reaches the generator in its place.';
comment on column gtm_profile.compass_needs is
  'Two WELL Compass keys, the same eight travellers answer against in the Journey Finder — so this guess can later be checked against what their travellers actually chose.';

-- The column grant allow-list is re-stated because a grant is absolute. An
-- advisor writes their persona through server-side code that scopes by
-- advisor_id; they must not gain direct table access here, and 011's grants on
-- `advisors` must not be widened by this migration touching a different table.
do $$
declare
  leaked text;
begin
  select string_agg(column_name, ', ') into leaked
    from information_schema.column_privileges
   where table_name = 'gtm_profile' and grantee = 'authenticated';
  if leaked is not null then
    raise warning 'gtm_profile IS DIRECTLY WRITABLE BY authenticated: % — it must be service-role only.', leaked;
  else
    raise notice 'gtm_profile remains service-role only, as intended.';
  end if;
end $$;

-- One glance answers "did this work".
select
  count(*) filter (where column_name = 'persona_answers')       as has_answers,
  count(*) filter (where column_name = 'expr_primary')          as has_primary,
  count(*) filter (where column_name = 'expr_confirmed')        as has_confirmed,
  count(*) filter (where column_name = 'traveller_orientation') as has_orientation,
  count(*) filter (where column_name = 'compass_needs')         as has_needs,
  count(*) filter (where column_name = 'capacity_class')        as has_capacity
from information_schema.columns where table_name = 'gtm_profile';
