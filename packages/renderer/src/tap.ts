import { systemClock, type GestureClock } from './gesture-engine';
import type { Point } from './viewport';

// A tap must lift within this long; held longer it is a long-press.
export const TAP_MAX_DURATION_MS = 350;
// A finger never lands perfectly still; more movement than this is a pan.
export const TAP_MOVE_TOLERANCE_PX = 10;
// Two taps this close in time and space are a double-tap (which the gesture
// engine turns into Fit), matching its own thresholds.
export const DOUBLE_TAP_INTERVAL_MS = 300;
export const DOUBLE_TAP_DISTANCE_PX = 20;

export interface TapInfo {
  pointerType: string;
  // The second tap of a double-tap. Whoever acts on single taps should ignore
  // it, so a double-tap (Fit) never also counts as two taps.
  secondOfDouble: boolean;
}

export interface TapOptions {
  onTap: (point: Point, info: TapInfo) => void;
  clock?: GestureClock;
}

// Recognises a tap: one pointer (touch, Pencil or mouse) pressed and lifted
// quickly without moving. A second finger, movement or a long hold rule it out,
// so a tap never fires at the end of a pan, a pinch or a long-press. Like the
// long-press detector it only listens -- it never stops the gesture engine
// from seeing the same pointers.
export class TapDetector {
  private readonly clock: GestureClock;
  private press: { id: number; origin: Point; at: Point; start: number; pointerType: string } | null = null;
  private down = new Set<number>();
  private lastTap: { time: number; point: Point; paired: boolean } | null = null;

  constructor(private readonly options: TapOptions) {
    this.clock = options.clock ?? systemClock;
  }

  pointerDown(pointerId: number, point: Point, pointerType: string): void {
    this.down.add(pointerId);
    if (this.down.size > 1) {
      this.press = null;
      return;
    }
    this.press = { id: pointerId, origin: point, at: point, start: this.clock.now(), pointerType };
  }

  pointerMove(pointerId: number, point: Point): void {
    const press = this.press;
    if (!press || press.id !== pointerId) return;
    if (Math.hypot(point.x - press.origin.x, point.y - press.origin.y) > TAP_MOVE_TOLERANCE_PX) {
      this.press = null;
      return;
    }
    press.at = point;
  }

  pointerUp(pointerId: number): void {
    this.down.delete(pointerId);
    const press = this.press;
    if (!press || press.id !== pointerId) return;
    this.press = null;
    const now = this.clock.now();
    if (now - press.start > TAP_MAX_DURATION_MS) return;

    const last = this.lastTap;
    const secondOfDouble =
      last !== null &&
      !last.paired &&
      now - last.time < DOUBLE_TAP_INTERVAL_MS &&
      Math.hypot(press.at.x - last.point.x, press.at.y - last.point.y) < DOUBLE_TAP_DISTANCE_PX;
    this.lastTap = { time: now, point: press.at, paired: secondOfDouble };
    this.options.onTap(press.at, { pointerType: press.pointerType, secondOfDouble });
  }

  cancel(): void {
    this.press = null;
  }

  dispose(): void {
    this.press = null;
    this.down.clear();
    this.lastTap = null;
  }
}
