# Advisor Hub — Phase 1 setup

Everything in the repo is built and tested. These are the four things only you
can do, because they involve creating accounts and holding keys.

**Until they are done, nothing breaks.** Every endpoint returns quietly when its
environment variables are missing, the Journey Finder keeps working exactly as
it does today, and the result screen shows the unattributed CTA. That is
verified, not assumed.

---

## 1 · Supabase

Create a project, then in the SQL editor run [`db/schema.sql`](schema.sql).

Before running it, change the email on the last statement — it seeds a
`test-advisor` row so the loop can be tested end to end, and the advisor
notification will go to whatever address is there.

From **Project Settings → API**, take:

| Value | Env var |
|---|---|
| Project URL | `SUPABASE_URL` |
| **service_role** secret | `SUPABASE_SERVICE_ROLE_KEY` |

> The service-role key bypasses row-level security. It belongs only in Vercel's
> environment variables. It must never appear in `js/`, because `build.js`
> copies that directory verbatim into `dist/` and everything there is public.
> The anon key is not used at all — the browser never talks to Supabase.

## 2 · Resend

Create an account and verify the sending domain (`discoversaintluciawell.com`).

| Value | Env var |
|---|---|
| API key | `RESEND_API_KEY` |
| From address, e.g. `Saint Lucia WELL <journeys@discoversaintluciawell.com>` | `NOTIFY_FROM` |

Advisor notifications set **reply-to as the consumer's address**, so an advisor
can simply hit reply and be talking to the person. That only works if the
sending domain is verified — otherwise the mail lands in spam.

## 3 · One secret you generate yourself

| Purpose | Env var |
|---|---|
| Salt for hashing IP addresses (rate limiting) | `IP_HASH_SALT` |

Any long random string. We never store an IP address — only a salted hash of
one, used to stop the public share endpoint being hammered. Without this,
rate limiting is skipped rather than falling back to a guessable hash.

## 4 · Set them in Vercel

Project → Settings → Environment Variables, all five, for **Production** and
**Preview**. Then redeploy — env vars are read at request time, but a deploy is
the simplest way to be sure.

---

## Testing the loop end to end

1. Visit `https://discoversaintluciawell.com/?advisor=test-advisor`
2. Move around the site, then open the Journey Finder and complete it.
3. The result's primary button should read **"Share my WELL Journey with Test"**.
4. Share it. The email arrives at the address you seeded.
5. In Supabase you should see one row in `campaign_visits`, one in
   `finder_completions`, and one in `journey_shares` with `notified_at` set.

If step 3 still says "Speak with a Saint Lucia WELL Advisor", the advisor lookup
is not resolving — check `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` and that the
advisor row's `status` is `active`.

## Adding real advisors

For the beta this is a table you edit by hand in the Supabase dashboard —
`advisors`, one row each, `slug` being whatever appears in their campaign link.
Six rows do not justify an admin screen, and the brief is explicit about not
building marketing software.

## Before this takes real consumer data

- `/privacy` and `/terms` carry `[ legal entity to confirm ]` and
  `[ jurisdiction to confirm ]`. Those are deliberate markers, not oversights —
  a policy naming the wrong controller is not a cosmetic error.
- You said you would have the privacy page reviewed. It describes real data
  flows including consumer PII passed to a third party, so that review should
  happen before the beta, not after.
