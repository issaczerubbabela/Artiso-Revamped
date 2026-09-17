// Phase 1 scope only: brightness/contrast/saturation + an optional grayscale
// toggle, per docs/architecture/03-image-processing-filters.md's fixed
// pipeline order (brightness -> contrast -> saturation -> structural
// filter). A single fixed shader with uniforms covers all of it, so unlike
// the general "recompile the chain on structural change" architecture the
// full filter suite will need in Phase 3, Phase 1 never recompiles at all --
// even the grayscale toggle is just a uniform flip.
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
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_grayscale;
out vec4 outColor;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;

  color += u_brightness / 100.0;
  color = (color - 0.5) * (1.0 + u_contrast / 100.0) + 0.5;

  float gray = dot(color, LUMA);
  color = mix(vec3(gray), color, 1.0 + u_saturation / 100.0);

  if (u_grayscale > 0.5) {
    color = vec3(dot(color, LUMA));
  }

  outColor = vec4(clamp(color, 0.0, 1.0), texColor.a);
}
`;
