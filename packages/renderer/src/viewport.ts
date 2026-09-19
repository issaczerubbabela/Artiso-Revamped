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

// Container px covered by floating chrome (rail, dock, top bar, bottom bar,
// zoom pill), each edge measured inward from the container edge. The surface
// stays full-bleed; the viewport just treats the *uncovered* region as "the
// place content should fit and be centred", so nothing important ends up
// hidden under a panel (docs/architecture/06-workspace-interaction.md).
export interface ViewportInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const NO_INSETS: Readonly<ViewportInsets> = { left: 0, top: 0, right: 0, bottom: 0 };

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
  private insets: ViewportInsets = { ...NO_INSETS };
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

  // The scale at which the whole content (plus fitPadding) fits the part of the
  // container that chrome does not cover.
  getFitScale(): number {
    const pad = this.options.fitPadding * 2;
    const region = this.visibleRegion();
    const availableW = Math.max(1, region.width - pad);
    const availableH = Math.max(1, region.height - pad);
    return Math.min(availableW / this.contentWidth, availableH / this.contentHeight);
  }

  zoomToFit(): void {
    const constraint = this.constraint();
    const scale = constraint.clampScale(this.getFitScale());
    const region = this.visibleRegion();
    this.state = constraint.clampPan({
      scale,
      translateX: region.x + (region.width - this.contentWidth * scale) / 2,
      translateY: region.y + (region.height - this.contentHeight * scale) / 2,
    });
  }

  // Tells the viewport which strips of the container floating chrome covers.
  // A view that was showing the whole content re-fits into the new visible
  // region; a zoomed-in view keeps its framing (opening a panel must not yank
  // it around) and is only re-clamped. Non-finite or negative values count as 0.
  setInsets(insets: Partial<ViewportInsets>): void {
    const next: ViewportInsets = {
      left: cleanInset(insets.left),
      top: cleanInset(insets.top),
      right: cleanInset(insets.right),
      bottom: cleanInset(insets.bottom),
    };
    const prev = this.insets;
    if (next.left === prev.left && next.top === prev.top && next.right === prev.right && next.bottom === prev.bottom) {
      return;
    }
    const wasFit = this.isAtFit();
    this.insets = next;
    if (wasFit) {
      this.zoomToFit();
      return;
    }
    const constraint = this.constraint();
    this.state = constraint.clampPan({ ...this.state, scale: constraint.clampScale(this.state.scale) });
  }

  getInsets(): ViewportInsets {
    return { ...this.insets };
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
    const wasFit = this.isAtFit();
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

  private isAtFit(): boolean {
    return Math.abs(this.state.scale - this.getFitScale()) <= 1e-9 * Math.max(1, this.state.scale);
  }

  // The part of the container that chrome does not cover. At least 1px each way
  // so a degenerate inset can never produce a zero or negative fit.
  private visibleRegion(): { x: number; y: number; width: number; height: number } {
    const { left, top, right, bottom } = this.insets;
    return {
      x: left,
      y: top,
      width: Math.max(1, this.containerWidth - left - right),
      height: Math.max(1, this.containerHeight - top - bottom),
    };
  }

  // The centre of the visible region -- where zoom buttons and Real size anchor.
  private containerCenter(): Point {
    const region = this.visibleRegion();
    return { x: region.x + region.width / 2, y: region.y + region.height / 2 };
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
      const region = this.visibleRegion();
      return {
        scale: state.scale,
        translateX: clampAxis(state.translateX, this.contentWidth * state.scale, region.x, region.width, slack),
        translateY: clampAxis(state.translateY, this.contentHeight * state.scale, region.y, region.height, slack),
      };
    },
  };
}

// Content smaller than the visible region is centred in it; larger content may
// be dragged until an edge is `slack` px inside the region. `start`/`size` are
// the region's offset and length on this axis (0 and the container length when
// no chrome covers it).
function clampAxis(translate: number, contentPx: number, start: number, size: number, slack: number): number {
  if (contentPx <= size) return start + (size - contentPx) / 2;
  return Math.min(Math.max(translate, start + size - contentPx - slack), start + slack);
}

function cleanInset(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
}
