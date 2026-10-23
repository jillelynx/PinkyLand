# Step 4: assemble the final game sheet (12 columns) with alternating-leg walk and run cycles.
import sys, json
sys.path.insert(0, sys.argv[1])
from compose import *
COLS=12
rows=[]
for f in (0,1):
    I=[cell(f,'idle',k) for k in range(8)]
    W=lambda k:cell(f,'walk',k); R=lambda k:cell(f,'run',k)
    PW=compose(W(5),R(7)); PR=compose(R(5),R(7))
    walk=[W(3),W(5),PW,swap_lead(W(1)),swap_lead(W(3)),swap_lead(W(5)),swap_lead(PW),W(1)]
    run=[R(5),PR,swap_lead(R(1)),swap_lead(R(2)),swap_lead(R(3)),swap_lead(R(4)),swap_lead(R(5)),swap_lead(PR),R(1),R(2),R(3),R(4)]
    crouch=[cell(f,'crouch',k) for k in range(8)]
    slide=[cell(f,'slide',k) for k in range(8)]
    attack=[cell(f,'attack',k) for k in range(8)]
    jump=[cell(f,'jump',k) for k in range(8)]
    rows += [I,walk,crouch,slide,attack,run,jump]
sheet=np.zeros((ch*len(rows), cw*COLS, 4), np.uint8)
for r,fr in enumerate(rows):
    for c,img in enumerate(fr): sheet[r*ch:(r+1)*ch, c*cw:(c+1)*cw]=img
Image.fromarray(sheet).save(sys.argv[2], optimize=True)
print('ok', sheet.shape)
