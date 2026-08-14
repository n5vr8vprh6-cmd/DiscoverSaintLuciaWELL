# Discover Saint Lucia WELL — consumer umbrella site

The consumer front door for **discoversaintluciawell.com**. A composed static
site: content modules + shared layouts → plain HTML in `dist/`. No framework, no
runtime dependency, deployable to any static host.

Built to the V4 Site Architecture brief
(`../Discover_Saint_Lucia_WELL_Site_Architecture_Claude_Code_Brief_V4.pdf`).

## Build

```bash
node build.js
```

`node build.js --clean` wipes `dist/` first. Serve it with the
`discover-saint-lucia-well` launch config (port 4602) — never a raw shell server.

**Edit source, not `dist/`.** Same rule as the brochure.

## Deploy

**origin** → github.com/n5vr8vprh6-cmd/DiscoverSaintLuciaWELL (`main`)
**Vercel** → `burnout-concierge-venture-studio/discover-saint-lucia-well`,
connected to that repo. **A push to `main` deploys.** There is nothing to run by
hand; `vercel deploy --prod` exists as an escape hatch, not the normal path.

Served at `discoversaintluciawell.com` (which 308s to the `www` host) as well as
`discover-saint-lucia-well.vercel.app`.

**TWELVE SERVERLESS FUNCTIONS, MAXIMUM.** The Hobby plan caps a deployment at
twelve, and every non-underscored `.js` under `api/` is one. Going over is a
nasty failure mode because it is not a build error: the build log is completely
green, ends with `Build Completed`, and then `Deploying outputs…` fails with

    No more than 12 Serverless Functions can be added to a Deployment
    on the Hobby plan.

`vercel ls` shows `● Error` and neither `vercel inspect` nor `inspect --logs`
prints the reason — the only way I found to see it was `vercel deploy` (a
preview, not `--prod`), which prints it on stderr. It cost a failed production
deploy on the Hub push.

The count today is ten: four public endpoints, five auth endpoints, and the Hub
router. **The Hub is one function, not eight** — see below. If a feature needs
several new endpoints, route them through one function rather than adding files,
or the deploy will fail after a build that looked perfect.

**A push can silently fail to deploy.** Seen once (2026-08-12): the commit
reached GitHub, the repo was still connected, no deployment was created, and
nothing errored anywhere — the webhook delivery was simply dropped. Fifteen
minutes of polling looked identical to a slow build. If a push has not deployed
in about two minutes, the diagnosis is `git ls-remote origin main` (is the
commit on GitHub?) plus `vercel ls` (is there a new deployment?). If GitHub has
it and Vercel does not, push an **empty commit** — that re-fires the webhook and
costs nothing. Do not reach for `vercel deploy --prod`: it uploads local files
and quietly takes the deploy out of the GitHub pipeline.

Also note `vercel inspect` reports deployment ages in UTC against local time, so
a deployment made minutes ago reads as several hours old. Trust the timestamp,
not the "[9h ago]".

`dist/` is **gitignored** — it is a build artifact, and committing it would put
generated output under review next to its own source. Vercel rebuilds it from
`build.js` on every push, which is also what keeps the repo honest: if the build
only works because of something sitting untracked on one laptop, the deploy
fails rather than quietly succeeding.

`vercel.json` sets: `node build.js` → `dist/`, `trailingSlash: false` (canonical
tags are extensionless and slashless), a permanent `/foundations` →
`/advisors/foundations` redirect, and the usual hardening headers.

Two cache decisions worth knowing:

- **`/assets/*` is one week, not `immutable`.** Image filenames carry a width,
  not a content hash, so a re-exported photograph reuses its filename. A
  year-long immutable cache would strand the old frame in browsers that already
  have it.
- **`/css/*` and `/js/*` are one hour.** They are versioned by `?v=<hash>`
  query, so the browser already treats each build as a new URL; the short TTL
  is only there to bound how long a CDN edge can hold a stale object.

The `/foundations` redirect exists twice on purpose: as a Vercel 308, and as
the meta-refresh page `build.js` emits. The static one is the fallback if the
site ever moves to a host without redirect rules.

**The `.vercel.app` preview is `noindex`, and that expires by itself.** The
`X-Robots-Tag` header is scoped with a host condition matching `*.vercel.app`,
so attaching discoversaintluciawell.com switches it off without anyone
remembering to. A blanket noindex header would have been a trap waiting for
launch day. Canonical tags already point at the real domain.

**Not wired yet:** no GTM container id, and `CAPTURE_ENDPOINT` in
`js/journey.js` is empty — the Finder's email capture validates and reports
honestly that nothing was sent rather than pretending. `/about` still shows a
visible `[ contact address to be confirmed ]` on the press/partnership route.

## The one architectural idea

**One domain, three layout templates.** Discovery pages invite exploration;
conversion pages deliberately reduce exits. Brand coherence comes from identity,
typography, tokens and components — *not* from forcing the same navigation onto
every page.

| Layout | Chrome | Pages |
|---|---|---|
| `destination` | GlobalHeader + GlobalFooter | `/`, `/explore`, `/eclipse`, `/about`, `/journey` |
| `professional` | GlobalHeader + ProfessionalContext | `/advisors` |
| `conversion` | ConversionHeader + ConversionFooter | `/advisors/intro`, `/advisors/foundations`, `/advisors/immersion` |

Layout is **declared explicitly** on each page object and never inferred from
the URL — `/advisors` and `/advisors/foundations` share a path segment but need
opposite chrome. `build.js` fails the build on an unknown layout rather than
silently shipping the wrong one.

## File map

| Path | What it holds |
|---|---|
| `build.js` | Page registry + composition. Add a page here and it builds. |
| `content/site.js` | Nav, footer, brand constants, the one primary CTA definition |
| `content/villages.js` | The six Wellness Villages, anchors + signature experiences |
| `content/properties-media.js` | **Generated** — property/village imagery + provenance |
| `content/home.js` | Homepage, ten sections in the brief's fixed order |
| `content/journey.js` | Journey Finder questions, scoring weights, copy |
| `content/explore.js` | Villages · Experiences · Places & Properties |
| `content/eclipse.js` | The signature journey (own midnight/copper world) |
| `content/about.js` | What a Well Destination is, why Saint Lucia, contact |
| `tools/build-property-images.py` | Turns the asset library into web derivatives |
| `lib/layouts.js` | The three layouts and every chrome component |
| `lib/components.js` | Section renderers (one per `type`) |
| `lib/page.js` | `<head>`, metadata, JSON-LD, asset versioning |
| `lib/brand.js` | Ring mark, wordmark, coordinates |
| `css/tokens.css` | **The single brand-token source.** Loaded by every page. |
| `css/chrome.css` | Headers, footers, buttons. Loaded by every page. |
| `css/site.css` | Consumer page components. NOT loaded by Foundations. |
| `css/hub.css` | Advisor Hub. Replaces `site.css` on Hub pages, keeps tokens + chrome. |
| `advisors/foundations/` | The moved Foundations page + its own css/js/assets |
| `api/_lib/` | Shared server code: db client, auth/sessions, Hub render + data + briefing |
| `api/hub/index.js` | The Hub's ONE serverless function — a router (see below) |
| `api/_lib/hub-screens/` | The Hub screens themselves. Underscored, so not deployed as functions. |
| `api/well.js` | `/well/<code>` — the opaque campaign link |
| `db/migrations/` | Additive SQL. Never edit an applied migration; add another. |
| `tools/` | Test suites and one-off scripts. `node tools/<name>.js`. |

## Design system

`css/tokens.css` is the one place brand truth lives — colours, the three-role
type system (Libre Caslon Display / Libre Caslon Text / Hanken Grotesk), the
clamp() scale, rhythm and easings. Both this site and the Foundations page load
it, which makes drift structurally impossible rather than merely discouraged.

Two deliberate departures from the inherited Foundations values, both for
contrast:

- `--muted` darkened `#5E7378` → `#586C71`. The old value clears AA on paper
  (4.71:1) but not on sand (4.29:1), and this site puts secondary text on sand
  constantly. New value holds AA on both (5.21 / 4.74).
- `--eclipse-on-copper` `#0A0E16` added. Midnight on a copper fill lands at
  4.41:1 — just under AA — so the copper button uses this instead (4.62:1).

Full-saturation deck teal/gold/coral appear **only** in the concentric ring
mark, inline in `lib/brand.js`. Eclipse keeps its own midnight/copper world.

### Widths that contain display type are set in rem, never `ch`

`ch` resolves against the element's *own* font-size. On a wrapper inheriting
17px body type, `22ch` is ~187px — not the ~850px a 82px display face needs.
Reading measures (which sit on body-size text) correctly stay in `ch`.

## The hero treatment

The hero photograph (supplied 2026-08-10) is a framed vista: the Pitons seen
through a rainforest window, a path leading down to the bay. It drove several
decisions that are worth keeping if the image is ever replaced — **re-run the
measurement rather than assuming the same values carry over.**

The method: sample the photograph's pixel luminance behind each text block, composite
the veil gradients over it mathematically, and measure worst-case contrast.
Eyeballing a scrim over a busy image is how you ship 2:1 text.

What the measurement found:

- **The frame is high-frequency everywhere** — dappled canopy light means there
  is no large reliably-dark area. Unscrimmed text fails somewhere at every
  placement.
- **The bottom third is consistently dark** (foreground foliage, shadowed
  path), so the text block lives there and the vista stays bright and uncrushed.
  The headline is deliberately smaller than the raw `--fs-hero` cap for exactly
  this reason: an extra 16px of display type costs two more lines, pushes the
  block up into the bright gap, and fails.
- **Scrims are anchored in pixels from the edges, not percentages of the hero.**
  The hero's height is viewport-dependent (`min(94svh, 900px)`), so a
  percentage-based scrim drifts relative to the text — on a 720px-tall screen
  the block sat at 45% of the hero instead of 55%, landed in the bright gap, and
  measured 2.65:1. Both the text scrim (600px from the bottom) and the nav wash
  (215px from the top) are px-anchored.
- **Below 860px the hero stops being an overlay.** A narrow viewport crops this
  16:9 frame to its middle 29% — precisely the bright gap of sky, peaks and open
  water, where text measures 1.5:1 and no scrim fixes it without turning the
  photograph to mud. So mobile stacks instead: the image keeps its full frame in
  a band, the text sits beneath it on ink, and legibility stops depending on
  what happens to be behind the words.
- **The scrim is lighter than pure contrast maths would pick, and a text shadow
  makes up the difference.** A scrim strong enough to clear AA against *every
  pixel* in the text bounding box desaturates the whole frame — the turquoise
  goes grey and the sunlit palms lose their glow. A shadow buys the same
  legibility locally, at the glyph, and costs the photograph nothing.

Measured under the **actual glyph pixels** (text rendered to a mask, backdrop
sampled beneath it) rather than across the whole text rectangle — most of that
rectangle is the gaps between words and lines, so it is far stricter than WCAG
asks. Worst 5th-percentile across headline, lead, eyebrow and nav: **4.80:1**.
Mobile text sits on solid ink at 13.3:1.

`hero-final.png` in this folder is a faithful offline render of the treatment
(browser screenshots do not composite in the preview pane). Regenerate it if the
hero image or scrim changes.

The source is 1456×816 (Midjourney's standard download). Derivatives stop at
native width — nothing is upscaled — so a 2× upscale from Midjourney would
sharpen the hero noticeably on a 2000px display.

## The three-stylesheet split

| Sheet | Loaded by | Holds |
|---|---|---|
| `tokens.css` | every page | colours, faces, scales, easings |
| `chrome.css` | every page | headers, footers, buttons, minimal base |
| `site.css` | consumer + professional pages only | page sections |

Foundations loads `tokens + chrome + its own site.css` and **must not** receive
the consumer component sheet. That split exists because of a measured defect:
when Foundations also loaded `site.css`, consumer rules bled onto it — the
mobile `.hero .hero-inner > *` rule stripped its hero text-shadow, and
`.hero .lead` narrowed its measure from 839px to 768px.

`chrome.css` carries only a *minimal* base (box-sizing, focus, skip link).
Every sheet that loads it brings its own reset, and a second base here silently
wins on whichever properties the host sheet happens not to declare — which is
exactly how Foundations' `h2` letter-spacing drifted before this was fixed.

After the split, the moved page matches the original standalone build on every
measured property at 1280px: font sizes, line heights, margins, measures and
text-shadows are identical.

## Progressive enhancement

Everything works with JavaScript off. The ladder, in order of what fails first:

- **Content** — always present in the HTML. The Journey Finder ships as a
  complete six-village explainer with real routes; the quiz replaces it only
  once `js/journey.js` confirms its data parsed and its DOM exists.
- **Header legibility** — the base state is the safe one: in normal flow,
  opaque, ink on paper. Sticky positioning and the transparent-over-hero
  treatment are gated behind `body[data-enhanced]`, set by `js/site.js`. Get
  this backwards and you ship paper-coloured nav on a paper background.
- **Motion** — `gsap` (Lenis inertia) → `io` (IntersectionObserver reveals,
  automatic if a CDN script fails, or forced with `?flat=1`) → `instant`
  (reduced-motion and automated agents; no observers created at all). A 3.6s
  failsafe reveals everything regardless, so content can never be lost to an
  interrupted transition.

### /journey is an application, and that is a fourth rung on this ladder

`/journey` presents as a tool rather than a page — global chrome gone, one
question filling the viewport, a named step rail, a distinct result surface.
None of that is rendered by the server.

**The page is sent exactly as an ordinary destination page, and JavaScript
promotes it.** Global header, page header, the six-village explainer, the
browse-instead section, the closing CTA and the global footer are all in the
HTML. With scripting off, that *is* the page and it is complete. App mode is
CSS keyed on `html[data-finder="app"]`, and that attribute is only ever set by
script — so the fallback needs no maintenance to stay correct.

**The stamp is an inline `<script>` in `<head>` and it cannot move.** Every
other script on the site is `defer`red, which runs after parse and after first
paint. Promoting there shows the whole website — header, nav, footer — and
snatches it away a frame later, which is worse than never leaving it. `page.js`
emits the stamp before the stylesheets for any page declaring `appShell: true`.
Verified in the build: stamp at char 73, first stylesheet at 1503. It is safe
as inline script only because no CSP is set; if one is ever added this needs a
hash or nonce, and **the symptom of forgetting will be the flash, not an
error.**

Two traps found while building it:

- **`.finder-steps` was already taken.** It is the homepage's "find your way
  through the island" 1-2-3 list, and it is registered in `js/motion.js`
  `LIT_TRACKS` for scroll-lighting. The tool's step rail is `.finder-rail` —
  reusing the name inherited the homepage's borders and let the scroll observer
  drive the rail.
- **Finder styles must stay in `site.css`.** `lib/page.js` drops `site.css` for
  any page declaring its own `styles` array (that is how Foundations keeps our
  components out). Moving these rules to a `css/finder.css` would silently strip
  the entire consumer component sheet from `/journey`.

The shaping transition between the last answer and the result is **not a timer
pretending to compute** — scoring is synchronous and instant. The markup is
built first and the reveal covers it, it is skipped entirely under
`prefers-reduced-motion`, and it never runs on a restored `#r=` link, because
someone opening a friend's result has answered nothing.

**The page scrolls. Do not lock it again.** App mode originally set
`overflow: hidden` on `html, body`, reasoning that the shell owned the viewport.
Two of the three states fit; the result does not — 2247px in a 704px viewport —
and the lock made the experiences, Eclipse, the advisor CTA and the whole email
capture unreachable. The inner `overflow-y: auto` did not save it either:
`min-height: 100dvh` lets the section *grow* to fit content, so the scroll
container grew with it and never overflowed. The section keeps `min-height`, the
page scrolls normally, and `.finder-bar` is `position: sticky`. A question still
fills exactly one screen because it is shorter than the viewport.

Two consequences of the sticky bar, both already handled: anything scrolled into
view needs `scroll-padding-top` or it lands underneath it, and `resultEl.focus()`
must pass `preventScroll` — a bare focus scrolled the result into view and
parked its heading and the top of the Compass under the bar.

**Verify scrolling at a real viewport.** This shipped broken because the result
was only ever captured in a 2000px-tall window, where everything fit. And note
`html { scroll-behavior: smooth }` (site.css): a test that calls `scrollTo` and
measures immediately reads `scrollY: 0` and looks like a scroll failure. Pass
`behavior: 'instant'`.

**The Compass on the result needs its entrance animation disabled.** The
homepage ring draws itself on scroll — rings stroke on, labels fade in on a
stagger, all gated behind `.compass.is-drawn`. Dropped into a result the visitor
is already reading, it must arrive finished, or it appears as a bare centre mark
and a half-drawn arc. It also has to be recoloured: the labels are `--paper`,
which is invisible on the result card.

**Known wart:** steps do not push history, so browser Back at question 3 leaves
the tool entirely. Tolerable when this was a page; more jarring now it presents
as software. Roughly fifteen lines to fix and the first thing to do next.

### Two things that must not be done with scroll

Both are inherited lessons, and both are load-bearing:

1. **Never use `scroll` events.** When Lenis drives the page they never fire —
   a handler records nothing for real visitors while appearing to work in
   fallback mode. `window.scrollY` stays accurate, so rAF-sample it instead.
2. **Never place scroll-depth sentinels absolutely on `body`.** With
   `overflow-x: hidden` making body a scroll container, a sentinel at 100% of
   `scrollHeight` *grows* `scrollHeight`; a ResizeObserver then re-places it
   lower and the document inflates without bound. Measured here at 26,124px
   against 10,432px of real content before it was replaced with rAF sampling.

## Attribution

`js/attribution.js` separates two classes of parameter:

- **Advisor referral** (`advisor`, `ref`) — establishes lead ownership.
  **First touch wins** and is never overwritten, so a later untagged visit
  cannot silently reassign a lead. Reattached to internal links so ownership
  survives a new tab.
- **Everything else** (`utm_*`, `src`, `campaign`) — last touch, retained for
  reporting only.

Held in `sessionStorage` (no consent banner needed, expires with the visit) and
transmitted nowhere. `js/analytics.js` stamps it onto every event alongside
`surface: consumer | advisor`, which is what keeps the two funnels separable on
one domain.

**Script order is load-bearing:** `attribution.js` must load before
`analytics.js`, which fires `page_view` at parse time and reads
`window.dslwAttribution`.

### Two identifiers, both resolved, forever

V2 §6 forbids an advisor's name in a consumer URL, so links are now minted as
opaque codes — `/well/8K4PX7`. V1.2 minted readable slugs — `?advisor=diana-lee`
— and some may be in circulation. `api/_lib/advisors.js` resolves **either**,
and always will: a QR code on a printed card cannot be recalled, and an advisor
whose link quietly stopped attributing would never find out.

**The slug is now random too, and that is the point.** Registration originally
minted it as `first-last`, which quietly put back exactly what the opaque code
removes: because the slug still resolves, anyone could try `/well/jane-smith`
and learn whether that advisor exists here, and every advisor's identifier was
predictable from their name. New registrations get `adv-<16 hex>`. Nothing
generates a link from the slug, so it has no reason to be readable.

Two things follow. Existing readable slugs must be **rotated, not just left
alone** — the fix is worthless to advisors who already have one; `test-advisor`
is the deliberate exception, kept because `db/SETUP.md` documents it as the
legacy-link fixture. And `tools/auth-test.js` now asserts the slug matches the
random format and contains neither name: the old check only asserted it was
non-empty, which is precisely why name-derived slugs shipped unnoticed.

`/well/<code>` is a 302, not a page. It resolves the code, then hands the
visitor to the consumer site at `/?advisor=<code>` so the existing attribution
path does the work — one implementation, not two that can disagree. An unknown
or paused code still lands them on the site, unattributed, because they came to
read about Saint Lucia and should not be punished for someone else's typo.

## The Advisor Hub

`/hub` is the authenticated advisor workspace: Home, the Journeys pipeline, the
Journey briefing, and account settings. It is **server-rendered from serverless
functions through the site's own renderer** — `render(page, body)` in
`lib/page.js` is a pure function, so the Hub is the fourth layout in
`lib/layouts.js` rather than a second application wearing a similar coat.

| Route | Function | Notes |
|---|---|---|
| `/hub` | `hub-screens/home.js` | Needs-attention list, funnel, next best action |
| `/hub/journeys` | `hub-screens/journeys.js` | Four server-side views; default is Needs Attention |
| `/hub/journeys/:id` | `hub-screens/journey.js` | GET renders; POST sets stage / adds a note, then 303 |
| `/hub/account` | `hub-screens/account.js` | Profile only — never status, code, slug or auth id |
| `/hub/login` · `register` · `forgot` · `reset` | `hub-screens/*.js` | Signed-out screens; the POST targets live in `api/auth/` |
| `/well/:code` | `api/well.js` | Opaque campaign link (above) |

**All eight screens are ONE serverless function.** `api/hub/index.js` is a
router; the screens live in `api/_lib/hub-screens/`, where the leading
underscore keeps the directory out of Vercel's function detection. The `screen`
parameter is set by the rewrites in `vercel.json` and matched against a fixed
table, so a hand-typed `/api/hub?screen=…` can only reach a screen that already
has a public route. Adding a screen is a file, a line in `SCREENS`, and a
rewrite — the function count stays at one.

Things worth knowing before changing any of it:

- **Every Hub page is `noindex`, `Cache-Control: private, no-store`.** A Journey
  detail page carries a real person's name, email and travel plans.
- **Reads are scoped twice.** RLS is the guarantee, but every query in
  `api/_lib/hub-data.js` also carries `advisor_id` in its `WHERE` clause, so a
  read that forgets its scope returns nothing rather than relying on the
  database to save it. Asking for another advisor's Journey renders "not here",
  worded identically to a Journey that does not exist, so ids cannot be probed.
- **The briefing is deterministic.** `api/_lib/hub-brief.js` is fixed copy keyed
  to answers the consumer actually selected — no generation, no inference. The
  `recognition: yes` wording says they *recognised a description*, never that
  they are burnt out; that would be a diagnosis, from a quiz, about someone the
  advisor has not yet spoken to.
- **Forms work before JavaScript does.** The auth screens post over fetch for
  inline errors; the stage and note forms are plain POST/redirect/GET. The
  endpoints answer in error codes and the sentences live in `js/hub.js` — one
  place, so `invalid_credentials` stays one message for both "no such account"
  and "wrong password".
- **`vercel.json` needs `functions.includeFiles: "{css,js}/**"`.** `v()` in
  `lib/page.js` reads asset files to compute cache-bust hashes, which Vercel
  cannot trace; without it, Hub pages silently degrade to `?v=0` while static
  pages carry real hashes.

### `js/hub.js` contains a QR encoder, and that is deliberate

About 120 lines of it, rather than a CDN script, because the page it runs on
displays another person's contact details. The trade is only worth it if the
encoder is correct, and "it looks like a QR code" is not evidence — a wrong mask
or a transposed format bit produces something that looks perfect and scans as
nothing. `tools/qr-test.js` proves four things: the function patterns and both
copies of the format information match a reference encoder; an independently
written reader (validated against that reference's own output first) round-trips
our matrix back to the input; and the codeword stream syndrome-checks clean by
Horner evaluation, a different algorithm from the division the encoder uses.

**Do not "fix" it by diffing against `segno`.** That test cannot pass. segno's
`write_padding_bits` does `[0] * (8 - length % 8)` with no guard for an already
aligned stream, and a byte-mode stream is 4 + 8 + 8n + 4 bits — always aligned —
so segno emits one spurious `0x00` codeword every time. Harmless (a decoder
reads the length and stops) but it means the two matrices diverge from the first
pad codeword onward. Ours follows ISO/IEC 18004 §7.4.10.

The encoder stops at version 5. Version 6-L is the first that splits the payload
across two blocks, and interleaving them is real machinery for a case we do not
have — a WELL link is ~45 characters and version 5 holds 106. Longer payloads
throw, and the caller says so rather than drawing something unscannable.

### Looking at the Hub

`node tools/hub-preview.js` renders every screen with obviously-fake fixture
data into `dist/_hub-preview/` (gitignored), so layout can be iterated without a
deploy, a database or a session.

## Tests

There is no framework. Each suite is a script that prints PASS/FAIL and exits
non-zero. Run the offline four before pushing; the two that talk to the live
system after.

| Command | Needs | What it holds down |
|---|---|---|
| `node tools/regress.js` | built `dist/` | The V1.2 acceptance suite — consent, guards, no secrets in `dist` |
| `node tools/hub-test.js` | nothing | Reference resolution, travel windows, attention ranking, the briefing, `safeNext` |
| `node tools/qr-test.js` | `py` + `segno` | The QR encoder (see above) |
| `node tools/check-migration.js` | `.env` | That `002`/`003` landed and preserved what was already there |
| `node tools/rls-test.js` | `.env` | Cross-advisor denial, proved by planting a row and failing to read it |
| `node tools/auth-test.js [url]` | deployed site | The auth lifecycle end to end, then cleans up after itself |

**`rls-test.js` exists because of a false pass.** An earlier check called the
table read "denied" on a `200`, but PostgREST returns `200 []` when RLS filters
everything out — indistinguishable from a wide-open table with no rows. The
suite now plants a row with the service role and then tries to read it back with
the restricted key, which is the only version of the question worth asking.

## Asset versioning

Local css/js URLs carry `?v=<content hash>`. This fixes the preview pane caching
`js/`/`css/` during development *and* means a returning visitor never needs a
hard refresh in production. The URL only changes when the file does, so
far-future cache headers on `css/` and `js/` are safe.

## Property imagery

Built from the 2026-08-10 asset library by
`tools/build-property-images.py`. Re-run it with the extracted library as its
argument; it rewrites `content/properties-media.js`.

```bash
py tools/build-property-images.py <path-to-extracted-asset-library>
```

Choices are **named explicitly** in `HEROES` / `VILLAGES` in that script rather
than picked by a "largest landscape" heuristic, which reliably chose a bedroom
over a Piton view. A named list is also reviewable in a diff.

Three things learned the hard way, all encoded in the script's comments:

- **The catalogue's categories are not reliable.** Anse Chastanet's
  "Pool, beach & views" entries are room interiors; TheLifeCo's
  "Exterior & aerial" hero is a restaurant. Verify the frame, not the label —
  alt text has to describe what is actually there.
- **A'ila's exterior/aerial assets are CGI renderings** of in-development
  phases, not photographs. Showing one as a place you can visit today would be
  a false claim. The hero is the built residence instead, and the constraint
  lives in `RENDERING_WARNING` so it travels with the data.
- **Quality steps down as width goes up.** The large derivatives only serve
  high-DPR screens where artefacts are half-size. At a flat q=82 an aerial of
  water and canopy landed at 497 KB for a frame displayed about 440 px wide.

Every image is cropped to 3:2 so grids align, and nothing is upscaled — the
widest derivative is whatever the source could give.

**Deployment note:** `.webp` must be served as `image/webp`. Python's
`http.server` sends `application/octet-stream`, which browsers tolerate here
because `<source type="image/webp">` drives selection, but a production host
should be configured properly.

## Canonical village names

Check here before writing a village name anywhere. These six strings must match
across **four** places — this site, `saint-lucia-well/content/properties.js`,
the Foundations page (`advisors/foundations/index.src.html`) and `pptx-build/`.

| # | Canonical name | Short form | `key` |
|---|---|---|---|
| 1 | Longevity Village | Longevity | `longevity` |
| 2 | **Nature & Renewal Village** | Nature & Renewal | `rainforest` |
| 3 | Ocean & Restoration Village | Ocean & Restoration | `ocean` |
| 4 | Heritage & Nourishment Village | Heritage & Nourishment | `heritage` |
| 5 | Movement & Adventure Village | Movement & Adventure | `movement` |
| 6 | **Connection & Romance Village** | Connection & Romance | `connection` |

The two in bold were drifting until 2026-08-11: the Foundations page said
"Nature & Renewal" and "Love & Connection" while every other publication said
"Rainforest & Nature" and "Connection & Romance". Two live pages on one domain
disagreed. Village 2 resolved in Foundations' favour (Duncan: "rainforest and
nature are similar, I want to add a wellness relationship"); village 6 resolved
the other way, because "Love & Connection" is the same redundancy and breaks
the *state + travel category* shape the other names share.

**`key` is not a label.** It addresses asset filenames, `#village-*` anchors,
the `properties-media.js` manifest and the Journey Finder's scoring weights.
`rainforest` still keys village 2 and that is intentional — renaming it would
break four systems to change a string nobody reads.

Two grep traps worth knowing, both of which hid this drift from an earlier
search: the HTML files write the ampersand as `&amp;`, so a literal `&` search
misses them, and `dist/` and `brochure*.html` contain stale copies that make a
finished rename look incomplete. Search with
`grep -rnE "Name (&amp;|&|and) Other"` and exclude build output.

## Truth discipline

- **Properties are confirmed** (Duncan, 2026-08-08) and ship as named anchors.
  They are real third-party businesses — do not extend beyond what each
  property publishes about itself.
- **Only Eclipse is promoted as a signature journey.** The brochure's seven
  "initial journey families" stay unpublished until those products genuinely
  exist (brief §1).
- **Eclipse arc uses the brochure's spelling** — ARRIVE · REGULATE · REAWAKEN ·
  RELEASE · RESTORE · RETURN. The brief writes "Awaken"; the brochure is the
  designated source of truth.
- **WELL Pass** is modelled separately from Journey content so it can be added
  later without restructuring. It appears nowhere on the site.
- Footer entries with `pending: true` render as plain text, not links. We do not
  ship 404s, and we do not invent a privacy policy.
- Images we do not have render as **labelled art-direction placeholders**
  (`lib/components.js` → `figure()`), carrying the Midjourney direction. A
  placeholder always reads as a placeholder.
- **No physiological claims** (2026-08-12). The campus passage used to open
  "Saint Lucia's landscape does real physiological work" and offer "magnesium
  drawn in on a mountain trail" as its evidence. That is not a soft claim that
  needed hedging — walking does not take up magnesium, so it was false, and the
  framing invited a clinical evidence burden this site cannot meet. It now reads
  "changes how a journey feels", keeps every sensory particular, and claims
  nothing about the body. It lived on **three surfaces** — `content/home.js`,
  `content/explore.js` and the brochure's `content/copy.js` — and they move
  together. The heritage line on /explore stays: what Saint Lucians have long
  held is a fact about tradition, not a mechanism we are asserting.
- **The partner label is one token.** `SITE.partnersLabel` in `content/site.js`,
  used by the homepage, /about and /advisors. It reads **"In conversation with"**,
  not "in collaboration with": neither the Saint Lucia Tourism Authority nor the
  Wellness Tourism Association has approved being represented as a collaborator
  on this consumer initiative. The Foundations page carries the same softened
  wording in both its copies. Strengthening it is a factual claim — only on
  Duncan's word, and it changes in one place. Keep the categories clean:
  research inclusion ≠ participation ≠ partnership ≠ endorsement.
- **The Finder states what it does with an address.** `.capture-consent` in
  `js/journey.js` — use, non-sharing, removal. It deliberately does not link to
  /privacy, because that page does not exist and a consent line pointing at a
  404 is worse than none. See the TODO at `CAPTURE_ENDPOINT`: wiring the ESP,
  writing the policy, linking it, and being able to honour a removal request are
  one change, not four. Today the form sends nothing, which is what makes the
  current wording true.

## Status

**Waves 1 and 2 complete** — build system, three layouts, design tokens,
homepage, Journey Finder, attribution and analytics; `/explore`, `/eclipse`,
`/about`, and property imagery.

Wave 3: `/advisors` hierarchy, the Foundations move, polish passes.
`/advisors*` links currently 404.

### Wave 2 notes

- **Two properties are placed by inference**, flagged `inferred: true` in
  `content/villages.js`: Cap Maison → Connection & Romance, Stonefield Villa
  Resort → Nature & Renewal. They arrived with the asset library and are not
  in the brochure's `properties.js`. Confirm before regenerating the brochure.
- **Zoëtry Marigot Bay and Calabash Cove have no library imagery**, so they
  render as typographic cards in the village accent — a deliberate treatment,
  and photography drops in later without a layout change.
- **The brochure and deck were regenerated** with all properties confirmed: no
  validation flags remain in either. The 53 `PHOTOGRAPHY PLACEHOLDER` blocks
  still in the deck are art direction for imagery the *brochure* does not have —
  unrelated to property validation.
- `/about` deliberately omits the framework's 8 Pillars, 5 Conditions and GWI
  market figures. That document labels them "market & product language" and
  "design & governance language" — partner vocabulary. They belong on
  `/advisors`.

### The choreography

The consumer surface runs the same vocabulary as Foundations, deliberately at
lower volume — Foundations is a sales argument and performs; this is a
destination brochure and invites. Same techniques, shorter travel, gentler
tilt, nothing that pins or scrubs.

| Effect | Where | Note |
|---|---|---|
| Split headlines | hero h1, page headers, section h2, final CTAs | words rise from masked slots; splits text nodes only, so inline `<em>` survives |
| Staggered grids | 14 grid types | index set as `--i`, not nth-child, so grids longer than six still cascade |
| 3D tilt + glare | village cards, property cards, Eclipse tiles | 4°/5° (Foundations uses 7°/9°). Glare takes the card's own `--v` accent — six villages should not all catch the light in the same gold |
| Magnetic CTAs | primary gold buttons only | plus a slow sheen sweep. A page where everything is magnetic is a page where nothing is |
| Reading thread | every page | teal → gold, rAF-sampled |
| Hero parallax | desktop only | drift + easing Ken Burns; **disabled below 860px**, where the hero is a stacked band and translating it would slide the photo out of its own frame |
| Editorial parallax | village + split imagery | ±16px against the section |

All hover-dependent effects are gated on `(hover: hover) and (pointer: fine)`.

**The masked word slot must be bigger than the line box.** An `overflow: hidden`
inline-block is only as tall as its line box, and at `line-height: 1.14` a Libre
Caslon Display line box is *shorter than the face's own descenders*. For months
the mask sat across the glyphs and sheared the tail off every `g`, `y`, `p` and
comma in every split headline — and, because italic glyphs overhang their
advance width, the right edge of italic words too. It reads as slightly-off
typography rather than as a bug, which is why it survived so long.

The slot is now padded out past the glyphs (`0.08em 0.16em 0.3em`) with matching
negative margins, so the margin box — what `vertical-align: bottom` aligns and
what the line box measures — is unchanged and only the paintable area grows.
Line breaks are identical before and after, which is the check that it is right.

Two things to keep in mind if this is ever touched: the hidden transform has to
clear the *padded* slot (`translateY(calc(108% + 0.4em))`, not `108%`) or the
word shows through the new padding before it rises — the mask failing open; and
verifying it needs the words parked at rest **with the mask still on**, because
headless captures at load, before the reveal transition has run.

### The WELL Compass is the one interactive diagram

The eight directions were bare words on every surface — the site, the brochure,
the deck — under a headline asking the visitor to "begin with how you want to
feel." Pointing at one now brings it forward, recedes the other seven, and
prints its line beneath the figure. Five of the eight glosses are the Journey
Finder's own intention notes (`content/journey.js` Q1) reused verbatim, so
Restore cannot mean one thing here and another three clicks later.

Three things about it are load-bearing and easy to undo by accident:

- **The hover state is picked in JS, not by `:hover`.** The hit circles are
  generous (r=58) and the *active* radius is wider still (118), so adjacent
  zones overlap and CSS would light two directions at once — or whichever came
  later in document order. `js/motion.js` listens once on the SVG and takes the
  nearest point, which is a Voronoi split of the ring: exactly one direction
  owns each 45° wedge, and the dead centre owns none.
- **Dimming rides on `fill-opacity` / `stroke-opacity`, never `opacity`.** The
  compass entrance animations end in `forwards`, so their final `opacity` keeps
  applying *from the animation origin*, which outranks ordinary author rules.
  Anything hover-driven written as `opacity` here silently does nothing. These
  two properties are untouched by the entrance, so the systems compose.
- **Only the outer ring draws.** `.compass-ring--inner` is dotted by design
  (`stroke-dasharray: 3 7`), and a dash-draw animation has to own
  `stroke-dasharray` — animating it converts the dotted ring to a solid one and
  leaves it that way. The inner ring fades and settles instead.

Touch has no hover, so the same eight lines render as a visible `<dl>` legend
and the readout stands down. On pointer devices that legend is clipped to 1×1
rather than `display: none`, which keeps it in the accessibility tree — a
screen-reader user reads all eight without having to hover anything.

Dimmed labels sit at `fill-opacity: .55`, which is a contrast floor rather than
a taste call: paper at `.3` over the ink section composites to about 2.5:1, and
at 21px these do not qualify as large text. Measured from rendered pixels, the
dimmed labels are 5.0:1 and the active gold label 5.8:1.

Applied from the Emil Kowalski design-engineering pass:

- **Movement-based hover is gated behind `@media (hover: hover) and (pointer: fine)`.**
  On touch, `:hover` fires on tap and *stays* — the village cards lifted and
  never settled back, reading as stuck rather than as an affordance. Colour-only
  hovers are left ungated; they flash and clear harmlessly.
- **`.btn:active` uses `scale(0.975)`** rather than a 1px nudge, with a faster
  160ms transition on transform. Press feedback should be the quickest thing on
  the page.
- **Scroll reveals run at 620ms**, down from 800ms — still editorial, no longer
  sluggish. Stagger stays at 70ms per item, inside the 30–80ms band.
- No `transition: all` anywhere; no `scale(0)` entrances; no `ease-in` on UI.

### Eclipse imagery

Eclipse was the last page with art-direction placeholders, and the asset library
has almost no twilight photography. Rather than fabricate one, the recognition
frame is a **real Saint Lucia photograph pushed into the Eclipse colour world**
— desaturated, darkened and tinted toward the printed edition's midnight. The
place is unaltered in form; only the grade moves. The brochure already treats
Eclipse as a separate colour world; this is that rule applied to photography.

The closing frame is deliberately **not** graded. The page opens in the Eclipse
world and ends in real light, and grading `dawn-horizon` flattened its
blue-to-gold horizon into mud. The contrast is the point.

Regenerate with the grade block in this README's history, or replace both with
commissioned twilight photography when it exists.

### A note on auditing contrast

The contrast sweep in this project reads computed styles, and it has bitten
twice. Both traps are worth knowing:

1. **Gradient backgrounds.** Reading only `backgroundColor` misses
   `background-image: linear-gradient(...)` and the walk falls through to
   `<body>`, reporting light-on-dark text as light-on-paper. Foundations paints
   `.section--ink` as a gradient; a naive audit reported 55 false failures.
   Parse the gradient's stops and take the darkest.
2. **Reveal timing.** Elements still at `opacity: 0` have zero height and get
   skipped, so an audit run too early silently measures a subset. Wait past the
   3.6s reveal failsafe before trusting a clean result.

### Anti-slop audit (taste-skill, 2026-08-10)

Ran the `design-taste-frontend` checklist over the built pages as a fresh-eyes
pass. Design read: *redesign-preserve of an editorial destination brand for
design-conscious travellers, Kinfolk/Monocle print-derived language.*

**Fixed:**

| Finding | Action |
|---|---|
| Six consecutive alternating image/text village rows on `/explore` (cap is 2) | Every third village now breaks to a full-measure band: 21:9 photograph, copy in two columns beneath. Rhythm is `split · flip · WIDE · flip · split · WIDE` |
| CTA casing drift: both "Find My WELL Journey" and "Find my WELL journey" shipped | `/explore` now references `SITE.primaryCta` instead of retyping it |
| Duplicate CTA intent on the homepage: three labels for two destinations | One label per intent. "Not sure yet? Start with the Finder" and "See what the island offers" both became "Explore the island" |
| An eyebrow above nearly every section (the templated rhythm) | Dropped 11 that only restated their own headline. Kept the ones that NAME something the headline does not: the Compass, the Villages, the signature journey, the partner strip |

**Deliberately not changed, with reasons:**

- **62 em-dashes.** The skill bans these outright as the top LLM tell. Here they
  are not AI habit: most are verbatim from the human-authored Editorial Founding
  Edition, and 25 are property role strings (`Anchor stay — marina`) that also
  live in `properties.js`, the printed brochure and the PPTX deck. Rewriting
  them desynchronises three publications to satisfy a heuristic aimed at
  generated copy. **Duncan's call, not a unilateral fix.**
- **The palette.** The skill explicitly bans `#fbf8f1` backgrounds plus brass
  accents as the default reach for wellness briefs. That is exactly this
  palette — but it is the established brand from the printed edition, the deck
  and the Foundations site, not a default we reached for. The skill's own
  override clause covers this ("the brand brief explicitly names those colors").
- **Libre Caslon.** Serif is "very discouraged as default"; the override applies
  (brand names it, genuinely editorial/publication). Not Fraunces or
  Instrument Serif, which are the two specifically banned.
- **Homepage sits at 5 eyebrows against a cap of 4.** The remaining five each
  name a distinct brand concept rather than labelling a section. Stopping there
  was a judgment call against cargo-culting a numeric cap.
- **The hero scroll cue** ("Scroll · the island opens") is banned outright by
  the skill, and its reasoning is sound. It is kept only because it mirrors an
  established device on the Foundations page. **Worth a decision** — removing it
  from both surfaces together would be defensible.

### Visual review (headless Chrome, 2026-08-10)

Screenshots do not composite in the preview pane, so for a long stretch every
claim about this site rested on measured geometry rather than on looking at it.
Chrome headless renders it fine:

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new   --disable-gpu --hide-scrollbars --window-size=1440,15000   --virtual-time-budget=9000 --screenshot=out.png http://localhost:4602/
```

Doing that immediately found **three defects that every numeric check had
passed**:

1. **`<picture>` had no height.** `.hero-media img { height: 100% }` resolved
   against a `<picture>` wrapper with `height: auto`, so the image fell back to
   its natural ratio and left a ~90px band of bare `--ink` under the hero and
   under every final CTA. Fixed by making the wrapper fill.
2. **The final CTA used a portrait image as a full-width band.**
   `dawn-horizon.jpg` is 771x998; `object-fit: cover` cropped it to a strange
   strip with a hard seam. Replaced with dedicated 21:9 crops
   (`assets/cta/cta-seacliff`, `cta-dawn`), alternated across pages.
3. **The final CTA text was over-bright and the contrast audit gave it a false
   pass.** The audit walked up to `.section.dark` and measured against charcoal,
   never seeing the photograph. The section also reused the hero's veil, which
   is bottom-anchored, while this section's text is centred — so the middle was
   barely scrimmed. Fixed with a centred scrim plus glyph-level text shadow;
   measured 10.4 / 5.7 / 6.5 under the actual glyphs.

**Headless Chrome cannot render narrower than about 500 CSS px on this machine.**
Windows enforces a minimum window width, so `--window-size=380,…` lays the page
out at ~500 and *crops* the screenshot to 380. The result looks exactly like a
horizontal-overflow bug: text cut off at the right edge, a two-column grid where
one column belongs. It cost an hour during the Hub build. For anything below
~500px, resize the preview pane and measure — `documentElement.scrollWidth`
against `clientWidth`, plus a sweep for elements whose `right` exceeds the
viewport — and use headless only for how it looks at 500 and up.

**The audit lesson worth keeping:** a computed-style contrast check answers
"what colour is the CSS background," not "what is actually behind these words."
It has now produced false passes twice on this project — once through gradients,
once through a photograph under a `.dark` section. Anything with a photographic
backdrop must be measured by sampling the composited image, the way the hero is.

### Cinemagraphs

Four ambient loops, layered over always-present stills. `js/ambient-video.js` is
ported verbatim from the Foundations page — do not simplify it; every branch is
a real failure mode. It skips video entirely for reduced-motion, automated
agents, Save-Data / 2G and narrow viewports, pauses off-screen and on hidden
tabs, and catches blocked autoplay silently so the still simply remains.

| Loop | Where | Source |
|---|---|---|
| `hero-loop` | homepage hero | **Generated** — Kling `kling-video-v2_6` |
| `seacliff-loop` | final CTA on `/`, `/journey`, `/about`, `/advisors` | reused from Foundations |
| `sulphur-loop` | homepage "the island is the therapy" | reused from Foundations |

Three of the four cost nothing: Foundations had already made them from the same
source frames, and `seacliff-loop` is 1280x586 (~21:9), which matches the CTA
band almost exactly. Only the new hero needed generating.

**The hero loop recipe**, which is worth repeating rather than re-deriving:

- Prompt is a *locked-off camera* with ambient motion only. The page drives its
  own parallax and Ken Burns on top, so any camera move in the source fights it
  and exposes the loop seam.
- `enable_audio: false`. These are muted background loops; generating sound is
  wasted cost and bytes.
- Looped by **crossfade, not boomerang** — cloud and water motion is
  directional and reads backwards in a boomerang. Recipe from the Foundations
  README: body = source[1s..5s], head = source[0s..1s], `xfade` the head over
  the body's tail. `xfade` needs constant frame rate, so re-stamp `fps=24`
  after each trim. Measured seam: 1.7% mean pixel difference, structurally
  identical.
- **The scrim was re-verified against the video, not just the poster.** A
  cinemagraph changes the luminance behind the words over time. Sampled four
  frames across the loop: worst 5th-percentile under the glyphs is 5.03:1, so
  the hero stays legible for the whole cycle rather than only at the poster
  frame.

Output is 0.77 MB mp4 / 0.42 MB webm at 1280x716.

### The Foundations compression pass (2026-08-12)

`/advisors/foundations` carried 20.2 MB of assets, four to five times any other
page. `tools/compress-foundations.py` re-encodes them to what the layout
actually paints — **run it once, against originals**, since it rewrites in place
and a second run is generation loss for no saving.

Measured in real headless Chrome — the commit before and the commit after both
built, served, and loaded at 1280x900, counting the bytes actually pulled:
**5.91 MB → 3.22 MB, 46% off.** Images 1664 → 1174 KB, video 4181 → 1913 KB.
On disk, 20.2 → 14.0 MB.

Both figures are the *initial view*: the three below-the-fold loops only fetch
once scrolled to, which adds roughly another 1 MB. Compare like with like — an
estimate assembled by reading the markup is not this number, and the first one
of those attempted here was 2 MB out.

Every target came from the painted size at 1280px / dpr 2, not a hopeful
fraction. Nothing was re-cut or re-timed: all four loops are finished
cinemagraphs, so a lower-bitrate re-encode preserves the loop exactly and there
is no seam to re-verify.

Three findings worth keeping:

- **VP9 lost to H.264 on three of the four loops** — and because the `<source>`
  order put webm first, the browser was downloading the *larger* file. Hero
  4132 vs 2772 KB, seacliff 1480 vs 796, sulphur 196 vs 160; only dawn won
  (260 vs 344). Those three webm files are gone. Measure VP9 per file; never
  assume it is smaller.
- **`poster` is an asset attribute and it was missing from `absolutise()`.**
  All four cinemagraph posters were still 404ing after the fix that was
  supposed to have solved exactly this. The build now throws on any surviving
  relative asset path, so the next missed attribute fails the build instead of
  shipping silently.
- **Posters now point at the `.webp`,** not the `.jpg`. The `<picture>` above
  each cinemagraph already fetches the webp, so the poster is a cache hit
  instead of a second, larger download of the identical frame — 0.71 MB saved
  for nothing. The `.jpg` stays as the `<picture>` fallback.

The hero mp4 is 1913 KB of the 3222, encoded at crf 33 rather than 30. It
measures 33.0 dB PSNR against the original and is indistinguishable side by
side — soft, misty, slow-moving footage with no hard edges is exactly what
compresses well. crf 30 cost 857 KB more for no visible gain.

**How the payload was measured, since it is easy to get wrong.**
`--virtual-time-budget` *hangs forever* on a page with autoplaying video —
virtual time does not advance for media. Use wall-clock (`--timeout`) instead.
The measuring server is `tools/`-adjacent scratch, not committed; it logs bytes
served for one visit, which is the only honest number.

### Open items

- Custom domain. GitHub → Vercel is live and auto-deploys on push to `main`;
  `discoversaintluciawell.com` is not connected yet, so canonical URLs point at
  a domain that does not serve the site.
- ESP endpoint — `CAPTURE_ENDPOINT` in `js/journey.js`. Until it is set the form
  validates and says plainly that nothing was sent.
- **Duncan's privacy review, before the beta takes real consumer data.** The
  pages are written and live; the review of them is not done. The Hub raises the
  stakes — a Journey detail page shows a real person's name, email, phone and
  what they said about their own wellbeing to whichever advisor holds the link.
- **Supabase custom SMTP.** Failing on Supabase's side; Resend itself is proven
  fine (`tools/smtp-test.js` gets `235 Authentication successful`). Email
  confirmation is currently switched OFF as a result, so registration signs the
  advisor straight in.
- **`status = 'pending'` is the only vetting.** Registration is open; receiving
  Journeys is not, until the row is set to `active` by hand. If that gate is
  ever removed, the privacy policy's promise that data goes to "an independent
  travel advisor" needs re-reading first.
- GTM container — `GTM_ID` in `js/analytics.js`. Empty means events queue on
  `dataLayer` but no network request is made.
- New photography — see the image list in the plan. Property photography must
  come from official press kits; AI generation is not an option for real named
  hotels.
- Longevity and Connection villages have **no signature experiences** in the
  brochure's excursion data, so a result matching only those two shows fewer
  experiences than the others.
