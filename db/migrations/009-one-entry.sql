-- ============================================================================
-- 009-one-entry.sql — one entry per email, per draw
-- ----------------------------------------------------------------------------
-- api/share.js allows five submissions per IP per hour, which is right for a
-- form real people occasionally send twice. It also meant somebody could stack
-- five entries into the same prize draw, and the advisor drawing a winner would
-- be picking from a pool one person had weighted.
--
-- SHARING TWICE STAYS ALLOWED. A traveller may genuinely send a second Journey
-- after rethinking their answers, and the advisor should receive both. What is
-- capped is ENTRIES: the second share is recorded in full, attributed to the
-- advisor, and simply carries no sweepstakes_id.
--
-- ── WHY AN INDEX AND NOT JUST THE CHECK IN api/share.js ────────────────────
-- The application looks for an existing entry before it writes, which handles
-- every ordinary case. It cannot handle two submissions arriving close enough
-- together that both checks pass before either insert lands — a check-then-act
-- race that is unlikely, trivially reproducible by double-clicking, and
-- invisible afterwards because the duplicate looks exactly like a legitimate
-- entry.
--
-- An index cannot be raced. It also holds for code that does not exist yet: a
-- future seeding tool, an admin action or a migration cannot create a duplicate
-- entry by forgetting a rule it never knew about.
--
-- ── lower() IS BELT AND BRACES ─────────────────────────────────────────────
-- api/share.js:61 already lowercases the address before storing it, so in
-- practice the plain column would do. The index normalises anyway, because the
-- share endpoint is not the only thing that has ever written this table and the
-- cost of being wrong is a second entry nobody notices.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

-- Partial, so the millions of ordinary shares with no draw are untouched and
-- unconstrained — only rows that claim to be entries are subject to it.
create unique index if not exists journey_shares_one_entry_per_email
  on journey_shares (sweepstakes_id, lower(consumer_email))
  where sweepstakes_id is not null;

comment on index journey_shares_one_entry_per_email is
  'One prize-draw entry per email address per draw. api/share.js checks before inserting and retries without the flag on 23505 — so a duplicate submission is still a successful share, it is simply not a second ticket.';

-- Should report zero. If it does not, two rows already claim the same entry and
-- the index above will have refused to build — resolve them before re-running.
select count(*) as duplicate_entries_found
from (
  select sweepstakes_id, lower(consumer_email) as who
  from journey_shares
  where sweepstakes_id is not null
  group by 1, 2
  having count(*) > 1
) d;
