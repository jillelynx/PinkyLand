# Builds Jacinta's in-game pixel sprite sheet from the two 8x7 reference sheets.
import json, base64, io, sys
from PIL import Image
import numpy as np
from scipy import ndimage

# run from the project folder:  python3 docs/tools/build_jacinta_sheet.py
SRC = {'friendly': 'docs/art/jacinta_sheet_friendly_source.png', 'determined': 'docs/art/jacinta_sheet_determined_source.png'}
ROWS = [(0,168),(166,326),(322,482),(478,638),(636,800),(798,978),(975,1254)]
CW = 1254/8
SCALE = 0.56          # sheet art (~146 px tall) -> ~82 px tall in the game
AIR = {(6,1),(6,2),(6,3),(6,4),(6,5)}   # frames drawn in mid-air (anchored by their own boots)

def hue_sat(rgb):
    rgb = rgb.astype(float)/255
    mx = rgb.max(-1); mn = rgb.min(-1); d = np.maximum(mx-mn,1e-6)
    r,g,b = rgb[...,0],rgb[...,1],rgb[...,2]
    h = np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    return h,(mx-mn)/np.maximum(mx,1e-6),mx

def frames_of(path):
    a = np.array(Image.open(path).convert('RGBA'))
    m = a[...,3] > 40
    out = {}
    for r,(y0,y1) in enumerate(ROWS):
        lab,n = ndimage.label(ndimage.binary_dilation(m[y0:y1],iterations=2))
        objs = ndimage.find_objects(lab)
        for c in range(8):
            best=None
            for i,o in enumerate(objs):
                cx=(o[1].start+o[1].stop)/2
                if c*CW <= cx < (c+1)*CW:
                    size=(lab[o]==i+1).sum()
                    if size>1500 and (best is None or size>best[1]): best=(i+1,size)
            if not best: continue
            keep = (lab==best[0]) & m[y0:y1]
            ys,xs = np.where(keep)
            f = np.zeros((y1-y0, a.shape[1], 4), np.uint8)
            f[keep] = a[y0:y1][keep]
            out[(r,c)] = dict(img=f, y0=y0, bottom=ys.max()+1, xs=(xs.min(),xs.max()))
    return out

data = {k: frames_of(p) for k,p in SRC.items()}
USE_ROWS = [0,1,2,5,6]   # idle, walk, crouch, run, jump (slide/attack rows have no game mechanic yet)
keys = sorted(k for k in set(data['friendly']) & set(data['determined']) if k[0] in USE_ROWS)
# row ground lines (lowest boot of the grounded frames in each row)
ground = {}
for (r,c) in keys:
    if (r,c) in AIR: continue
    for e in data.values():
        ground[r] = max(ground.get(r,0), e[(r,c)]['bottom'])

# anchor = centre of her purple shirt (x) and the ground under her feet (y)
anch = {}
for e in data.values():
    for k in keys:
        fr = e[k]; f = fr['img']
        h,s,v = hue_sat(f[...,:3])
        shirt = (f[...,3]>128)&(h>255)&(h<320)&(s>0.25)&(v>0.3)
        ys,xs = np.where(shirt)
        ax = xs.mean() if len(xs) else (fr['xs'][0]+fr['xs'][1])/2
        ay = fr['bottom'] if k in AIR else ground[k[0]]
        fr['anchor'] = (ax, ay)

# scale every frame, crop around its anchor into one common cell size
def scaled(f):
    im = Image.fromarray(f)
    # premultiply so edges don't pick up dark fringes
    arr = np.array(im).astype(float); al = arr[...,3:]/255
    pre = np.concatenate([arr[...,:3]*al, arr[...,3:]],-1)
    W,H = im.size
    sw,sh = round(W*SCALE), round(H*SCALE)
    out = np.stack([np.array(Image.fromarray(pre[...,i].astype(np.uint8) if i==3 else np.clip(pre[...,i],0,255).astype(np.uint8)).resize((sw,sh),Image.LANCZOS)).astype(float) for i in range(4)],-1)
    al2 = out[...,3:]/255
    rgb = np.where(al2>0.05, out[...,:3]/np.maximum(al2,1e-3), 0)
    alpha = np.where(out[...,3]>110, 255, 0)
    return np.dstack([np.clip(rgb,0,255), alpha]).astype(np.uint8)

small = {}
L=T=R=B=0
for name,e in data.items():
    for k in keys:
        fr=e[k]
        s = scaled(fr['img'])
        ax,ay = fr['anchor'][0]*SCALE, (fr['anchor'][1])*SCALE
        ys,xs = np.where(s[...,3]>0)
        L=min(L, xs.min()-ax); R=max(R, xs.max()+1-ax); T=min(T, ys.min()-ay); B=max(B, ys.max()+1-ay)
        small[(name,k)] = (s, ax, ay)
cellW = int(np.ceil(R) - np.floor(L)) + 2; cellH = int(np.ceil(B) - np.floor(T)) + 2
AX = int(-np.floor(L)) + 1; AY = int(-np.floor(T)) + 1
print('cell', cellW, cellH, 'anchor', AX, AY, file=sys.stderr)

# shared palette for every frame (keeps colours consistent)
names = ['friendly','determined']
sheet = Image.new('RGBA', (cellW*8, cellH*len(USE_ROWS)*2), (0,0,0,0))
for ni,name in enumerate(names):
    for (r,c) in keys:
        s,ax,ay = small[(name,(r,c))]
        cell = Image.new('RGBA',(cellW,cellH),(0,0,0,0))
        cell.alpha_composite(Image.fromarray(s), (int(round(AX-ax)), int(round(AY-ay))))
        sheet.alpha_composite(cell, (c*cellW, (ni*len(USE_ROWS)+USE_ROWS.index(r))*cellH))
arr = np.array(sheet)
alpha = arr[...,3]
# k-means palette (opaque pixels only) so small colour areas like the purple shirt keep their own colours
from scipy.cluster.vq import kmeans2
op = arr[alpha>0][:, :3].astype(float)
rs = np.random.default_rng(1)
samp = op[rs.choice(len(op), min(40000, len(op)), replace=False)]
cent, _ = kmeans2(samp, 80, minit='++', seed=1, iter=25)
flat = arr[...,:3].reshape(-1,3).astype(float)
idx = np.argmin(((flat[:,None,:]-cent[None,:,:])**2).sum(-1), axis=1)
rgbimg = Image.fromarray(np.clip(cent[idx],0,255).reshape(arr.shape[0],arr.shape[1],3).astype(np.uint8))
print('palette colours', len(cent), file=sys.stderr)
q = np.dstack([np.array(rgbimg), alpha]).astype(np.uint8)
q[alpha==0] = 0
final = Image.fromarray(q,'RGBA')
final.save('assets/jacinta/jacinta_sheet.png', optimize=True)
meta = dict(cellW=cellW, cellH=cellH, anchorX=AX, anchorY=AY, cols=8, rows=['idle','walk','crouch','run','jump'], faces=names)
json.dump(meta, open('assets/jacinta/jacinta_sheet.json','w'))
print(json.dumps(meta))
