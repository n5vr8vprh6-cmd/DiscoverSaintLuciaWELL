-- ============================================================================
-- 023-design-stepped.sql — the four stages, a dated trip, an estimate, a send
-- ----------------------------------------------------------------------------
-- The design workspace became a stepped consultation on 2026-09-08:
-- Understand → Compare → Shape → Send. 022's stage vocabulary named the
-- workspace's first shape (read · direction · shortlist · rhythm · narrative ·
-- issued) and the screen no longer shows those words, so writing 'compare'
-- raised 23514 and api/_lib/hub-screens/design.js has been recording the stage
-- best-effort — log, never fail — since Phase 1. This makes the write succeed.
--
-- ── WHAT IS CHECKED AND WHAT IS NOT ────────────────────────────────────────
-- 014's line, again: structural yes, editorial no. The stage list is structural
-- (the screen dispatches on it) and stays CHECKed. day_plan and estimate are
-- jsonb the code validates against the generated bank — intensity bands,
-- property slugs, recipe keys — because a CHECK on those would silently reject
-- a plan the moment the research added a band.
--
-- ── travel_from IS A DATE, NOT TEXT ────────────────────────────────────────
-- journey_consultations has no free text and must never have any; a month the
-- advisor picks is a date. It is what lets the estimate resolve a public rate
-- for THIS trip rather than a season, and it is passed to no prompt.
--
-- ── sent_at LIVES OUTSIDE THE FROZEN LIST ──────────────────────────────────
-- itinerary_frozen() in 022 refuses changes to the document, brand, version and
-- token. sent_at is a fact ABOUT the artifact, like view_count, and is
-- deliberately not in that list — it is written after issue, by the mail path.
--
-- Run in the Supabase SQL editor. Additive and idempotent; no new tables, so
-- RLS is untouched.
-- ============================================================================

-- ── The stage vocabulary becomes the four the screen shows ──────────────────
alter table design_sessions drop constraint if exists design_stage_valid;

update design_sessions set stage = case stage
  when 'read'      then 'understand'
  when 'direction' then 'compare'
  when 'shortlist' then 'compare'
  when 'rhythm'    then 'shape'
  when 'narrative' then 'send'
  else stage end
  where stage in ('read','direction','shortlist','rhythm','narrative');

alter table design_sessions alter column stage set default 'understand';

alter table design_sessions add constraint design_stage_valid
  check (stage in ('understand','compare','shape','send','issued'));

comment on column design_sessions.stage is
  'understand · compare · shape · send · issued — the four screens of the stepped consultation, plus the terminal state. Resume is DERIVED by the code from what is stored; this column is a record, not the authority.';

-- ── The estimate, advisor-edited, frozen into the document at issue ─────────
alter table design_sessions add column if not exists estimate jsonb;
comment on column design_sessions.estimate is
  'Line items and a total RANGE, computed by code from content/rates.js and edited by the advisor. No model ever touches it. Frozen into journey_itineraries.document at issue.';

-- ── When the client was sent the link ───────────────────────────────────────
alter table journey_itineraries add column if not exists sent_at timestamptz;
comment on column journey_itineraries.sent_at is
  'Set when the link was emailed to the client from inside Issue. A fact about the artifact, like view_count — deliberately outside itinerary_frozen().';

-- ── When the trip is ───────────────────────────────────────────────────────
alter table journey_consultations add column if not exists travel_from date;
comment on column journey_consultations.travel_from is
  'First day of travel, or the first of the month when only a month is known. Seeded from journey_shares.travel_window, sharpened by the advisor. A date, never text; passed to no prompt.';

-- ── day_plan: documented, not constrained ───────────────────────────────────
comment on column design_sessions.day_plan is
  '{ recipe, nights, days: [{ n, phase, property, intensity: rest|low|medium|high, note, noteSource }] } — built by api/_lib/design-shape.js, validated against the generated bank. Intensity bands are inferred until Duncan confirms them.';

-- ── Say what happened ───────────────────────────────────────────────────────
do $$
declare
  legacy integer;
begin
  select count(*) into legacy from design_sessions
   where stage not in ('understand','compare','shape','send','issued');
  if legacy > 0 then
    raise warning '% design_sessions rows still carry a stage outside the new vocabulary.', legacy;
  else
    raise notice 'every design_sessions row speaks the four-stage vocabulary.';
  end if;
end $$;

-- One glance answers "did this work".
select
  exists (select 1 from information_schema.columns
           where table_name = 'design_sessions' and column_name = 'estimate')        as estimate_column,
  exists (select 1 from information_schema.columns
           where table_name = 'journey_itineraries' and column_name = 'sent_at')     as sent_at_column,
  exists (select 1 from information_schema.columns
           where table_name = 'journey_consultations' and column_name = 'travel_from') as travel_from_column,
  (select pg_get_constraintdef(oid) from pg_constraint
    where conname = 'design_stage_valid')                                           as stage_check;
