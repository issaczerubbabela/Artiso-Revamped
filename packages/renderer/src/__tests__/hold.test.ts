import { describe, expect, it } from 'vitest';
import { HOLD_DELAY_MS, HOLD_MOVE_TOLERANCE_PX, HoldDetector } from '../hold';
import type { LongPressTimers } from '../long-press';

class FakeTimers implements LongPressTimers {
  private now = 0;
  private next = 1;
  private readonly pending = new Map<number, { at: number; callback: () => void }>();
  set(callback: () => void, ms: number): number {
    const handle = this.next++;
    this.pending.set(handle, { at: this.now + ms, callback });
    return handle;
  }
  clear(handle: number): void {
    this.pending.delete(handle);
  }
  advance(ms: number): void {
    this.now += ms;
    for (const [handle, timer] of [...this.pending]) {
      if (timer.at <= this.now) {
        this.pending.delete(handle);
        timer.callback();
      }
    }
  }
}

function setup() {
  const timers = new FakeTimers();
  const holds: { x: number; y: number }[] = [];
  const detector = new HoldDetector({ timers, onHold: (point) => holds.push(point) });
  return { timers, holds, detector };
}

describe('HoldDetector', () => {
  it('fires when a drag pauses for the delay', () => {
    const { timers, holds, detector } = setup();
    detector.start({ x: 0, y: 0 });
    detector.move({ x: 40, y: 10 });
    timers.advance(HOLD_DELAY_MS - 1);
    expect(holds).toEqual([]);
    timers.advance(1);
    expect(holds).toEqual([{ x: 40, y: 10 }]);
  });

  it('restarts the wait whenever the drag moves on', () => {
    const { timers, holds, detector } = setup();
    detector.start({ x: 0, y: 0 });
    timers.advance(HOLD_DELAY_MS - 10);
    detector.move({ x: 30, y: 0 });
    timers.advance(HOLD_DELAY_MS - 10);
    expect(holds).toEqual([]);
    timers.advance(10);
    expect(holds).toEqual([{ x: 30, y: 0 }]);
  });

  it('ignores the tremble of a held finger', () => {
    const { timers, holds, detector } = setup();
    detector.start({ x: 10, y: 10 });
    timers.advance(HOLD_DELAY_MS / 2);
    detector.move({ x: 10 + HOLD_MOVE_TOLERANCE_PX - 1, y: 10 });
    timers.advance(HOLD_DELAY_MS / 2);
    expect(holds).toEqual([{ x: 10, y: 10 }]);
  });

  it('never fires after it is stopped', () => {
    const { timers, holds, detector } = setup();
    detector.start({ x: 0, y: 0 });
    detector.stop();
    timers.advance(HOLD_DELAY_MS * 2);
    expect(holds).toEqual([]);
    detector.move({ x: 50, y: 50 });
    timers.advance(HOLD_DELAY_MS * 2);
    expect(holds).toEqual([]);
  });
});
