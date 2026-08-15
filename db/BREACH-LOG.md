# Breach log

**This file is empty, and that is the intended state.**

It exists because PIPEDA s.10.3 requires an organisation to keep a record of
**every** breach of security safeguards involving personal information — not
only the ones serious enough to report. The Privacy Commissioner can ask for
this log, and "we did not keep one" is itself the finding. The Privacy Policy
§13 says we assess and respond in accordance with applicable law; this is what
that sentence has to mean in practice.

The questions below are written **now, before anything has happened**, because
the moment you need them is the moment you are least able to think clearly:
somebody has just told you a traveller's details went to the wrong person, and
there is a 72-hour clock running in one jurisdiction and a "without unreasonable
delay" standard in another. A form you have to invent under pressure is a form
that gets filled in badly.

---

## If something has happened, start here

**Do not delete anything.** Not the email, not the log line, not the row. The
first instinct is to make it go away; the record of what happened is what lets
you assess it honestly and prove what you did.

**Write the entry before you fix it.** Five minutes of notes now beats
reconstructing a timeline from memory a fortnight later.

### 1. What happened

- What was disclosed, lost, altered, or accessed without authorisation?
- **Whose data?** Travellers, advisors, or both. Roughly how many people.
- **What kind?** Names and email addresses are one thing. The free-text
  "anything you'd like them to know" field is another — people write candid
  things there about why they need rest, and it should be treated as the most
  sensitive field in the database even though it is not formally special
  category data.
- When did it start, when did it stop, and when did we find out?

### 2. How

- A mistake, a technical failure, or someone acting deliberately?
- Was it us, an advisor, or a processor (Supabase, Resend, Encharge, Vercel)?
- Is it still happening?

### 3. Real risk of significant harm?

This is the test that decides everything else. PIPEDA asks whether there is a
**real risk of significant harm** — humiliation, damage to reputation or
relationships, identity theft, fraud, loss of employment or professional
opportunity. UK/EU GDPR asks a similar question in different words.

Consider:

- **Sensitivity.** A name and a travel timeline is not the same as a note
  explaining that someone is burnt out and needs to disappear for a fortnight.
- **Probability of misuse.** A misdirected email to one known advisor is not an
  exposed database.
- **Who received it**, and whether they can be relied on to delete it.

Record the reasoning, not just the conclusion. A defensible "no" is a written
one.

### 4. Who has to be told, and by when

| Who | When | Where |
|---|---|---|
| **The people affected** | As soon as feasible, if there is a real risk of significant harm | Directly, in plain language: what happened, what it means for them, what we have done, what they can do |
| **Office of the Privacy Commissioner of Canada** | As soon as feasible, same test | priv.gc.ca — PIPEDA breach report form |
| **ICO (UK)** or the lead EU authority | **72 hours** from becoming aware, unless unlikely to be a risk | ico.org.uk |
| **The advisor involved** | Immediately | They may need to act on their own copy |
| **This log** | Always | Even when nobody else is told |

**The 72-hour clock is the tightest one and it starts at awareness, not at
certainty.** A partial report on time beats a complete report late.

### 5. Afterwards

- What stops it happening again — and was it a control that failed, or one that
  was never there?
- If an advisor was the source, does the [Advisor Data
  Undertaking](../content/advisor-undertaking.js) need to change, or does that
  advisor need their access reviewed?

---

## Entries

Newest first. Keep them for at least 24 months from the date of the breach,
which is what PIPEDA requires.

<!-- Template — copy, do not edit this one.

### YYYY-MM-DD — one line saying what happened

| | |
|---|---|
| **Discovered** | date, time, and how we found out |
| **Occurred** | date range, or "unknown" |
| **Source** | us / advisor / processor — name them |
| **People affected** | number, and who they are |
| **Data involved** | be specific; name the fields |
| **Still happening?** | yes / no / contained at ⟨time⟩ |
| **Real risk of significant harm?** | yes / no — *and the reasoning* |
| **Individuals notified** | date, or why not |
| **OPC notified** | date, or why not |
| **ICO / EU authority notified** | date, or why not, and whether 72h was met |
| **Fixed by** | what changed |

**What happened**

**What we did**

**What changed as a result**

-->

*No entries. Last reviewed 14 August 2026.*
