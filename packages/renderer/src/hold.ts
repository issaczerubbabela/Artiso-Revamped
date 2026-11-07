import { systemTimers, type LongPressTimers } from './long-press';
import type { Point } from './viewport';

// How long a drag must rest at one spot to count as held (Measure's axis snap).
export const HOLD_DELAY_MS = 500;
// A held finger or Pencil trembles; less movement than this is still holding.
export const HOLD_MOVE_TOLERANCE_PX = 6;

export interface HoldOptions {
  onHold: (point: Point) => void;
  timers?: LongPressTimers;
}

// Recognises a pause *during* a drag: the pointer resting within a few px for
// ~500ms. Unlike the long-press it does not end when the pointer moves -- it
// waits again from the new spot -- so "drag, then hold at the end" works.
export class HoldDetector {
  private readonly timers: LongPressTimers;
  private anchor: Point | null = null;
  private timer: number | null = null;

  constructor(private readonly options: HoldOptions) {
    this.timers = options.timers ?? systemTimers;
  }

  start(point: Point): void {
    this.anchor = point;
    this.arm();
  }

  move(point: Point): void {
    const anchor = this.anchor;
    if (!anchor) return;
    if (Math.hypot(point.x - anchor.x, point.y - anchor.y) < HOLD_MOVE_TOLERANCE_PX) return;
    this.anchor = point;
    this.arm();
  }

  stop(): void {
    this.clear();
    this.anchor = null;
  }

  private arm(): void {
    this.clear();
    this.timer = this.timers.set(() => {
      this.timer = null;
      if (this.anchor) this.options.onHold(this.anchor);
    }, HOLD_DELAY_MS);
  }

  private clear(): void {
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
  }
}
