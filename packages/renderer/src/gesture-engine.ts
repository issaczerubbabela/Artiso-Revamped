import type { Point, Viewport } from './viewport';

// The time source the gesture engine reads (double-tap timing now; glide and
// spring-back with View Rotation). Injected so tests can drive gestures on a
// fake clock instead of real time.
export interface GestureClock {
  now(): number;
}

// Runs a callback on the next display frame. Injected for the same reason as
// the clock: momentum after a gesture is a sequence of frames, and tests step
// through them by hand.
export interface FrameScheduler {
  request(callback: (time: number) => void): number;
  cancel(handle: number): void;
}

export const systemClock: GestureClock = {
  now: () => performance.now(),
};

export const animationFrameScheduler: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export interface GestureEngineOptions {
  viewport: Viewport;
  onChange: () => void;
  // Checked before every gesture -- when locked, pan/zoom input is ignored
  // but any other UI control still works (Settings' Gesture Lock, see
  // docs/architecture/06-workspace-interaction.md).
  isGestureLocked?: () => boolean;
  clock?: GestureClock;
  // Unused until momentum lands with View Rotation (#5); part of the engine's
  // contract now so the seam is in place.
  scheduler?: FrameScheduler;
}

const DOUBLE_TAP_MAX_INTERVAL_MS = 300;
const DOUBLE_TAP_MAX_DISTANCE_PX = 20;

// What a pointer gesture does to the view, independent of where the input came
// from: it takes pointer ids and points in container CSS px, so it is driven
// the same way by the DOM (InputController) and by tests with a fake clock.
//
// - one pointer drags: panBy, 1:1;
// - two pointers pinch: zoom by the change in their distance, anchored at
//   their current midpoint;
// - wheel: zoom anchored at the cursor;
// - double-tap: toggle zoomToFit / the previous view.
//
// Purely transform-only: it never calls into the grid engine or the filter
// pipeline, only Viewport methods (ki-grid-image-independence).
export class GestureEngine {
  private readonly pointers = new Map<number, Point>();
  private readonly clock: GestureClock;
  private lastPinchDistance = 0;
  private lastTapTime = Number.NEGATIVE_INFINITY;
  private lastTapPoint: Point = { x: 0, y: 0 };
  private previousZoomState: ReturnType<Viewport['getState']> | null = null;

  constructor(private readonly options: GestureEngineOptions) {
    this.clock = options.clock ?? systemClock;
  }

  pointerDown(id: number, point: Point): void {
    this.pointers.set(id, point);
    if (this.pointers.size === 2) {
      const [a, b] = firstTwo(this.pointers);
      this.lastPinchDistance = distance(a, b);
    }
  }

  // Whether pointer `id` is down and part of a gesture.
  isTracking(id: number): boolean {
    return this.pointers.has(id);
  }

  pointerMove(id: number, point: Point): void {
    const previous = this.pointers.get(id);
    if (!previous) return;
    this.pointers.set(id, point);

    if (this.isLocked()) return;

    if (this.pointers.size === 1) {
      this.options.viewport.panBy(point.x - previous.x, point.y - previous.y);
      this.options.onChange();
      return;
    }

    if (this.pointers.size === 2) {
      const [a, b] = firstTwo(this.pointers);
      const dist = distance(a, b);
      if (this.lastPinchDistance > 0) {
        const currentScale = this.options.viewport.getState().scale;
        this.options.viewport.setZoom((currentScale * dist) / this.lastPinchDistance, midpoint(a, b));
      }
      this.lastPinchDistance = dist;
      this.options.onChange();
    }
  }

  // A pointer lifted or was cancelled.
  pointerUp(id: number): void {
    const point = this.pointers.get(id);
    this.pointers.delete(id);
    if (this.pointers.size < 2) this.lastPinchDistance = 0;
    if (point && this.pointers.size === 0) this.handlePotentialDoubleTap(point);
  }

  // A wheel step at `point`; negative `deltaY` zooms in.
  wheel(point: Point, deltaY: number): void {
    if (this.isLocked()) return;
    const currentScale = this.options.viewport.getState().scale;
    const zoomFactor = Math.exp(-deltaY * 0.001);
    this.options.viewport.setZoom(currentScale * zoomFactor, point);
    this.options.onChange();
  }

  dispose(): void {
    this.pointers.clear();
    this.lastPinchDistance = 0;
  }

  private isLocked(): boolean {
    return this.options.isGestureLocked?.() ?? false;
  }

  private handlePotentialDoubleTap(point: Point): void {
    const now = this.clock.now();
    const isDoubleTap =
      now - this.lastTapTime < DOUBLE_TAP_MAX_INTERVAL_MS &&
      distance(point, this.lastTapPoint) < DOUBLE_TAP_MAX_DISTANCE_PX;
    this.lastTapTime = now;
    this.lastTapPoint = point;

    if (!isDoubleTap || this.isLocked()) return;

    const { viewport } = this.options;
    if (this.previousZoomState) {
      viewport.setState(this.previousZoomState);
      this.previousZoomState = null;
    } else {
      this.previousZoomState = viewport.getState();
      viewport.zoomToFit();
    }
    this.options.onChange();
  }
}

// Callers only reach this once `pointers.size === 2` has already been
// checked, so the map is guaranteed to have two entries.
function firstTwo(pointers: Map<number, Point>): [Point, Point] {
  const values = [...pointers.values()];
  return [values[0] as Point, values[1] as Point];
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
