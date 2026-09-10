-- ============================================================================
-- 027-party-rooms.sql — how many rooms
-- ----------------------------------------------------------------------------
-- Compare shows a stay price per room a night from the public-rate lookup
-- (content/rates.js, two adults a room). To say what that is a person, the
-- consultation needs the party in numbers: adults and children have had
-- columns since 022 (never written until now); rooms is new. All three are
-- counts, all three are codes-not-prose, and all three may reach a prompt as
-- numbers of people — never as money.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

alter table journey_consultations add column if not exists rooms integer;
alter table journey_consultations drop constraint if exists consult_rooms_valid;
alter table journey_consultations add constraint consult_rooms_valid
  check (rooms is null or rooms >= 0);

comment on column journey_consultations.rooms is
  'How many rooms the party needs. With adults and children (022) it turns a per-room public rate into a per-person figure on Compare. A count, never money.';

-- One glance answers "did this work".
select
  exists (select 1 from information_schema.columns
           where table_name = 'journey_consultations' and column_name = 'rooms') as rooms_column,
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'consult_rooms_valid') as rooms_check;
