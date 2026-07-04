// Per-tile state, one texel per tile, held in a feedback loop.
//   r — shatter amount, 0 (intact) .. 1 (fully broken)
//   g — break angle in radians: direction of the swipe that broke the tile
//   b — exposure offset, -1 .. 1, painted by the second hand (dodge & burn)
//   a — block size, 0 .. 1: finger spread when the tile broke; the render
//       shader merges high-size tiles into bigger cubes
// (signed values throughout, so the texture must be 32-bit float)
//
// Break hand: a swipe over intact tiles breaks them and records its
// direction; an opposing swipe heals; near-perpendicular leaves them alone.
// The palm is one wide contact blob (wider when fingers spread) and each
// fingertip is its own small one.
// Exposure hand: hover and raise to brighten the tiles underneath, lower
// to darken. Exposure survives healing — light stays painted.

uniform vec4 uHand;  // break palm x, y, vx, vy — uv space, v up
uniform vec4 uInfo;  // speed, present, time (forces per-frame cook), aspect
uniform vec4 uTipsA; // thumb.xy, index.xy
uniform vec4 uTipsB; // middle.xy, ring.xy
uniform vec4 uTipsC; // pinky.xy, spread, unused
uniform vec4 uHand2; // exposure palm x, y, vy, present

out vec4 fragColor;

// aspect-corrected falloff so a contact's reach is a circle, not an oval
float reachAt(vec2 p, float r) {
    vec2 d = (p - vUV.st) * vec2(uInfo.w, 1.0);
    return smoothstep(r, r * 0.3, length(d));
}

void main() {
    vec4 prev = texture(sTD2DInputs[0], vUV.st);
    float shatter = prev.r;
    float angle = prev.g;
    float exposure = prev.b;
    float size = prev.a;

    // --- break hand ---------------------------------------------------------
    float spread = uTipsC.z;
    float reach = reachAt(uHand.xy, 0.13 * (1.0 + 0.6 * spread));
    reach = max(reach, reachAt(uTipsA.xy, 0.055));
    reach = max(reach, reachAt(uTipsA.zw, 0.055));
    reach = max(reach, reachAt(uTipsB.xy, 0.055));
    reach = max(reach, reachAt(uTipsB.zw, 0.055));
    reach = max(reach, reachAt(uTipsC.xy, 0.055));
    reach *= uInfo.y;

    float speed = uInfo.x;
    if (speed > 0.3 && reach > 0.0) {
        vec2 dir = normalize(uHand.zw);
        vec2 stored = vec2(cos(angle), sin(angle));
        float k = reach * min(speed, 3.0) * 0.09;
        if (shatter > 0.03) {
            float align = dot(dir, stored);
            if (align < -0.25) {
                shatter -= k * 2.0;                    // opposite swipe heals
                if (shatter < 0.2) shatter = 0.0;      // finish the heal cleanly
            } else if (align > 0.25) {
                shatter += k;                          // same direction deepens
                vec2 nd = normalize(mix(stored, dir, 0.2));
                angle = atan(nd.y, nd.x);
                size = max(size, spread * reach);
            }
        } else {
            // one decisive pass breaks the tile outright and it stays broken
            shatter = max(shatter, 0.45 * reach + k);
            angle = atan(dir.y, dir.x);
            size = max(size, spread * reach);
        }
    }

    // --- exposure hand ------------------------------------------------------
    float reach2 = reachAt(uHand2.xy, 0.11) * uHand2.w;
    if (reach2 > 0.0 && abs(uHand2.z) > 0.15) {
        exposure = clamp(exposure + uHand2.z * reach2 * 0.04, -1.0, 1.0);
    }

    shatter = clamp(shatter, 0.0, 1.0);
    if (shatter < 0.002) { shatter = 0.0; angle = 0.0; size = 0.0; }

    fragColor = TDOutputSwizzle(vec4(shatter, angle, exposure, size));
}
