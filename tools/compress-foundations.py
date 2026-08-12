"""
compress-foundations.py — shrink the Foundations page's asset payload
============================================================================
/advisors/foundations carried 20.2 MB of assets, four to five times every
other page on the site. This re-encodes them to what the layout actually
paints.

Run:
    py tools/compress-foundations.py [--dry]

RUN THIS ONCE, AGAINST ORIGINALS
It rewrites the files in place, so a second run re-encodes already-compressed
video and loses quality for no saving. If it needs re-running, restore the
assets from git first.

WHAT IT DOES NOT DO
It never re-cuts or re-times a video. All four loops are finished cinemagraphs
— the hero is a boomerang, the other three are crossfade loops — so a plain
re-encode at a lower bitrate preserves the loop exactly and there is no seam
to re-verify. Only bitrate and, for one file, dimensions change.

MEASURED, NOT GUESSED
Every target below comes from what the browser reported painting at 1280px
with dpr 2, so the numbers are display size × 2 rounded up to something
sensible — not a hopeful fraction of the original.
"""
import os
import subprocess
import sys

from PIL import Image
import imageio_ffmpeg

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(HERE, 'advisors', 'foundations', 'assets')
FF = imageio_ffmpeg.get_ffmpeg_exe()
DRY = '--dry' in sys.argv

# Unreferenced. A 1000x1000 PNG portrait left behind when the page moved to
# the .jpg/.webp pair it actually uses — grep finds no reference anywhere.
DEAD = ['ernie-george.png']

# name -> (target width or None to keep, h264 crf, vp9 crf)
#   painted sizes at 1280/dpr2: hero 1392x964 · seacliff 1185x374
#                               sulphur 268x335 · dawn 1265x1196
VIDEOS = {
    # 10s boomerang at 4440 kb/s — by far the heaviest single asset on the
    # site. Width stays 1280: the hero is painted 1392 wide, so it is already
    # being upscaled slightly and must not shrink further.
    # crf 33, not 30. Both are soft, misty, slow-moving footage with no hard
    # edges or text — exactly what compresses well. At 33 the hero measures
    # 33.0 dB PSNR against the original and is indistinguishable side by side,
    # for 857 KB less than crf 30.
    'hero-loop-web':  (None, 33, 36),
    'seacliff-loop':  (None, 33, 36),
    # 720px wide for a 268px slot. 560 still covers dpr 2 with room to spare.
    'sulphur-loop':   (560,  30, 36),
    'dawn-loop':      (None, 30, 36),
}

# name -> target width. Painted sizes, doubled for dpr 2, rounded up.
IMAGES = {
    'duncan-so':        720,   # 1536x2048 for a portrait card ~300px wide
    'sea-shallows':     640,   # painted 268 wide in the photo strip
    'cocoa-market':     640,
    'sulphur-springs':  640,
}


def kb(p):
    return os.path.getsize(p) / 1024


def run(args):
    subprocess.run(args, check=True, capture_output=True)


def do_video(name, width, crf, vp9):
    src = os.path.join(A, f'{name}.mp4')
    if not os.path.exists(src):
        print(f'  MISSING {name}')
        return 0, 0
    before = kb(src) + (kb(os.path.join(A, f'{name}.webm'))
                        if os.path.exists(os.path.join(A, f'{name}.webm')) else 0)
    vf = f'scale={width}:-2' if width else 'null'
    tmp4 = os.path.join(A, f'_{name}.mp4')
    tweb = os.path.join(A, f'_{name}.webm')
    if not DRY:
        run([FF, '-hide_banner', '-v', 'error', '-y', '-i', src, '-vf', vf,
             '-an', '-c:v', 'libx264', '-crf', str(crf), '-preset', 'veryslow',
             '-movflags', '+faststart', tmp4])
        run([FF, '-hide_banner', '-v', 'error', '-y', '-i', tmp4,
             '-an', '-c:v', 'libvpx-vp9', '-crf', str(vp9), '-b:v', '0',
             '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', tweb])
        os.replace(tmp4, src)
        os.replace(tweb, os.path.join(A, f'{name}.webm'))
    after = kb(src) + kb(os.path.join(A, f'{name}.webm'))
    print(f'  {name:18s} {before:7.0f} -> {after:7.0f} KB   ({100 - after / before * 100:4.0f}% saved)')
    return before, after


def do_image(name, width):
    total_b = total_a = 0
    for ext, kwargs in (('jpg', dict(quality=82, optimize=True, progressive=True)),
                        ('webp', dict(quality=78, method=6))):
        p = os.path.join(A, f'{name}.{ext}')
        if not os.path.exists(p):
            continue
        before = kb(p)
        im = Image.open(p)
        if im.width > width:
            if not DRY:
                im.convert('RGB').resize(
                    (width, round(width * im.height / im.width)), Image.LANCZOS
                ).save(p, **kwargs)
        total_b += before
        total_a += kb(p)
    if total_b:
        print(f'  {name:18s} {total_b:7.0f} -> {total_a:7.0f} KB   ({100 - total_a / total_b * 100:4.0f}% saved)')
    return total_b, total_a


def main():
    start = sum(kb(os.path.join(A, f)) for f in os.listdir(A))
    print(f'{"DRY RUN — " if DRY else ""}start: {start / 1024:.1f} MB\n')

    print('UNREFERENCED')
    for f in DEAD:
        p = os.path.join(A, f)
        if os.path.exists(p):
            print(f'  {f:18s} {kb(p):7.0f} KB  removed')
            if not DRY:
                os.remove(p)

    print('\nVIDEO')
    for n, (w, crf, vp9) in VIDEOS.items():
        do_video(n, w, crf, vp9)

    print('\nIMAGES')
    for n, w in IMAGES.items():
        do_image(n, w)

    end = sum(kb(os.path.join(A, f)) for f in os.listdir(A))
    print(f'\n  {start / 1024:.1f} MB -> {end / 1024:.1f} MB   '
          f'({100 - end / start * 100:.0f}% saved)')


if __name__ == '__main__':
    main()
