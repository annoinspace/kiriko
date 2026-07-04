// Renders the image through the tile state.
// Intact tiles pass the image straight through. Broken tiles become glass
// cubes: the swipe angle sets the direction light bends, each tile gets a
// slightly different cut (hash jitter), edges bevel and catch light on the
// side the swipe came from, and seams open between the cubes.
// Tiles broken with spread fingers (high size channel) merge into bigger
// 2x2 / 4x4 blocks, aligned to the base grid so the levels nest cleanly.
//
// input 0 — source image
// input 1 — tile state (r shatter, gb break direction, a block size)

uniform vec4 uGrid;  // cols, rows
uniform vec4 uHand;  // palm x, y, present — for the cursor rings
uniform vec4 uTipsA; // thumb.xy, index.xy
uniform vec4 uTipsB; // middle.xy, ring.xy
uniform vec4 uTipsC; // pinky.xy, spread, unused

out vec4 fragColor;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float ringAt(vec2 uv, vec2 p, float r, float aspect) {
    vec2 q = (uv - p) * vec2(aspect, 1.0);
    return smoothstep(0.005, 0.0, abs(length(q) - r));
}

void main() {
    vec2 uv = vUV.st;
    vec2 grid = uGrid.xy;

    // Pick the block level. Sample the state at the centers of the 4x4 and
    // 2x2 blocks this pixel falls in; a broken tile with enough stored size
    // promotes the whole aligned block to one big cube.
    float level = 1.0;
    vec4 st4 = texture(sTD2DInputs[1], (floor(uv * grid / 4.0) + 0.5) * 4.0 / grid);
    vec4 st2 = texture(sTD2DInputs[1], (floor(uv * grid / 2.0) + 0.5) * 2.0 / grid);
    if      (st4.r > 0.001 && st4.a > 0.6) level = 4.0;
    else if (st2.r > 0.001 && st2.a > 0.3) level = 2.0;

    vec2 cell = floor(uv * grid / level);
    vec2 local = fract(uv * grid / level);
    vec4 st = texture(sTD2DInputs[1], (cell + 0.5) * level / grid);
    float shatter = st.r;
    vec2 dn = normalize(st.gb + 1e-6);

    vec3 col;
    if (shatter < 0.001) {
        col = texture(sTD2DInputs[0], uv).rgb;
    } else {
        float h = hash(cell + level * 7.31);

        // swipe angle sets the bend; every tile is cut a little differently,
        // and bigger blocks bend a little harder
        float ang = atan(dn.y, dn.x) + (h - 0.5) * 1.1 * shatter;
        vec2 bend = vec2(cos(ang), sin(ang)) * shatter * 0.04 * (0.55 + 0.9 * h)
                  * (0.8 + 0.2 * level);
        // fake facet curvature — light bends more toward the tile edges
        vec2 curve = (local - 0.5) * shatter * 0.035 * level;
        vec2 p = uv + bend + curve;

        // chromatic split along the swipe direction
        float ca = shatter * 0.010 * (0.5 + h);
        col.r = texture(sTD2DInputs[0], p + dn * ca).r;
        col.g = texture(sTD2DInputs[0], p).g;
        col.b = texture(sTD2DInputs[0], p - dn * ca).b;

        // beveled edges, lit from the direction the swipe came from
        float bx = min(local.x, 1.0 - local.x);
        float by = min(local.y, 1.0 - local.y);
        float edge = smoothstep(0.14, 0.0, min(bx, by));
        vec2 en = bx < by ? vec2(local.x < 0.5 ? -1.0 : 1.0, 0.0)
                          : vec2(0.0, local.y < 0.5 ? -1.0 : 1.0);
        col *= 1.0 + edge * shatter * (0.30 * dot(en, dn) + 0.10);

        // seams open up between the cubes
        float seam = smoothstep(0.045, 0.0, min(bx, by));
        col *= 1.0 - seam * shatter * 0.55;
    }

    // faint rings where TD thinks your hand is: palm plus five fingertips
    if (uHand.z > 0.5) {
        float aspect = grid.x / grid.y;
        float ring = ringAt(uv, uHand.xy, 0.035, aspect);
        ring = max(ring, ringAt(uv, uTipsA.xy, 0.012, aspect));
        ring = max(ring, ringAt(uv, uTipsA.zw, 0.012, aspect));
        ring = max(ring, ringAt(uv, uTipsB.xy, 0.012, aspect));
        ring = max(ring, ringAt(uv, uTipsB.zw, 0.012, aspect));
        ring = max(ring, ringAt(uv, uTipsC.xy, 0.012, aspect));
        col = mix(col, vec3(1.0), ring * 0.35);
    }

    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
