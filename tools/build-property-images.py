"""
build-property-images.py — turn the property asset library into web imagery
============================================================================
Reads the Discover Saint Lucia WELL asset library (asset_catalogue.csv plus the
properties/ tree) and emits responsive derivatives into assets/properties/.

Run:
    py tools/build-property-images.py <path-to-extracted-asset-library>

Selection is explicit, not automatic. HEROES below names the exact file chosen
for each property, because "largest landscape image" picks a bedroom over a
Piton view often enough to matter. A named list is also reviewable: you can see
what changed in a diff.

Every source is a first-party promotional asset from the property's own site.
Provenance (source page, retrieval date) is carried into content/properties-media.js
so it stays attached to the image rather than living only in a spreadsheet.
"""
import csv
import json
import os
import sys
from PIL import Image

# property_folder -> (chosen file, short alt text)
HEROES = {
    '01-sugar-beach-viceroy': (
        '07_other_viceroy-home.webp',
        'Sugar Beach resort set between the Pitons above Val des Pitons.'),
    '02-jade-mountain': (
        '07_rooms-villas_jade-sunset-on-terrace-3.jpg',
        'An open-wall Jade Mountain sanctuary at sunset, facing the Pitons.'),
    '03-anse-chastanet': (
        '07_exterior-aerial_aerial-3.jpg',
        'Anse Chastanet beach and its house reef seen from above.'),
    '04-the-landings': (
        '06_exterior-aerial_resort-overview.jpg',
        'The Landings Resort seen across its marina and villa suites.'),
    '05-sandals-grande-st-lucian': (
        '01_exterior-aerial_sgl-heart-pool-drone-5f015482c8.avif',
        'Sandals Grande St. Lucian on the Pigeon Island causeway from the air.'),
    '06-bodyholiday': (
        '01_pool-beach-views_hero-fb-cover-2020edit-1-scaled.jpg',
        'The beach and wellness pavilions at BodyHoliday, Cariblue Beach.'),
    # A'ila's exterior/aerial assets (01, 03, 04, 06, 07) are CGI architectural
    # RENDERINGS of an in-development property, not photographs. Publishing one
    # as a place a traveller can visit today would be a false claim, so the hero
    # is the built residence instead. See `RENDERING_WARNING` below.
    '07-aila-resorts-villas-residences': (
        '02_rooms-villas_bluezone-club-residence.webp',
        "A residence and pool deck at A'ila, Rodney Bay."),
    '08-stolentime': (
        '05_wellness-spa_spa-in-the-water-garden-1.jpg',
        'The Spa in the Water Garden at StolenTime, Malabar Beach.'),
    '09-rabot-hotel-hotel-chocolat': (
        '03_pool-beach-views_infinity-pool-piton-view-matt-wild-1.jpg',
        'The infinity pool at Rabot Hotel looking out to the Pitons.'),
    '10-ladera-resort': (
        '05_rooms-villas_heritage-suite-wide.jpg',
        'A Ladera heritage suite with its open fourth wall framing the Pitons.'),
    '11-cap-maison': (
        '04_exterior-aerial_aerial-054.jpg',
        'Cap Maison above the cliffs at Cap Estate.'),
    '12-thelifeco-st-lucia': (
        '06_other_photo1.webp',
        'TheLifeCo above the coastline at Rodney Bay.'),
    '13-stonefield-villa-resort': (
        '01_pool-beach-views_hiking-views.jpg',
        'The Piton view from the Stonefield estate above Soufrière.'),
    # Supplied separately 2026-08-10, so these two have no catalogue row and
    # therefore no source/retrieved provenance — see PROVENANCE_GAP below.
    '14-zoetry-marigot-bay': (
        '12_exterior-aerial_labas-beach.webp',
        'The beach and sheltered water at Marigot Bay.'),
    '15-calabash-cove': (
        '04_exterior-aerial_resort-and-beach.webp',
        'Calabash Cove above its beach on Bonaire Bay.'),
}

# Folders that arrived outside the catalogued library. Recorded so a missing
# source URL reads as a known gap rather than looking like a scraping bug.
PROVENANCE_GAP = {'14-zoetry-marigot-bay', '15-calabash-cove'}

# village key -> (property_folder, file, alt) — one representative frame each
VILLAGES = {
    'longevity': ('12-thelifeco-st-lucia', '07_wellness-spa_photo6.webp',
                  'A treatment and recovery space at TheLifeCo, overlooking the sea.'),
    'rainforest': ('01-sugar-beach-viceroy',
                   '12_wellness-spa_la-rainforest-spa-md-spa-day009370-hdr-central-009282.jpg',
                   'The Rainforest Spa at Sugar Beach, set among the forest canopy.'),
    # Deliberately place-led rather than a posed spa frame: the brochure's own
    # photography rule rules out generic wellness/yoga stock, and the village is
    # about water, not treatments.
    # NB the catalogue's categories are not always reliable — Anse Chastanet's
    # "Pool, beach & views" entries are actually room interiors. Verify the frame,
    # not the label, before trusting it; the alt text has to describe what is
    # really there.
    'ocean': ('11-cap-maison', '02_pool-beach-views_the-cap-maison-and-naked-fisherman-beach.jpg',
              'Beach meeting clear turquoise shallows below Cap Maison, seen from above.'),
    'heritage': ('09-rabot-hotel-hotel-chocolat',
                 '05_dining-culinary_rabot-restaurant-7q4a4762-1-jpg-1.jpg',
                 'The cacao-led table at Rabot Restaurant above Soufrière.'),
    'movement': ('03-anse-chastanet', '01_exterior-aerial_aerial.jpg',
                 'Anse Chastanet beach and the forested hillside above it.'),
    'connection': ('02-jade-mountain', '06_pool-beach-views_main-img-pools.jpg',
                   'An infinity pool sanctuary at Jade Mountain facing the Pitons.'),
}

WIDTHS = [640, 960, 1440]
TARGET_RATIO = 3 / 2          # crop everything to a common ratio so grids align

# Properties whose library imagery includes CGI renderings of unbuilt phases.
# Carried into the generated media file so the constraint travels with the data
# rather than living in a README nobody re-reads. Anything shown for these must
# be a photograph of what exists today, or be labelled an artist's impression.
RENDERING_WARNING = {
    '07-aila-resorts-villas-residences':
        "Library assets 01/03/04/06/07 are CGI renderings of in-development "
        "phases. Only built-and-open photography may be shown without an "
        "explicit artist's-impression label.",
}


def load_catalogue(root):
    path = os.path.join(root, 'asset_catalogue.csv')
    rows = list(csv.DictReader(open(path, encoding='utf-8-sig')))
    return {(r['property_folder'], r['file_name']): r for r in rows}


def crop_to_ratio(im, ratio):
    """Centre-crop to `ratio`, trimming the long axis only — never upscale."""
    w, h = im.size
    if w / h > ratio:
        new_w = int(h * ratio)
        left = (w - new_w) // 2
        return im.crop((left, 0, left + new_w, h))
    new_h = int(w / ratio)
    # Bias slightly above centre: horizons and architecture sit high in these frames.
    top = int((h - new_h) * 0.40)
    return im.crop((0, top, w, top + new_h))


def save_pair(im, out_dir, base, w):
    """Write one width as JPEG + WebP.

    Quality steps DOWN as the image gets wider. The big derivatives only ever
    serve high-DPR screens, where the pixels are half the apparent size and
    compression artefacts are correspondingly harder to see — so paying full
    quality for them is waste. Aerials of water and canopy are the worst case:
    at a flat q=82 one of these landed at 497 KB for a frame that is displayed
    about 440 px wide.
    """
    jpg_q, webp_q = {640: (84, 80), 960: (80, 74), 1440: (76, 70)}.get(w, (80, 74))
    im.save(os.path.join(out_dir, f'{base}-{w}.jpg'),
            'JPEG', quality=jpg_q, optimize=True, progressive=True)
    im.save(os.path.join(out_dir, f'{base}-{w}.webp'), 'WEBP', quality=webp_q, method=6)


def emit(src_path, out_base, out_dir):
    im = Image.open(src_path)
    if im.mode in ('RGBA', 'P', 'LA'):
        im = im.convert('RGB')
    im = crop_to_ratio(im, TARGET_RATIO)
    made = []
    for w in WIDTHS:
        if w > im.width:
            continue
        h = round(im.height * w / im.width)
        save_pair(im.resize((w, h), Image.LANCZOS), out_dir, out_base, w)
        made.append(w)
    if not made:                      # source narrower than our smallest width
        save_pair(im, out_dir, out_base, im.width)
        made.append(im.width)
    return made, im.size


def main():
    if len(sys.argv) < 2:
        sys.exit('usage: py tools/build-property-images.py <asset-library-root>')
    root = sys.argv[1]
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(here, 'assets', 'properties')
    os.makedirs(out_dir, exist_ok=True)
    cat = load_catalogue(root)

    media = {'properties': {}, 'villages': {}}

    for folder, (fname, alt) in HEROES.items():
        src = os.path.join(root, 'properties', folder, fname)
        if not os.path.exists(src):
            print(f'  MISSING {folder}/{fname}')
            continue
        slug = folder.split('-', 1)[1]
        widths, size = emit(src, slug, out_dir)
        meta = cat.get((folder, fname), {})
        media['properties'][folder] = {
            'src': f'/assets/properties/{slug}-{widths[-1]}.jpg',
            'base': f'/assets/properties/{slug}',
            'widths': widths,
            'w': size[0], 'h': size[1],
            'alt': alt,
            'source': meta.get('source_page_url', ''),
            'retrieved': meta.get('retrieved_on', ''),
        }
        if folder in RENDERING_WARNING:
            media['properties'][folder]['renderingWarning'] = RENDERING_WARNING[folder]
        if folder in PROVENANCE_GAP:
            media['properties'][folder]['provenanceNote'] = (
                'Supplied outside the catalogued asset library — no source page '
                'or retrieval date recorded.')
        print(f'  {slug:34s} {size[0]}x{size[1]}  widths {widths}'
              + ('   [renderings present in source set]' if folder in RENDERING_WARNING else ''))

    for key, (folder, fname, alt) in VILLAGES.items():
        src = os.path.join(root, 'properties', folder, fname)
        if not os.path.exists(src):
            print(f'  MISSING village {key}: {folder}/{fname}')
            continue
        widths, size = emit(src, f'village-{key}', out_dir)
        meta = cat.get((folder, fname), {})
        media['villages'][key] = {
            'src': f'/assets/properties/village-{key}-{widths[-1]}.jpg',
            'base': f'/assets/properties/village-{key}',
            'widths': widths,
            'w': size[0], 'h': size[1],
            'alt': alt,
            'source': meta.get('source_page_url', ''),
            'retrieved': meta.get('retrieved_on', ''),
        }
        print(f'  village-{key:26s} {size[0]}x{size[1]}  widths {widths}')

    out_js = os.path.join(here, 'content', 'properties-media.js')
    with open(out_js, 'w', encoding='utf-8') as f:
        f.write('/* ==========================================================================\n')
        f.write('   PROPERTY & VILLAGE IMAGERY — GENERATED, DO NOT EDIT BY HAND\n')
        f.write('   --------------------------------------------------------------------------\n')
        f.write('   Written by tools/build-property-images.py from the asset library.\n')
        f.write('   To change a chosen image, edit HEROES / VILLAGES in that script and re-run\n')
        f.write('   it — editing this file directly will be overwritten on the next build.\n\n')
        f.write('   Sources are first-party promotional assets from each property\'s own site;\n')
        f.write('   `source` and `retrieved` are kept per image so provenance travels with it.\n')
        f.write('   ======================================================================== */\n')
        f.write("'use strict';\n\nmodule.exports = ")
        f.write(json.dumps(media, indent=2, ensure_ascii=False))
        f.write(';\n')
    print(f'\n  wrote content/properties-media.js '
          f'({len(media["properties"])} properties, {len(media["villages"])} villages)')


if __name__ == '__main__':
    main()
