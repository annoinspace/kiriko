# Callbacks for the Web Server DAT. The tracker page streams hand messages
# here; we fan them out into the `hand` Constant CHOP, which the GLSL TOPs
# read through parameter expressions. 'nav' messages (one-hand fast rip)
# cycle through the images in assets/.

import glob
import json
import os

IMG_EXTS = ('jpg', 'jpeg', 'png', 'tif', 'tiff', 'exr')


def _set_image(path):
    # Point the source at a new image and refit the tile grid to its aspect
    # (mirrors the grid logic in build.py), then start from fresh glass.
    src = op('source')
    src.par.file = path
    src.cook(force=True)
    w, h = max(src.width, 1), max(src.height, 1)
    short = 28
    if w <= h:
        cols, rows = short, max(4, round(short * h / w))
    else:
        cols, rows = max(4, round(short * w / h)), short
    for name in ('seed', 'state'):
        o = op(name)
        o.par.resolutionw = cols
        o.par.resolutionh = rows
    op('state').par.value1w = cols / rows
    op('refract').par.value0x = cols
    op('refract').par.value0y = rows
    op('feedback1').par.resetpulse.pulse()


def _nav(step):
    src = op('source')
    cur = src.par.file.eval()
    folder = os.path.dirname(cur)
    imgs = sorted(
        f for e in IMG_EXTS
        for f in glob.glob(os.path.join(folder, '*.' + e))
    )
    if not imgs:
        return
    i = imgs.index(cur) if cur in imgs else -step  # unknown current -> first
    _set_image(imgs[(i + step) % len(imgs)])


def _set(h, i, v):
    # Constant CHOP value pars are value0.. in older TD builds,
    # const0value.. in newer ones.
    for pname in ('value%d' % i, 'const%dvalue' % i):
        p = getattr(h.par, pname, None)
        if p is not None:
            p.val = v
            return


def onWebSocketReceiveText(webServerDAT, client, data):
    try:
        msg = json.loads(data)
    except ValueError:
        return
    kind = msg.get('type')
    if kind == 'hand':
        h = op('hand')
        _set(h, 0, msg.get('x', 0.5))
        _set(h, 1, msg.get('y', 0.5))
        _set(h, 2, msg.get('vx', 0))
        _set(h, 3, msg.get('vy', 0))
        _set(h, 4, msg.get('speed', 0))
        _set(h, 5, float(msg.get('present') or 0))  # eased 0..1, not a bool
        _set(h, 6, msg.get('spread', 0))
        # five fingertips (thumb..pinky) into t0x, t0y .. t4x, t4y
        for i, tip in enumerate((msg.get('tips') or [])[:5]):
            _set(h, 7 + 2 * i, tip[0])
            _set(h, 8 + 2 * i, tip[1])
        # second (exposure) hand into h2x, h2y, h2vy, h2p
        h2 = msg.get('hand2') or {}
        _set(h, 17, h2.get('x', 0.5))
        _set(h, 18, h2.get('y', 0.5))
        _set(h, 19, h2.get('vy', 0))
        _set(h, 20, float(h2.get('present') or 0))  # eased 0..1, not a bool
    elif kind == 'nav':
        _nav(1 if msg.get('dir', 1) >= 0 else -1)
    elif kind == 'reset':
        op('feedback1').par.resetpulse.pulse()
    return


def onHTTPRequest(webServerDAT, request, response):
    # Lets you sanity-check the bridge at http://127.0.0.1:9980
    response['statusCode'] = 200
    response['statusReason'] = 'OK'
    response['data'] = 'kiriko bridge is up'
    return response
