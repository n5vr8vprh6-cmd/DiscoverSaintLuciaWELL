"""
derive-piton-path.py -- the Pitons mark's outline, measured from a photograph
-----------------------------------------------------------------------------
    py tools/derive-piton-path.py <photo of the Pitons from the north>  [--write-overlay out.png]

Prints the values that lib/brand.js holds as PITON_PATH / PITON_* constants. The
site does not run this: it is how the constants were produced, kept so the drawing
can be re-derived (or a different photo used) rather than trusted.

WHY MEASURED. The first mark was drawn as a symmetric "M" from the artwork. The
real Pitons are not symmetric, and that is most of their character: Gros Piton
is tall with a steep, almost straight right flank and a small shoulder on its
left; Petit Piton is about two-thirds as high with a short steep left side and a
long gentle slope to the sea on its right; between them is a deep saddle.

METHOD
  1. Sky vs mountain by the green channel (mountain/forest is dark in this photo,
     sky is light; the mountains are blue-green, so a hue test fails).
  2. Skyline = first run of 10 mountain pixels from the top, per column, over the
     two peaks. Beyond x=1430 a palm occludes Petit's right flank, so that slope
     is extended as a straight line at the slope measured on its visible part;
     the left foot is extended the same way from Gros's shoulder.
  3. Smoothed with a Gaussian (sigma 30px). That is what rounds the tips — the
     softening the brand wants is applied to the REAL profile, not drawn on top.
  4. Simplified to a handful of anchor points and joined with a Catmull-Rom spline
     converted to cubic Beziers, then mapped into the mark's 96 x 46 box, with the
     heights exaggerated 1.4x (see VERTICAL_EXAGGERATION) and a 6% horizontal squeeze.
"""
import sys, json
import numpy as np
from PIL import Image

if len(sys.argv) < 2:
    sys.exit(__doc__)
im = Image.open(sys.argv[1]).convert('RGB')
a = np.array(im).astype(int)
H, W, _ = a.shape
mount = ~(a[..., 1] > 165)

def skyline(x, y0=590, y1=1040, run=10):
    col = mount[y0:y1, x]
    for y in range(len(col) - run):
        if col[y:y + run].all():
            return y0 + y
    return None

# --- 2 · the visible skyline over the two peaks ------------------------------
xs = list(range(830, 1431, 5))
ys = [skyline(x) for x in xs]
# a stray tree at x=920 reads as a notch in the flank; median-filter single outliers
ys = np.array(ys, float)
for i in range(1, len(ys) - 1):
    if abs(ys[i] - ys[i - 1]) > 30 and abs(ys[i] - ys[i + 1]) > 30:
        ys[i] = (ys[i - 1] + ys[i + 1]) / 2
xs = np.array(xs, float)

# extensions: left foot down Gros's shoulder (slope ~0.97), right foot along Petit's
# visible slope (~0.58) to the same base height.
BASE = 960.0
left_slope = 0.97
x_left = xs[0] - (BASE - ys[0]) / left_slope
right_slope = (ys[-1] - ys[np.searchsorted(xs, 1300)]) / (xs[-1] - 1300)
x_right = xs[-1] + (BASE - ys[-1]) / right_slope
lx = np.arange(x_left, xs[0], 5.0); ly = ys[0] + (lx - xs[0]) * -left_slope
rx = np.arange(xs[-1] + 5, x_right + 5, 5.0); ry = ys[-1] + (rx - xs[-1]) * right_slope
X = np.concatenate([lx, xs, rx]); Y = np.concatenate([ly, ys, ry])
Y = np.minimum(Y, BASE)

# --- 3 · Gaussian smoothing (rounds the tips) -----------------------------------
sigma = 30 / 5.0
k = np.arange(-int(4 * sigma), int(4 * sigma) + 1)
w = np.exp(-0.5 * (k / sigma) ** 2); w /= w.sum()
pad = len(k) // 2
Yp = np.concatenate([np.full(pad, Y[0]), Y, np.full(pad, Y[-1])])
Ys = np.convolve(Yp, w, mode='valid')
# smoothing shaves the tips; put the height back so the summits stay where they are
top_true, top_sm = Y.min(), Ys.min()
Ys = BASE - (BASE - Ys) * ((BASE - top_true) / (BASE - top_sm))

# --- 4 · into the mark's box --------------------------------------------------------
X0, Y0 = X.min(), Y.min()
# VERTICAL_EXAGGERATION: the faithful profile is low and wide (peaks about a third as
# tall as the mark is wide) and read as flat next to how the Pitons FEEL. Stretching
# height by 1.4x (0.0774 -> 0.108) gives them the spire-like presence of the hero
# photograph while keeping every proportion between the features.
SX, SY = 0.0725, 0.108
def mx(v): return 9 + (v - X0) * SX
def my(v): return 5 + (v - Y0) * SY
P = np.stack([mx(X), my(Ys)], 1)

def sample(P, step=4.4):
    """Even steps in x along the smoothed curve, plus the true extrema (the two
    tips and the saddle) so the rounding is the photograph's, not the sampling's.
    A simplifier (Douglas-Peucker) was tried first and left noise in the spline."""
    xs_ = np.arange(P[0][0], P[-1][0], step)
    xs_ = np.append(xs_, P[-1][0])
    ex = []
    i_g = int(np.argmin(P[:, 1]))
    ex.append(P[i_g, 0])
    i_p = int(np.argmin(np.where(P[:, 0] > 50, P[:, 1], 99)))
    ex.append(P[i_p, 0])
    lo, hi = P[i_g, 0] + 4, P[i_p, 0] - 4
    i_v = int(np.argmax(np.where((P[:, 0] > lo) & (P[:, 0] < hi), P[:, 1], -1)))
    ex.append(P[i_v, 0])
    keep = [x for x in xs_ if all(abs(x - e) > 1.9 for e in ex)] + ex
    keep = sorted(keep)
    return np.stack([keep, np.interp(keep, P[:, 0], P[:, 1])], 1)
A = sample(P)
def catmull(pts):
    out = [f'M{pts[0][0]:.1f} {pts[0][1]:.1f}']
    for i in range(len(pts) - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]; p1 = pts[i]; p2 = pts[i + 1]; p3 = pts[i + 2] if i + 2 < len(pts) else pts[i + 1]
        c1 = p1 + (p2 - p0) / 6; c2 = p2 - (p3 - p1) / 6
        out.append(f'C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}')
    return ' '.join(out)
path = catmull(A)

gros = P[np.argmin(P[:, 1])]
right_half = P[P[:, 0] > 47]
petit_i = np.argmin(np.where(P[:, 0] > 50, P[:, 1], 99)); petit = P[petit_i]
valley_i = np.argmax(np.where((P[:, 0] > gros[0] + 4) & (P[:, 0] < petit[0] - 4), P[:, 1], -1)); valley = P[valley_i]
print(json.dumps({
    'PITON_PATH': path,
    'gros': [round(float(gros[0]), 1), round(float(gros[1]), 1)],
    'petit': [round(float(petit[0]), 1), round(float(petit[1]), 1)],
    'valley': [round(float(valley[0]), 1), round(float(valley[1]), 1)],
    'feet': [[round(float(P[0][0]), 1), round(float(P[0][1]), 1)], [round(float(P[-1][0]), 1), round(float(P[-1][1]), 1)]],
    'anchors': len(A)
}, indent=1))

if '--write-overlay' in sys.argv:
    out = sys.argv[sys.argv.index('--write-overlay') + 1]
    from PIL import ImageDraw
    o = im.copy(); d = ImageDraw.Draw(o)
    pts = [(float(x), float(y)) for x, y in zip(X, Ys)]
    d.line(pts, fill=(255, 40, 120), width=5)
    o.crop((int(x_left) - 40, 560, int(x_right) + 40, 1040)).save(out)
