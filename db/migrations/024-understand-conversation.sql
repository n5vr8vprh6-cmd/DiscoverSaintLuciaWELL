-- ============================================================================
-- 024-understand-conversation.sql — the Understand stage becomes a conversation
-- ----------------------------------------------------------------------------
-- Duncan's review of the deployed designer (2026-09-09): "Why now" and "What
-- could stop them" must be multi-select; budget must be a real number; there
-- must be room for something the client said in their own words. Four columns
-- on journey_consultations, nothing else.
--
-- ── MULTI-SELECT FOLLOWS constraints text[] ────────────────────────────────
-- 022 already holds one array of codes (constraints). triggers and
-- uncertainties are the same shape. The singular columns stay: rows written
-- before this migration keep their value, the subject-rights export still reads
-- them, and api/_lib/design-data.js reads the array and falls back to
-- [singular] when the array is empty. Backfilled here so no row has a value in
-- one and not the other.
--
-- ── budget_usd IS THE PARTY TOTAL. THE BAND IS DERIVED. ────────────────────
-- One figure, US dollars, for the whole trip and everyone on it — what an
-- advisor actually hears on a call. `budget` (entry · mid · premium · open)
-- stays and is now computed from budget_usd and nights by
-- api/_lib/need-state.js bandFor(), so the matcher's inclusion rule and the
-- prompt's band keep working. budget_usd itself is passed to no prompt: a model
-- that has seen a number will print one.
--
-- ── in_their_words IS THE ONE PROSE COLUMN, AND IT IS NOT IN THE NEED-STATE ─
-- 022's header says journey_consultations has no free text. This adds one
-- column of it, deliberately, and keeps the boundary where it always was: the
-- need-state OBJECT that api/_lib/need-state.js validates and api/_lib/
-- design-need.js projects still carries no prose. This column takes the path
-- travel_from took in 023 — written through `extra`, read from the stored row,
-- never copied into the need-state, never named in the projection.
-- tools/design-privacy-test.js puts a sentinel in it and sweeps both prompts.
-- It is in the subject-rights export because it is about the person.
--
-- Run in the Supabase SQL editor. Additive and idempotent; no new tables, so
-- RLS is untouched.
-- ============================================================================

-- ── Multi-select ────────────────────────────────────────────────────────────
alter table journey_consultations add column if not exists triggers      text[] not null default '{}';
alter table journey_consultations add column if not exists uncertainties text[] not null default '{}';

update journey_consultations set triggers = array[trigger]
  where trigger is not null and triggers = '{}';
update journey_consultations set uncertainties = array[uncertainty]
  where uncertainty is not null and uncertainties = '{}';

comment on column journey_consultations.triggers is
  'Why now — every trigger the advisor heard, as codes from the need-state vocabulary. Replaces the single `trigger`, which is kept for rows written before 024 and for the subject-rights export.';
comment on column journey_consultations.uncertainties is
  'What could get in the way — every uncertainty the advisor heard, as codes. Replaces the single `uncertainty`, kept for the same reasons.';

-- ── The budget as a number ──────────────────────────────────────────────────
alter table journey_consultations add column if not exists budget_usd integer;
alter table journey_consultations drop constraint if exists consult_budget_valid;
alter table journey_consultations add constraint consult_budget_valid
  check (budget_usd is null or budget_usd >= 0);

comment on column journey_consultations.budget_usd is
  'About how much, all in: US dollars for the whole trip and the whole party. The band in `budget` is DERIVED from this and nights by api/_lib/need-state.js; this figure reaches no prompt.';

-- ── In their words ──────────────────────────────────────────────────────────
alter table journey_consultations add column if not exists in_their_words text;

comment on column journey_consultations.in_their_words is
  'Something the client said about why now, in their words, as the advisor heard it. THE ONE PROSE COLUMN on this table. Never copied into the need-state object, never in a prompt projection, never on the client document. In the subject-rights export. Code caps it at 400 characters.';

-- ── Say what happened ───────────────────────────────────────────────────────
do $$
declare
  singles integer;
  moved   integer;
begin
  select count(*) into singles from journey_consultations where trigger is not null or uncertainty is not null;
  select count(*) into moved from journey_consultations
   where (trigger is not null and triggers <> '{}') or (uncertainty is not null and uncertainties <> '{}');
  if singles > 0 and moved < singles then
    raise warning '% consultation rows carry a single trigger/uncertainty that did not backfill into the arrays.', singles - moved;
  else
    raise notice '% consultation rows carried a single value; every one is now also in its array.', singles;
  end if;
end $$;

-- One glance answers "did this work".
select
  exists (select 1 from information_schema.columns
           where table_name = 'journey_consultations' and column_name = 'triggers')       as triggers_column,
  exists (select 1 from information_schema.columns
           where table_name = 'journey_consultations' and column_name = 'uncertainties')  as uncertainties_column,
  exists (select 1 from information_schema.columns
           where table_name = 'journey_consultations' and column_name = 'budget_usd')     as budget_usd_column,
  exists (select 1 from information_schema.columns
           where table_name = 'journey_consultations' and column_name = 'in_their_words') as in_their_words_column,
  (select pg_get_constraintdef(oid) from pg_constraint
    where conname = 'consult_budget_valid')                                              as budget_check;
