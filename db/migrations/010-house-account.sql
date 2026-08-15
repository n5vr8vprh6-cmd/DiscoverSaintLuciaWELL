-- ============================================================================
-- 010-house-account.sql — somewhere for an unreferred Journey to go
-- ----------------------------------------------------------------------------
-- Until now, a visitor who finished the Journey Finder without arriving through
-- an advisor's link hit a dead end: api/share.js wrote advisor_id = null, the
-- row sat unassigned, nobody was notified, and the result page offered a link
-- to the contact form instead of the share flow. js/journey.js said so plainly
-- — "Without an advisor there is nobody to send it to."
--
-- Consumer Engine brief §8 always specified the answer as the third rung of the
-- attribution hierarchy: "No attributable advisor → central Discover Saint
-- Lucia WELL lead pool." This is that pool, implemented as an ordinary advisor
-- row so that every screen, query, notification and guard already written works
-- on it without a special case.
--
-- ── ONE, AND ONLY ONE ──────────────────────────────────────────────────────
-- The partial unique index is the same shape as advisors_one_master in
-- 004-admin.sql. Two house accounts would mean unreferred Journeys silently
-- split between them depending on which the query happened to return first —
-- the kind of fault that is invisible until somebody asks why the numbers do
-- not add up.
--
-- ── IT IS STILL AN ADVISOR ROW ─────────────────────────────────────────────
-- It signs in, it has a Hub, it has a pipeline, it can hold a prize draw. The
-- flag changes exactly three things: it is the fallback recipient, it is exempt
-- from the Advisor Data Undertaking (staff are covered by the privacy policy
-- directly, not by a third-party agreement), and it is badged in the admin
-- console so it is not mistaken for a regular advisor in the counts.
--
-- Run in the Supabase SQL editor. Additive and idempotent.
-- ============================================================================

alter table advisors add column if not exists is_house boolean not null default false;

comment on column advisors.is_house is
  'The central lead pool. Receives Journeys shared without an advisor referral, and is exempt from the Advisor Data Undertaking because the team are staff rather than independent professionals. At most one row may have this set.';

create unique index if not exists advisors_one_house
  on advisors (is_house) where is_house;

-- Should report zero rows and one house account once you have set the flag.
select
  count(*) filter (where is_house) as house_accounts,
  count(*) filter (where is_house and status <> 'active') as house_but_not_active
from advisors;
