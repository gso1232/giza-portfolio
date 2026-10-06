"""Every visible thing in the desk photo, placed in the fitted world -> src/desk/layout2.json"""
import json, runpy
import numpy as np
g = runpy.run_path('tools/desk2-probe.py', run_name='probe')
on_y, on_z, height_at = g['on_y'], g['on_z'], g['height_at']
fit = json.load(open('src/desk/fit2.json'))
r = lambda v: [round(float(x), 2) for x in v]
L = {'fit': fit}
wall = {'print': [(102, 15), (270, 162)], 'torn': [(285, 12), (342, 112)], 'flowers': [(350, 20), (435, 90)], 'portrait': [(357, 92), (425, 160)],
        'clipping': [(450, 20), (520, 145)], 'pink': [(285, 161), (334, 217)], 'blue': [(342, 167), (391, 222)], 'orange': [(398, 171), (450, 227)]}
L['wall'] = {}
for k, (a, b) in wall.items():
    p, q = on_z(a, 0), on_z(b, 0)
    L['wall'][k] = {'x': r([p[0], q[0]]), 'y': r([q[1], p[1]])}
pts = {'notebookRF': ((105, 462), 1.4), 'notebookRB': ((100, 407), 1.4), 'phoneFL': ((25, 455), 2.2), 'phoneFR': ((88, 457), 2.2), 'phoneBR': ((100, 416), 2.2), 'phoneBL': ((38, 414), 2.2),
       'pensTop': ((12, 410), 2), 'pensBottom': ((12, 445), 2), 'jarFront': ((405, 445), 0), 'booksRFront': ((375, 447), 0), 'coaster': ((405, 522), 0),
       'smallFrameFoot': ((450, 468), 0), 'bigFrameFootL': ((420, 468), 0), 'zzPotFront': ((65, 402), 0), 'leftPotFront': ((15, 395), 0), 'booksLFront': ((112, 400), 0),
       'chairTop150': ((150, 572), 5), 'chairTop300': ((300, 575), 5), 'throw': ((30, 600), -5), 'wireBasket': ((435, 720), -57)}
L['desk'] = {k: r(on_y(px, h)) for k, (px, h) in pts.items()}
tops = {'whitePrintTL': ((322, 235), 2), 'whitePrintTR': ((400, 238), 2), 'bigFrameTL': ((420, 230), 2), 'zzTop': ((70, 150), 4), 'jarLeavesTop': ((400, 230), 6), 'basketTop': ((126, 286), 6)}
L['tops'] = {k: r(on_z(px, z)) for k, (px, z) in tops.items()}
json.dump(L, open('src/desk/layout2.json', 'w'), indent=1)
for k, v in L['wall'].items(): print('wall', k, v)
for k, v in L['desk'].items(): print('desk', k, v)
for k, v in L['tops'].items(): print('top ', k, v)
print('laptop', fit['laptop']['backLeft'], 'camera', fit['camera'])
