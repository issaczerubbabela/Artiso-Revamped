import type { RememberedView } from './orientation-views';

export interface Point {
  x: number;
  y: number;
}

// screen = translate + scale * R(rotation) * content. `rotation` is the View
// Rotation in radians (GLOSSARY.md): positive turns the content clockwise on
// screen, since screen y points down. It is view state only -- never an edit,
// never exported -- and every layer projects through this one transform, so
// turning the view never touches the image pipeline or grid generation
// (ki-grid-image-independence). `translate` is where the content origin lands.
export interface ViewportState {
  scale: number;
  translateX: number;
  translateY: number;
  rotation: number;
}

// The view as a 2D affine matrix in canvas `setTransform`/`transform` order:
// screen.x = a*x + c*y + e, screen.y = b*x + d*y + f. At 0° it is exactly the
// scale-and-translate the layers used before rotation existed.
export interface ViewMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export function viewMatrix(state: ViewportState): ViewMatrix {
  const cos = Math.cos(state.rotation);
  const sin = Math.sin(state.rotation);
  return {
    a: state.scale * cos,
    b: state.scale * sin,
    c: -state.scale * sin,
    d: state.scale * cos,
    e: state.translateX,
    f: state.translateY,
  };
}

// Limits on zoom and pan. The default is built from ViewportOptions; the crop
// tool supplies its own (the image must always cover a fixed frame).
// `clampScale` runs *before* the zoom is anchored, so the point under the
// cursor stays put; `clampPan` runs after, on the final transform. `rotation`
// is the angle the scale is about to be used at (the fit depends on it).
export interface ViewportConstraint {
  clampScale(scale: number, rotation: number): number;
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

// A single 2D affine transform {scale, translateX, translateY, rotation} that
// the image, grid and annotation layers all re-project through on every paint.
// Pan/zoom/rotate never recomputes the image pipeline or grid line geometry --
// only this transform changes -- which is what makes 60fps pan/zoom possible on
// mid-range hardware (docs/architecture/05-canvas-renderer.md).
//
// "Content units" are whatever the caller draws in: paper millimetres in the
// drawing view (so `scale` is container px per mm), image pixels in the crop
// tool. The container is measured in CSS px, and so are pointer coordinates;
// canvases are backed at devicePixelRatio and draw under a matching transform,
// so nothing here ever sees device pixels.
//
// Fit-to-screen and the pan limits work on the content's *rotated* bounding
// box, so they hold at any View Rotation. At 0° every formula reduces exactly
// to the plain scale-and-translate one.
//
// Pure math, no DOM/canvas dependency, so it's unit-testable on its own; the
// renderer wires it to actual pointer/wheel/pinch events and canvas draw
// calls separately.
export class Viewport {
  private state: ViewportState = { scale: 1, translateX: 0, translateY: 0, rotation: 0 };
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
    const constraint = this.constraint();
    this.state = constraint.clampPan({ ...state, scale: constraint.clampScale(state.scale, state.rotation) });
  }

  screenToImage(point: Point): Point {
    const { scale, translateX, translateY, rotation } = this.state;
    const dx = (point.x - translateX) / scale;
    const dy = (point.y - translateY) / scale;
    if (rotation === 0) return { x: dx, y: dy };
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
  }

  imageToScreen(point: Point): Point {
    const offset = contentOffset(point, this.state.scale, this.state.rotation);
    return { x: offset.x + this.state.translateX, y: offset.y + this.state.translateY };
  }

  // Keeps the content point under `anchor` fixed on screen while changing
  // scale -- anchored at the cursor (wheel) or pinch midpoint (touch), never
  // the canvas center, per .agents/workflows/build-canvas-zoom-pan-gestures.md.
  setZoom(scale: number, anchor: Point = this.containerCenter()): void {
    this.setScaleAndRotation(scale, this.state.rotation, anchor);
  }

  // Turns the view to `rotation` radians about `anchor`, keeping the content
  // point under it fixed. The scale is re-clamped, since the fit floor depends
  // on the angle.
  setRotation(rotation: number, anchor: Point = this.containerCenter()): void {
    this.setScaleAndRotation(this.state.scale, rotation, anchor);
  }

  // Zoom and rotate in one step about one anchor. The content point under
  // `anchor` stays under it.
  setScaleAndRotation(scale: number, rotation: number, anchor: Point = this.containerCenter()): void {
    this.transformAbout(scale, rotation, anchor, anchor);
  }

  // What one step of a two-finger gesture does: zoom to `scale`, turn to
  // `rotation`, and carry the content point that was under `from` to `to` (the
  // fingers' old and new midpoints), so pinch, pan and twist are one motion.
  // `clampScale: false` leaves the scale exactly as given -- the gesture engine
  // uses it to rubber-band past a zoom limit and spring back afterwards; the
  // pan limits always apply.
  transformAbout(scale: number, rotation: number, from: Point, to: Point, options: { clampScale?: boolean } = {}): void {
    const constraint = this.constraint();
    const finalScale = options.clampScale === false ? scale : constraint.clampScale(scale, rotation);
    if (!(finalScale > 0) || !Number.isFinite(finalScale) || !Number.isFinite(rotation)) return;
    const offset = contentOffset(this.screenToImage(from), finalScale, rotation);
    this.state = constraint.clampPan({
      scale: finalScale,
      translateX: to.x - offset.x,
      translateY: to.y - offset.y,
      rotation,
    });
  }

  // The scale the zoom limits allow nearest to `scale`, at `rotation` (the
  // current angle by default; the fit floor depends on it).
  clampScale(scale: number, rotation: number = this.state.rotation): number {
    return this.constraint().clampScale(scale, rotation);
  }

  // The centre of the part of the container chrome leaves uncovered: where the
  // zoom buttons, Real size and Shift+drag rotation pivot.
  getVisibleCenter(): Point {
    return this.containerCenter();
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

  // Cell Focus's auto-pan: pans just far enough that `rect` (content units) is
  // wholly inside the visible region, `margin` px clear of its edges -- at the
  // same zoom and angle, in one step (no glide). A rect already wholly on
  // screen leaves the view alone, even if it sits inside the margin; one too big
  // to fit is centred on that axis. Returns whether the view moved.
  revealRect(rect: { x: number; y: number; w: number; h: number }, margin = 0): boolean {
    const corners = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h },
    ].map((p) => this.imageToScreen(p));
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const region = this.visibleRegion();
    const right = region.x + region.width;
    const bottom = region.y + region.height;
    const EPS = 1e-6;
    if (minX >= region.x - EPS && maxX <= right + EPS && minY >= region.y - EPS && maxY <= bottom + EPS) return false;
    const dx = revealShift(minX, maxX, region.x + margin, right - margin);
    const dy = revealShift(minY, maxY, region.y + margin, bottom - margin);
    if (dx === 0 && dy === 0) return false;
    const before = this.state;
    this.panBy(dx, dy);
    return this.state.translateX !== before.translateX || this.state.translateY !== before.translateY;
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
  // container that chrome does not cover, turned to `rotation` (the current
  // angle by default): it is the rotated bounding box that has to fit.
  getFitScale(rotation: number = this.state.rotation): number {
    const pad = this.options.fitPadding * 2;
    const region = this.visibleRegion();
    const availableW = Math.max(1, region.width - pad);
    const availableH = Math.max(1, region.height - pad);
    const extent = this.rotatedExtent(rotation);
    return Math.min(availableW / extent.width, availableH / extent.height);
  }

  // Fits the scale and centres the content in the visible region, at
  // `rotation` (the current angle by default; double-tap passes 0 to fit and
  // square up in one step).
  zoomToFit(rotation: number = this.state.rotation): void {
    const constraint = this.constraint();
    const scale = constraint.clampScale(this.getFitScale(rotation), rotation);
    const region = this.visibleRegion();
    const box = this.rotatedBox(scale, rotation);
    this.state = constraint.clampPan({
      scale,
      translateX: region.x + (region.width - box.width) / 2 - box.minX,
      translateY: region.y + (region.height - box.height) / 2 - box.minY,
      rotation,
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
    this.reclamp();
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
    this.reclamp();
  }

  getRealScale(): number | null {
    return this.realScale;
  }

  // Zooms to real size about `anchor` (the container centre by default), so the
  // viewport centre stays fixed. Fixes the scale only: the angle is kept.
  // Returns false when not yet calibrated.
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
    this.reclamp();
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
  // was showing the whole content keeps doing so. The angle is always kept.
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
    const { rotation } = this.state;
    const scale = constraint.clampScale(this.state.scale, rotation);
    const newCenter = this.containerCenter();
    const offset = contentOffset(oldCenter, scale, rotation);
    this.state = constraint.clampPan({
      scale,
      translateX: newCenter.x - offset.x,
      translateY: newCenter.y - offset.y,
      rotation,
    });
  }

  // The view as an orientation slot remembers it (orientation-views.ts): just
  // the angle when the whole content fits, so it fits again however the chrome
  // has moved; otherwise the zoom and the content point at the visible centre.
  getRememberedView(): RememberedView {
    const { scale, rotation } = this.state;
    if (this.isAtFit()) return { rotation };
    const center = this.screenToImage(this.containerCenter());
    return { rotation, scale, centerX: center.x, centerY: center.y };
  }

  // Puts a remembered view back: fitted at its angle, or zoomed with its content
  // point at the visible centre. Clamped like any other view.
  restoreView(view: RememberedView): void {
    const rotation = Number.isFinite(view.rotation) ? view.rotation : 0;
    if (view.scale === undefined || view.centerX === undefined || view.centerY === undefined) {
      this.zoomToFit(rotation);
      return;
    }
    const constraint = this.constraint();
    const scale = constraint.clampScale(view.scale, rotation);
    const center = this.containerCenter();
    const offset = contentOffset({ x: view.centerX, y: view.centerY }, scale, rotation);
    this.state = constraint.clampPan({ scale, translateX: center.x - offset.x, translateY: center.y - offset.y, rotation });
  }

  private reclamp(): void {
    const constraint = this.constraint();
    this.state = constraint.clampPan({ ...this.state, scale: constraint.clampScale(this.state.scale, this.state.rotation) });
  }

  // The content's on-screen bounding box relative to translate, at `scale` and
  // `rotation`: where its left/top edge sits (minX/minY) and how big it is.
  private rotatedBox(scale: number, rotation: number): { minX: number; minY: number; width: number; height: number } {
    if (rotation === 0) {
      return { minX: 0, minY: 0, width: this.contentWidth * scale, height: this.contentHeight * scale };
    }
    const corners = [
      { x: 0, y: 0 },
      { x: this.contentWidth, y: 0 },
      { x: this.contentWidth, y: this.contentHeight },
      { x: 0, y: this.contentHeight },
    ].map((p) => contentOffset(p, scale, rotation));
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return { minX, minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
  }

  // The content's bounding box size, in content units, once turned by `rotation`.
  private rotatedExtent(rotation: number): { width: number; height: number } {
    if (rotation === 0) return { width: this.contentWidth, height: this.contentHeight };
    const cos = Math.abs(Math.cos(rotation));
    const sin = Math.abs(Math.sin(rotation));
    return {
      width: this.contentWidth * cos + this.contentHeight * sin,
      height: this.contentWidth * sin + this.contentHeight * cos,
    };
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
    clampScale: (scale, rotation) => {
      const { minScale, maxScale } = this.options;
      let min: number;
      if (minScale === 'fit') {
        const fit = this.getFitScale(rotation);
        min = this.realScale === null ? fit : Math.min(fit, this.realScale);
      } else {
        min = minScale;
      }
      return Math.min(Math.max(min, maxScale), Math.max(min, scale));
    },
    clampPan: (state) => {
      const slack = this.options.panSlack;
      if (slack === null) return state;
      // Clamped by the on-screen bounding box, so the limits hold at any angle.
      // At 0° the box starts at translate and this is the plain per-axis clamp.
      const region = this.visibleRegion();
      const box = this.rotatedBox(state.scale, state.rotation);
      return {
        scale: state.scale,
        translateX: clampAxis(state.translateX + box.minX, box.width, region.x, region.width, slack) - box.minX,
        translateY: clampAxis(state.translateY + box.minY, box.height, region.y, region.height, slack) - box.minY,
        rotation: state.rotation,
      };
    },
  };
}

// `point` (content units) scaled and turned, before translation. At 0° this is
// exactly point * scale.
function contentOffset(point: Point, scale: number, rotation: number): Point {
  if (rotation === 0) return { x: point.x * scale, y: point.y * scale };
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return { x: scale * (point.x * cos - point.y * sin), y: scale * (point.x * sin + point.y * cos) };
}

// `edge` is where the content's leading (left/top) edge sits on this axis.
// Content smaller than the visible region is centred in it; larger content may
// be dragged until an edge is `slack` px inside the region. `start`/`size` are
// the region's offset and length on this axis (0 and the container length when
// no chrome covers it).
function clampAxis(edge: number, contentPx: number, start: number, size: number, slack: number): number {
  if (contentPx <= size) return start + (size - contentPx) / 2;
  return Math.min(Math.max(edge, start + size - contentPx - slack), start + slack);
}

// How far to move [min, max] along one axis so it lies within [lo, hi]: the
// least distance, or onto the centre when it is longer than the span.
function revealShift(min: number, max: number, lo: number, hi: number): number {
  if (max - min > hi - lo) return (lo + hi) / 2 - (min + max) / 2;
  if (min < lo) return lo - min;
  if (max > hi) return hi - max;
  return 0;
}

function cleanInset(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
}
