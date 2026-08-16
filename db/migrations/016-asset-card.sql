-- ============================================================================
-- 016-asset-card.sql — the two fields that respect an advisor's real week
-- ----------------------------------------------------------------------------
-- The Strategist Bible's Asset Card has seventeen fields. Most of them we
-- already hold or can derive without spending a token:
--
--   job            <- the pattern the skeleton chose already carries one
--   proof source   <- the `uses` citation, when it points at a PROOF item
--   success signal <- the channel's own metrics line in the marketing playbook
--   compliance     <- the flags claims.js already produces
--   audience state <- the traveller orientation on the profile
--
-- Deriving beats generating: it costs nothing, it cannot hallucinate, and it
-- cannot drift from the thing it describes. Only two fields carry information
-- that exists nowhere else, so only two are generated and stored here.
--
-- ── FALLBACK ───────────────────────────────────────────────────────────────
-- A lower-burden execution that preserves the same job, for the week life gets
-- busy. Nothing else in this product acknowledges that week, and it is the week
-- most campaigns actually die in — not because the plan was wrong but because
-- Tuesday was. An advisor who can do the smaller version keeps the sequence
-- alive; one facing only the full version skips it, then skips the next.
--
-- ── PERSONALIZATION ────────────────────────────────────────────────────────
-- Where the advisor should add a real opinion, a story or a client's own words.
-- It is the difference between their campaign and anybody's, and it is the one
-- thing the generator can point at but never supply.
--
-- Both are nullable and both degrade silently. An asset generated before this
-- migration, or one whose tail failed to parse, is a normal asset with a normal
-- body — the copy never depends on them.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

alter table gtm_asset add column if not exists fallback        text;
alter table gtm_asset add column if not exists personalization text;

comment on column gtm_asset.fallback is
  'A lower-burden execution preserving the same job, for the week life gets busy — which is the week campaigns actually die in. Nullable: the copy never depends on it.';
comment on column gtm_asset.personalization is
  'Where the advisor adds a real opinion, story or client words. The one thing the generator can point at but never supply.';

-- Warnings, never exceptions: the SQL editor runs a script as ONE transaction,
-- so a RAISE EXCEPTION here would roll back the ALTERs above it and report the
-- migration as never applied. 006 and 007 both did exactly that.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_name = 'gtm_asset' and column_name = 'fallback') then
    raise warning 'gtm_asset.fallback is missing — assets will save without it.';
  else
    raise notice 'Asset card columns present.';
  end if;
end $$;

-- One glance answers "did this work".
select
  count(*) filter (where column_name = 'fallback')        as has_fallback,
  count(*) filter (where column_name = 'personalization') as has_personalization
from information_schema.columns where table_name = 'gtm_asset';
