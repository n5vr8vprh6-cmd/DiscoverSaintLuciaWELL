"""
build-hub-walkthrough.py — the Hub, walked through, from real renders
============================================================================
Companion to build-property-images.py and build-eclipse-images.py, and
deliberately the same shape: an explicit named sequence, not a glob, so a
re-run either reproduces what shipped or fails loudly.

Run:
    node tools/hub-preview.js          # fixture screens into dist/_hub-preview
    (serve dist/ on 4602)
    py tools/build-hub-walkthrough.py

WHAT THIS IS, AND WHAT IT IS NOT
Every frame is a REAL render of the real Hub handlers, captured from
tools/hub-preview.js — which uses invented people at example.com precisely so
nothing can be mistaken for a traveller. The motion between frames (cuts, the
scroll pan, the cursor) is editorial. That is what a product walkthrough is.

What this is NOT is generated video. Animating a still of our own interface
would invent behaviour the product does not have and present it as the product
— the same reason D6 refuses AI destination imagery, and it matters more when
the subject is our own software. Nothing here is invented except the cursor,
which is a UI convention rather than a claim.

NEVER POINT THIS AT A LIVE HUB. A real Hub screen carries a real traveller's
name, email and travel plans. The capture URLs below are fixtures only, and the
script asserts every address it can see is example.com before it will encode.
"""
import os, subprocess, sys, shutil
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_VIDEO = os.path.join(HERE, 'assets', 'video')
TMP = os.path.join(os.environ.get('TEMP', '/tmp'), 'hub-walkthrough')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
BASE = 'http://localhost:4602/_hub-preview/'

# 2x capture, 1200 logical wide. Heights are generous; the page decides.
SCALE = 2
LOGICAL_W = 1200
SHOTS = {
    'home':    ('index.html',   2900),
    'journey': ('journey.html', 2900),
}

# Output matches the poster's aspect exactly (1440x986 = 1.4605) or the video
# jumps against the still it layers over. Even dimensions for H.264.
OUT_W, OUT_H = 1440, 986
FPS = 24

# Measured from the DOM, not guessed — see the session that built this.
# Logical px at 1200 wide.
ROW_Y      = 1096   # the Marguerite row on the home screen
EMAIL_XY   = (155, 354)    # Email Marguerite, near the top of the briefing
QUOTE_Y    = 769           # "I have not taken more than four consecutive days"


def assert_fixtures_only():
    """No real person may reach a frame. Checked against the SOURCE HTML,
    because an email address cannot be grepped out of a PNG afterwards — by
    then it is pixels and the check is impossible.

    This is the one refusal in the file. A walkthrough is 300 frames of
    somebody's data if it is ever pointed at a live Hub."""
    import re
    bad = []
    for name, (page, _) in SHOTS.items():
        p = os.path.join(HERE, 'dist', '_hub-preview', page)
        if not os.path.exists(p):
            sys.exit('  %s missing — run `node tools/hub-preview.js` first.\n' % p)
        html = open(p, encoding='utf-8').read()
        for addr in set(re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+', html)):
            if not addr.lower().endswith(('example.com', 'example.org', 'example.invalid')):
                bad.append('%s: %s' % (page, addr))
    if bad:
        sys.exit('\n  REFUSING TO BUILD — non-fixture addresses in the source:\n    '
                 + '\n    '.join(bad) + '\n\n  These renders are not fixture data.\n')
    print('  fixtures verified — every address is example.com')


def capture():
    os.makedirs(TMP, exist_ok=True)
    for name, (page, h) in SHOTS.items():
        dst = os.path.join(TMP, name + '.png')
        subprocess.run([
            CHROME, '--headless', '--disable-gpu', '--hide-scrollbars',
            '--force-device-scale-factor=%d' % SCALE,
            '--window-size=%d,%d' % (LOGICAL_W, h),
            '--virtual-time-budget=10000',
            '--screenshot=' + dst, BASE + page,
        ], check=True, capture_output=True)
        print('  captured %-10s %s' % (name, Image.open(dst).size))


def frame(src, scroll_logical):
    """One output frame: a window onto the tall capture at a scroll position."""
    win_h = round(src.size[0] / (OUT_W / OUT_H))          # window height at 2x
    top = max(0, min(round(scroll_logical * SCALE), src.size[1] - win_h))
    return src.crop((0, top, src.size[0], top + win_h)).resize((OUT_W, OUT_H), Image.LANCZOS)


def cursor(im, x, y, click=0.0):
    """The one drawn element. A pointer, and a pulse when it clicks."""
    d = ImageDraw.Draw(im, 'RGBA')
    if click > 0:
        r = int(14 + 34 * click)
        a = int(150 * (1 - click))
        d.ellipse([x - r, y - r, x + r, y + r], outline=(217, 160, 60, a), width=3)
    arrow = [(x, y), (x, y + 21), (x + 5, y + 16), (x + 9, y + 25),
             (x + 13, y + 23), (x + 9, y + 14), (x + 16, y + 14)]
    d.polygon([(px + 1, py + 1) for px, py in arrow], fill=(18, 48, 47, 110))
    d.polygon(arrow, fill=(251, 248, 241, 255), outline=(18, 48, 47, 220))
    return im


def ease(t):
    return t * t * (3 - 2 * t)


def build():
    home = Image.open(os.path.join(TMP, 'home.png')).convert('RGB')
    jrny = Image.open(os.path.join(TMP, 'journey.png')).convert('RGB')

    # Where a frame's window has to sit for a logical y to be centred.
    win_logical = (home.size[0] / SCALE) / (OUT_W / OUT_H)
    def centre_on(y):
        return max(0, y - win_logical / 2)

    def px(y, scroll):
        """Logical y -> output-frame y at a given scroll."""
        return round((y - scroll) * (OUT_H / win_logical))
    def pxx(x):
        return round(x * (OUT_W / (home.size[0] / SCALE)))

    frames = []
    def hold(img, seconds):
        frames.extend([img] * round(seconds * FPS))

    # ── 1 · the Hub home, at rest
    f = frame(home, 0)
    hold(f, 1.4)

    # ── 2 · pan down to the Journeys list, cursor arriving
    target = centre_on(ROW_Y)
    n = round(1.1 * FPS)
    for i in range(n):
        t = ease((i + 1) / n)
        s = target * t
        im = frame(home, s)
        cx, cy = pxx(980), px(ROW_Y + 30 - 260 * (1 - t), s)
        frames.append(cursor(im.copy(), cx, cy))

    # ── 3 · the click
    n = round(0.5 * FPS)
    for i in range(n):
        im = frame(home, target)
        frames.append(cursor(im.copy(), pxx(980), px(ROW_Y + 30, target), click=(i + 1) / n))

    # ── 4 · cut to the briefing, at its top
    hold(frame(jrny, 0), 1.5)

    # ── 5 · read down, through the briefing to her own words
    down = centre_on(QUOTE_Y + 320)
    n = round(2.6 * FPS)
    for i in range(n):
        frames.append(frame(jrny, down * ease((i + 1) / n)))
    hold(frame(jrny, down), 1.2)

    # ── 6 · back up to Email — which sits ABOVE the briefing, so this is what
    #        an advisor actually does: read, then reply.
    n = round(0.9 * FPS)
    for i in range(n):
        frames.append(frame(jrny, down * (1 - ease((i + 1) / n))))

    # ── 7 · cursor to Email, and click
    ex, ey = EMAIL_XY
    n = round(0.7 * FPS)
    for i in range(n):
        t = ease((i + 1) / n)
        im = frame(jrny, 0)
        frames.append(cursor(im.copy(), pxx(ex + 250 * (1 - t)), px(ey + 200 * (1 - t), 0)))
    n = round(0.5 * FPS)
    for i in range(n):
        im = frame(jrny, 0)
        frames.append(cursor(im.copy(), pxx(ex), px(ey, 0), click=(i + 1) / n))

    # ── 8 · the hold. Somebody who glances away and back lands on a still
    #        frame rather than mid-scroll.
    end = cursor(frame(jrny, 0).copy(), pxx(ex), px(ey, 0))
    hold(end, 2.2)

    # ── 9 · fade home, so the loop does not jump
    first = frame(home, 0)
    n = round(0.6 * FPS)
    for i in range(n):
        frames.append(Image.blend(end, first, ease((i + 1) / n)))

    return frames


def encode(frames):
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    seq = os.path.join(TMP, 'seq')
    shutil.rmtree(seq, ignore_errors=True)
    os.makedirs(seq)
    for i, f in enumerate(frames):
        f.save(os.path.join(seq, '%05d.png' % i))
    os.makedirs(OUT_VIDEO, exist_ok=True)

    mp4 = os.path.join(OUT_VIDEO, 'hub-walkthrough.mp4')
    subprocess.run([ff, '-y', '-framerate', str(FPS), '-i', os.path.join(seq, '%05d.png'),
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '29',
                    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4],
                   check=True, capture_output=True)

    webm = os.path.join(OUT_VIDEO, 'hub-walkthrough.webm')
    subprocess.run([ff, '-y', '-framerate', str(FPS), '-i', os.path.join(seq, '%05d.png'),
                    '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-row-mt', '1', webm],
                   check=True, capture_output=True)

    a, b = os.path.getsize(mp4), os.path.getsize(webm)
    print('\n  mp4   %6.2f MB' % (a / 1048576))
    print('  webm  %6.2f MB   %s' % (b / 1048576,
          'ships' if b < a else 'DROPPED — larger than H.264, so shipping it would'
          ' make every Chrome visitor download the worse file'))
    if b >= a:
        os.remove(webm)
    return a, b


if __name__ == '__main__':
    print('\n  Capturing fixture screens…')
    capture()
    print('\n  Composing %d frames…' % 0 or '')
    fr = build()
    print('  %d frames · %.1fs at %dfps' % (len(fr), len(fr) / FPS, FPS))
    encode(fr)
    print('\n  Fixture data only. Never point this at a live Hub.\n')
