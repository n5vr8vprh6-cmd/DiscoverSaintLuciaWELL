# Feedback on the AI Marketing Strategist Bible (Canonical v1.0)

**From:** the team implementing the Discover Saint Lucia WELL campaign engine
**Date:** 2026-08-16
**Read against:** a working implementation — deterministic claims checker,
generation pipeline, and a live Hub with real advisors

---

## What this is

We are the ones building against this document, and we have already shipped part
of it. This is not a review of the writing. It is a list of the things that
stopped us, in the order they stopped us, so a v2 is more buildable.

Two things are worth saying before the criticism. The document is genuinely
strong — several ideas in it changed our plan the day we read them. And the
criticism below is mostly about **what is missing at the seams**, not about what
is there.

---

## 1. Keep these. They changed what we are building.

**Capacity classes (C1–C4), and the reasoning behind them.** *"The system should
not promise a fixed count such as '30 social posts' because that creates asset
volume as the objective."* We were generating a fixed eight-asset kit regardless
of whether the advisor could execute it. This is the correct critique and we are
adopting it. The observation that **capacity is not follower count** is the part
practitioners get wrong most often.

**"Questions are a cost."** The clarifying-question protocol — ask 3–5, only
when the answer changes the decision, prefer bounded questions — is the single
most useful UX instruction in the document. It is the antidote to the long
intake form that everybody starts and nobody finishes.

**"A single enormous AI response is a poor product interface."** The nine-layer
package and progressive disclosure gave us a better interface spec than we had.
The example — *"this week: personalize these three scripts, send Email 1, reply
to your Journey Finder leads"* — is the product.

**The Asset Card**, and specifically two fields nothing else in our system had:
**Fallback** (a lower-burden execution preserving the same job) and
**Personalization cue** (where the advisor adds a real opinion or a client's own
words). Fallback respects the week life gets busy, which is the week most
campaigns die.

**Treating the Journey Finder as conversion infrastructure rather than a quiz.**
173 references, and the framing — *"not only a quiz; it is a category-framing
and lead-quality mechanism"* — is right and is now load-bearing in our roadmap.

**The evidence tiers (A–F) and the willingness to say "it depends."** The
warning that conditional effects get flattened into universal rules is the right
instinct for a document that will be mined by a language model.

---

## 2. The structural gaps

### 2.1 It consumes inputs that nobody produces

This is the largest gap and everything else is downstream of it.

The architecture reads a **Day 1 Brand Profile** ("values, purpose, mission,
positioning, voice, tone, visual direction, strengths, stories, authority,
boundaries and validated personality reflections") and **Day 2 Traveler +
Destination Intelligence** as structured, available inputs. Section 0 §3's Input
Intelligence Stack assumes them. Section 6 is entirely a translation layer over
the Brand Profile.

**Neither exists as a structured artifact.** Foundations is a course, not a
schema. So the executive OS is specified to run on data that has no producer.

We tested the consequence empirically before we read this document, and it is
not theoretical. We generated the same campaign against three prompt variants
and two model tiers — six combinations. **Not one used the single concrete
detail in the advisor's profile** ("two lawyers who had not taken a week off
together since 2019"). The output was not model-limited or prompt-limited. It
was input-limited, and it plateaued at exactly the level of the thin intake we
had.

**What a v2 should do:** specify the Day 1 and Day 2 outputs as schemas —
field names, types, required vs optional, and what the strategist does when each
is absent. Without that, Sections 0 and 6 cannot be implemented, only admired.

### 2.2 Registered advisors are nearly absent

The document is written for an advisor who has completed Foundations. That
advisor is the minority. The majority — and the entire top of the funnel — is
someone who registered last week, has a thin profile, and is deciding whether
this is worth their time.

Section 8's sufficiency gate has a RED state that says *"do not generate the
final campaign."* Applied literally to a new registrant, the product refuses to
work on first contact, which is commercially fatal and also unnecessary: an
honest shallow campaign with its assumptions visible is more useful than a
refusal.

**What a v2 should do:** state what the strategist produces at each input depth,
and treat "thin inputs" as a first-class operating mode with its own rules
rather than a failure state. The interesting design question — how do you make a
campaign that is honestly shallow rather than falsely confident — is not
addressed.

### 2.3 Truth enforcement is specified model-side throughout

Section 0 §12 (hard failures), the QA rubrics in every section, and the claim
discipline in Section 2 are all instructions **to the model**. The document
treats "the strategist must not" as a control.

It is not one. We learned this the expensive way and rebuilt around it: a
checker that can hallucinate is not a checker, and a model asked to review its
own output will pass a claim it just wrote, for the same reasons it wrote it.

Our implementation runs a **deterministic** claims checker — plain string
comparison against an approved fact bank, blocking health-outcome language,
unsupported property names, credential claims above the advisor's earned rung,
and prices. It blocks the copy button. It cannot be argued with, and it caught
things the model produced while under explicit instruction not to.

**What a v2 should do:** specify a deterministic enforcement layer as
architecture, and demote the QA rubrics to what they are — a useful secondary
review that must never be the only thing standing between generated text and
publication. Concretely: which claims must be *mechanically* checkable, and
against what source of truth?

### 2.4 Nothing is costed

The control loop is: Context → Data Sufficiency → Diagnosis → Strategic Options
→ Strategic Lock → Channel/Pattern/Expression Selection → Orchestration →
Production → QA → Learning.

That is a lot of sequential model calls. Our functions are killed at ten
seconds. A single skeleton call already takes five. Nowhere does the document
state a latency budget, a token budget, or which stages can be merged, cached,
skipped or run without a model at all.

Our measured reality, for calibration: a full campaign kit costs about **0.7¢**
and takes roughly 20 seconds spread across nine calls. Adding the full reasoning
loop as specified would multiply both, and the document offers no guidance on
what to trade.

**What a v2 should do:** for each stage of the control loop, state whether it
requires a model call, roughly what it costs, and what the degraded version is
when the budget does not allow it.

### 2.5 Section 10 decays, and nothing is staffed to refresh it

Section 10 is date-stamped August 2026 — which is now. It is the most
immediately useful section and it will be the most wrong section within six
months. The document acknowledges this and specifies a refresh protocol (§17),
but a refresh protocol without an owner and a cadence is a liability presented
as an asset.

**What a v2 should do:** either name the refresh owner and interval, or move the
dated material into a separate document with its own version number so the
durable sections can be trusted without checking their dates.

---

## 3. Specific defects worth fixing

**The `AssetCard` is specified twice, and the two disagree.** Both are in
machine-readable object tables, so this is not prose-versus-schema drift:

| | Section 0 §19 | Section 8 §21 |
|---|---|---|
| Fields | 12 | 17 |
| | `job, state, channel, pattern, hook, payoff, proof, expression, CTA, production, fallback, tracking` | `asset_id, job, audience_state, channel_surface, pattern, hook, body, payoff, proof, CTA, production, personalization, compliance, trigger, fallback, tracking, success_signal` |

Section 8 §21 matches the prose table in Section 8 §9, so Section 0 §19 is
almost certainly the stale one — it is missing `asset_id`, `body`,
`personalization`, `compliance`, `trigger` and `success_signal`, and carries an
`expression` field the other two do not. **Missing `asset_id` is the one that
bites**: Section 8 §18 requires versioning assets separately from strategy, and
you cannot version what has no identity.

An implementer meeting §19 first builds the wrong object.

**Some field lists contain prose rather than identifiers.** `ranking/originality
signals`, `use/ignore/watch`, `country/region`, `privacy/provenance risks`.
These read as descriptions of a field rather than a field name, so they cannot be
transcribed into a schema without interpretation.

**No relationships are declared between objects.** There are no keys, no
foreign keys and no cardinality. `AudienceState` is an object in Section 4 §18
and also a field on `CampaignStateVector` in Section 0 §19 — same thing, or
different? A v2 should say which objects own which, and what points at what.

**No object carries its own version.** `StrategistContext` has
`section_versions`, which is good, but the objects themselves do not. When the
`AssetCard` shape changes, stored cards become ambiguous.

---

## 4. What we would most like a v2 to add

1. **Schemas for the Day 1 and Day 2 outputs.** Everything else depends on them.
2. **A thin-input operating mode** with its own rules, since that is most users.
3. **A deterministic enforcement layer** in the architecture, not in the prose.
4. **A cost and latency budget per stage**, with named degraded versions.
5. **One canonical object schema**, with relationships and versions, in one
   place rather than restated per section.
6. **A worked example at the bottom of the market**, not only the top. Section 0
   §20's worked example is an established advisor with 1,200 past clients, event
   strength and a polished writing capability. The harder and more common case is
   an advisor with 40 contacts, no list, no video comfort and two hours a week.
   What does the strategist do for them?

---

## 5. Two questions we could not answer from the document

**What does the strategist do when the advisor is wrong about themselves?**
Self-declared capacity, voice and audience are all inputs the advisor supplies
about themselves, and people are unreliable narrators of their own capability.
Section 8 mentions using publishing history to calibrate, which is the right
instinct — but what happens when stated capacity and demonstrated capacity
disagree?

**Where is the line between personalization and inference?** The privacy
guardrail in Section 8 §3 is good on sensitive attributes. But the ICP depth the
system wants — pains, triggers, objections, what they have tried — is exactly
the kind of material that becomes uncomfortable when it is inferred rather than
told. A v2 could be sharper about which ICP fields may be inferred from
observation and which must be stated by a human.
