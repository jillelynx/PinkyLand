# Combine one frame's upper body with another frame's legs, joined inside the shorts.
import numpy as np
from PIL import Image
import json
META=json.load(open('/tmp/claude-0/sheet/meta.json')); cw,ch=META['cellW'],META['cellH']; NR=len(META['rows'])
A=np.array(Image.open('/tmp/claude-0/sheet/aligned.png')).astype(np.uint8)
ROW={n:i for i,n in enumerate(META['rows'])}
def cell(face,name,c): r=face*NR+ROW[name]; return A[r*ch:(r+1)*ch, c*cw:(c+1)*cw].copy()
def masks(c):
    rgb=c[...,:3].astype(int); a=c[...,3]>0
    r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
    mx=rgb.max(-1); mn=rgb.min(-1); s=(mx-mn)/np.maximum(mx,1)
    olive=a&(g>=b+20)&(r>=b+15)&(abs(r-g)<45)&(s>0.3)&(mx>60)&(mx<190)
    cape=a&(b>r+25)&(b>g)
    return olive,cape
from scipy import ndimage
def shorts_info(c):
    olive,_=masks(c)
    olive=ndimage.binary_closing(olive,iterations=1)
    lab,n=ndimage.label(olive); sizes=ndimage.sum(olive,lab,range(1,n+1)); olive=lab==(np.argmax(sizes)+1)
    ys,xs=np.where(olive)
    top,bot=ys.min(),ys.max()
    counts=olive.sum(1); mid=int(np.argmax(counts))
    row=np.where(olive[mid])[0]
    return top,bot,(row.min()+row.max())/2
def compose(upper,legs,cut_from_bottom=5):
    ut,ub,ux=shorts_info(upper); lt,lb,lx=shorts_info(legs)
    cut=min(ub,lb)-cut_from_bottom
    dx=int(round(ux-lx))
    out=np.zeros_like(upper)
    L=np.roll(legs,dx,axis=1)
    out[cut:]=L[cut:]
    _,cape=masks(upper)
    up=upper.copy(); up[cut:][~cape[cut:]]=0
    m=up[...,3]>0; out[m]=up[m]
    return out

# ---------------------------------------------------------------- leg swapping
PAL=None
def palette():
    global PAL
    if PAL is None:
        a=A.reshape(-1,4); PAL=np.unique(a[a[:,3]>0][:,:3],axis=0).astype(float)
    return PAL
def snap(rgb):
    P=palette(); flat=rgb.reshape(-1,3).astype(float)
    idx=np.argmin(((flat[:,None,:]-P[None,:,:])**2).sum(-1),axis=1)
    return P[idx].reshape(rgb.shape).astype(np.uint8)
def lum(rgb): return rgb[...,0]*0.3+rgb[...,1]*0.59+rgb[...,2]*0.11
def legs_split(c):
    """the two legs below the shorts as separate pieces: (front, back) masks"""
    ut,ub,ux=shorts_info(c)
    _,cape=masks(c)
    a=c[...,3]>0
    ys=np.arange(ch)[:,None]
    region=a&~cape&(ys>=ub-3)
    for start in (ub+2,ub+5,ub+8,ub+11):
        seed=a&~cape&(ys>=start)
        lab,n=ndimage.label(seed)
        if n<2: continue
        sizes=ndimage.sum(seed,lab,range(1,n+1))
        order=np.argsort(sizes)[::-1][:2]
        if sizes[order[1]]<25: continue
        s1=lab==(order[0]+1); s2=lab==(order[1]+1)
        # grow each leg upward into the cuffs: every leg pixel joins the nearer seed
        d1=ndimage.distance_transform_edt(~s1); d2=ndimage.distance_transform_edt(~s2)
        m1=region&(d1<=d2); m2=region&(d2<d1)
        cx1=np.where(s1)[1].mean(); cx2=np.where(s2)[1].mean()
        return (m1,m2) if cx1>cx2 else (m2,m1)
    return None

def swap_lead(c,dark=0.8):
    s=legs_split(c)
    if s is None: return c.copy()
    front,back=s
    out=c.copy(); rgb=out[...,:3].astype(float)
    rgb[front]*=dark
    rgb[back]=np.minimum(255,rgb[back]/dark)
    newc=np.clip(rgb,0,255).astype(np.uint8)
    m=front|back
    out[...,:3][m]=newc[m]
    return out
