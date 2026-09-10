-- ============================================================================
-- 025-understand-notes.sql — the human layer: notes, a recap, and the
-- advisor's own stories about places
-- ----------------------------------------------------------------------------
-- Duncan's second review of Understand (2026-09-10): the screen should give
-- the advisor room to be human — to dig into how the client is overwhelmed,
-- to write down what was actually said, to tell a story about a place. Three
-- additions, each a home for prose that stays out of every prompt.
--
-- ── notes IS THE PROSE COLUMN NOW ──────────────────────────────────────────
-- 024 added in_their_words, one line of prose about why now. The second pass
-- wants a note under four sections (what they said about how they feel, why
-- now, what would make them hesitate, things to plan around). One jsonb
-- column, four keys — told · why · hesitate · around — each capped at 400
-- characters in code. Same rule as before, now with four keys: written
-- through `extra`, read from the row, never copied into a need-state, never
-- named in the projection; tools/design-privacy-test.js poisons every key.
-- in_their_words is backfilled into notes.why and stops being written.
--
-- ── heard_sent_at ──────────────────────────────────────────────────────────
-- "Send what I heard" emails the read-back paragraph to the client, copied to
-- the advisor. When it went is a fact about the consultation; the button then
-- says "Sent 3 minutes ago" instead of offering to send it again blind.
--
-- ── advisor_place_notes: THE ADVISOR'S OWN STORIES ─────────────────────────
-- "Stayed here in 2024; the sunset massage at Kai Mer is the thing." One note
-- per advisor per property, shown on the island card and the Compare card so
-- the story is to hand when the place comes up. Advisor-scoped and about a
-- place, not a person: RLS own-rows like advisor_notes, not in the
-- subject-rights export, never in a prompt or a document.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

-- ── Notes, four keys ────────────────────────────────────────────────────────
alter table journey_consultations add column if not exists notes jsonb not null default '{}'::jsonb;

update journey_consultations
   set notes = jsonb_build_object('why', in_their_words)
 where in_their_words is not null and in_their_words <> '' and notes = '{}'::jsonb;

comment on column journey_consultations.notes is
  '{ told, why, hesitate, around } — what the advisor wrote down under four sections of Understand, in their own or the client''s words. THE PROSE ON THIS TABLE. Never copied into a need-state, never in a prompt projection, never on the client document. In the subject-rights export. Code caps each at 400 characters. Supersedes in_their_words (024), which is kept for rows written before this migration.';

-- ── The recap ───────────────────────────────────────────────────────────────
alter table journey_consultations add column if not exists heard_sent_at timestamptz;
comment on column journey_consultations.heard_sent_at is
  'When "What I heard" was last emailed to the client from Understand. A fact about the consultation, so the screen can say when rather than offer to send it again blind.';

-- ── The advisor''s stories about places ─────────────────────────────────────
create table if not exists advisor_place_notes (
  id         uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references advisors (id) on delete cascade,
  slug       text not null,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advisor_place_notes_one_per_place unique (advisor_id, slug)
);
create index if not exists advisor_place_notes_advisor_idx on advisor_place_notes (advisor_id);

comment on table advisor_place_notes is
  'An advisor''s own note about a property — a stay, an anecdote, a thing to say when it comes up. Shown to that advisor on the island card and the Compare card. About a place, not a person; never in a prompt or a document.';

alter table advisor_place_notes enable row level security;
drop policy if exists place_notes_own_all on advisor_place_notes;
create policy place_notes_own_all on advisor_place_notes
  for all to authenticated
  using (advisor_id = current_advisor_id())
  with check (advisor_id = current_advisor_id());

-- ── Say what happened ───────────────────────────────────────────────────────
do $$
declare
  moved integer;
begin
  select count(*) into moved from journey_consultations
   where in_their_words is not null and in_their_words <> '' and notes ? 'why';
  raise notice '% consultation rows carried in_their_words; every one is now also notes.why.', moved;
end $$;

-- One glance answers "did this work".
select
  exists (select 1 from information_schema.columns
           where table_name = 'journey_consultations' and column_name = 'notes')          as notes_column,
  exists (select 1 from information_schema.columns
           where table_name = 'journey_consultations' and column_name = 'heard_sent_at')  as heard_sent_at_column,
  exists (select 1 from information_schema.tables
           where table_name = 'advisor_place_notes')                                       as place_notes_table,
  (select count(*) from pg_policies where tablename = 'advisor_place_notes')              as place_notes_policies;
