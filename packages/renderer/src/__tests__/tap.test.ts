import { describe, expect, it } from 'vitest';
import { TAP_MAX_DURATION_MS, TAP_MOVE_TOLERANCE_PX, TapDetector, type TapInfo } from '../tap';

function setup() {
  let now = 0;
  const taps: { x: number; y: number; info: TapInfo }[] = [];
  const detector = new TapDetector({
    onTap: (point, info) => taps.push({ ...point, info }),
    clock: { now: () => now },
  });
  return {
    detector,
    taps,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('TapDetector', () => {
  it('reports a quick, still press as a tap where it lifted', () => {
    const { detector, taps, advance } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    advance(80);
    detector.pointerMove(1, { x: 103, y: 101 });
    detector.pointerUp(1);
    expect(taps).toEqual([{ x: 103, y: 101, info: { pointerType: 'touch', secondOfDouble: false } }]);
  });

  it('counts a mouse click and a Pencil tap too', () => {
    const { detector, taps, advance } = setup();
    detector.pointerDown(1, { x: 10, y: 10 }, 'mouse');
    detector.pointerUp(1);
    advance(1000);
    detector.pointerDown(2, { x: 10, y: 10 }, 'pen');
    detector.pointerUp(2);
    expect(taps.map((t) => t.info.pointerType)).toEqual(['mouse', 'pen']);
  });

  it('is not a tap once the pointer has moved (a pan)', () => {
    const { detector, taps } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    detector.pointerMove(1, { x: 100 + TAP_MOVE_TOLERANCE_PX + 1, y: 100 });
    detector.pointerMove(1, { x: 100, y: 100 });
    detector.pointerUp(1);
    expect(taps).toEqual([]);
  });

  it('is not a tap when held too long (a long-press)', () => {
    const { detector, taps, advance } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    advance(TAP_MAX_DURATION_MS + 1);
    detector.pointerUp(1);
    expect(taps).toEqual([]);
  });

  it('is not a tap when a second finger joined (a pinch)', () => {
    const { detector, taps } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    detector.pointerDown(2, { x: 200, y: 100 }, 'touch');
    detector.pointerUp(2);
    detector.pointerUp(1);
    expect(taps).toEqual([]);
  });

  it('marks the second tap of a double-tap, so it is not acted on twice', () => {
    const { detector, taps, advance } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    detector.pointerUp(1);
    advance(150);
    detector.pointerDown(2, { x: 105, y: 102 }, 'touch');
    detector.pointerUp(2);
    advance(150);
    // A third tap starts afresh.
    detector.pointerDown(3, { x: 105, y: 102 }, 'touch');
    detector.pointerUp(3);
    expect(taps.map((t) => t.info.secondOfDouble)).toEqual([false, true, false]);
  });

  it('does not pair taps that are far apart in time or space', () => {
    const { detector, taps, advance } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    detector.pointerUp(1);
    advance(400);
    detector.pointerDown(2, { x: 100, y: 100 }, 'touch');
    detector.pointerUp(2);
    advance(100);
    detector.pointerDown(3, { x: 300, y: 100 }, 'touch');
    detector.pointerUp(3);
    expect(taps.map((t) => t.info.secondOfDouble)).toEqual([false, false, false]);
  });

  it('forgets a press when cancelled', () => {
    const { detector, taps } = setup();
    detector.pointerDown(1, { x: 100, y: 100 }, 'touch');
    detector.cancel();
    detector.pointerUp(1);
    expect(taps).toEqual([]);
  });
});
