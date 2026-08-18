-- ============================================================================
-- 019-capture-rate.sql — the smallest table that stops a mail relay
-- ----------------------------------------------------------------------------
-- /api/capture sends a traveller their own Finder result. It is public,
-- unauthenticated, and it emails whatever address it is handed — which is the
-- same shape as api/share.js and therefore the same abuse surface: point a
-- script at it and it will send thousands of unsolicited messages from our
-- domain, at a moment when that domain's sending reputation is new enough to be
-- landing in spam folders already.
--
-- share.js rate-limits by counting journey_shares rows with the same ip_hash
-- (journey_shares_rate_idx exists for exactly that). The capture endpoint
-- deliberately STORES NOTHING — the address is used to send the email and then
-- forgotten, which is the strongest possible answer to "what do you hold about
-- me" — so it has no rows of its own to count. This table is that counter, and
-- nothing else.
--
-- ── WHAT IS AND IS NOT IN HERE ─────────────────────────────────────────────
-- No email address. No answers. No villages. No session. Nothing that ties a
-- row to a person or to a request. One salted hash of a network address, and a
-- timestamp.
--
-- api/_lib/core.js states the rule this follows, and it predates this file:
-- "Never store the address itself — only a salted hash, so a rate limit does
-- not become an IP log." Without IP_HASH_SALT configured, ipHash() returns null
-- and the endpoint treats rate limiting as unavailable rather than hashing with
-- a guessable constant — so an unsalted deployment writes no rows here at all.
--
-- ── WHY IT IS NOT journey_shares ───────────────────────────────────────────
-- A share is a person choosing to hand their details to a named advisor, with
-- the consent wording they agreed to stored beside it. A capture is a person
-- emailing themselves. Recording one as the other would misstate what somebody
-- consented to, and would put an entry in an advisor's Hub that no advisor was
-- ever chosen for.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
--
-- NOTE ON `raise`: the editor runs the script as ONE transaction, so a RAISE
-- EXCEPTION would roll back the DDL above it and leave a clean-looking error
-- and no table. This warns and continues; the closing SELECT is the proof.
-- ============================================================================

create table if not exists capture_rate (
  id          uuid primary key default gen_random_uuid(),
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);

-- The only query this table ever serves: how many from this origin, recently.
create index if not exists capture_rate_idx on capture_rate (ip_hash, created_at desc);

comment on table capture_rate is
  'Rate-limit counter for /api/capture. Salted IP hashes and timestamps ONLY — no address, no answers, nothing identifying. See db/migrations/019.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- On, with zero policies: service role only, like every other table here.
alter table capture_rate enable row level security;

-- ── Retention ────────────────────────────────────────────────────────────────
-- Re-stated in full because `create or replace` replaces the whole body. This
-- is 018's function with one arm added.
--
-- ONE MONTH, not 24. A rate-limit window is an hour; a row older than that has
-- no job left to do. Everything else in this schema is kept for two years
-- because somebody may need it back — nobody will ever need this back, and a
-- hash of a network address is exactly the kind of thing that should expire on
-- its own rather than accumulate because the default said so.
create or replace function retention_months(what text)
returns integer
language sql
immutable
as $$
  select case what
    when 'journey_shares' then 24
    when 'campaign_visits' then 24
    when 'finder_completions' then 24
    when 'immersion_waitlist' then 24
    when 'capture_rate' then 1
    else 24
  end;
$$;

do $$
begin
  if not exists (select 1 from information_schema.tables where table_name = 'capture_rate') then
    raise warning 'capture_rate was not created — read the error above this line.';
  end if;
end $$;

select
  exists (select 1 from information_schema.tables
           where table_name = 'capture_rate')                 as has_table,
  exists (select 1 from pg_indexes
           where indexname = 'capture_rate_idx')              as has_index,
  (select relrowsecurity from pg_class
    where relname = 'capture_rate')                           as rls_on,
  retention_months('capture_rate')                            as retention_months,
  -- Listed, not counted, because the whole point of this table is WHICH
  -- columns it has. Expect exactly: id, ip_hash, created_at.
  (select string_agg(column_name, ', ' order by ordinal_position)
     from information_schema.columns
    where table_name = 'capture_rate')                        as columns;
