-- ============================================================================
-- 008-sweepstakes.sql — mark which Journeys were prize-draw entries
-- ----------------------------------------------------------------------------
-- Advisors run their own prize draws to build a list. The mechanic already
-- exists: somebody completes the Journey Finder and shares it with the advisor.
-- The only thing missing was knowing WHICH shares were entries.
--
-- ── WHAT THIS DELIBERATELY IS NOT ──────────────────────────────────────────
-- Not the campaign layer in Consumer Engine brief §7 — no prize_summary, no
-- rules_url, no eligible_regions, no sponsor metadata, no separate consent
-- fields, no draw mechanism.
--
-- Discover Saint Lucia WELL is NOT the sponsor. The rules, eligibility, prize,
-- communications and the draw itself belong to the advisor and happen off this
-- platform. Storing prize terms here would make the platform look like the
-- promoter, which is a legal position nobody has taken. What the entrant is
-- told at the point of entry says so explicitly, and that sentence is stored in
-- journey_shares.consent_text with everything else they read.
--
-- So: a table of draws, and one nullable column on the share. That is all.
--
-- ── AN ENTRY IS A SHARE, NOT A FINDER COMPLETION ───────────────────────────
-- Completing the Finder collects no contact details, so a pool of completions
-- cannot be contacted, verified or drawn from. Sharing is the act that produces
-- an entrant, which is also the act that gives the advisor what they wanted.
-- journey_shares.created_at is therefore the entry time and there is no
-- separate entered_at to drift away from it.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

-- ── Codes ────────────────────────────────────────────────────────────────────
-- Six characters from the same Crockford-ish alphabet as gen_public_code()
-- (002-hub.sql): no I, L, O or U, so nothing reads as a word and nothing is
-- mistyped off a printed card. Shorter than an advisor code because it is the
-- SECOND segment of the link and the pair has to stay scannable as a QR.
--
-- Generated, never chosen. An advisor picking their own would eventually pick
-- something like OFFICIAL or WINNER in this brand's name.
create or replace function gen_sweeps_code() returns text language plpgsql as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end $$;

-- ── The draws ────────────────────────────────────────────────────────────────
create table if not exists sweepstakes (
  id          uuid primary key default gen_random_uuid(),
  -- Cascade: a deleted advisor's draws go with them. The ENTRIES do not — see
  -- the column below, which is ON DELETE SET NULL precisely so no real person's
  -- Journey is ever destroyed by tidying up a campaign.
  advisor_id  uuid not null references advisors (id) on delete cascade,

  -- The advisor's own name for it. Shown to nobody but them: the entrant sees
  -- the advisor's name, not the campaign's, because the advisor is who they are
  -- entering with.
  name        text not null,
  code        text not null unique,

  -- open | closed. Closing stops entries being counted; it does NOT break the
  -- link. Printed cards and QR codes outlive campaigns, so a closed draw's link
  -- keeps working as that advisor's ordinary WELL link — a dead link is worse
  -- than one that quietly stops counting.
  status      text not null default 'open',

  -- Display only, for the advisor's own reference. Nothing enforces it: the
  -- close is an act, not a timestamp, so a draw cannot silently stop counting
  -- entries while its owner still believes it is running.
  closes_at   timestamptz,

  created_at  timestamptz not null default now(),
  closed_at   timestamptz,

  constraint sweepstakes_status_valid check (status in ('open', 'closed'))
);

create index if not exists sweepstakes_advisor_idx on sweepstakes (advisor_id, created_at desc);

-- Fill the code on insert, retrying on the vanishingly unlikely clash. Same
-- pattern as advisors_public_code in 003.
create or replace function sweepstakes_set_code() returns trigger
language plpgsql as $$
declare
  candidate text;
begin
  if new.code is not null and new.code <> '' then
    return new;
  end if;
  loop
    candidate := gen_sweeps_code();
    exit when not exists (select 1 from sweepstakes where code = candidate);
  end loop;
  new.code := candidate;
  return new;
end $$;

drop trigger if exists sweepstakes_code on sweepstakes;
create trigger sweepstakes_code
  before insert on sweepstakes
  for each row execute function sweepstakes_set_code();

-- ── The flag on the share ────────────────────────────────────────────────────
-- ON DELETE SET NULL, emphatically. Deleting a finished campaign must never
-- delete the people who entered it: they shared their details with an advisor
-- to plan a trip, and the draw was incidental to that.
alter table journey_shares
  add column if not exists sweepstakes_id uuid references sweepstakes (id) on delete set null;

create index if not exists journey_shares_sweeps_idx
  on journey_shares (sweepstakes_id, created_at desc);

comment on column journey_shares.sweepstakes_id is
  'Set by api/share.js ONLY when it resolved an open sweepstakes at write time. Never set from the client: the entrant is told they are entered only if this was written.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- RLS on with zero policies, like every original table: service role only. The
-- Hub reads through server-side code that scopes by advisor_id, so an advisor
-- needs no direct grant here and must not have one.
alter table sweepstakes enable row level security;

do $$
begin
  raise notice 'Sweepstakes ready. Codes are 6 chars; links are /well/<advisor_code>/<sweeps_code>.';
end $$;

select
  exists (select 1 from information_schema.tables where table_name = 'sweepstakes') as has_table,
  exists (select 1 from information_schema.columns
           where table_name = 'journey_shares' and column_name = 'sweepstakes_id') as has_column,
  gen_sweeps_code() as sample_code;
