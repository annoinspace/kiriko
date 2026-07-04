# Builds the whole kiriko network from scratch, then saves td/kiriko.toe.
#
# Run from the TouchDesigner textport (Alt+T):
#
#   REPO = '/path/to/kiriko'; exec(open(REPO + '/td/build.py').read())
#
# Safe to re-run: it destroys and rebuilds the /kiriko container each time.
# Shader and callback DATs sync to the files in this repo, so you can edit
# td/shaders/*.frag on disk and TD picks the change up live.

import os
import glob

try:
    REPO
except NameError:
    REPO = os.path.expanduser('~/kiriko')

SHADERS = os.path.join(REPO, 'td', 'shaders')
SHORT = 28  # tiles across the image's shorter side; the long side follows aspect

if op('/kiriko'):
    op('/kiriko').destroy()
c = root.create(baseCOMP, 'kiriko')
c.nodeX, c.nodeY = 0, 0

# --- source image -----------------------------------------------------------
src = c.create(moviefileinTOP, 'source')
src.nodeX, src.nodeY = -600, 200
imgs = sorted(
    f for e in ('jpg', 'jpeg', 'png', 'tif', 'tiff', 'exr')
    for f in glob.glob(os.path.join(REPO, 'assets', '*.' + e))
)
if imgs:
    src.par.file = imgs[0]
    print('kiriko: using image', imgs[0])
else:
    print('kiriko: no image in assets/, using the TD default — drop one in and rerun')
src.cook(force=True)
w, h = max(src.width, 1), max(src.height, 1)
if w <= h:
    COLS = SHORT
    ROWS = max(4, round(SHORT * h / w))
else:
    ROWS = SHORT
    COLS = max(4, round(SHORT * w / h))

# --- hand data in -----------------------------------------------------------
hand = c.create(constantCHOP, 'hand')
hand.nodeX, hand.nodeY = -600, -100
for i, (name, val) in enumerate([
    ('x', 0.5), ('y', 0.5), ('vx', 0), ('vy', 0), ('speed', 0), ('present', 0),
]):
    # Constant CHOP pars were renamed name0/value0 -> const0name/const0value
    # in newer TD builds; handle both.
    for npar, vpar in (('name%d' % i, 'value%d' % i),
                       ('const%dname' % i, 'const%dvalue' % i)):
        if getattr(hand.par, npar, None) is not None:
            setattr(hand.par, npar, name)
            setattr(hand.par, vpar, val)
            break

cb = c.create(textDAT, 'webserver1_callbacks')
cb.nodeX, cb.nodeY = -800, -100
cb.par.file = os.path.join(REPO, 'td', 'webserver_callbacks.py')
cb.par.syncfile = True

ws = c.create(webserverDAT, 'webserver1')
ws.nodeX, ws.nodeY = -800, -250
ws.par.port = 9980
ws.par.callbacks = 'webserver1_callbacks'
ws.par.active = True

# --- tile state feedback loop ------------------------------------------------
def shader_dat(name, filename):
    t = c.create(textDAT, name)
    t.par.file = os.path.join(SHADERS, filename)
    t.par.syncfile = True
    return t

state_code = shader_dat('state_frag', 'state.frag')
state_code.nodeX, state_code.nodeY = -400, -250
refract_code = shader_dat('refract_frag', 'refract.frag')
refract_code.nodeX, refract_code.nodeY = -100, -250

def grid_res(top):
    top.par.outputresolution = 'custom'
    top.par.resolutionw = COLS
    top.par.resolutionh = ROWS
    top.par.format = 'rgba32float'

seed = c.create(constantTOP, 'seed')  # black = everything intact
seed.nodeX, seed.nodeY = -600, 0
seed.par.colorr = seed.par.colorg = seed.par.colorb = 0
grid_res(seed)

fb = c.create(feedbackTOP, 'feedback1')
fb.nodeX, fb.nodeY = -400, 0
fb.inputConnectors[0].connect(seed)
fb.par.top = 'state_out'

state = c.create(glslTOP, 'state')
state.nodeX, state.nodeY = -250, 0
grid_res(state)
state.par.pixeldat = 'state_frag'
state.inputConnectors[0].connect(fb)
state.par.uniname0 = 'uHand'
state.par.value0x.expr = "op('hand')['x']"
state.par.value0y.expr = "op('hand')['y']"
state.par.value0z.expr = "op('hand')['vx']"
state.par.value0w.expr = "op('hand')['vy']"
state.par.uniname1 = 'uInfo'
state.par.value1x.expr = "op('hand')['speed']"
state.par.value1y.expr = "op('hand')['present']"
state.par.value1z.expr = 'absTime.seconds'  # keeps the loop cooking every frame
state.par.value1w = COLS / ROWS

state_out = c.create(nullTOP, 'state_out')
state_out.nodeX, state_out.nodeY = -100, 0
state_out.inputConnectors[0].connect(state)

# --- render ------------------------------------------------------------------
refract = c.create(glslTOP, 'refract')
refract.nodeX, refract.nodeY = 100, 150
refract.par.pixeldat = 'refract_frag'
refract.inputConnectors[0].connect(src)
refract.inputConnectors[1].connect(state_out)
refract.par.uniname0 = 'uGrid'
refract.par.value0x = COLS
refract.par.value0y = ROWS
refract.par.uniname1 = 'uHand'
refract.par.value1x.expr = "op('hand')['x']"
refract.par.value1y.expr = "op('hand')['y']"
refract.par.value1z.expr = "op('hand')['present']"

out = c.create(nullTOP, 'OUT')
out.nodeX, out.nodeY = 300, 150
out.inputConnectors[0].connect(refract)
out.viewer = True

project.save(os.path.join(REPO, 'td', 'kiriko.toe'))
print('kiriko: built %dx%d tile grid, listening on ws://127.0.0.1:9980' % (COLS, ROWS))
print('kiriko: saved td/kiriko.toe — open that directly next time')
