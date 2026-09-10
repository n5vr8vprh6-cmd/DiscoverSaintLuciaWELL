-- ============================================================================
-- 026-eclipse-interest.sql — did they want to hear how Eclipse would shape it?
-- ----------------------------------------------------------------------------
-- A client who answered "Yes, some of it" to the Finder's recognition question
-- sees Eclipse on the Understand stage: a practitioner-led, curated five-day
-- journey across several places. The advisor asks whether they want to hear
-- how it would shape the week and records the answer here. The Shape stage
-- will read it and start from Eclipse's own arc rather than from the answers.
--
-- Three states, one column: null (not asked, or the question never applied),
-- true (interested), false (not for this trip). A code, not prose — so it may
-- travel in the need-state and reach a prompt as a word ("interested"), which
-- identifies nobody and makes a narrative that knows Eclipse is on the table.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

alter table journey_consultations add column if not exists eclipse_interest boolean;

comment on column journey_consultations.eclipse_interest is
  'Whether the client wants to hear how Eclipse would shape the week. null = not asked / did not apply; true = interested; false = not for this trip. Recorded on Understand; read by Shape. A code, allowed into the prompt as a word.';

-- One glance answers "did this work".
select
  exists (select 1 from information_schema.columns
           where table_name = 'journey_consultations' and column_name = 'eclipse_interest') as eclipse_interest_column;
