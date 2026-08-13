# Connecting the backend — a walkthrough

Everything in the repo is built and tested. What follows is the part only you
can do, because it means creating accounts and holding keys.

**Nothing is broken while you do it.** Every endpoint answers quietly when its
keys are missing, the Journey Finder works exactly as it does today, and the
result screen shows the unattributed CTA. That is verified, not assumed — the
live API already behaves that way right now.

Budget about 30 minutes. Steps 1–3 are Supabase, 4 is Resend, 5 is Vercel.

---

## 1 · Create the Supabase project

1. Go to **supabase.com** and sign in with GitHub (the same account the site
   deploys from is convenient, but any works).
2. **New project**. You will be asked for four things:
   - **Name** — `discover-saint-lucia-well`
   - **Database password** — generate one and put it in your password manager.
     You will almost certainly never type it again; the app uses an API key, not
     this password. But if you lose it, resetting is a nuisance.
   - **Region** — choose **East US (North Virginia)** or **Canada (Central)**.
     Pick one and note which: §11 of the privacy policy says personal
     information may be processed outside your country, and the international
     transfer checklist asks you to confirm the actual hosting region. Canada
     (Central) is the tidier answer for a Toronto company.
   - **Plan** — Free is genuinely fine for a beta.
3. It takes a couple of minutes to provision.

## 2 · Create the tables

1. In the left sidebar, open **SQL Editor** → **New query**.
2. Open [`db/schema.sql`](schema.sql) from this repo, copy the whole file, and
   paste it in.
3. **Before you run it**, look at the very last statement. It creates a
   `test-advisor` row so you can test the loop end to end, and the advisor
   notification will go to whatever email is there. Change it if you want it
   somewhere other than `duncan.so@phinklife.org`.
4. Click **Run**. You should see "Success. No rows returned."
5. Open **Table Editor** in the sidebar. You should now see four tables:
   `advisors` (with one row), `campaign_visits`, `finder_completions` and
   `journey_shares`.

> **You will notice the tables look locked.** That is deliberate. The schema
> turns on row-level security with no policies, which denies everything to the
> public keys. Only the service-role key — which lives on the server and never
> reaches a browser — can read or write. Please don't add a permissive policy to
> "make it work"; if something cannot read the data, the key is wrong, not the
> security.

## 3 · Get the two Supabase values

**Project Settings** (gear icon) → **API**.

| What you copy | Where it goes |
|---|---|
| **Project URL** | `SUPABASE_URL` |
| **service_role** — click *Reveal* | `SUPABASE_SERVICE_ROLE_KEY` |

There are two keys on that page. You want **service_role**, not **anon**. The
anon key is not used anywhere in this project, because the browser never talks
to Supabase directly — it only ever calls our own `/api` endpoints.

> The service-role key bypasses all security. Treat it like a password. It goes
> in Vercel's environment variables and nowhere else — never in `js/`, because
> `build.js` copies that folder verbatim into the deployed site and everything
> there is public.

## 4 · Resend, for the advisor email

1. **resend.com**, sign up.
2. **Domains** → **Add domain** → `discoversaintluciawell.com`. It gives you
   three or four DNS records to add wherever the domain is managed. Verification
   usually completes within the hour.
3. **API Keys** → **Create API Key**, permission *Sending access*. Copy it now;
   it is shown once.

| What you copy | Where it goes |
|---|---|
| The API key | `RESEND_API_KEY` |
| `Saint Lucia WELL <journeys@discoversaintluciawell.com>` | `NOTIFY_FROM` |

**Verify the domain before testing.** The advisor notification sets reply-to as
the consumer's address so the advisor can just hit reply and be talking to the
person — that only survives spam filtering from a verified domain.

## 5 · One value you make up

| Purpose | Variable |
|---|---|
| Salt for hashing IP addresses | `IP_HASH_SALT` |

Any long random string — 32+ characters of nonsense. We never store an IP
address, only a salted hash of one, used to stop the public share endpoint being
hammered. Without this, rate limiting is skipped rather than falling back to a
guessable hash.

## 6 · Put all five into Vercel — automated

A local `.env` has already been created for you, with `SUPABASE_URL`,
`NOTIFY_FROM` and a generated `IP_HASH_SALT` filled in. Two blanks remain:
`SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY`.

Open `.env`, paste those two in, save, then run:

```bash
node tools/push-env.js
```

It pushes all five to Production and Preview and prints **names only** — the
values go from the file down a pipe into the Vercel CLI and are never displayed,
logged, or passed as command arguments. Re-running is safe; add `--force` to
replace values already set.

`.env` is gitignored, so it cannot be committed.

**Please don't paste either key into a chat window** — not to me, not to
anything else. Transcripts persist, and the service-role key bypasses every
row-level-security policy on your database. The file is the right place for it.

Then redeploy:

```bash
vercel redeploy
```

---

## Testing the whole loop

1. Visit `https://discoversaintluciawell.com/?advisor=test-advisor`
2. Click around, then open the Journey Finder and complete it.
3. The result's main button should read **"Share my WELL Journey with Test"**.
   If it still says "Speak with a Saint Lucia WELL Advisor", the advisor lookup
   is not resolving — see troubleshooting below.
4. Share it, filling in the form.
5. Check the inbox on the seeded advisor row. The email should name the person,
   their timing, what their Journey pointed toward, and reply to *them*.
6. In Supabase **Table Editor**, you should now see one row in
   `campaign_visits`, one in `finder_completions`, and one in `journey_shares`
   with `notified_at` filled in.

### If something doesn't work

| Symptom | Almost always |
|---|---|
| Button still says "Speak with a Saint Lucia WELL Advisor" | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` wrong or missing, or the advisor row's `status` is not `active`. Check `/api/advisor?slug=test-advisor` in a browser — it should return a first name, not `null`. |
| Share says it worked, no email | Resend domain not verified yet, or `NOTIFY_FROM` is on a domain Resend doesn't hold. The share is still saved — check `journey_shares`; `notified_at` will be empty. |
| Share returns an error | Open the Vercel deployment's **Logs** and look at `/api/share`. |
| Rows appear with `advisor_id` empty | The link didn't carry `?advisor=`, or the slug doesn't match a row. |

## Adding real advisors

**Table Editor** → `advisors` → **Insert row**. One per advisor:

- `slug` — what appears in their campaign link, e.g. `diana-lee`. Keep it
  readable; it goes in emails and on printed QR codes.
- `first_name`, `last_name`, `email` — the email receives the notifications.
- `business`, `market` — optional.
- `status` — `active`.

Their campaign link is then
`https://discoversaintluciawell.com/?advisor=diana-lee`.

For a beta cohort this is the right amount of tooling. Six rows do not justify
an admin screen, and the brief is explicit about not building marketing
software.

---

## Before this takes real consumer data

- The privacy review you planned should happen now rather than after. The site
  now describes real flows including consumer personal information passed to an
  independent third party.
- Two processors were added to §10 of the policy that your draft did not name —
  **Resend** and **jsDelivr** — because both genuinely handle data. Worth
  mentioning to whoever reviews it.
- Your implementation guide asks for a cookie/consent layer for analytics and
  advertising. **None is needed yet**: no analytics or advertising script
  currently loads (`GTM_ID` is empty, there is no Meta pixel), and attribution
  uses session storage that is cleared when the tab closes. The moment GTM or a
  pixel is switched on, that changes and the consent layer has to exist first.
