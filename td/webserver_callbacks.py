# Callbacks for the Web Server DAT. The tracker page streams hand messages
# here; we fan them out into the `hand` Constant CHOP, which the GLSL TOPs
# read through parameter expressions.

import json


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
        _set(h, 5, 1 if msg.get('present') else 0)
    elif kind == 'reset':
        op('feedback1').par.resetpulse.pulse()
    return


def onHTTPRequest(webServerDAT, request, response):
    # Lets you sanity-check the bridge at http://127.0.0.1:9980
    response['statusCode'] = 200
    response['statusReason'] = 'OK'
    response['data'] = 'kiriko bridge is up'
    return response
