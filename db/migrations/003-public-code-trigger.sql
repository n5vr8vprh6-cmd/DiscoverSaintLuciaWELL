-- ===========================================================================
-- 003-public-code-trigger.sql — every advisor gets a code, on every path
-- ---------------------------------------------------------------------------
-- 002 backfilled public_code for rows that already existed, which made the
-- migration check pass and hid the fact that nothing assigns a code to a NEW
-- row. Registration created an advisor with a null code, and that advisor had
-- no working WELL link.
--
-- A trigger rather than a column default, for two reasons:
--
--   1. A default cannot retry. Collisions are vanishingly unlikely at 32^8, but
--      "vanishingly unlikely" becomes "a confusing 500 on someone's signup" the
--      one time it happens. The loop below simply tries again.
--   2. Duncan adds advisors by hand in the Supabase Table Editor. A trigger
--      covers that path too, and any future path, without anyone remembering.
--
-- Safe to run more than once.
-- ===========================================================================

create or replace function advisors_set_public_code() returns trigger
language plpgsql as $$
declare
  candidate text;
begin
  if new.public_code is not null and new.public_code <> '' then
    return new;                      -- an explicit code was supplied; respect it
  end if;
  loop
    candidate := gen_public_code();
    exit when not exists (select 1 from advisors where public_code = candidate);
  end loop;
  new.public_code := candidate;
  return new;
end $$;

drop trigger if exists advisors_public_code on advisors;
create trigger advisors_public_code
  before insert on advisors
  for each row execute function advisors_set_public_code();

-- Anything that slipped through before the trigger existed.
do $$
declare
  r record;
  candidate text;
begin
  for r in select id from advisors where public_code is null or public_code = '' loop
    loop
      candidate := gen_public_code();
      exit when not exists (select 1 from advisors where public_code = candidate);
    end loop;
    update advisors set public_code = candidate where id = r.id;
  end loop;
end $$;

-- Now that every row is guaranteed to have one, make that a rule rather than
-- a habit. Done last so it cannot fail against pre-existing null rows.
alter table advisors alter column public_code set not null;
