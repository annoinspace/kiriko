// Renders the image through the tile state.
// Intact tiles pass the image straight through. Broken tiles become glass
// cubes: the swipe angle sets the direction light bends, each tile gets a
// slightly different cut (hash jitter), edges bevel and catch light on the
// side the swipe came from, and seams open between the cubes.
//
// input 0 — source image
// input 1 — tile state (r shatter, gb break direction)

uniform vec4 uGrid; // cols, rows
uniform vec4 uHand; // x, y, present — for the cursor ring

out vec4 fragColor;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
    vec2 uv = vUV.st;
    vec2 grid = uGrid.xy;
    vec2 cell = floor(uv * grid);
    vec2 local = fract(uv * grid);

    vec4 st = texture(sTD2DInputs[1], (cell + 0.5) / grid);
    float shatter = st.r;
    vec2 dn = normalize(st.gb + 1e-6);

    vec3 col;
    if (shatter < 0.001) {
        col = texture(sTD2DInputs[0], uv).rgb;
    } else {
        float h = hash(cell);

        // swipe angle sets the bend; every tile is cut a little differently
        float ang = atan(dn.y, dn.x) + (h - 0.5) * 1.1 * shatter;
        vec2 bend = vec2(cos(ang), sin(ang)) * shatter * 0.04 * (0.55 + 0.9 * h);
        // fake facet curvature — light bends more toward the tile edges
        vec2 curve = (local - 0.5) * shatter * 0.035;
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

    // faint ring where TD thinks your hand is
    if (uHand.z > 0.5) {
        vec2 q = (uv - uHand.xy) * vec2(grid.x / grid.y, 1.0);
        float ring = abs(length(q) - 0.035);
        col = mix(col, vec3(1.0), smoothstep(0.006, 0.0, ring) * 0.35);
    }

    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
