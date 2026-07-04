// Per-tile shatter state, one texel per tile, held in a feedback loop.
//   r  — shatter amount, 0 (intact) .. 1 (fully broken)
//   gb — unit vector of the swipe that broke the tile (signed, so the
//        texture must be 32-bit float)
//
// A swipe over intact tiles breaks them and records its direction.
// A swipe roughly opposing the stored direction heals the tile back.
// Near-perpendicular swipes leave a broken tile alone.

uniform vec4 uHand; // x, y, vx, vy — palm in uv space, v up
uniform vec4 uInfo; // speed, present, time (forces per-frame cook), aspect

out vec4 fragColor;

void main() {
    vec4 prev = texture(sTD2DInputs[0], vUV.st);
    float shatter = prev.r;
    vec2 stored = prev.gb;

    // aspect-corrected distance so the hand's reach is a circle, not an oval
    vec2 toHand = (uHand.xy - vUV.st) * vec2(uInfo.w, 1.0);
    float reach = smoothstep(0.16, 0.05, length(toHand)) * uInfo.y;

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
            }
        } else {
            shatter += k;                              // fresh break
            stored = dir;
        }
    }

    shatter = clamp(shatter, 0.0, 1.0);
    if (shatter < 0.002) { shatter = 0.0; stored = vec2(0.0); }

    fragColor = TDOutputSwizzle(vec4(shatter, stored, 1.0));
}
