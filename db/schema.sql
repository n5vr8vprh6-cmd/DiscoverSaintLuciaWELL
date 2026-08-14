-- ===========================================================================
-- Advisor Hub V1.2 — Phase 1 schema
-- ---------------------------------------------------------------------------
-- Run this once in the Supabase SQL editor.
--
-- THREE TABLES, AND ONE DELIBERATE ABSENCE.
-- The brief (§17) suggests storing anonymous Journey Sessions — the Finder's
-- answers and result, without contact details. This schema does not. It counts
-- completions instead, and stores answers only when someone explicitly shares.
--
-- The reason is that /privacy now tells visitors, in plain words, that their
-- Finder answers are not sent to us and are not stored. That promise is worth
-- more than the analytics, and it is the reason the Finder can stay
-- frictionless. Adding session storage later is additive and would need the
-- privacy page updated in the same commit; taking it away later would not be
-- possible, because it would already have been collected.
--
-- ROW LEVEL SECURITY IS ON WITH NO POLICIES, ON PURPOSE.
-- That combination denies everything to the anon and authenticated keys. Only
-- the service-role key — which lives in Vercel env vars and never reaches a
-- browser — can read or write. When advisor auth arrives in Phase 2, policies
-- get added so an advisor can read their own rows and nobody else's.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ── Advisors ──────────────────────────────────────────────────────────────
-- For the beta this is a table Duncan edits by hand in the Supabase dashboard.
-- Six rows do not justify an admin UI, and the brief warns against building
-- marketing SaaS.
create table if not exists advisors (
  id          uuid primary key default gen_random_uuid(),
  -- The campaign link is /?advisor=<slug>. It is public and appears in emails
  -- and on printed QR codes, so it should be readable and stable.
  slug        text not null unique,
  first_name  text not null,
  last_name   text not null,
  email       text not null,
  business    text,
  market      text,
  -- 'active' | 'paused'. A paused advisor still resolves for attribution that
  -- is already in flight, but see api/advisor.js — they stop being offered.
  status      text not null default 'active',
  created_at  timestamptz not null default now()
);

create index if not exists advisors_slug_idx on advisors (slug) where status = 'active';

-- ── Campaign visits ───────────────────────────────────────────────────────
-- One row each time an advisor's link brings someone to the site. Carries no
-- personal data: the session id is random and browser-scoped, and the IP is
-- never stored, only hashed for rate limiting elsewhere.
create table if not exists campaign_visits (
  id          uuid primary key default gen_random_uuid(),
  advisor_id  uuid references advisors (id) on delete set null,
  source      text,            -- email / social / event / referral / partner / direct
  session_id  text,            -- random, browser-scoped, not a user identifier
  path        text,
  referrer    text,
  created_at  timestamptz not null default now()
);

create index if not exists campaign_visits_advisor_idx on campaign_visits (advisor_id, created_at desc);

-- ── Finder completions ────────────────────────────────────────────────────
-- Deliberately just a count with a timestamp. NO ANSWERS. This is what turns
-- "24 visits" into "24 visits → 7 completions → 3 shared" without holding a
-- record of what any anonymous person said.
create table if not exists finder_completions (
  id          uuid primary key default gen_random_uuid(),
  advisor_id  uuid references advisors (id) on delete set null,
  session_id  text,
  created_at  timestamptz not null default now()
);

create index if not exists finder_completions_advisor_idx on finder_completions (advisor_id, created_at desc);

-- ── Journey shares ────────────────────────────────────────────────────────
-- The only table holding personal data, and only ever written after a person
-- has read who will receive it and pressed the button.
create table if not exists journey_shares (
  id             uuid primary key default gen_random_uuid(),
  advisor_id     uuid references advisors (id) on delete set null,

  -- The four Finder answers and the villages they produced. Stored here
  -- because the advisor needs to understand the person before calling them.
  answers        jsonb not null,
  villages       text[] not null default '{}',

  consumer_first text not null,
  consumer_last  text not null,
  consumer_email text not null,
  consumer_phone text,
  timing         text,
  context        text,

  -- Evidence of consent: when they agreed, and to exactly what wording. The
  -- wording is stored verbatim because a consent record that cannot show what
  -- was agreed to is not a consent record.
  consent_at     timestamptz not null default now(),
  consent_text   text not null,

  source         text,
  session_id     text,
  -- Salted hash, never the address itself. Used only to rate limit the public
  -- endpoint; it cannot be reversed into an IP.
  ip_hash        text,

  notified_at    timestamptz,   -- set once the advisor email is accepted
  created_at     timestamptz not null default now()
);

create index if not exists journey_shares_advisor_idx on journey_shares (advisor_id, created_at desc);
-- Supports the rate-limit lookup in api/share.js.
create index if not exists journey_shares_rate_idx on journey_shares (ip_hash, created_at desc);

-- ── Lock everything down ──────────────────────────────────────────────────
-- RLS on, zero policies: anon and authenticated keys can do nothing at all.
-- Only the service-role key reaches these tables, and it only exists on the
-- server. Do not add a permissive policy "to make testing easier".
alter table advisors           enable row level security;
alter table campaign_visits    enable row level security;
alter table finder_completions enable row level security;
alter table journey_shares     enable row level security;

-- ── No seeded advisor ─────────────────────────────────────────────────────
-- This file used to insert a `test-advisor` row so the loop could be tested
-- before anyone had registered. That row is gone, and the seed with it, for
-- two reasons.
--
-- It could not sign in. Rows created here have no `auth_user_id`, so a seeded
-- advisor can receive Journeys but can never open the Hub to read them — an
-- account in a state no real advisor can be in, which makes it a poor thing to
-- test against.
--
-- And an `active` advisor is not an inert fixture: it is an address that real
-- consumer contact details get routed to. A seed that ships one by default is
-- a seed that quietly opts a database into receiving personal data.
--
-- Advisors register themselves at /hub/register (see db/SETUP.md). To exercise
-- attribution against a deployment, pass a real code to the suite:
--     node tools/regress.js --advisor=<public_code>
