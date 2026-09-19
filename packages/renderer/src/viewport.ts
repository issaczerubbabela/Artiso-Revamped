export interface Point {
  x: number;
  y: number;
}

export interface ViewportState {
  scale: number;
  translateX: number;
  translateY: number;
}

// Limits on zoom and pan. The default is built from ViewportOptions; the crop
// tool supplies its own (the image must always cover a fixed frame).
// `clampScale` runs *before* the zoom is anchored, so the point under the
// cursor stays put; `clampPan` runs after, on the final transform.
export interface ViewportConstraint {
  clampScale(scale: number): number;
  clampPan(state: ViewportState): ViewportState;
}

export interface ViewportOptions {
  // 'fit' makes the smallest zoom "the whole content fits the container"
  // (Grid-Feature-Spec.md §10); a number is a fixed floor. Default 0.05.
  minScale?: number | 'fit';
  // Default 32.
  maxScale?: number;
  // How far (in container px) an edge of the content may be dragged past the
  // container edge, showing a margin. Content smaller than the container is
  // simply centred. null (the default) leaves panning unconstrained.
  panSlack?: number | null;
  // Container px kept clear around the content by zoomToFit.
  fitPadding?: number;
}

const DEFAULT_MIN_SCALE = 0.05;
const DEFAULT_MAX_SCALE = 32;
const REAL_SIZE_TOLERANCE = 0.005;

// A single 2D affine transform {scale, translateX, translateY} that the image,
// grid and annotation layers all re-project through on every paint. Pan/zoom
// never recomputes the image pipeline or grid line geometry -- only this
// transform changes -- which is what makes 60fps pan/zoom possible on
// mid-range hardware (docs/architecture/05-canvas-renderer.md).
//
// "Content units" are whatever the caller draws in: paper millimetres in the
// drawing view (so `scale` is container px per mm), image pixels in the crop
// tool. The container is measured in CSS px, and so are pointer coordinates;
// canvases are backed at devicePixelRatio and draw under a matching transform,
// so nothing here ever sees device pixels.
//
// Pure math, no DOM/canvas dependency, so it's unit-testable on its own; the
// renderer wires it to actual pointer/wheel/pinch events and canvas draw
// calls separately.
export class Viewport {
  private state: ViewportState = { scale: 1, translateX: 0, translateY: 0 };
  private realScale: number | null = null;
  private custom: ViewportConstraint | null = null;
  private readonly options: Required<Omit<ViewportOptions, 'panSlack'>> & { panSlack: number | null };

  constructor(
    private containerWidth: number,
    private containerHeight: number,
    private contentWidth: number,
    private contentHeight: number,
    options: ViewportOptions = {},
  ) {
    this.options = {
      minScale: options.minScale ?? DEFAULT_MIN_SCALE,
      maxScale: options.maxScale ?? DEFAULT_MAX_SCALE,
      panSlack: options.panSlack ?? null,
      fitPadding: options.fitPadding ?? 0,
    };
    this.zoomToFit();
  }

  getState(): ViewportState {
    return { ...this.state };
  }

  // Used to restore a previously-saved transform -- e.g. resuming a session, or
  // the input controller's double-tap zoomToFit/previous-zoom toggle. It is
  // still constrained, since the container may have changed since it was saved.
  setState(state: ViewportState): void {
    this.state = this.constraint().clampPan({ ...state, scale: this.constraint().clampScale(state.scale) });
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

  // Keeps the content point under `anchor` fixed on screen while changing
  // scale -- anchored at the cursor (wheel) or pinch midpoint (touch), never
  // the canvas center, per .agents/workflows/build-canvas-zoom-pan-gestures.md.
  setZoom(scale: number, anchor: Point = this.containerCenter()): void {
    const constraint = this.constraint();
    const clamped = constraint.clampScale(scale);
    const contentPoint = this.screenToImage(anchor);
    this.state = constraint.clampPan({
      scale: clamped,
      translateX: anchor.x - contentPoint.x * clamped,
      translateY: anchor.y - contentPoint.y * clamped,
    });
  }

  // Direct 1:1 tracking of the input delta -- no easing, no animation
  // (ki-immediate-feedback: canvas pan/zoom is direct manipulation).
  panBy(dx: number, dy: number): void {
    this.state = this.constraint().clampPan({
      ...this.state,
      translateX: this.state.translateX + dx,
      translateY: this.state.translateY + dy,
    });
  }

  // Called when the content itself changes size (e.g. the paper changing),
  // as opposed to resize() which is for the container changing size. Re-fits
  // rather than trying to preserve the prior framing, since what the user was
  // looking at has changed.
  setContentSize(width: number, height: number): void {
    this.contentWidth = width;
    this.contentHeight = height;
    this.zoomToFit();
  }

  // The scale at which the whole content (plus fitPadding) fits the container.
  getFitScale(): number {
    const pad = this.options.fitPadding * 2;
    const availableW = Math.max(1, this.containerWidth - pad);
    const availableH = Math.max(1, this.containerHeight - pad);
    return Math.min(availableW / this.contentWidth, availableH / this.contentHeight);
  }

  zoomToFit(): void {
    const constraint = this.constraint();
    const scale = constraint.clampScale(this.getFitScale());
    this.state = constraint.clampPan({
      scale,
      translateX: (this.containerWidth - this.contentWidth * scale) / 2,
      translateY: (this.containerHeight - this.contentHeight * scale) / 2,
    });
  }

  reset(): void {
    this.zoomToFit();
  }

  // Real size (1:1): the `scale` at which content units are physical
  // millimetres on the user's screen. Set once calibrated (null = unknown).
  // Recording it also lowers the minimum zoom to it when it is below "fit", so
  // a small sheet on a big screen can still be shown at its true size.
  setRealScale(pxPerUnit: number | null): void {
    this.realScale = pxPerUnit !== null && pxPerUnit > 0 ? pxPerUnit : null;
    this.state = this.constraint().clampPan({ ...this.state, scale: this.constraint().clampScale(this.state.scale) });
  }

  getRealScale(): number | null {
    return this.realScale;
  }

  // Zooms to real size about `anchor` (the container centre by default), so the
  // viewport centre stays fixed. Returns false when not yet calibrated.
  setRealSize(anchor: Point = this.containerCenter()): boolean {
    if (this.realScale === null) return false;
    this.setZoom(this.realScale, anchor);
    return true;
  }

  isRealSize(): boolean {
    return this.realScale !== null && Math.abs(this.state.scale - this.realScale) / this.realScale < REAL_SIZE_TOLERANCE;
  }

  // Replaces the default zoom/pan limits (null restores them).
  setConstraint(constraint: ViewportConstraint | null): void {
    this.custom = constraint;
    this.state = this.constraint().clampPan({ ...this.state, scale: this.constraint().clampScale(this.state.scale) });
  }

  getContainerSize(): { width: number; height: number } {
    return { width: this.containerWidth, height: this.containerHeight };
  }

  getContentSize(): { width: number; height: number } {
    return { width: this.contentWidth, height: this.contentHeight };
  }

  // Preserves the current framing (same content region stays centered) rather
  // than resetting the view -- required across breakpoint transitions and
  // window resizes (see docs/architecture/05-canvas-renderer.md). A view that
  // was showing the whole content keeps doing so.
  resize(containerWidth: number, containerHeight: number): void {
    const wasFit = Math.abs(this.state.scale - this.getFitScale()) <= 1e-9 * Math.max(1, this.state.scale);
    const oldCenter = this.screenToImage(this.containerCenter());
    this.containerWidth = containerWidth;
    this.containerHeight = containerHeight;
    if (wasFit) {
      this.zoomToFit();
      return;
    }
    const constraint = this.constraint();
    const scale = constraint.clampScale(this.state.scale);
    const newCenter = this.containerCenter();
    this.state = constraint.clampPan({
      scale,
      translateX: newCenter.x - oldCenter.x * scale,
      translateY: newCenter.y - oldCenter.y * scale,
    });
  }

  private containerCenter(): Point {
    return { x: this.containerWidth / 2, y: this.containerHeight / 2 };
  }

  private constraint(): ViewportConstraint {
    return this.custom ?? this.defaultConstraint;
  }

  private readonly defaultConstraint: ViewportConstraint = {
    clampScale: (scale) => {
      const { minScale, maxScale } = this.options;
      let min: number;
      if (minScale === 'fit') {
        const fit = this.getFitScale();
        min = this.realScale === null ? fit : Math.min(fit, this.realScale);
      } else {
        min = minScale;
      }
      return Math.min(Math.max(min, maxScale), Math.max(min, scale));
    },
    clampPan: (state) => {
      const slack = this.options.panSlack;
      if (slack === null) return state;
      return {
        scale: state.scale,
        translateX: clampAxis(state.translateX, this.contentWidth * state.scale, this.containerWidth, slack),
        translateY: clampAxis(state.translateY, this.contentHeight * state.scale, this.containerHeight, slack),
      };
    },
  };
}

// Content smaller than the container is centred; larger content may be dragged
// until an edge is `slack` px inside the container.
function clampAxis(translate: number, contentPx: number, containerPx: number, slack: number): number {
  if (contentPx <= containerPx) return (containerPx - contentPx) / 2;
  return Math.min(Math.max(translate, containerPx - contentPx - slack), slack);
}
