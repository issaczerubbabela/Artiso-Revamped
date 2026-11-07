import type { Point, Viewport, ViewportState } from './viewport';
import { ROTATION_DEAD_ZONE_RAD, normalizeAngle, rubberBandScale, snapViewRotation } from './view-rotation';

// The time source the gesture engine reads: double-tap timing, flick velocity
// and the glide / spring-back after a release. Injected so tests can drive
// gestures on a fake clock instead of real time.
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
  // The Lock rotation switch (and any mode that must stay at its angle, like
  // the Paper tool): the twist is ignored while pinch and pan keep working.
  isRotationLocked?: () => boolean;
  // `prefers-reduced-motion`: no glide after a flick and no rubber-banding
  // past a zoom limit (so nothing to spring back from).
  prefersReducedMotion?: () => boolean;
  // Whether a pinch may stretch past a zoom limit and spring back. Off where
  // an overshoot would be acted on mid-gesture (the Paper tool's crop).
  allowsZoomOvershoot?: () => boolean;
  // Which pointer types ('touch', 'pen', 'mouse') move the view, checked as
  // each pointer goes down. Pencil-only Drawing leaves the Pencil to draw and
  // gives the view to the fingers. Unset: every pointer.
  acceptsPointer?: (pointerType: string) => boolean;
  clock?: GestureClock;
  scheduler?: FrameScheduler;
}

// Modifier keys held during a pointer move (desktop).
export interface GestureModifiers {
  shiftKey?: boolean;
}

const DOUBLE_TAP_MAX_INTERVAL_MS = 300;
const DOUBLE_TAP_MAX_DISTANCE_PX = 20;

// Flick velocity is measured over the last stretch of the drag; a finger that
// paused before lifting has no velocity.
const VELOCITY_WINDOW_MS = 80;
const VELOCITY_STALE_MS = 50;
// px/ms: slower releases just stop.
export const GLIDE_MIN_START_SPEED = 0.25;
const GLIDE_STOP_SPEED = 0.02;
// Speed is multiplied by this every millisecond (a ~200 ms time constant), so
// a glide covers about speed × 200 ms and settles in well under a second.
export const GLIDE_DECAY_PER_MS = 0.995;

// Spring-back closes the log-gap to the zoom limit with this time constant.
const SPRING_TIME_CONSTANT_MS = 60;
const SPRING_DONE_LOG_RATIO = 0.002;

// Wheel zoom rates (per unit of deltaY). Ctrl+wheel is how Chromium reports a
// trackpad pinch, in small deltas, so it zooms faster per unit; a Ctrl+mouse
// wheel notch is capped so one notch never jumps too far.
const WHEEL_ZOOM_RATE = 0.001;
const CTRL_WHEEL_ZOOM_RATE = 0.01;
const CTRL_WHEEL_MAX_DELTA = 25;

// A two-finger (or trackpad) gesture in progress: pinch, pan and twist at once.
interface Transform {
  lastMid: Point;
  lastDistance: number;
  lastAngle: number;
  // The finger scale with no limits applied; what is shown is this clamped, or
  // rubber-banded past a limit.
  rawScale: number;
  // Twist accumulated since the gesture began, and the angle it began at.
  twist: number;
  baseRotation: number;
  // Set once the twist crosses the dead zone: which way it crossed (±1). The
  // view then turns by the twist minus the dead zone, so it starts from where
  // it is (no jump) and follows the fingers 1:1.
  crossed: number;
}

interface Sample {
  t: number;
  p: Point;
}

// What a pointer gesture does to the view, independent of where the input came
// from: it takes pointer ids and points in container CSS px, so it is driven
// the same way by the DOM (InputController) and by tests with a fake clock.
//
// - one pointer drags: panBy, 1:1; a flick glides on with decaying speed;
// - two pointers pinch, pan and twist together, anchored at their midpoint;
//   the twist only turns the view past a ~10° dead zone, then 1:1; on release
//   the angle snaps to a right angle within 5°, and a zoom past a limit
//   springs back to it; rotation never has momentum;
// - Shift + one pointer turns the view about the visible centre (desktop);
// - Safari's trackpad gesture (scale + rotation) runs the two-finger path;
// - wheel: zoom anchored at the cursor (Ctrl+wheel = trackpad pinch);
// - double-tap: fit and square up (0°), or go back to the previous view.
//
// Purely transform-only: it never calls into the grid engine or the filter
// pipeline, only Viewport methods (ki-grid-image-independence).
export class GestureEngine {
  private readonly pointers = new Map<number, Point>();
  private readonly clock: GestureClock;
  private readonly scheduler: FrameScheduler | null;
  private lastTapTime = Number.NEGATIVE_INFINITY;
  private lastTapPoint: Point = { x: 0, y: 0 };
  private previousZoomState: ViewportState | null = null;

  private transform: Transform | null = null;
  // The last anchor of a pinch, kept for the spring-back after release.
  private springAnchor: Point | null = null;
  // Set when a twist or Shift+drag turned the view, so its release snaps.
  private rotatedAbout: Point | null = null;
  // Once a second finger has touched down, this touch sequence can no longer
  // end in a flick: rotation and pinches never glide.
  private multiTouch = false;
  private samples: Sample[] = [];

  private frame: number | null = null;
  private lastFrameTime = 0;
  private glide: { vx: number; vy: number } | null = null;
  private spring: { anchor: Point } | null = null;

  constructor(private readonly options: GestureEngineOptions) {
    this.clock = options.clock ?? systemClock;
    this.scheduler = options.scheduler ?? (typeof requestAnimationFrame === 'function' ? animationFrameScheduler : null);
  }

  pointerDown(id: number, point: Point, pointerType?: string): void {
    // A pointer that is not for the view is never tracked, so its moves and
    // lift are no-ops here.
    if (pointerType !== undefined && this.options.acceptsPointer && !this.options.acceptsPointer(pointerType)) return;
    // Touching the canvas catches a glide, as it would a sliding sheet.
    this.stopMotion();
    this.pointers.set(id, point);
    if (this.pointers.size === 1) {
      this.multiTouch = false;
      this.samples = [{ t: this.clock.now(), p: point }];
    } else {
      this.multiTouch = true;
      this.samples = [];
    }
    this.resetTwoFinger();
  }

  // Whether pointer `id` is down and part of a gesture.
  isTracking(id: number): boolean {
    return this.pointers.has(id);
  }

  pointerMove(id: number, point: Point, modifiers: GestureModifiers = {}): void {
    const previous = this.pointers.get(id);
    if (!previous) return;
    this.pointers.set(id, point);

    if (this.isLocked()) return;

    if (this.pointers.size === 1) {
      if (modifiers.shiftKey) {
        this.shiftRotate(previous, point);
        return;
      }
      this.recordSample(point);
      this.options.viewport.panBy(point.x - previous.x, point.y - previous.y);
      this.options.onChange();
      return;
    }

    if (this.pointers.size === 2) {
      const [a, b] = firstTwo(this.pointers);
      this.moveTransform(midpoint(a, b), distance(a, b), angleOf(a, b));
    }
  }

  // A pointer lifted or was cancelled.
  pointerUp(id: number): void {
    const point = this.pointers.get(id);
    if (!point) return;
    const sizeBefore = this.pointers.size;
    this.pointers.delete(id);

    if (sizeBefore === 2) this.endTransform();
    if (this.pointers.size === 2) this.resetTwoFinger();
    if (this.pointers.size === 1) {
      // The remaining finger carries on as a pan from where it is.
      this.samples = [];
    }
    if (this.pointers.size > 0) return;

    if (this.rotatedAbout) this.finishRotation();
    if (!this.multiTouch && !this.isLocked()) this.startGlide();
    this.samples = [];
    // Only a one-finger tap can be half of a double-tap: two- and three-finger
    // taps are their own shortcuts (undo, show/hide grid).
    if (this.multiTouch) {
      this.lastTapTime = Number.NEGATIVE_INFINITY;
      return;
    }
    this.handlePotentialDoubleTap(point);
  }

  // Safari's trackpad gesture events (gesturestart / gesturechange / gestureend):
  // `scale` and `rotationDeg` are cumulative since the start. Mapped onto the
  // same pinch / pan / twist path as two fingers.
  trackpadGestureStart(point: Point): void {
    if (this.pointers.size > 0) return;
    this.stopMotion();
    this.beginTransform(point, 1, 0);
  }

  trackpadGestureChange(point: Point, scale: number, rotationDeg: number): void {
    if (this.pointers.size > 0 || !this.transform || this.isLocked()) return;
    if (!(scale > 0)) return;
    this.moveTransform(point, scale, (rotationDeg * Math.PI) / 180);
  }

  trackpadGestureEnd(): void {
    if (this.pointers.size > 0 || !this.transform) return;
    this.endTransform();
    if (this.rotatedAbout) this.finishRotation();
  }

  // A wheel step at `point`; negative `deltaY` zooms in. With Ctrl held it is
  // a trackpad pinch (Chromium) or Ctrl+wheel: still a zoom at the cursor.
  wheel(point: Point, deltaY: number, modifiers: { ctrlKey?: boolean } = {}): void {
    if (this.isLocked()) return;
    this.stopMotion();
    const currentScale = this.options.viewport.getState().scale;
    const zoomFactor = modifiers.ctrlKey
      ? Math.exp(-clamp(deltaY, -CTRL_WHEEL_MAX_DELTA, CTRL_WHEEL_MAX_DELTA) * CTRL_WHEEL_ZOOM_RATE)
      : Math.exp(-deltaY * WHEEL_ZOOM_RATE);
    this.options.viewport.setZoom(currentScale * zoomFactor, point);
    this.options.onChange();
  }

  // Stops any glide or spring-back in progress -- e.g. before a button moves
  // the view, so the two never fight. A pending spring-back lands on its limit.
  stopMotion(): void {
    if (this.frame !== null) this.scheduler?.cancel(this.frame);
    this.frame = null;
    this.glide = null;
    if (this.spring) {
      const { viewport } = this.options;
      const { scale } = viewport.getState();
      viewport.setZoom(viewport.clampScale(scale), this.spring.anchor);
      this.spring = null;
      this.options.onChange();
    }
  }

  // Whether a glide or spring-back is running.
  isMoving(): boolean {
    return this.frame !== null;
  }

  dispose(): void {
    if (this.frame !== null) this.scheduler?.cancel(this.frame);
    this.frame = null;
    this.glide = null;
    this.spring = null;
    this.pointers.clear();
    this.transform = null;
  }

  private isLocked(): boolean {
    return this.options.isGestureLocked?.() ?? false;
  }

  private isRotationLocked(): boolean {
    return this.options.isRotationLocked?.() ?? false;
  }

  private reducedMotion(): boolean {
    return this.options.prefersReducedMotion?.() ?? false;
  }

  private elastic(): boolean {
    return !this.reducedMotion() && (this.options.allowsZoomOvershoot?.() ?? true);
  }

  private resetTwoFinger(): void {
    if (this.pointers.size !== 2) {
      this.transform = null;
      return;
    }
    const [a, b] = firstTwo(this.pointers);
    this.beginTransform(midpoint(a, b), distance(a, b), angleOf(a, b));
  }

  private beginTransform(mid: Point, dist: number, angle: number): void {
    const state = this.options.viewport.getState();
    this.transform = {
      lastMid: mid,
      lastDistance: dist,
      lastAngle: angle,
      rawScale: state.scale,
      twist: 0,
      baseRotation: state.rotation,
      crossed: 0,
    };
  }

  private moveTransform(mid: Point, dist: number, angle: number): void {
    const t = this.transform;
    if (!t) return;
    const { viewport } = this.options;
    const state = viewport.getState();

    if (t.lastDistance > 0 && dist > 0) t.rawScale *= dist / t.lastDistance;
    const delta = normalizeAngle(angle - t.lastAngle);
    if (!this.isRotationLocked()) {
      t.twist += delta;
      if (t.crossed === 0 && Math.abs(t.twist) >= ROTATION_DEAD_ZONE_RAD) t.crossed = Math.sign(t.twist);
    }
    const rotation = t.crossed === 0 ? state.rotation : t.baseRotation + t.twist - t.crossed * ROTATION_DEAD_ZONE_RAD;

    const limit = viewport.clampScale(t.rawScale, rotation);
    let scale = limit;
    if (this.elastic()) {
      scale = rubberBandScale(t.rawScale, limit);
    } else {
      // No overshoot: the finger scale itself stops at the limit, so pinching
      // back the other way responds at once.
      t.rawScale = limit;
    }
    viewport.transformAbout(scale, rotation, t.lastMid, mid, { clampScale: false });

    if (t.crossed !== 0) this.rotatedAbout = mid;
    this.springAnchor = mid;
    t.lastMid = mid;
    t.lastDistance = dist;
    t.lastAngle = angle;
    this.options.onChange();
  }

  // The fingers came off (or one of two did): spring back from an overshoot.
  // The rotation snap waits until every finger is up.
  private endTransform(): void {
    this.transform = null;
    const anchor = this.springAnchor;
    this.springAnchor = null;
    if (!anchor) return;
    const { viewport } = this.options;
    const { scale } = viewport.getState();
    const limit = viewport.clampScale(scale);
    if (Math.abs(Math.log(scale / limit)) <= 1e-9) return;
    if (this.reducedMotion() || !this.scheduler) {
      viewport.setZoom(limit, anchor);
      this.options.onChange();
      return;
    }
    this.spring = { anchor };
    this.requestFrame();
  }

  private shiftRotate(previous: Point, point: Point): void {
    this.samples = [];
    if (this.isRotationLocked()) return;
    const { viewport } = this.options;
    const pivot = viewport.getVisibleCenter();
    const delta = normalizeAngle(angleOf(pivot, point) - angleOf(pivot, previous));
    if (delta === 0) return;
    viewport.setRotation(viewport.getState().rotation + delta, pivot);
    this.rotatedAbout = pivot;
    this.options.onChange();
  }

  // Settles a turned view: snapped to a right angle when close to one, and
  // normalized either way. Instant -- rotation never has momentum.
  private finishRotation(): void {
    const anchor = this.rotatedAbout;
    this.rotatedAbout = null;
    if (!anchor) return;
    const { viewport } = this.options;
    const { rotation } = viewport.getState();
    const settled = snapViewRotation(rotation);
    if (settled === rotation) return;
    viewport.setRotation(settled, anchor);
    this.options.onChange();
  }

  private recordSample(point: Point): void {
    const t = this.clock.now();
    this.samples.push({ t, p: point });
    while (this.samples.length > 2 && t - (this.samples[0] as Sample).t > VELOCITY_WINDOW_MS) this.samples.shift();
  }

  private startGlide(): void {
    if (this.reducedMotion() || !this.scheduler || this.samples.length < 2) return;
    const now = this.clock.now();
    const first = this.samples[0] as Sample;
    const last = this.samples[this.samples.length - 1] as Sample;
    if (now - last.t > VELOCITY_STALE_MS) return;
    const dt = last.t - first.t;
    if (dt <= 0) return;
    const vx = (last.p.x - first.p.x) / dt;
    const vy = (last.p.y - first.p.y) / dt;
    if (Math.hypot(vx, vy) < GLIDE_MIN_START_SPEED) return;
    this.glide = { vx, vy };
    this.requestFrame();
  }

  private requestFrame(): void {
    if (!this.scheduler || this.frame !== null) {
      return;
    }
    this.lastFrameTime = this.clock.now();
    this.frame = this.scheduler.request(() => this.step());
  }

  // One display frame of glide and/or spring-back.
  private step(): void {
    this.frame = null;
    const now = this.clock.now();
    const dt = Math.max(0, now - this.lastFrameTime);
    this.lastFrameTime = now;
    const { viewport } = this.options;

    if (this.glide) {
      const { vx, vy } = this.glide;
      const before = viewport.getState();
      viewport.panBy(vx * dt, vy * dt);
      const after = viewport.getState();
      const decay = Math.pow(GLIDE_DECAY_PER_MS, dt);
      const moved = after.translateX !== before.translateX || after.translateY !== before.translateY;
      this.glide = { vx: vx * decay, vy: vy * decay };
      // Done once slow enough, or when a pan limit stops it dead.
      if (Math.hypot(this.glide.vx, this.glide.vy) < GLIDE_STOP_SPEED || (dt > 0 && !moved)) this.glide = null;
    }

    if (this.spring) {
      const { scale } = viewport.getState();
      const limit = viewport.clampScale(scale);
      const gap = Math.log(scale / limit) * Math.exp(-dt / SPRING_TIME_CONSTANT_MS);
      if (Math.abs(gap) < SPRING_DONE_LOG_RATIO) {
        viewport.setZoom(limit, this.spring.anchor);
        this.spring = null;
      } else {
        const { rotation } = viewport.getState();
        viewport.transformAbout(limit * Math.exp(gap), rotation, this.spring.anchor, this.spring.anchor, { clampScale: false });
      }
    }

    this.options.onChange();
    if (this.glide || this.spring) {
      this.frame = this.scheduler?.request(() => this.step()) ?? null;
    }
  }

  private handlePotentialDoubleTap(point: Point): void {
    const now = this.clock.now();
    const isDoubleTap =
      now - this.lastTapTime < DOUBLE_TAP_MAX_INTERVAL_MS &&
      distance(point, this.lastTapPoint) < DOUBLE_TAP_MAX_DISTANCE_PX;
    this.lastTapTime = now;
    this.lastTapPoint = point;

    if (!isDoubleTap || this.isLocked()) return;

    this.stopMotion();
    const { viewport } = this.options;
    if (this.previousZoomState) {
      viewport.setState(this.previousZoomState);
      this.previousZoomState = null;
    } else {
      this.previousZoomState = viewport.getState();
      // Fit and square up: the one quick "reset view".
      viewport.zoomToFit(0);
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

// The direction from `a` to `b`, in radians (clockwise on screen, y down).
function angleOf(a: Point, b: Point): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
