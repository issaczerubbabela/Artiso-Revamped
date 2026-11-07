import { describe, expect, it } from 'vitest';
import { MULTI_FINGER_TAP_MAX_DURATION_MS, MULTI_FINGER_TAP_MOVE_TOLERANCE_PX, MultiFingerTapDetector } from '../multi-finger-tap';

function setup() {
  let now = 0;
  const taps: number[] = [];
  const detector = new MultiFingerTapDetector({ onTap: (fingers) => taps.push(fingers), clock: { now: () => now } });
  return {
    detector,
    taps,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('MultiFingerTapDetector', () => {
  it('reports a quick two-finger tap', () => {
    const { detector, taps, advance } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    detector.pointerDown(2, { x: 200, y: 100 }, 'touch');
    advance(120);
    detector.pointerUp(1);
    expect(taps).toEqual([]);
    detector.pointerUp(2);
    expect(taps).toEqual([2]);
  });

  it('reports a three-finger tap, even with the fingers landing one by one', () => {
    const { detector, taps, advance } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    advance(30);
    detector.pointerDown(2, { x: 160, y: 100 }, 'touch');
    advance(30);
    detector.pointerDown(3, { x: 220, y: 100 }, 'touch');
    advance(60);
    detector.pointerUp(2);
    detector.pointerUp(1);
    detector.pointerUp(3);
    expect(taps).toEqual([3]);
  });

  it('ignores one finger: that is an ordinary tap', () => {
    const { detector, taps } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    detector.pointerUp(1);
    expect(taps).toEqual([]);
  });

  it('is not a tap when held too long (a pinch that stayed still)', () => {
    const { detector, taps, advance } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    detector.pointerDown(2, { x: 200, y: 100 }, 'touch');
    advance(MULTI_FINGER_TAP_MAX_DURATION_MS + 1);
    detector.pointerUp(1);
    detector.pointerUp(2);
    expect(taps).toEqual([]);
  });

  it('is not a tap when a finger moves (a pinch or a pan)', () => {
    const { detector, taps } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    detector.pointerDown(2, { x: 200, y: 100 }, 'touch');
    detector.pointerMove(2, { x: 200 + MULTI_FINGER_TAP_MOVE_TOLERANCE_PX + 1, y: 100 });
    detector.pointerUp(1);
    detector.pointerUp(2);
    expect(taps).toEqual([]);
  });

  it('tolerates the jitter of a finger landing', () => {
    const { detector, taps } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    detector.pointerDown(2, { x: 200, y: 100 }, 'touch');
    detector.pointerMove(1, { x: 103, y: 102 });
    detector.pointerUp(1);
    detector.pointerUp(2);
    expect(taps).toEqual([2]);
  });

  it('only counts fingers: a Pencil or a mouse is never part of it', () => {
    const { detector, taps } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    detector.pointerDown(2, { x: 200, y: 100 }, 'pen');
    detector.pointerUp(2);
    detector.pointerUp(1);
    expect(taps).toEqual([]);
  });

  it('starts afresh after a cancel', () => {
    const { detector, taps } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    detector.pointerDown(2, { x: 200, y: 100 }, 'touch');
    detector.cancel();
    detector.pointerUp(1);
    detector.pointerUp(2);
    expect(taps).toEqual([]);
    detector.pointerDown(3, { x: 100, y: 100 }, 'touch');
    detector.pointerDown(4, { x: 200, y: 100 }, 'touch');
    detector.pointerUp(3);
    detector.pointerUp(4);
    expect(taps).toEqual([2]);
  });

  it('is not a tap with more than three fingers', () => {
    const { detector, taps } = setup();
    for (let id = 1; id <= 4; id++) detector.pointerDown(id, { x: id * 50, y: 100 }, 'touch');
    for (let id = 1; id <= 4; id++) detector.pointerUp(id);
    expect(taps).toEqual([]);
  });
});
