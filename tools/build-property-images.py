"""
build-property-images.py — turn the property asset library into web imagery
============================================================================
Reads the Discover Saint Lucia WELL asset library (asset_catalogue.csv plus the
properties/ tree) and emits responsive derivatives into assets/properties/.

Run:
    py tools/build-property-images.py <asset-library-root> [<supplement-root> ...]

Several roots may be given. Each has the same layout (asset_catalogue.csv +
properties/<NN-slug>/); catalogues are merged and a file is looked up in the
roots in order. The 2026-08-10 library is the first; later research lands in a
supplement library beside it, never inside this repo.

Selection is explicit, not automatic. HEROES names the exact file chosen for
each property, because "largest landscape image" picks a bedroom over a Piton
view often enough to matter. GALLERY names up to six more per property, each
tagged with what it shows. A named list is also reviewable: you can see what
changed in a diff.

Every source is a first-party promotional asset from the property's own site
unless its catalogue row says otherwise (source_kind below). Provenance —
source page, retrieval date, rights status — is carried into
content/properties-media.js so it stays attached to the image rather than
living only in a spreadsheet.

RIGHTS. The library's own README says: "Treat every asset as permission
required / not verified." Every image therefore carries `cleared: False`
until Duncan sets it, and the client document shows only cleared images. The
workspace shows everything, marked.
"""
import csv
import hashlib
import json
import os
import re
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

# What a gallery frame may be tagged as. Fixed, so the thumb label is one of
# seven words and the client document can ask for "the spa frame" by name.
KINDS = frozenset({'hero', 'spa', 'room', 'lobby', 'gym', 'activity', 'dining', 'exterior'})

# property_folder -> [(file, kind, alt), ...]  — up to six, the hero makes seven.
# Every pick was eyeballed on a contact sheet, not mapped from the filename's
# category token: the catalogue's categories are wrong often enough to matter
# (Anse Chastanet's "pool, beach & views" rows are room interiors; The Landings'
# "rooms" row is a beachside table). Excluded on sight: CGI renderings (A'ila),
# marketing frames with text baked in, weddings, stock-looking and medical
# imagery (TheLifeCo's consultation and IV frames — the field guide's brief says
# "avoid unsupported medical imagery"). Alt text says what is in the frame.
GALLERY = {
    '01-sugar-beach-viceroy': [
        ('12_wellness-spa_la-rainforest-spa-md-spa-day009370-hdr-central-009282.jpg', 'spa',
         'A thatched treatment hut of the Rainforest Spa beside a rock pool, Sugar Beach.'),
        ('08_rooms-villas_sugar-beach-luxury-cottage-outdoor-area.jpg', 'room',
         'A white Luxury Cottage with its terrace and plunge pool among the trees.'),
        ('11_wellness-spa_vhr-viceroy-sugar-beach-wellness-fitness-center.jpg', 'gym',
         'The fitness centre at Sugar Beach, a curved timber room of cardio machines open to the garden.'),
        ('10_wellness-spa_vhr-viceroy-sugar-beach-wellness-yoga-beach.jpg', 'activity',
         'A yoga pose on a deck with Petit Piton directly behind.'),
        ('05_dining-culinary_vsb-chef-with-fish.webp', 'dining',
         'A chef carrying the day’s catch along the beach below the Pitons.'),
        ('03_pool-beach-views_vhr-viceroy-sugar-beach-spice-of-life-4-0.jpg', 'exterior',
         'Petit Piton seen from the end of the jetty at Sugar Beach.'),
    ],
    '02-jade-mountain': [
        ('01_exterior-aerial_home-bottom-aerial.jpg', 'exterior',
         'Jade Mountain’s bridges and sanctuaries from the air, the Pitons across the bay.'),
        ('02_rooms-villas_slider3.jpg', 'room',
         'A sanctuary’s infinity pool and open fourth wall at dusk, facing the Pitons.'),
        ('03_wellness-spa_main-img-spa-treatments.jpg', 'spa',
         'A massage on a sanctuary terrace beside the pool, the Pitons in view.'),
        ('04_experiences-people_main-img-activities.jpg', 'activity',
         'Snorkellers over the reef in Anse Chastanet bay, the Pitons behind.'),
        ('09_wellness-spa_main-img-yoga.jpg', 'activity',
         'A partner yoga session beside a sanctuary pool at Jade Mountain.'),
    ],
    '03-anse-chastanet': [
        ('02_rooms-villas_anse-room1.jpg', 'room',
         'An open-sided hillside room at Anse Chastanet, madras-covered seating and the Pitons beyond.'),
        ('11_wellness-spa_ansechastanet-spa-3-medium.jpg', 'spa',
         'A guest in a robe at the rail of the Kai Mer spa above the sea.'),
        ('09_wellness-spa_day-spapage-pampering-and-relaxationsection.jpg', 'spa',
         'A facial treatment at the Anse Chastanet spa.'),
        ('10_wellness-spa_sup-yoga.jpg', 'activity',
         'Stand-up paddleboard yoga on the calm water off Anse Chastanet beach.'),
        ('05_experiences-people_snorkeler-single.jpg', 'activity',
         'A snorkeller surfacing in the bay, the Pitons on the horizon.'),
        ('06_other_achbay-sept23-0004-medium-1.jpg', 'exterior',
         'Anse Chastanet bay and its beach from above, Petit Piton behind the headland.'),
    ],
    '04-the-landings': [
        ('01_rooms-villas_callaloo-241a2991-1.webp', 'dining',
         'Tables set at the water’s edge at Callaloo, The Landings, at sunset.'),
        ('02_other_thelandings-gallery-46-65bd58ce41bac.jpg', 'exterior',
         'The Landings’ villa suites along Pigeon Island beach.'),
        ('03_rooms-villas_beachfron-241a1198-1.webp', 'room',
         'A beachfront suite’s covered terrace with plunge pool and Rodney Bay view.'),
        ('04_exterior-aerial_landings-activities-aerialtram-65fb47d48ef03-1.webp', 'activity',
         'Guests riding the rainforest aerial tram, an excursion from The Landings.'),
        ('07_wellness-spa_landings-spawellness-fitness-center-65aff848e65c8.webp', 'activity',
         'A mat class in the fitness studio at The Landings.'),
        ('10_wellness-spa_landings-25-spa-2x-1.webp', 'spa',
         'A treatment room at The Landings spa, curtains open to the terrace.'),
    ],
    '05-sandals-grande-st-lucian': [
        ('02_rooms-villas_sgl-hr-bedroom-cb7f2d2579.avif', 'room',
         'A bedroom at Sandals Grande St. Lucian opening onto a private pool.'),
        ('08_exterior-aerial_sgl-lobby-entrance-620bbf9711.avif', 'lobby',
         'The open-air lobby lounge at Sandals Grande St. Lucian.'),
        ('04_exterior-aerial_sgl-grounds-16-05fcbb5b08.webp', 'exterior',
         'Gardens and gazebos on the grounds at Sandals Grande St. Lucian.'),
        ('10_wellness-spa_list-content-02-01-e122612f3f.avif', 'spa',
         'A twin treatment cabana on the beach with a soaking tub, open to the sea.'),
        ('11_wellness-spa_list-content-02-02-fbc2dc679c.avif', 'gym',
         'The fitness centre at Sandals Grande St. Lucian, treadmills facing the sea.'),
        ('06_pool-beach-views_sgl-bp-pool-5cd6bbedc4.avif', 'room',
         'A beachfront villa’s private pool and terrace at Sandals Grande St. Lucian.'),
    ],
    '06-bodyholiday': [
        ('02_wellness-spa_img-4730.jpg', 'activity',
         'A sunrise yoga pose on the jetty at BodyHoliday, Pigeon Island behind.'),
        ('03_dining-culinary_restaurants.jpg', 'dining',
         'A sushi platter at one of BodyHoliday’s restaurants.'),
        ('07_rooms-villas_accommodations-1.webp', 'room',
         'A guest room at BodyHoliday with a freestanding tub and garden view.'),
        ('08_wellness-spa_ff083c58-3b04-4ad5-8df2-71353fa3c541.webp', 'spa',
         'A head treatment in the Wellness Centre at BodyHoliday.'),
        ('10_wellness-spa_dsc8328-1.jpg', 'activity',
         'Partner yoga in the infinity pool at BodyHoliday.'),
        ('13_wellness-spa_dsc8328.jpg', 'gym',
         'A mat class with stability balls in the fitness studio at BodyHoliday.'),
    ],
    # Only built-and-operating frames. Assets 01/03/04/06/07 are renderings and
    # are never picked; TheLifeCo's frames are the operating centre.
    '07-aila-resorts-villas-residences': [
        ('05_other_high-format-tlc-main.webp', 'exterior',
         'The operating TheLifeCo centre at A’ila, Rodney Bay, from the air.'),
        ('11_wellness-spa_4-healthy-nutrition.webp', 'dining',
         'Plant-based rolls from the TheLifeCo kitchen at A’ila.'),
        ('12_wellness-spa_cta-wellness.jpg', 'spa',
         'A massage under the palms at the operating TheLifeCo centre.'),
    ],
    '08-stolentime': [
        ('01_pool-beach-views_nature-2-1-1.webp', 'exterior',
         'Gardens and a gazebo among the palms at StolenTime, Malabar Beach.'),
        ('03_pool-beach-views_beach-yog1-2.webp', 'exterior',
         'Malabar Beach in front of StolenTime, Pigeon Island across the water.'),
        ('02_other_feet-v4b-1.jpg', 'dining',
         'A couple at dinner at StolenTime.'),
        ('09_wellness-spa_holistic-fitness-progra-banner.jpg', 'gym',
         'A class in the fitness studio at StolenTime.'),
        ('11_wellness-spa_tai-chi-banner.jpg', 'activity',
         'A tai chi lesson on the beach at StolenTime.'),
        ('08_wellness-spa_finding-fitness-banner.jpg', 'activity',
         'An aqua fitness class in the pool at StolenTime.'),
    ],
    '09-rabot-hotel-hotel-chocolat': [
        ('02_rooms-villas_rabot-hotel-outside-lodge-1.jpg', 'room',
         'Timber lodges among the cacao trees at Rabot Hotel.'),
        ('04_wellness-spa_spa-outside-matt-wild-1.jpg', 'spa',
         'The dark timber spa at Rabot Hotel, its beauté de cacao sign at the door.'),
        ('05_dining-culinary_rabot-restaurant-7q4a4762-1-jpg-1.jpg', 'dining',
         'The cacao-led table at Rabot Restaurant, Petit Piton in the window.'),
        ('11_wellness-spa_yoga-infinity-pool-1-march-2022-1.jpg', 'activity',
         'A tree pose on the yoga deck beside the infinity pool, facing the Piton.'),
        ('07_experiences-people_boat-experience-0211-2-1.jpg', 'activity',
         'The Rabot boat under way along the Soufrière coast.'),
        ('09_wellness-spa_spa-treatment-2-march-2022-1.jpg', 'spa',
         'A cacao scrub treatment at the Rabot spa.'),
    ],
    '10-ladera-resort': [
        ('02_wellness-spa_dscf1734-large.jpg', 'gym',
         'A treadmill at Ladera’s fitness room, facing the Pitons through open walls.'),
        ('03_experiences-people_piton-hike-trail-anson-wide.jpg', 'activity',
         'A guide on the shaded trail below the Pitons.'),
        ('04_other_treehouse-wide-2.jpg', 'spa',
         'The Lévé treehouse spa raised in the forest canopy at Ladera.'),
        ('10_wellness-spa_leve-spa-still001-retouched-standard.jpg', 'exterior',
         'Ladera on its ridge below Petit Piton.'),
        ('12_wellness-spa_983a902b-80f2-4604-8f28-98a8996bbb34-m-large.jpg', 'activity',
         'A seated yoga session on a covered deck at Ladera.'),
        ('08_other_tra-5285.jpg', 'exterior',
         'The pool terrace at Ladera with the valley falling away behind.'),
    ],
    '11-cap-maison': [
        ('02_pool-beach-views_the-cap-maison-and-naked-fisherman-beach.jpg', 'exterior',
         'Smugglers Cove below Cap Maison, seen from above.'),
        ('08_rooms-villas_rooms-077.jpg', 'room',
         'A twin room at Cap Maison opening onto a terrace.'),
        ('06_dining-culinary_img-2439x-scaled-1.jpg', 'dining',
         'A dish under glass and a glass of white wine at The Cliff at Cap.'),
        ('10_wellness-spa_beach-010.jpg', 'spa',
         'A hanging chair on the Rock Maison deck above the sea at Cap Maison.'),
        ('05_rooms-villas_img-8594x-1-scaled-1.jpg', 'room',
         'A guest at the balcony rail of a Cap Maison room, garden and sea beyond.'),
        ('09_wellness-spa_courtyard-005-2.jpg', 'exterior',
         'The courtyard pool at Cap Maison between the white villas.'),
    ],
    '12-thelifeco-st-lucia': [
        ('01_exterior-aerial_photo5.webp', 'lobby',
         'The lounge and juice bar at TheLifeCo St. Lucia.'),
        ('02_rooms-villas_photo1-scaled.webp', 'room',
         'A guest room at TheLifeCo with its balcony over Rodney Bay.'),
        ('03_pool-beach-views_photo2.webp', 'exterior',
         'A balcony at TheLifeCo looking across Rodney Bay to Pigeon Island.'),
        ('05_dining-culinary_thelifeco-vegan-sushi.jpg', 'dining',
         'Vegan sushi from the TheLifeCo kitchen.'),
        ('07_wellness-spa_photo6.webp', 'spa',
         'A treatment room at TheLifeCo St. Lucia.'),
        ('12_wellness-spa_cta-wellness.jpg', 'spa',
         'A massage under the palms at TheLifeCo.'),
    ],
    '13-stonefield-villa-resort': [
        ('02_wellness-spa_3-img-8202.jpg', 'activity',
         'Mats laid out on the yoga deck at Stonefield, Petit Piton behind.'),
        ('07_rooms-villas_oceanview-villa-bedroom.jpg', 'room',
         'A four-poster bed under a vaulted ceiling in a Stonefield villa.'),
        ('06_rooms-villas_poolside-5-bdrm-villa-lead.png', 'exterior',
         'A villa pool at Stonefield with the Pitons above the treeline.'),
        ('09_wellness-spa_escape-spa.jpg', 'spa',
         'A guest in a robe on a Stonefield veranda facing Petit Piton.'),
        ('10_wellness-spa_yoga-studio.jpg', 'activity',
         'A seated yoga pose on a villa veranda at Stonefield, the Piton in view.'),
        ('03_exterior-aerial_shower-landscape.png', 'room',
         'An open-air garden shower in a Stonefield villa.'),
    ],
}

# Folders that arrived outside the catalogued library. Recorded so a missing
# source URL reads as a known gap rather than looking like a scraping bug.
PROVENANCE_GAP = {'14-zoetry-marigot-bay', '15-calabash-cove'}

# Display names for the credit line where no catalogue row can supply one.
CREDIT_FALLBACK = {
    '14-zoetry-marigot-bay': 'Zoëtry Marigot Bay St. Lucia',
    '15-calabash-cove': 'Calabash Cove Resort & Spa',
}

# Domains that are booking intermediaries, not the property. An image whose
# catalogue row came from one of these is marked source_kind 'ota' and never
# reaches the client document until cleared — the OTA licensed it from the
# property (or shot it); public-facing is not public domain.
OTA_DOMAINS = ('expedia.', 'hotels.com', 'booking.com', 'tripadvisor.', 'agoda.',
               'trivago.', 'kayak.', 'priceline.', 'orbitz.', 'travelocity.', 'hotwire.')

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
# Gallery frames are thumbnails first and a swapped-in card image second; the
# card is never wider than 960 CSS px. Skipping 1440 is a third of the bytes.
GALLERY_WIDTHS = [640, 960]
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


def load_catalogues(roots):
    """Merge every root's catalogue; the first root wins on a duplicate key."""
    cat = {}
    for root in roots:
        path = os.path.join(root, 'asset_catalogue.csv')
        if not os.path.exists(path):
            print(f'  (no asset_catalogue.csv in {root})')
            continue
        for r in csv.DictReader(open(path, encoding='utf-8-sig')):
            cat.setdefault((r['property_folder'], r['file_name']), r)
    return cat


def find_source(roots, folder, fname):
    for root in roots:
        p = os.path.join(root, 'properties', folder, fname)
        if os.path.exists(p):
            return p
    return None


def load_existing(path):
    """The current manifest, so a property whose source is not on disk can be
    carried forward rather than silently dropped."""
    if not os.path.exists(path):
        return {'properties': {}, 'villages': {}}
    text = open(path, encoding='utf-8').read()
    m = re.search(r'module\.exports\s*=\s*(\{.*\});?\s*$', text, re.S)
    return json.loads(m.group(1)) if m else {'properties': {}, 'villages': {}}


def sha6(meta, src_path):
    """Six hex characters of the file's sha256 — from the catalogue when it has
    one, else computed. Goes into the basename so a replaced frame is a new URL
    and the seven-day /assets cache can never serve the old one."""
    h = (meta or {}).get('sha256') or ''
    if len(h) >= 6:
        return h[:6].lower()
    d = hashlib.sha256()
    with open(src_path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            d.update(chunk)
    return d.hexdigest()[:6]


def source_kind(meta):
    dom = ((meta or {}).get('source_domain') or '').lower()
    if any(o in dom for o in OTA_DOMAINS):
        return 'ota'
    if 'press' in ((meta or {}).get('asset_type') or '').lower():
        return 'press'
    return 'property'


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


def emit(src_path, out_base, out_dir, widths=WIDTHS):
    im = Image.open(src_path)
    if im.mode in ('RGBA', 'P', 'LA'):
        im = im.convert('RGB')
    im = crop_to_ratio(im, TARGET_RATIO)
    made = []
    for w in widths:
        if w > im.width:
            continue
        h = round(im.height * w / im.width)
        save_pair(im.resize((w, h), Image.LANCZOS), out_dir, out_base, w)
        made.append(w)
    if not made:                      # source narrower than our smallest width
        save_pair(im, out_dir, out_base, im.width)
        made.append(im.width)
    return made, im.size


def record(base, widths, size, alt, kind, meta, credit):
    """One image, the same shape whether it is the hero or a gallery frame."""
    return {
        'kind': kind,
        'src': f'{base}-{widths[-1]}.jpg',
        'base': base,
        'widths': widths,
        'w': size[0], 'h': size[1],
        'alt': alt,
        'source': (meta or {}).get('source_page_url', ''),
        'source_kind': source_kind(meta),
        'retrieved': (meta or {}).get('retrieved_on', ''),
        'cleared': False,
        'credit': credit,
    }


def main():
    if len(sys.argv) < 2:
        sys.exit('usage: py tools/build-property-images.py <asset-library-root> [<supplement-root> ...]')
    roots = sys.argv[1:]
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(here, 'assets', 'properties')
    out_js = os.path.join(here, 'content', 'properties-media.js')
    os.makedirs(out_dir, exist_ok=True)
    cat = load_catalogues(roots)
    existing = load_existing(out_js)

    for folder, picks in GALLERY.items():
        assert folder in HEROES, f'GALLERY names a folder HEROES does not: {folder}'
        assert len(picks) <= 6, f'{folder}: more than six gallery frames'
        for fname, kind, alt in picks:
            assert kind in KINDS and kind != 'hero', f'{folder}/{fname}: bad kind {kind!r}'
            assert len(alt) > 20, f'{folder}/{fname}: alt text is too short to describe a frame'

    media = {'properties': {}, 'villages': {}}
    tally = {k: 0 for k in sorted(KINDS)}
    ota = []

    for folder, (fname, alt) in HEROES.items():
        slug = folder.split('-', 1)[1]
        rows = [r for (f, _), r in cat.items() if f == folder]
        credit = (rows[0]['property'] if rows else CREDIT_FALLBACK.get(folder)) or slug
        src = find_source(roots, folder, fname)

        if not src:
            old = existing.get('properties', {}).get(folder)
            if not old:
                print(f'  MISSING {folder}/{fname}')
                continue
            # Carried forward from the last build: the derivatives are on disk
            # but the original is not in any root given. Nothing is re-encoded.
            hero = dict(old)
            hero.pop('images', None)
            hero.pop('renderingWarning', None)
            hero.pop('provenanceNote', None)
            hero.pop('rights_status', None)
            hero.pop('usage_note', None)
            hero.setdefault('kind', 'hero')
            hero.setdefault('source_kind', 'property')
            hero.setdefault('cleared', False)
            hero.setdefault('credit', credit)
            prop = dict(hero)
            prop['images'] = [hero]
            print(f'  {slug:34s} CARRIED — no source in any root; derivatives kept')
        else:
            widths, size = emit(src, slug, out_dir)
            meta = cat.get((folder, fname), {})
            hero = record(f'/assets/properties/{slug}', widths, size, alt, 'hero', meta, credit)
            prop = dict(hero)
            prop['images'] = [hero]
            print(f'  {slug:34s} {size[0]}x{size[1]}  widths {widths}'
                  + ('   [renderings present in source set]' if folder in RENDERING_WARNING else ''))

        for gname, kind, galt in GALLERY.get(folder, []):
            gsrc = find_source(roots, folder, gname)
            if not gsrc:
                print(f'    MISSING gallery {folder}/{gname}')
                continue
            gmeta = cat.get((folder, gname), {})
            base_name = f'{slug}-{kind}-{sha6(gmeta, gsrc)}'
            gw, gsize = emit(gsrc, base_name, out_dir, GALLERY_WIDTHS)
            img = record(f'/assets/properties/{base_name}', gw, gsize, galt, kind, gmeta, credit)
            prop['images'].append(img)
            tally[kind] += 1
            if img['source_kind'] == 'ota':
                ota.append(f'{folder}/{gname}')
            print(f'    {kind:9s} {gsize[0]}x{gsize[1]}  {gname[:60]}')
        tally['hero'] += 1

        if rows:
            # What the library's README says, carried where the images go.
            prop['rights_status'] = rows[0].get('rights_status', '')
            prop['usage_note'] = rows[0].get('usage_note', '')
        if folder in RENDERING_WARNING:
            prop['renderingWarning'] = RENDERING_WARNING[folder]
        if folder in PROVENANCE_GAP:
            prop['provenanceNote'] = (
                'Supplied outside the catalogued asset library — no source page '
                'or retrieval date recorded.')
        media['properties'][folder] = prop

    for key, (folder, fname, alt) in VILLAGES.items():
        src = find_source(roots, folder, fname)
        if not src:
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

    with open(out_js, 'w', encoding='utf-8') as f:
        f.write('/* ==========================================================================\n')
        f.write('   PROPERTY & VILLAGE IMAGERY — GENERATED, DO NOT EDIT BY HAND\n')
        f.write('   --------------------------------------------------------------------------\n')
        f.write('   Written by tools/build-property-images.py from the asset library.\n')
        f.write('   To change a chosen image, edit HEROES / GALLERY / VILLAGES in that script\n')
        f.write('   and re-run it — editing this file directly will be overwritten.\n\n')
        f.write('   Each property carries its hero as flat keys (the shape every caller of\n')
        f.write('   mediaPicture() has always read) and `images[]` — the hero first, then up\n')
        f.write('   to six gallery frames, each tagged `kind`. `source`, `retrieved`,\n')
        f.write('   `source_kind` and `cleared` travel with every image; the client document\n')
        f.write('   shows only `cleared: true`, and nothing is cleared until Duncan says so.\n')
        f.write('   ======================================================================== */\n')
        f.write("'use strict';\n\nmodule.exports = ")
        f.write(json.dumps(media, indent=2, ensure_ascii=False))
        f.write(';\n')

    print(f'\n  wrote content/properties-media.js '
          f'({len(media["properties"])} properties, {len(media["villages"])} villages)')
    print('  frames by kind: ' + ', '.join(f'{k} {v}' for k, v in tally.items() if v))
    print('  OTA-sourced: ' + (', '.join(ota) if ota else 'none'))


if __name__ == '__main__':
    main()
