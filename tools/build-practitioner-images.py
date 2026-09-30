"""
build-practitioner-images.py -- web derivatives for /practitioners
------------------------------------------------------------------
    py tools/build-practitioner-images.py <folder holding hero.* and network.*>

Same rules as tools/build-eclipse-images.py: paired .jpg + .webp, width-suffixed,
never upscaled past the source, so the widest candidate is the native width.

  hero     21:9 wide  -> assets/practitioners/practitioners-hero-{960,1440,2000}
  network  4:5 portrait -> assets/practitioners/practitioners-network-{640,960}

The sources are AI-generated (Midjourney, via Duncan; approved for these slots
2026-09-29). They are not committed; the derivatives are.
"""
import sys, glob, os
from PIL import Image

if len(sys.argv) != 2:
    sys.exit(__doc__)

src, out = sys.argv[1], os.path.join(os.path.dirname(__file__), '..', 'assets', 'practitioners')
os.makedirs(out, exist_ok=True)

JOBS = [('hero', [960, 1440, 2000]), ('network', [640, 960])]

for name, widths in JOBS:
    found = glob.glob(os.path.join(src, name + '.*'))
    if not found:
        sys.exit('no %s.* in %s' % (name, src))
    im = Image.open(found[0]).convert('RGB')
    for w in widths:
        if w > im.width:
            continue
        h = round(im.height * w / im.width)
        r = im.resize((w, h), Image.LANCZOS)
        base = os.path.join(out, 'practitioners-%s-%d' % (name, w))
        r.save(base + '.jpg', quality=82, optimize=True, progressive=True)
        r.save(base + '.webp', quality=80, method=6)
        print('%s %dx%d  jpg %d KB  webp %d KB' % (os.path.basename(base), w, h,
              os.path.getsize(base + '.jpg') // 1024, os.path.getsize(base + '.webp') // 1024))
