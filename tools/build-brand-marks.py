"""
build-brand-marks.py -- favicon, tile icons and the share image, from one geometry
----------------------------------------------------------------------------------
    py tools/build-brand-marks.py

The Pitons mark is defined in lib/brand.js (PITON_PATH and pitonsMarkInner). This
script does NOT repeat the geometry: it asks Node for the mark's markup, so the
favicon, the tile icons and the share image are the same drawing as the page.
(The path itself was measured from a photograph: tools/derive-piton-path.py.)

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


def mark_inner(uid, stroke, color):
    """The mark's markup from lib/brand.js, so there is one drawing."""
    js = ("const b=require('./lib/brand.js');"
          f"console.log(b.pitonsMarkInner('{uid}',{{stroke:{stroke},color:'{color}'}}))")
    return subprocess.run(['node', '-e', js], cwd=ROOT, check=True, capture_output=True, text=True).stdout


def tile_svg(rounded=True, scale=0.35):
    """A square tile with the mark centred a touch below middle (the light rises
    above it). The mark occupies x 9-87, y 6-32 of its own 96 x 36 box."""
    tx = 16 - 48 * scale
    ty = 17 - 19.2 * scale
    rx = ' rx="7"' if rounded else ''
    inner = mark_inner('-t', round(2.3 / scale, 2), PAPER)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32"{rx} fill="{INK}"/>
  <g transform="translate({tx:.2f} {ty:.2f}) scale({scale})">
  {inner}
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
    """The template holds {{MARK}}; it is filled from lib/brand.js like the icons."""
    src = os.path.join(ROOT, 'tools', 'brand', 'og.html')
    built = os.path.join(ROOT, 'tools', 'brand', 'og.build.html')
    out = os.path.join(ROOT, 'assets', 'og-default.jpg')
    tmp = out + '.png'
    mark = ('<svg width="117" height="44" viewBox="0 0 96 36" aria-hidden="true">'
            + mark_inner('-og', 2.2, PAPER) + '</svg>')
    with open(src, encoding='utf8') as f:
        html = f.read().replace('{{MARK}}', mark)
    with open(built, 'w', encoding='utf8') as f:
        f.write(html)
    try:
        chrome_png(built, tmp, 1200, 630)
    finally:
        os.remove(built)
    Image.open(tmp).convert('RGB').save(out, quality=88, optimize=True, progressive=True)
    os.remove(tmp)
    print('wrote assets/og-default.jpg', Image.open(out).size, os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    svg = tile_svg(rounded=True)
    write('assets/favicon.svg', svg)
    write('advisors/foundations/assets/favicon.svg', svg)
    render_icon(svg, 32, 'assets/favicon-32.png', transparent=True)
    render_icon(svg, 192, 'assets/icon-192.png', transparent=True)
    render_icon(tile_svg(rounded=False, scale=0.32), 180, 'assets/apple-touch-icon.png', transparent=False)
    if os.path.exists(os.path.join(ROOT, 'tools', 'brand', 'og.html')):
        render_og()
    else:
        print('tools/brand/og.html not found; share image skipped')
