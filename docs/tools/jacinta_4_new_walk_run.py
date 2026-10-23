# Put the new walk (friendly) and run (determined) sprite rows into Jacinta's game sheet.
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage
SRC, SHEET = sys.argv[1], sys.argv[2]
meta = json.load(open('/tmp/claude-0/sheet/meta.json'))
cw, ch, AX, AY = meta['cellW'], meta['cellH'], meta['anchorX'], meta['anchorY']
G = AY - 1
a = np.array(Image.open(SRC).convert('RGBA'))
m = a[..., 3] > 40
rs = m.sum(1); ysplit = min(range(320, 410), key=lambda y: rs[y])
def frames(y0, y1):
    sub = m[y0:y1]; lab, n = ndimage.label(sub); objs = ndimage.find_objects(lab)
    sizes = ndimage.sum(sub, lab, range(1, n + 1))
    out = []
    for i, (o, s) in enumerate(zip(objs, sizes)):
        if s < 3000: continue
        keep = lab[o] == i + 1
        f = np.zeros(keep.shape + (4,), np.uint8); f[keep] = a[y0:y1][o][keep]
        out.append((o[1].start, f, o[0].stop))
    out = sorted(out, key=lambda t: t[0])
    ground = max(t[2] for t in out)
    return [(f, ground - st) for _, f, st in out]  # (frame, how far its lowest point is above the row's ground)
walkL, runL = frames(0, ysplit), frames(ysplit, a.shape[0])
walk = [f for f, _ in walkL]; run = [f for f, _ in runL]
lift_walk = [0] * 8; lift_run = [l for _, l in runL]
assert len(walk) == 8 and len(run) == 8, (len(walk), len(run))

# the old game sheet: match her size to the old standing height
old = np.array(Image.open(SHEET))
def fig_h(cell):
    ys = np.where(cell[..., 3].any(1))[0]; return ys.max() - ys.min() + 1
old_idle_h = np.median([fig_h(old[0:ch, c*cw:(c+1)*cw]) for c in range(8)])
new_h = np.median([f.shape[0] for f in walk])
# the new art stands slightly taller in its frame; scale so her height matches the idle frames
SCALE = old_idle_h / new_h
print('scale', round(SCALE, 4), 'old idle h', old_idle_h, 'new walk h', new_h)

def hue_sat(rgb):
    rgb = rgb.astype(float) / 255; mx = rgb.max(-1); mn = rgb.min(-1); d = np.maximum(mx - mn, 1e-6)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, (mx - mn) / np.maximum(mx, 1e-6), mx

def scaled(f):
    arr = f.astype(float); al = arr[..., 3:] / 255
    pre = np.concatenate([arr[..., :3] * al, arr[..., 3:]], -1)
    H, W = f.shape[:2]; sw, sh = max(1, round(W * SCALE)), max(1, round(H * SCALE))
    out = np.stack([np.array(Image.fromarray(np.clip(pre[..., i], 0, 255).astype(np.uint8)).resize((sw, sh), Image.LANCZOS)).astype(float) for i in range(4)], -1)
    al2 = out[..., 3:] / 255
    rgb = np.where(al2 > 0.05, out[..., :3] / np.maximum(al2, 1e-3), 0)
    return np.dstack([np.clip(rgb, 0, 255), np.where(out[..., 3] > 110, 255, 0)]).astype(np.uint8)

# shared palette from the existing sheet keeps colours consistent with every other frame
P = np.unique(old.reshape(-1, 4)[old.reshape(-1, 4)[:, 3] > 0][:, :3], axis=0).astype(np.float32)
def to_palette(img):
    flat = img[..., :3].reshape(-1, 3).astype(np.float32)
    idx = np.concatenate([np.argmin(((flat[i:i+20000, None, :] - P[None]) ** 2).sum(-1), 1) for i in range(0, len(flat), 20000)])
    out = img.copy(); out[..., :3] = P[idx].reshape(img.shape[:2] + (3,)).astype(np.uint8); out[img[..., 3] == 0] = 0
    return out

def cells(fr, lifts):
    sm = [scaled(f) for f in fr]
    anchors = []
    for s in sm:
        h, sat, v = hue_sat(s[..., :3])
        shirt = (s[..., 3] > 0) & (h > 255) & (h < 320) & (sat > 0.25) & (v > 0.3)
        ys, xs = np.where(shirt); ax = xs.mean()
        bottom = np.where(s[..., 3].any(1))[0].max()
        anchors.append((ax, bottom))
    out = []
    for s, (ax, bottom), lift in zip(sm, anchors, lifts):
        c = np.zeros((ch, cw, 4), np.uint8)
        dx = int(round(AX - ax)); dy = G - bottom - int(round(lift * SCALE))  # lowest boot on the ground (run flight frames stay a little lifted)
        H, W = s.shape[:2]
        for y in range(H):
            ty = y + dy
            if 0 <= ty < ch:
                x0 = max(0, dx); x1 = min(cw, W + dx)
                if x1 > x0: 
                    row = s[y, x0 - dx:x1 - dx]; msk = row[:, 3] > 0
                    c[ty, x0:x1][msk] = row[msk]
        out.append(to_palette(c))
    return out, anchors

W_cells, wa = cells(walk, lift_walk)
R_cells, ra = cells(run, lift_run)
print('run lifts (px)', [round(l * SCALE) for l in lift_run])
# run: keep the little "both feet off the ground" lift: use each frame's lowest point relative to the row
sheet = old.copy()
NR = 7
for face in (0, 1):
    for c in range(12):
        for r in (1, 5):
            sheet[(face*NR + r)*ch:(face*NR + r + 1)*ch, c*cw:(c+1)*cw] = 0
    for c in range(8):
        sheet[(face*NR + 1)*ch:(face*NR + 2)*ch, c*cw:(c+1)*cw] = W_cells[c]
        sheet[(face*NR + 5)*ch:(face*NR + 6)*ch, c*cw:(c+1)*cw] = R_cells[c]
Image.fromarray(sheet).save(SHEET, optimize=True)
# stride for the anti-slide setting: distance the planted boot moves back between frames
def boots(cell):
    band = cell[G-6:G+1, :, 3] > 0
    lab, n = ndimage.label(band.any(0)[None, :])
    return [np.where(lab[0] == i)[0].mean() for i in range(1, n + 1)]
print('walk boots', [ [round(x) for x in boots(c)] for c in W_cells])
print('run boots', [ [round(x) for x in boots(c)] for c in R_cells])
