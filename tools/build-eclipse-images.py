"""
build-eclipse-images.py — turn the supplied Eclipse art into web derivatives
============================================================================
Companion to build-property-images.py, and deliberately the same shape: an
explicit named map, centre-crop to a target ratio, JPEG+WebP pairs with quality
stepping down as width goes up.

Run:
    py tools/build-eclipse-images.py [source-dir]      (default: ~/Downloads)

WHY A NAMED MAP AND NOT A GLOB
Same reason as the property tool. These filenames are human-written and will
not survive a re-export; pinning them here means a re-run either reproduces
exactly what shipped or fails loudly, and the mapping is reviewable in a diff.

WHAT THESE IMAGES ARE
Generated atmospheres for the nine Eclipse signature experiences, plus two wide
frames. None depicts a real named property and none carries an identifiable
face — which is the distinction that makes them safe to publish, where the
property library is not. Keep it that way on any re-shoot.
"""
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'assets', 'eclipse')

# The two wide frames. 21:9, full measure, so they carry an extra width.
#
# POSTER FRAMING MUST MATCH THE VIDEO LOOP, or the ambient video visibly jumps
# when it fades in over its own poster. Kling will not accept an input wider
# than 2:1, so both loops were generated from a 16:9 intermediate — and these
# posters are therefore cut through that same 16:9 window rather than straight
# from the widest source. Cutting the hero from the native 21:9 file instead
# measured 42.7/255 against the video's first frame; through the 16:9 window it
# is a match.
#
#   base -> (source filename, pre-crop ratio or None, alt text)
WIDES = {
    # Duncan supplied a native 16:9 of this frame as well as the 21:9. The 16:9
    # is what Kling animated, so the poster comes from it too.
    'eclipse-hero': (
        '01 - Twilight over the Caribbean Sea in Saint Lucia.png', None,
        'The Pitons in silhouette across a calm sea as the sun meets the horizon.'),
    # Only a 21:9 exists here, so it was centre-cropped to 16:9 for Kling. The
    # poster takes the same two-step path: 21:9 -> 16:9 -> 21:9.
    'eclipse-arc': (
        '02 - Pre-dawn Caribbean Sea in Saint Lucia.png', 16 / 9,
        ''),                       # decorative band, behind the arc — no alt
}

# The nine signature experiences. 4:5, sized for a 3-up grid.
TILES = {
    'first-light': (
        '04 - First Light - Long communal dining table at dusk in Saint Lucia.png',
        'A long candlelit table at dusk, set with plant-based courses and cacao bowls.'),
    'rising-tide': (
        '05 - Rising Tide -Empty beach in Saint Lucia at first light.png',
        'Footprints along wet sand at the waterline, first light.'),
    'earth-descent': (
        '06 - Earth Decent - Waterfall tucked deep within the Saint Lucian rainf.png',
        'A waterfall falling into a pool deep in rainforest shade.'),
    'phoenix-passage': (
        '07 - Phoenix Passage -Abstract atmospheric study of light.png',
        'Light moving through mist — an abstract study.'),
    'tides-within': (
        '08 - Tides Within - Lantern release over dark Caribbean water at night.png',
        'Paper lanterns drifting across dark water at night, their reflections beneath.'),
    'nightfall': (
        '09 - Nightfall - Dark intimate wellness room.png',
        'A singing bowl and a candle on linen in a darkened room.'),
    'learning-salon': (
        '10 - Learning Salon -  Circle of empty chairs.png',
        'A circle of empty wooden chairs with notebooks, in daylight.'),
    'restorative-therapies': (
        '11 - Warm clinical-adjacent treatment room.png',
        'A treatment room in warm daylight, linen-covered table, no equipment on show.'),
    'ocean-within': (
        '12 - Ocean Within -Twilight Caribbean Sea.png',
        'A single swimmer far below on open water, ripples spreading outward.'),
}

WIDE_WIDTHS = [960, 1440, 2000]
TILE_WIDTHS = [640, 960]
WIDE_RATIO = 21 / 9
TILE_RATIO = 4 / 5


def crop_to_ratio(im, ratio, bias=0.40):
    """Centre-crop to `ratio`, trimming the long axis only — never upscale.

    `bias` pulls the crop window above centre when trimming height, because
    horizons and faces-of-interest sit high in these frames. The Ocean Within
    aerial is the exception and overrides it (see below).
    """
    w, h = im.size
    if w / h > ratio:
        new_w = int(h * ratio)
        return im.crop(((w - new_w) // 2, 0, (w - new_w) // 2 + new_w, h))
    new_h = int(w / ratio)
    top = int((h - new_h) * bias)
    return im.crop((0, top, w, top + new_h))


def save_pair(im, base, w):
    """One width as JPEG + WebP, quality stepping down as width goes up —
    wide derivatives only ever serve high-DPR screens, where artefacts are
    half the apparent size."""
    jpg_q, webp_q = {640: (84, 80), 960: (80, 74),
                     1440: (76, 70), 2000: (72, 66)}.get(w, (80, 74))
    im.save(os.path.join(OUT, f'{base}-{w}.jpg'),
            'JPEG', quality=jpg_q, optimize=True, progressive=True)
    im.save(os.path.join(OUT, f'{base}-{w}.webp'), 'WEBP', quality=webp_q, method=6)


def emit(src_dir, base, filename, ratio, widths, bias=0.40, pre_ratio=None):
    path = os.path.join(src_dir, filename)
    if not os.path.exists(path):
        print(f'  MISSING  {base:24s} {filename}')
        return None
    im = Image.open(path)
    if im.mode in ('RGBA', 'P', 'LA'):
        im = im.convert('RGB')
    # `pre_ratio` reproduces the intermediate crop the video generator needed,
    # so poster and loop end up looking through the same window.
    if pre_ratio:
        im = crop_to_ratio(im, pre_ratio, 0.5)
    im = crop_to_ratio(im, ratio, bias)
    full_w, full_h = im.size
    for w in widths:
        if w > full_w:
            continue
        save_pair(im.resize((w, round(w * full_h / full_w)), Image.LANCZOS), base, w)
    kb = sum(os.path.getsize(os.path.join(OUT, f))
             for f in os.listdir(OUT) if f.startswith(base + '-')) / 1024
    print(f'  {base:24s} {full_w}x{full_h}  ->  {len(widths)} widths, {kb:6.0f} KB total')
    return {'base': f'/assets/eclipse/{base}', 'widths': widths,
            'w': full_w, 'h': full_h}


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Downloads')
    os.makedirs(OUT, exist_ok=True)
    print(f'source: {src}\noutput: {OUT}\n')

    print('WIDE (21:9)')
    for base, (fn, pre, _alt) in WIDES.items():
        # bias 0.5: the loops crop vertical-centre, so these must too.
        emit(src, base, fn, WIDE_RATIO, WIDE_WIDTHS, 0.5, pre)

    print('\nTILES (4:5)')
    for base, (fn, _alt) in TILES.items():
        # The aerial swimmer sits low-centre in frame; a 0.40 bias crops the
        # subject out of the bottom of the tile entirely.
        bias = 0.50 if base == 'ocean-within' else 0.40
        emit(src, f'eclipse-{base}', fn, TILE_RATIO, TILE_WIDTHS, bias)

    print('\nAlt text lives in content/eclipse.js, next to the copy it belongs to.')


if __name__ == '__main__':
    main()
