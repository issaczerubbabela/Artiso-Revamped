// Fixed pipeline order (docs/architecture/03-image-processing-filters.md):
// brightness -> contrast -> saturation -> at most one structural filter.
// See filter-ids.ts for why the full Phase 3 filter suite is implemented as
// branches in this one shader rather than a dynamically composed chain.
export const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
uniform vec2 u_size;
uniform vec2 u_scale;
uniform vec2 u_offset;
out vec2 v_texCoord;

void main() {
  vec2 imagePos = a_position * u_size;
  vec2 clip = imagePos * u_scale + u_offset;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_texCoord = a_position;
}
`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform int u_filterId;
uniform float u_param1;
out vec4 outColor;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);

vec3 applyTonal(vec3 color, float brightness, float contrast) {
  vec3 c = color + brightness / 100.0;
  c = (c - 0.5) * (1.0 + contrast / 100.0) + 0.5;
  return c;
}

float luma(vec3 color) {
  return dot(color, LUMA);
}

// 5x5 box blur -- cheap (one uniform loop, no separable two-pass setup) and
// plenty for a reference-readability aid; also reused as the base sampling
// step for sharpen and pencil sketch below.
vec3 boxBlur(vec2 uv, float radiusScale) {
  vec3 sum = vec3(0.0);
  float count = 0.0;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 offset = vec2(float(x), float(y)) * u_texelSize * radiusScale;
      sum += texture(u_texture, uv + offset).rgb;
      count += 1.0;
    }
  }
  return sum / count;
}

// Sobel operator on luma -- the GPU-friendly baseline noted in
// docs/architecture/03 (Canny was considered and rejected as too expensive
// for a live preview).
float sobelEdge(vec2 uv) {
  float kernelX[9] = float[](-1.0, 0.0, 1.0, -2.0, 0.0, 2.0, -1.0, 0.0, 1.0);
  float kernelY[9] = float[](-1.0, -2.0, -1.0, 0.0, 0.0, 0.0, 1.0, 2.0, 1.0);
  float gx = 0.0;
  float gy = 0.0;
  int i = 0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      float l = luma(texture(u_texture, uv + vec2(float(x), float(y)) * u_texelSize).rgb);
      gx += l * kernelX[i];
      gy += l * kernelY[i];
      i++;
    }
  }
  return clamp(sqrt(gx * gx + gy * gy), 0.0, 1.0);
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = applyTonal(texColor.rgb, u_brightness, u_contrast);

  float gray = luma(color);
  color = mix(vec3(gray), color, 1.0 + u_saturation / 100.0);

  if (u_filterId == 1) {
    // grayscale
    color = vec3(luma(color));
  } else if (u_filterId == 2) {
    // highContrast: a fixed extra contrast boost layered on top of the
    // user's own contrast slider, not a replacement for it.
    color = applyTonal(color, 0.0, 50.0);
  } else if (u_filterId == 3) {
    // lowContrast
    color = applyTonal(color, 0.0, -50.0);
  } else if (u_filterId == 4) {
    // threshold: u_param1 is the cutoff, 0-100
    float cutoff = clamp(u_param1, 0.0, 100.0) / 100.0;
    color = luma(color) > cutoff ? vec3(1.0) : vec3(0.0);
  } else if (u_filterId == 5) {
    // posterize: u_param1 is the level count, >= 2
    float levels = max(2.0, u_param1);
    color = floor(color * levels) / (levels - 1.0);
  } else if (u_filterId == 6) {
    // pencilSketch: grayscale "color dodge" against a blurred, inverted copy
    // -- a well-known single-pass approximation (no separate blur pass).
    vec3 blurred = boxBlur(v_texCoord, 1.5);
    float invertedBlurredLuma = 1.0 - luma(blurred);
    color = vec3(clamp(luma(color) / max(0.001, 1.0 - invertedBlurredLuma), 0.0, 1.0));
  } else if (u_filterId == 7) {
    // edgeDetect
    color = vec3(sobelEdge(v_texCoord));
  } else if (u_filterId == 8) {
    // invert
    color = 1.0 - color;
  } else if (u_filterId == 9) {
    // blur: u_param1 scales the sample radius, minimum 1 texel
    color = boxBlur(v_texCoord, max(1.0, u_param1));
  } else if (u_filterId == 10) {
    // sharpen: unsharp mask -- push the color away from its local blurred
    // average by u_param1 percent.
    vec3 blurred = boxBlur(v_texCoord, 1.0);
    float amount = max(0.0, u_param1) / 100.0;
    color = color + (color - blurred) * amount * 4.0;
  }

  outColor = vec4(clamp(color, 0.0, 1.0), texColor.a);
}
`;
