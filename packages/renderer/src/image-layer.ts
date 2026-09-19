import type { DerivedAdjustments } from '@artiso/core-engine';
import type { FilterId } from '@artiso/shared-types';
import { createProgram } from './gl/compile';
import { FILTER_ID_TO_INT } from './gl/filter-ids';
import { FRAGMENT_SHADER_SOURCE, VERTEX_SHADER_SOURCE } from './gl/shader-source';
import type { ViewportState } from './viewport';

// Each filter that takes a param reads it from a specific key in
// Operation['filter']['params'], falling back to this default when unset --
// e.g. dragging the Filters panel's slider for the first time before the
// user has touched it.
const PARAM_KEY_BY_FILTER: Partial<Record<FilterId, { key: string; fallback: number }>> = {
  threshold: { key: 'cutoff', fallback: 50 },
  posterize: { key: 'levels', fallback: 4 },
  blur: { key: 'radius', fallback: 2 },
  sharpen: { key: 'amount', fallback: 50 },
};

function resolveParam1(adjustments: DerivedAdjustments): number {
  if (!adjustments.filterId) return 0;
  const spec = PARAM_KEY_BY_FILTER[adjustments.filterId];
  if (!spec) return 0;
  return adjustments.filterParams[spec.key] ?? spec.fallback;
}

// WebGL2 image layer: the bottom canvas of the two-canvas compositor (see
// docs/architecture/05-canvas-renderer.md). Draws the working bitmap through
// the fixed brightness/contrast/saturation + full-filter-suite shader,
// reprojected through the current Viewport transform every frame -- never
// recomputing the image pipeline itself for pan/zoom.
//
// Needs a real WebGL2 context, so it isn't unit tested under Vitest; it's
// exercised via the Playwright E2E golden path and manual verification.
export class ImageLayer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly texture: WebGLTexture;
  private readonly uniforms: {
    size: WebGLUniformLocation | null;
    scale: WebGLUniformLocation | null;
    offset: WebGLUniformLocation | null;
    texelSize: WebGLUniformLocation | null;
    brightness: WebGLUniformLocation | null;
    contrast: WebGLUniformLocation | null;
    saturation: WebGLUniformLocation | null;
    filterId: WebGLUniformLocation | null;
    param1: WebGLUniformLocation | null;
    texture: WebGLUniformLocation | null;
  };
  private sourceWidth = 0;
  private sourceHeight = 0;
  // The size the image occupies in *content units* (the units the Viewport
  // works in). Defaults to the bitmap's own pixel size; the drawing view sets
  // it to the paper in mm, so the bitmap is stretched over the paper.
  private contentWidth: number | null = null;
  private contentHeight: number | null = null;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL2 is not available on this device');
    this.gl = gl;

    this.program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create vertex array');
    this.vao = vao;
    gl.bindVertexArray(vao);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Unit quad as a triangle strip: (0,0) (1,0) (0,1) (1,1).
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const positionLoc = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create texture');
    this.texture = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.uniforms = {
      size: gl.getUniformLocation(this.program, 'u_size'),
      scale: gl.getUniformLocation(this.program, 'u_scale'),
      offset: gl.getUniformLocation(this.program, 'u_offset'),
      texelSize: gl.getUniformLocation(this.program, 'u_texelSize'),
      brightness: gl.getUniformLocation(this.program, 'u_brightness'),
      contrast: gl.getUniformLocation(this.program, 'u_contrast'),
      saturation: gl.getUniformLocation(this.program, 'u_saturation'),
      filterId: gl.getUniformLocation(this.program, 'u_filterId'),
      param1: gl.getUniformLocation(this.program, 'u_param1'),
      texture: gl.getUniformLocation(this.program, 'u_texture'),
    };
  }

  setSource(bitmap: ImageBitmap): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    this.sourceWidth = bitmap.width;
    this.sourceHeight = bitmap.height;
  }

  // Draw the image over `width` x `height` content units instead of its own
  // pixel size (pass null to go back to the bitmap's size).
  setContentSize(width: number | null, height: number | null): void {
    this.contentWidth = width;
    this.contentHeight = height;
  }

  // canvasWidth/Height are in CSS px (the units the Viewport works in); the
  // backing store is `pixelRatio` times larger, which only the GL viewport needs
  // to know -- clip space is resolution independent.
  draw(
    viewport: ViewportState,
    canvasWidth: number,
    canvasHeight: number,
    adjustments: DerivedAdjustments,
    pixelRatio = 1,
  ): void {
    const gl = this.gl;
    gl.viewport(0, 0, Math.round(canvasWidth * pixelRatio), Math.round(canvasHeight * pixelRatio));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (this.sourceWidth === 0 || this.sourceHeight === 0) return;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Combines the image-space -> screen-space Viewport transform with the
    // screen-space -> WebGL clip-space conversion (y flipped) into a single
    // per-axis scale+offset pair, since there's no rotation to account for.
    const scaleX = (2 * viewport.scale) / canvasWidth;
    const offsetX = (2 * viewport.translateX) / canvasWidth - 1;
    const scaleY = (-2 * viewport.scale) / canvasHeight;
    const offsetY = 1 - (2 * viewport.translateY) / canvasHeight;

    gl.uniform2f(this.uniforms.size, this.contentWidth ?? this.sourceWidth, this.contentHeight ?? this.sourceHeight);
    gl.uniform2f(this.uniforms.scale, scaleX, scaleY);
    gl.uniform2f(this.uniforms.offset, offsetX, offsetY);
    // Texture-space, not canvas-space -- the multi-tap filters (blur, sharpen,
    // edge detect, pencil sketch) sample neighboring texels of the source
    // image itself, independent of how large it's currently drawn on screen.
    gl.uniform2f(this.uniforms.texelSize, 1 / this.sourceWidth, 1 / this.sourceHeight);
    gl.uniform1f(this.uniforms.brightness, adjustments.brightness);
    gl.uniform1f(this.uniforms.contrast, adjustments.contrast);
    gl.uniform1f(this.uniforms.saturation, adjustments.saturation);
    gl.uniform1i(this.uniforms.filterId, adjustments.filterId ? FILTER_ID_TO_INT[adjustments.filterId] : 0);
    gl.uniform1f(this.uniforms.param1, resolveParam1(adjustments));

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms.texture, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
  }
}
