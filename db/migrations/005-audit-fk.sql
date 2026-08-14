-- ============================================================================
-- 005 — AN AUDIT LOG SHOULD NOT HAVE FOREIGN KEYS TO THINGS IT OUTLIVES
-- ----------------------------------------------------------------------------
-- 004 gave admin_audit foreign keys on subject_advisor_id and subject_share_id.
-- That looked tidy and was wrong twice over, both discovered by round-tripping
-- a real deletion rather than by reading the schema:
--
--   1. THE DELETION AUDIT COULD NOT BE WRITTEN AT ALL. The row recording
--      "deleted this advisor" is inserted after the advisor is gone, so the
--      foreign key rejected it (23503). The single most consequential action in
--      the console was the one action that left no trace.
--
--   2. `on delete set null` QUIETLY ERASED HISTORY. Every earlier audit row
--      about that advisor — approved, paused, locked — had its subject id
--      nulled the moment they were deleted. The linkage was destroyed by the
--      very event most worth having a record of.
--
-- The table already stores `admin_email` and `subject_label` verbatim for
-- exactly this reason: an entry has to keep meaning after the accounts it names
-- are gone. The ids were only ever a convenience for filtering.
--
-- So they become plain uuids. Nothing is dropped from the table and no data is
-- lost; only the constraints go.
--
-- Safe to re-run.
-- ============================================================================

alter table admin_audit drop constraint if exists admin_audit_subject_advisor_id_fkey;
alter table admin_audit drop constraint if exists admin_audit_subject_share_id_fkey;

-- The indexes stay: filtering an advisor's history by id is still useful while
-- they exist, and is simply empty once they do not.
create index if not exists admin_audit_subject_idx on admin_audit (subject_advisor_id, created_at desc);

-- api/_lib/admin-data.js retries a rejected insert without the ids, so the trail
-- stays complete whether or not this migration has been applied. Applying it
-- means the ids survive too.
