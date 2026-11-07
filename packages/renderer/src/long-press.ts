import type { Point } from './viewport';

// One-shot timers, injected so tests can step through time (the same seam as
// the gesture engine's clock and frame scheduler).
export interface LongPressTimers {
  set(callback: () => void, ms: number): number;
  clear(handle: number): void;
}

export const systemTimers: LongPressTimers = {
  set: (callback, ms) => window.setTimeout(callback, ms),
  clear: (handle) => window.clearTimeout(handle),
};

// How long a still finger must stay down to open the canvas menu.
export const LONG_PRESS_DELAY_MS = 500;
// A finger never holds perfectly still; more movement than this is a drag.
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

export interface LongPressOptions {
  onLongPress: (point: Point) => void;
  timers?: LongPressTimers;
  delayMs?: number;
}

// Recognises a long-press: one touch or pen held still for ~500ms. Movement,
// lifting early or a second finger cancel it, so it never fires during a pan
// or a pinch. A mouse has right-click for the same job and is ignored.
export class LongPressDetector {
  private readonly timers: LongPressTimers;
  private readonly delayMs: number;
  private pointerId: number | null = null;
  private origin: Point | null = null;
  private timer: number | null = null;
  private down = new Set<number>();

  constructor(private readonly options: LongPressOptions) {
    this.timers = options.timers ?? systemTimers;
    this.delayMs = options.delayMs ?? LONG_PRESS_DELAY_MS;
  }

  pointerDown(pointerId: number, point: Point, pointerType: string): void {
    this.down.add(pointerId);
    if (this.down.size > 1 || pointerType === 'mouse') {
      this.cancel();
      return;
    }
    this.cancel();
    this.pointerId = pointerId;
    this.origin = point;
    this.timer = this.timers.set(() => {
      this.timer = null;
      const at = this.origin;
      this.pointerId = null;
      this.origin = null;
      if (at) this.options.onLongPress(at);
    }, this.delayMs);
  }

  pointerMove(pointerId: number, point: Point): void {
    if (pointerId !== this.pointerId || !this.origin) return;
    if (Math.hypot(point.x - this.origin.x, point.y - this.origin.y) > LONG_PRESS_MOVE_TOLERANCE_PX) this.cancel();
  }

  pointerUp(pointerId: number): void {
    this.down.delete(pointerId);
    if (pointerId === this.pointerId) this.cancel();
  }

  cancel(): void {
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
    this.pointerId = null;
    this.origin = null;
  }

  dispose(): void {
    this.cancel();
    this.down.clear();
  }
}
