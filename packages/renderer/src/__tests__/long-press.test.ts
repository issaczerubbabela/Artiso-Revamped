import { describe, expect, it } from 'vitest';
import { LONG_PRESS_DELAY_MS, LONG_PRESS_MOVE_TOLERANCE_PX, LongPressDetector, type LongPressTimers } from '../long-press';

// Timers that only fire when the test advances time.
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
  const presses: { x: number; y: number }[] = [];
  const detector = new LongPressDetector({ timers, onLongPress: (point) => presses.push(point) });
  return { timers, presses, detector };
}

describe('LongPressDetector', () => {
  it('fires once a still touch has been held for the delay', () => {
    const { timers, presses, detector } = setup();
    detector.pointerDown(1, { x: 100, y: 200 }, 'touch');
    timers.advance(LONG_PRESS_DELAY_MS - 1);
    expect(presses).toHaveLength(0);
    timers.advance(1);
    expect(presses).toEqual([{ x: 100, y: 200 }]);
  });

  it('is about half a second', () => {
    expect(LONG_PRESS_DELAY_MS).toBeGreaterThanOrEqual(450);
    expect(LONG_PRESS_DELAY_MS).toBeLessThanOrEqual(600);
  });

  it('tolerates a finger wobble but is cancelled by movement', () => {
    const { timers, presses, detector } = setup();
    detector.pointerDown(1, { x: 100, y: 200 }, 'touch');
    detector.pointerMove(1, { x: 100 + LONG_PRESS_MOVE_TOLERANCE_PX - 1, y: 200 });
    timers.advance(LONG_PRESS_DELAY_MS);
    expect(presses).toHaveLength(1);

    detector.pointerUp(1);
    detector.pointerDown(2, { x: 100, y: 200 }, 'touch');
    detector.pointerMove(2, { x: 100, y: 200 + LONG_PRESS_MOVE_TOLERANCE_PX + 1 });
    timers.advance(LONG_PRESS_DELAY_MS);
    expect(presses).toHaveLength(1);
  });

  it('is cancelled by lifting early', () => {
    const { timers, presses, detector } = setup();
    detector.pointerDown(1, { x: 0, y: 0 }, 'touch');
    timers.advance(200);
    detector.pointerUp(1);
    timers.advance(LONG_PRESS_DELAY_MS);
    expect(presses).toHaveLength(0);
  });

  it('is cancelled by a second finger (a pinch is not a press)', () => {
    const { timers, presses, detector } = setup();
    detector.pointerDown(1, { x: 0, y: 0 }, 'touch');
    detector.pointerDown(2, { x: 50, y: 0 }, 'touch');
    timers.advance(LONG_PRESS_DELAY_MS * 2);
    expect(presses).toHaveLength(0);
  });

  it('ignores the mouse, which has right-click instead', () => {
    const { timers, presses, detector } = setup();
    detector.pointerDown(1, { x: 0, y: 0 }, 'mouse');
    timers.advance(LONG_PRESS_DELAY_MS);
    expect(presses).toHaveLength(0);
  });

  it('can be cancelled from outside', () => {
    const { timers, presses, detector } = setup();
    detector.pointerDown(1, { x: 0, y: 0 }, 'pen');
    detector.cancel();
    timers.advance(LONG_PRESS_DELAY_MS);
    expect(presses).toHaveLength(0);
  });
});
