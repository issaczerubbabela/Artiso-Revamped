import type { Point } from './viewport';
import type { Viewport } from './viewport';

export interface InputControllerOptions {
  element: HTMLElement;
  viewport: Viewport;
  onChange: () => void;
  // Checked before every gesture -- when locked, pan/zoom input is ignored
  // but any other UI control still works (Settings' Gesture Lock, see
  // docs/architecture/06-workspace-interaction.md).
  isGestureLocked?: () => boolean;
}

const DOUBLE_TAP_MAX_INTERVAL_MS = 300;
const DOUBLE_TAP_MAX_DISTANCE_PX = 20;

// One input controller using the Pointer Events API only -- no separate
// touch/mouse code paths (see
// .agents/workflows/build-canvas-zoom-pan-gestures.md). Handles
// single-pointer drag (pan), two-pointer pinch (zoom anchored at the pinch
// midpoint), wheel (zoom anchored at the cursor), and double-tap/double-click
// (toggle zoomToFit / previous zoom). Purely transform-only: never calls into
// the grid engine or filter pipeline, only Viewport methods.
export class InputController {
  private readonly pointers = new Map<number, Point>();
  private lastPinchDistance = 0;
  private lastTapTime = 0;
  private lastTapPoint: Point = { x: 0, y: 0 };
  private previousZoomState: ReturnType<Viewport['getState']> | null = null;

  private readonly handlePointerDown = (event: PointerEvent) => {
    (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, this.localPoint(event));
    if (this.pointers.size === 2) {
      const [a, b] = firstTwo(this.pointers);
      this.lastPinchDistance = distance(a, b);
    }
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (!this.pointers.has(event.pointerId)) return;
    const previous = this.pointers.get(event.pointerId) as Point;
    const point = this.localPoint(event);
    this.pointers.set(event.pointerId, point);

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
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    const point = this.pointers.get(event.pointerId);
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.lastPinchDistance = 0;
    if (point && this.pointers.size === 0) this.handlePotentialDoubleTap(point);
  };

  private readonly handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (this.isLocked()) return;
    const anchor = this.localPointFromClient(event.clientX, event.clientY);
    const currentScale = this.options.viewport.getState().scale;
    const zoomFactor = Math.exp(-event.deltaY * 0.001);
    this.options.viewport.setZoom(currentScale * zoomFactor, anchor);
    this.options.onChange();
  };

  constructor(private readonly options: InputControllerOptions) {
    const { element } = options;
    element.addEventListener('pointerdown', this.handlePointerDown);
    element.addEventListener('pointermove', this.handlePointerMove);
    element.addEventListener('pointerup', this.handlePointerUp);
    element.addEventListener('pointercancel', this.handlePointerUp);
    element.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  dispose(): void {
    const { element } = this.options;
    element.removeEventListener('pointerdown', this.handlePointerDown);
    element.removeEventListener('pointermove', this.handlePointerMove);
    element.removeEventListener('pointerup', this.handlePointerUp);
    element.removeEventListener('pointercancel', this.handlePointerUp);
    element.removeEventListener('wheel', this.handleWheel);
  }

  private isLocked(): boolean {
    return this.options.isGestureLocked?.() ?? false;
  }

  private localPoint(event: PointerEvent): Point {
    return this.localPointFromClient(event.clientX, event.clientY);
  }

  private localPointFromClient(clientX: number, clientY: number): Point {
    const rect = this.options.element.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private handlePotentialDoubleTap(point: Point): void {
    const now = performance.now();
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
