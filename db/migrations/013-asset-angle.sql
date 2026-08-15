-- ============================================================================
-- 013-asset-angle.sql — which angle produced this version
-- ----------------------------------------------------------------------------
-- Release D gives every asset an "Another angle" button: pain, aspiration,
-- proof or practical. The angle is stored so the block can say which version an
-- advisor is looking at, and so it survives a reload — without it, somebody
-- returning to their plan sees four rewrites of the same caption with no way to
-- tell what distinguished them.
--
-- Deliberately a plain text column with a CHECK rather than an enum: the set of
-- angles lives in api/_lib/gtm-generate.js and will change as the marketing
-- playbook matures. An enum would make every addition a migration, and the
-- application already validates against its own table before writing — a
-- hand-edited request cannot inject one.
--
-- NULL is the normal case. The first generation of an asset has no angle,
-- because the advisor has not yet seen what they would want to change.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

alter table gtm_asset add column if not exists angle text;

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
     where table_name = 'gtm_asset' and constraint_name = 'gtm_asset_angle_valid'
  ) then
    alter table gtm_asset add constraint gtm_asset_angle_valid
      check (angle is null or angle in ('pain', 'aspiration', 'proof', 'practical'));
  end if;
end $$;

comment on column gtm_asset.angle is
  'Which angle produced this version — pain, aspiration, proof, practical. NULL for a first generation, which has no angle because the advisor has not yet seen what they want changed.';

-- Warnings, never exceptions: the SQL editor runs a script as ONE transaction,
-- so a RAISE EXCEPTION here would roll back the ALTER above it and report the
-- migration as never applied. 006 and 007 both did exactly that.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_name = 'gtm_asset' and column_name = 'angle') then
    raise warning 'gtm_asset.angle is missing — regenerating with an angle will fail on write.';
  else
    raise notice 'gtm_asset.angle is present.';
  end if;
end $$;

-- One glance answers "did this work".
select
  (select count(*) from information_schema.columns
    where table_name = 'gtm_asset' and column_name = 'angle') as has_angle,
  (select count(*) from gtm_asset where angle is not null)    as rows_with_an_angle;
