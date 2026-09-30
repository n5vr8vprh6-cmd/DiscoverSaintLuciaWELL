"""
build-brand-marks.py -- favicon, tile icons and the share image, from one geometry
----------------------------------------------------------------------------------
    py tools/build-brand-marks.py

The Pitons mark is defined in lib/brand.js (`PITON_POINTS`). Everything here that
draws it repeats those numbers, and tools/brand-test.js fails if the two drift.

Writes:
  assets/favicon.svg                        the tab icon (SVG browsers)
  advisors/foundations/assets/favicon.svg   the Foundations page's own copy
  assets/favicon-32.png                     PNG fallback (Safari ignores SVG favicons)
  assets/apple-touch-icon.png               180px, opaque square (iOS rounds it itself)
  assets/icon-192.png                       192px, rounded tile
  assets/og-default.jpg                     1200x630 share image

PNGs and the share image are rendered by headless Chrome from the SVG / HTML, not
drawn with PIL: a mitred peak and an anti-aliased hairline are what the browser
does exactly, and PIL's polyline joins are not. Needs Chrome at the usual path.
"""
import os, subprocess, sys, tempfile
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

INK = '#12302F'       # --ink: the deep tile colour, matching the supplied artwork
PAPER = '#FBF8F1'     # --paper
CORAL = '#EF6A4A'
PATH = 'M3 37 C13 27.5 21.5 15.5 27.8 7.2 Q30 4.2 32.2 7.2 C36.8 13 41.2 18.2 44.7 20.6 Q46 21.7 47.3 20.6 C51.6 17.8 57.6 11.4 62.9 4.6 Q65 2 67.1 4.6 C74.6 14 82 27 89 37'   # keep in step with lib/brand.js (PITON_PATH)
SUN = (46, 11.5)


def tile_svg(rounded=True, mark_scale=0.32):
    """A square tile, the mark centred a touch below middle (peaks read as 'up')."""
    tx = 16 - 46 * mark_scale
    ty = 17 - 19.75 * mark_scale
    rx = ' rx="7"' if rounded else ''
    stroke = 7.4   # local units; x mark_scale = ~2.4px at 32
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs><radialGradient id="g"><stop offset="0" stop-color="#FFE2C2"/><stop offset=".18" stop-color="#F58A66" stop-opacity=".95"/><stop offset=".5" stop-color="#EF6A4A" stop-opacity=".4"/><stop offset="1" stop-color="#D9A03C" stop-opacity="0"/></radialGradient></defs>
  <rect width="32" height="32"{rx} fill="{INK}"/>
  <g transform="translate({tx:.2f} {ty:.2f}) scale({mark_scale})">
    <circle cx="{SUN[0]}" cy="{SUN[1]}" r="14" fill="url(#g)"/>
    <path d="{PATH}" fill="none" stroke="{PAPER}" stroke-width="{stroke}" stroke-linejoin="round" stroke-linecap="round"/>
  </g>
</svg>
'''


def write(path, text):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf8', newline='\n') as f:
        f.write(text)
    print('wrote', path)


def chrome_png(html_path, out_path, w, h, transparent=False):
    """Screenshot an HTML file at exactly w x h. --window-size can come back a
    pixel or so short in headless, so ask for a little more and crop."""
    tmp = out_path + '.raw.png'
    args = [CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
            '--force-device-scale-factor=1', f'--window-size={w},{h + 120}',
            f'--screenshot={tmp}', '--virtual-time-budget=6000']
    if transparent:
        args.append('--default-background-color=00000000')
    args.append('file:///' + html_path.replace('\\', '/'))
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    im = Image.open(tmp)
    im.crop((0, 0, w, h)).save(out_path)
    os.remove(tmp)


def render_icon(svg_text, size, out_rel, transparent):
    out = os.path.join(ROOT, out_rel)
    with tempfile.TemporaryDirectory() as d:
        html = os.path.join(d, 'i.html')
        with open(html, 'w', encoding='utf8') as f:
            f.write(f'<!doctype html><meta charset=utf-8><style>html,body{{margin:0;background:transparent}}'
                    f'svg{{display:block;width:{size}px;height:{size}px}}</style>{svg_text}')
        chrome_png(html, out, size, size, transparent=transparent)
    print('wrote', out_rel, Image.open(out).size)


def render_og():
    tpl = os.path.join(ROOT, 'tools', 'brand', 'og.html')
    out = os.path.join(ROOT, 'assets', 'og-default.jpg')
    tmp = out + '.png'
    chrome_png(tpl, tmp, 1200, 630)
    Image.open(tmp).convert('RGB').save(out, quality=88, optimize=True, progressive=True)
    os.remove(tmp)
    print('wrote assets/og-default.jpg', Image.open(out).size, os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    svg = tile_svg(rounded=True)
    write('assets/favicon.svg', svg)
    write('advisors/foundations/assets/favicon.svg', svg)
    render_icon(svg, 32, 'assets/favicon-32.png', transparent=True)
    render_icon(svg, 192, 'assets/icon-192.png', transparent=True)
    render_icon(tile_svg(rounded=False, mark_scale=0.30), 180, 'assets/apple-touch-icon.png', transparent=False)
    if os.path.exists(os.path.join(ROOT, 'tools', 'brand', 'og.html')):
        render_og()
    else:
        print('tools/brand/og.html not found; share image skipped')
