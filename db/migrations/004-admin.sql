-- ============================================================================
-- 004 — THE ADMIN CONSOLE
-- ----------------------------------------------------------------------------
-- Additive only. Nothing dropped, nothing renamed, safe to re-run.
--
-- Approving an advisor currently means editing a `status` cell in the Supabase
-- Table Editor, and nothing records who did it. This adds the columns an admin
-- console needs, an audit table, and — the part worth reading carefully — the
-- guards that stop the new `role` column becoming a way to become an admin.
--
-- Run it in the SQL editor, then bootstrap the first admin by hand (bottom).
-- ============================================================================

-- ── Advisor columns ───────────────────────────────────────────────────────
alter table advisors add column if not exists role              text not null default 'advisor';
alter table advisors add column if not exists is_master         boolean not null default false;
alter table advisors add column if not exists approved_at       timestamptz;
alter table advisors add column if not exists approved_by       uuid references advisors (id);
alter table advisors add column if not exists registration_note text;
alter table advisors add column if not exists locked_at         timestamptz;

alter table advisors drop constraint if exists advisors_role_check;
alter table advisors add constraint advisors_role_check check (role in ('advisor', 'admin'));

create index if not exists advisors_role_idx   on advisors (role) where role = 'admin';
create index if not exists advisors_status_idx on advisors (status, created_at desc);


-- ── THE PRIVILEGE-ESCALATION HOLE THIS COLUMN WOULD OTHERWISE OPEN ────────
-- 002 created this policy:
--
--   create policy advisors_self_update on advisors
--     for update to authenticated
--     using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
--
-- It restricts WHICH ROW you may update. It says nothing about WHICH COLUMNS.
-- So the moment `role` exists on this table, any holder of a real user JWT
-- could set their own row's role to 'admin' — and the same is true of `status`
-- (self-approval), `public_code` (stealing another advisor's link) and
-- `auth_user_id` (attaching your login to someone else's advisor record).
--
-- It is latent today: the Hub is server-rendered and reads through the service
-- role, and anonClient() is only ever used to exchange credentials, so no user
-- JWT is ever issued against PostgREST. Latent is not the same as absent, and
-- a column called `role` is not the thing to leave resting on that.
--
-- RLS policies cannot restrict columns. Column-level GRANT is the mechanism.
--
-- WRITTEN AS AN ALLOW-LIST, DELIBERATELY. A deny-list rots: the next migration
-- that adds a sensitive column is silently writable unless someone remembers to
-- come back here. This way, anything added later is denied until it is named.
revoke update on advisors from authenticated;
grant update (
  first_name, last_name, business, host_agency, phone,
  website, socials, bio, market, photo_url
) on advisors to authenticated;
-- Not granted, on purpose: role, is_master, status, approved_at, approved_by,
-- locked_at, public_code, slug, auth_user_id, email, onboarding_state, id,
-- created_at, registration_note.
-- Mirrors the whitelist api/_lib/hub-screens/account.js already applies in
-- application code, so the rule is now enforced in two independent places.


-- ── One master admin, and it cannot be removed ────────────────────────────
-- The master exists so that a mistake in the console — or a stray script, of
-- which this project has already seen one — cannot leave the system with no
-- way in. B2 adds delete and demote controls; the guard lands first, because a
-- guard written after the thing it guards is a guard that gets skipped.
create unique index if not exists advisors_one_master on advisors (is_master) where is_master;

create or replace function advisors_protect_master() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.is_master then
      raise exception 'The master admin cannot be deleted.';
    end if;
    return old;
  end if;

  if old.is_master then
    if new.is_master is distinct from true then
      raise exception 'The master admin flag cannot be removed.';
    end if;
    if new.role is distinct from 'admin' then
      raise exception 'The master admin cannot be demoted.';
    end if;
    if new.locked_at is not null then
      raise exception 'The master admin cannot be locked.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists advisors_master_guard on advisors;
create trigger advisors_master_guard
  before delete or update on advisors
  for each row execute function advisors_protect_master();
-- Note this fires for the SERVICE ROLE too. That is the point: the console is
-- not the only thing that talks to this database.


-- ── The audit trail ───────────────────────────────────────────────────────
-- Every administrative action lands here. Deliberately append-only in spirit:
-- there is no update path in the console, and no policy lets anyone read it
-- except the service role.
create table if not exists admin_audit (
  id                 uuid primary key default gen_random_uuid(),
  admin_id           uuid references advisors (id) on delete set null,
  admin_email        text,          -- kept verbatim: the row must still make
                                    -- sense after the admin account is gone
  action             text not null,
  subject_advisor_id uuid references advisors (id) on delete set null,
  subject_share_id   uuid references journey_shares (id) on delete set null,
  subject_label      text,          -- ditto, for the same reason
  detail             jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists admin_audit_created_idx on admin_audit (created_at desc);
create index if not exists admin_audit_subject_idx on admin_audit (subject_advisor_id, created_at desc);

-- Same posture as every original table: on, with zero policies. Denies
-- everything to the public keys; only the service role, from server code that
-- has already checked who is asking, can read or write it.
alter table admin_audit enable row level security;


-- ── Bootstrap, by hand ────────────────────────────────────────────────────
-- There is deliberately no self-serve route to admin. Promote the first one
-- here, once, with your own email:
--
--   update advisors
--      set role = 'admin', is_master = true, approved_at = now()
--    where email = 'you@yourdomain.com';
--
-- After that the master row is protected by the trigger above and cannot be
-- deleted, demoted or locked by anything — console, script or SQL editor.
