# Step 2: re-seat every frame on the ground and line the determined face up with the friendly face.
import numpy as np
from PIL import Image
import json
M=json.load(open('/tmp/claude-0/sheet/meta.json')); cw,ch=M['cellW'],M['cellH']; G=M['anchorY']-1   # lowest boot pixel row when standing on the ground
ROWS=M['rows']; NR=len(ROWS)
AIR_JUMP={1,2,3,4,5}
src=np.array(Image.open('/tmp/claude-0/sheet/jacinta_sheet.png'))
out=np.zeros_like(src)
def cell(a,r,c): return a[r*ch:(r+1)*ch, c*cw:(c+1)*cw]
def shift(img,dx,dy):
    o=np.zeros_like(img); h,w=img.shape[:2]
    ys0,ys1=max(0,dy),min(h,h+dy); xs0,xs1=max(0,dx),min(w,w+dx)
    o[ys0:ys1,xs0:xs1]=img[ys0-dy:ys1-dy, xs0-dx:xs1-dx]; return o
def bottom(img):
    ys=np.where(img[...,3].any(1))[0]; return ys.max()
for face in (0,1):
    for ri,name in enumerate(ROWS):
        r=face*NR+ri
        frames=[cell(src,r,c).copy() for c in range(8)]
        if name=='jump':
            for c in range(8):
                frames[c]=shift(frames[c],0,G-bottom(frames[c]))
        elif name=='run':
            # flight frames stay lifted: shift the whole row so its lowest foot touches
            d=G-max(bottom(f) for f in frames)
            frames=[shift(f,0,d) for f in frames]
        else:
            frames=[shift(f,0,G-bottom(f)) for f in frames]
        for c in range(8): out[r*ch:(r+1)*ch, c*cw:(c+1)*cw]=frames[c]
# register the determined frames onto the friendly ones (best overlap of the body outline)
for ri in range(NR):
    for c in range(8):
        a=cell(out,ri,c)[...,3]>0; b=cell(out,NR+ri,c)
        best=(-1,0,0)
        for dy in range(-3,4):
            for dx in range(-3,4):
                s=(shift(b,dx,dy)[...,3]>0)
                sc=(s&a).sum()-(s^a).sum()*0.5
                if sc>best[0]: best=(sc,dx,dy)
        best=(best[0],best[1],0)  # only slide sideways: feet stay on the ground
        out[(NR+ri)*ch:(NR+ri+1)*ch, c*cw:(c+1)*cw]=shift(b,best[1],best[2])
# the run row: give each determined frame the same foot height as its friendly twin
for c in range(8):
    RR=ROWS.index('run')
    bf=bottom(cell(out,RR,c)); bd=bottom(cell(out,NR+RR,c))
    out[(NR+RR)*ch:(NR+RR+1)*ch, c*cw:(c+1)*cw]=shift(cell(out,NR+RR,c).copy(),0,bf-bd)
Image.fromarray(out).save('/tmp/claude-0/sheet/aligned.png')
print('ok')
