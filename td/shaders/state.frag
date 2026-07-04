// Per-tile shatter state, one texel per tile, held in a feedback loop.
//   r  — shatter amount, 0 (intact) .. 1 (fully broken)
//   gb — unit vector of the swipe that broke the tile (signed, so the
//        texture must be 32-bit float)
//   a  — block size, 0 .. 1: how spread the fingers were when the tile
//        broke; the render shader merges high-size tiles into bigger cubes
//
// A swipe over intact tiles breaks them and records its direction.
// A swipe roughly opposing the stored direction heals the tile back.
// Near-perpendicular swipes leave a broken tile alone.
// The palm is one wide contact blob (wider when fingers spread) and each
// fingertip is its own small one.

uniform vec4 uHand;  // palm x, y, vx, vy — uv space, v up
uniform vec4 uInfo;  // speed, present, time (forces per-frame cook), aspect
uniform vec4 uTipsA; // thumb.xy, index.xy
uniform vec4 uTipsB; // middle.xy, ring.xy
uniform vec4 uTipsC; // pinky.xy, spread, unused

out vec4 fragColor;

// aspect-corrected falloff so a contact's reach is a circle, not an oval
float reachAt(vec2 p, float r) {
    vec2 d = (p - vUV.st) * vec2(uInfo.w, 1.0);
    return smoothstep(r, r * 0.3, length(d));
}

void main() {
    vec4 prev = texture(sTD2DInputs[0], vUV.st);
    float shatter = prev.r;
    vec2 stored = prev.gb;
    float size = prev.a;

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
        float k = reach * min(speed, 3.0) * 0.055;
        if (shatter > 0.03) {
            float align = dot(dir, normalize(stored));
            if (align < -0.25) {
                shatter -= k * 1.5;                    // opposite swipe heals
            } else if (align > 0.25) {
                shatter += k;                          // same direction deepens
                stored = normalize(mix(stored, dir, 0.2));
                size = max(size, spread * reach);
            }
        } else {
            shatter += k;                              // fresh break
            stored = dir;
            size = max(size, spread * reach);
        }
    }

    shatter = clamp(shatter, 0.0, 1.0);
    if (shatter < 0.002) { shatter = 0.0; stored = vec2(0.0); size = 0.0; }

    fragColor = TDOutputSwizzle(vec4(shatter, stored, size));
}
