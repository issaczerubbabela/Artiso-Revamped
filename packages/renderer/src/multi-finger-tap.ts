import { systemClock, type GestureClock } from './gesture-engine';
import type { Point } from './viewport';

// Every finger must be up again within this long of the first one landing.
export const MULTI_FINGER_TAP_MAX_DURATION_MS = 250;
// Fingers never land perfectly still; more movement than this is a pinch or a pan.
export const MULTI_FINGER_TAP_MOVE_TOLERANCE_PX = 10;

export interface MultiFingerTapOptions {
  // `fingers` is 2 or 3: how many were down together at most.
  onTap: (fingers: 2 | 3) => void;
  clock?: GestureClock;
}

// Recognises a two- or three-finger tap (the touch shortcuts: undo, show/hide
// grid): fingers landing together and lifting quickly without moving. Only
// touches count -- a Pencil or a mouse is never part of one -- and a single
// finger is an ordinary tap, left to the TapDetector. Like the other
// detectors it only listens: the gesture engine sees the same pointers.
export class MultiFingerTapDetector {
  private readonly clock: GestureClock;
  private readonly down = new Map<number, Point>();
  private start = 0;
  private most = 0;
  private valid = false;

  constructor(private readonly options: MultiFingerTapOptions) {
    this.clock = options.clock ?? systemClock;
  }

  pointerDown(pointerId: number, point: Point, pointerType: string): void {
    if (pointerType !== 'touch') {
      // Anything but a finger in the middle of it rules it out.
      this.valid = false;
      return;
    }
    if (this.down.size === 0) {
      this.start = this.clock.now();
      this.most = 0;
      this.valid = true;
    }
    this.down.set(pointerId, point);
    this.most = Math.max(this.most, this.down.size);
  }

  pointerMove(pointerId: number, point: Point): void {
    const origin = this.down.get(pointerId);
    if (!origin) return;
    if (Math.hypot(point.x - origin.x, point.y - origin.y) > MULTI_FINGER_TAP_MOVE_TOLERANCE_PX) this.valid = false;
  }

  pointerUp(pointerId: number): void {
    if (!this.down.delete(pointerId) || this.down.size > 0) return;
    const fingers = this.most;
    const quick = this.clock.now() - this.start <= MULTI_FINGER_TAP_MAX_DURATION_MS;
    const valid = this.valid;
    this.valid = false;
    if (valid && quick && (fingers === 2 || fingers === 3)) this.options.onTap(fingers);
  }

  // The fingers on screen now can no longer make a tap (a pointercancel, say).
  cancel(): void {
    this.valid = false;
  }

  dispose(): void {
    this.down.clear();
    this.valid = false;
  }
}
