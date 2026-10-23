# Advisor Hub: imagery and motion brief

For the Hub UX lift (23 Oct 2026). Every slot below already ships with a
photograph the site owns (`api/_lib/hub-ui.js` → `IMAGES`), so nothing is
blocked on new imagery. This brief covers **replacing the stand-ins with frames
made for the Hub**. Once Duncan approves a frame, it drops into `assets/hub/`
and replaces one line of `IMAGES`, with no layout change.

## Ground rules

- **Atmosphere only.** No AI frame may be presented as a named property or
  landmark. It must not be recognisably Jade Mountain's open wall or Ladera's
  pool deck, for example. The Pitons as a skyline are fine; the brand mark is
  built from them.
- **References, not sources.** Frames in `Saint Lucia Property Assets/` are
  hotels' own Instagram posts, recorded as *not cleared*. They can steer light,
  palette and composition as Midjourney references. They are never uploaded to
  the Hub, and never used where a guest or a building is recognisable.
- **The Hub will be screen-shared and recorded in webinars**, so treat every slot
  as public.
- **People:** backs, distance and silhouettes rather than faces. This matches the
  practitioners page, where the group is shown but no one is identifiable.
- **Palette:** golden hour and deep teal water. The image should never be louder
  than the ink and gold UI around it.

## Slots

| Slot | Today | Aspect / export | Text safe zone | Direction |
|---|---|---|---|---|
| New-advisor hero | `hero-saint-lucia` | 16:9, 2400px wide | Left 45% sits under an ink wash; keep it quiet (foliage or shadow) | The Pitons through rainforest, early light, a path down to the bay. The current frame is right in spirit; it needs more resolution for 2000px screens. |
| Returning band | `hero-saint-lucia` (crop) | 5:1, 2400 × 480 | Left 40% | A wide, calm horizon: water and Pitons, low sun. It must still read when cropped to 120px tall on a phone. |
| Journey Designer tile + header | `hero-pitons` / `sea-cliff-wide` | 4:3 tile, 5:1 band | Band: left 40% | A hand-drawn route on a linen map or a notebook beside the sea, with the itinerary feeling. No screens and no hotel. |
| Explore tile + header | `sulphur-springs` / hero | 4:3, 5:1 | Band: left 40% | The island from above: ridgelines, a bay, rainforest texture. |
| Marketing tile | `cocoa-market` | 4:3 | none | Hands passing a card or postcard at golden hour: warmth and invitation. |
| WELL Group Studio tile | `dawn-horizon` | 4:3 | none | A small group in silhouette on a deck at dawn, mid-stretch or seated, seen from behind. |
| Field Guide tile | `sea-shallows` | 4:3 | none | An open field guide or journal on teak, with a sea glint. Any visible text is soft and unreadable. |
| Training card | `pitons-golden-wave` | 16:9, flexible crop | none | A conversation over coffee on a veranda, two people in soft focus. "Learning, in place." |

Export each at the listed width as JPEG (quality about 82) plus WebP, the same
pair the rest of `assets/` uses.

## Motion (Kling): two loops at most, each only on Duncan's yes

The Hub is a working tool, so motion goes only where a page is *arriving*, never
next to people or numbers.

1. **New-advisor hero.** Image-to-video from the approved hero still: canopy
   breathing, water shimmer, no camera move. Six seconds, seamless loop, muted.
2. **Explore header.** Slow cloud shadow across the island, no camera move.

For both:
- Encode under about 2MB as MP4 plus WebM, with the still as poster.
- Play only under the site's motion gate. Show the still under reduced motion or
  to automated agents, and pause off-screen. This follows the cinemagraph rules
  in the README.
- Never in the returning-advisor band.

**First, try the existing loops in `assets/video/`.** `hero-loop` and
`seacliff-loop` may already be right. Every Kling job is charged, so each one
gets its prompt, source still and duration agreed before it is submitted.
