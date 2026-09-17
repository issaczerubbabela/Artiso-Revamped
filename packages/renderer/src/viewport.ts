export interface Point {
  x: number;
  y: number;
}

export interface ViewportState {
  scale: number;
  translateX: number;
  translateY: number;
}

// A single 2D affine transform {scale, translateX, translateY} that both the
// WebGL image layer and the Canvas2D grid layer re-project through on every
// paint. Pan/zoom never recomputes the image pipeline or grid geometry --
// only this transform changes -- which is what makes 60fps pan/zoom possible
// on mid-range hardware (docs/architecture/05-canvas-renderer.md).
//
// Pure math, no DOM/canvas dependency, so it's unit-testable on its own; the
// renderer wires it to actual pointer/wheel/pinch events and canvas draw
// calls separately.
export class Viewport {
  private state: ViewportState = { scale: 1, translateX: 0, translateY: 0 };

  constructor(
    private containerWidth: number,
    private containerHeight: number,
    private contentWidth: number,
    private contentHeight: number,
  ) {
    this.zoomToFit();
  }

  getState(): ViewportState {
    return { ...this.state };
  }

  // Used to restore a previously-saved transform verbatim -- e.g. resuming a
  // session, or the input controller's double-tap zoomToFit/previous-zoom
  // toggle.
  setState(state: ViewportState): void {
    this.state = { ...state };
  }

  screenToImage(point: Point): Point {
    return {
      x: (point.x - this.state.translateX) / this.state.scale,
      y: (point.y - this.state.translateY) / this.state.scale,
    };
  }

  imageToScreen(point: Point): Point {
    return {
      x: point.x * this.state.scale + this.state.translateX,
      y: point.y * this.state.scale + this.state.translateY,
    };
  }

  // Keeps the image point under `anchor` fixed on screen while changing
  // scale -- anchored at the cursor (wheel) or pinch midpoint (touch), never
  // the canvas center, per .agents/workflows/build-canvas-zoom-pan-gestures.md.
  setZoom(scale: number, anchor: Point = this.containerCenter()): void {
    const clamped = clampScale(scale);
    const imagePoint = this.screenToImage(anchor);
    this.state.scale = clamped;
    this.state.translateX = anchor.x - imagePoint.x * clamped;
    this.state.translateY = anchor.y - imagePoint.y * clamped;
  }

  // Direct 1:1 tracking of the input delta -- no easing, no animation
  // (ki-immediate-feedback: canvas pan/zoom is direct manipulation).
  panBy(dx: number, dy: number): void {
    this.state.translateX += dx;
    this.state.translateY += dy;
  }

  zoomToFit(): void {
    const scale = clampScale(
      Math.min(this.containerWidth / this.contentWidth, this.containerHeight / this.contentHeight),
    );
    this.state.scale = scale;
    this.state.translateX = (this.containerWidth - this.contentWidth * scale) / 2;
    this.state.translateY = (this.containerHeight - this.contentHeight * scale) / 2;
  }

  reset(): void {
    this.zoomToFit();
  }

  // Preserves the current framing (same image region stays centered) rather
  // than resetting the view -- required across breakpoint transitions and
  // window resizes (see docs/architecture/05-canvas-renderer.md).
  resize(containerWidth: number, containerHeight: number): void {
    const oldCenterImage = this.screenToImage(this.containerCenter());
    this.containerWidth = containerWidth;
    this.containerHeight = containerHeight;
    const newCenter = this.containerCenter();
    this.state.translateX = newCenter.x - oldCenterImage.x * this.state.scale;
    this.state.translateY = newCenter.y - oldCenterImage.y * this.state.scale;
  }

  private containerCenter(): Point {
    return { x: this.containerWidth / 2, y: this.containerHeight / 2 };
  }
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 32;

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}
