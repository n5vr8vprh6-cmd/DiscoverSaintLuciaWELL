-- ============================================================================
-- 015-brief.sql — the advisor's own specifics, stored addressably
-- ----------------------------------------------------------------------------
-- The Campaign Brief an advisor's own AI produces and they paste back. It is
-- the deepest input the system has, and the only place an advisor's actual
-- clients, markets and proof arrive.
--
-- ── WHY BOTH THE RAW TEXT AND THE PARSED FORM ──────────────────────────────
-- brief_parsed is what the generator reads. brief_raw is what the advisor
-- actually pasted.
--
-- Keeping the raw is not sentimentality. The parser in api/_lib/brief.js will
-- change — the section list, the minimum item counts and the tolerance for
-- whatever a chat window does to text are all things we will get wrong the
-- first time. A stored raw brief can be re-parsed against a better parser; a
-- stored parse cannot be un-parsed. It is also the only way to answer "why did
-- my plan not use my best client story" without asking the advisor to paste it
-- all again.
--
-- ── WHY IT IS jsonb AND NOT COLUMNS ────────────────────────────────────────
-- The sections are a list of lists — clients, markets, objections, proof — and
-- their shape is set by content/marketing-playbook.js and the research behind
-- it, not by this schema. Columns here would mean a migration every time the
-- brief format learned something.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

alter table gtm_profile add column if not exists brief_raw    text;
alter table gtm_profile add column if not exists brief_parsed jsonb;
alter table gtm_profile add column if not exists brief_at     timestamptz;

comment on column gtm_profile.brief_raw is
  'Exactly what the advisor pasted. Kept so a brief can be re-parsed when the parser improves — a stored parse cannot be un-parsed, and this is the only way to explain why a plan missed something they thought they had given us.';
comment on column gtm_profile.brief_parsed is
  'The sections the generator reads, as an addressable inventory: CLIENTS 1, MARKETS 2, PROOF 1. Addressable because five attempts proved the model uses labelled input and reads prose as scenery.';

-- Warnings, never exceptions: the SQL editor runs a script as ONE transaction,
-- so a RAISE EXCEPTION here would roll back the ALTERs above it and report the
-- migration as never applied. 006 and 007 both did exactly that.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_name = 'gtm_profile' and column_name = 'brief_parsed') then
    raise warning 'brief_parsed is missing — a pasted brief will not reach the generator.';
  else
    raise notice 'Brief columns present.';
  end if;
end $$;

-- One glance answers "did this work".
select
  count(*) filter (where column_name = 'brief_raw')    as has_raw,
  count(*) filter (where column_name = 'brief_parsed') as has_parsed,
  count(*) filter (where column_name = 'brief_at')     as has_at
from information_schema.columns where table_name = 'gtm_profile';
