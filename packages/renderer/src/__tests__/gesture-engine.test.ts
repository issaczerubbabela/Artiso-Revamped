import { describe, expect, it, vi } from 'vitest';
import { GestureEngine, type FrameScheduler, type GestureClock } from '../gesture-engine';
import { Viewport, type Point, type ViewportOptions } from '../viewport';

// A clock that only moves when the test says so.
class FakeClock implements GestureClock {
  private t = 1000;
  now(): number {
    return this.t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

// A frame scheduler whose frames only run when the test flushes them.
class FakeScheduler implements FrameScheduler {
  private next = 1;
  readonly pending = new Map<number, (time: number) => void>();
  request(callback: (time: number) => void): number {
    const handle = this.next++;
    this.pending.set(handle, callback);
    return handle;
  }
  cancel(handle: number): void {
    this.pending.delete(handle);
  }
}

const DRAW: ViewportOptions = { minScale: 'fit', maxScale: 30, panSlack: 48, fitPadding: 16 };

function setup(options: { locked?: boolean; viewport?: Viewport } = {}) {
  const viewport = options.viewport ?? new Viewport(1000, 800, 210, 297, DRAW);
  const clock = new FakeClock();
  const scheduler = new FakeScheduler();
  const onChange = vi.fn();
  let locked = options.locked ?? false;
  const engine = new GestureEngine({
    viewport,
    onChange,
    isGestureLocked: () => locked,
    clock,
    scheduler,
  });
  return {
    viewport,
    clock,
    scheduler,
    onChange,
    engine,
    setLocked: (value: boolean) => {
      locked = value;
    },
  };
}

// A tap: down and up at one point, `holdMs` apart.
function tap(engine: GestureEngine, clock: FakeClock, id: number, point: Point, holdMs = 40): void {
  engine.pointerDown(id, point);
  clock.advance(holdMs);
  engine.pointerUp(id);
}

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

describe('GestureEngine: one-finger pan', () => {
  it('pans the view 1:1 with the pointer', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(10);
    const before = viewport.getState();
    engine.pointerDown(1, { x: 500, y: 400 });
    engine.pointerMove(1, { x: 470, y: 425 });
    engine.pointerMove(1, { x: 440, y: 450 });
    const after = viewport.getState();
    expect(after.translateX).toBeCloseTo(before.translateX - 60, 9);
    expect(after.translateY).toBeCloseTo(before.translateY + 50, 9);
    expect(after.scale).toBe(before.scale);
  });

  it('reports every change so the canvas repaints', () => {
    const { viewport, engine, onChange } = setup();
    viewport.setZoom(10);
    engine.pointerDown(1, { x: 500, y: 400 });
    engine.pointerMove(1, { x: 490, y: 400 });
    engine.pointerMove(1, { x: 480, y: 400 });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('ignores moves from a pointer it never saw go down', () => {
    const { viewport, engine, onChange } = setup();
    viewport.setZoom(10);
    const before = viewport.getState();
    engine.pointerMove(7, { x: 10, y: 10 });
    expect(viewport.getState()).toEqual(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('has no glide after release (no momentum yet)', () => {
    const { viewport, engine, scheduler } = setup();
    viewport.setZoom(10);
    engine.pointerDown(1, { x: 500, y: 400 });
    engine.pointerMove(1, { x: 300, y: 400 });
    engine.pointerUp(1);
    expect(scheduler.pending.size).toBe(0);
  });
});

describe('GestureEngine: two-finger pinch', () => {
  it('zooms by the change in finger distance, anchored at the midpoint', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(4);
    const a0 = { x: 400, y: 400 };
    const b0 = { x: 600, y: 400 };
    const scale0 = viewport.getState().scale;

    engine.pointerDown(1, a0);
    engine.pointerDown(2, b0);
    // Both fingers spread, one pointer event each, to 1.5x the distance about
    // the same midpoint.
    const mid = midpoint(a0, b0);
    const underMid = viewport.screenToImage(mid);
    const a1 = { x: 350, y: 400 };
    const b1 = { x: 650, y: 400 };
    engine.pointerMove(1, a1);
    engine.pointerMove(2, b1);

    expect(viewport.getState().scale).toBeCloseTo(scale0 * 1.5, 9);
    // Each move zooms about the midpoint *at that moment*: (475,400) after the
    // first finger, then (500,400) after the second.
    const reference = new Viewport(1000, 800, 210, 297, DRAW);
    reference.setZoom(4);
    reference.setZoom(scale0 * (250 / 200), midpoint(a1, b0));
    reference.setZoom(scale0 * 1.5, midpoint(a1, b1));
    expect(viewport.getState().translateX).toBeCloseTo(reference.getState().translateX, 9);
    expect(viewport.getState().translateY).toBeCloseTo(reference.getState().translateY, 9);
    // The midpoint's content drifts by no more than the half-step it moved.
    const after = viewport.screenToImage(mid);
    expect(Math.abs(after.x - underMid.x)).toBeLessThan(25 / scale0);
    expect(after.y).toBeCloseTo(underMid.y, 9);
  });

  it('anchors each step at the current midpoint and does not pan with it', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(4);
    const a = { x: 400, y: 400 };
    engine.pointerDown(1, a);
    engine.pointerDown(2, { x: 600, y: 400 });
    // Only the second finger moves: distance 200 -> 300, midpoint (500,400) -> (550,400).
    const expected = new Viewport(1000, 800, 210, 297, DRAW);
    expected.setState(viewport.getState());
    expected.setZoom(expected.getState().scale * (300 / 200), { x: 550, y: 400 });
    engine.pointerMove(2, { x: 700, y: 400 });
    expect(viewport.getState()).toEqual(expected.getState());
  });

  it('pinching in is floored at fit', () => {
    const { viewport, engine } = setup();
    const fit = viewport.getState().scale;
    engine.pointerDown(1, { x: 300, y: 400 });
    engine.pointerDown(2, { x: 700, y: 400 });
    engine.pointerMove(1, { x: 480, y: 400 });
    engine.pointerMove(2, { x: 520, y: 400 });
    expect(viewport.getState().scale).toBeCloseTo(fit, 12);
  });

  it('never turns the view, however the fingers twist', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(4);
    const a0 = { x: 400, y: 400 };
    const b0 = { x: 600, y: 400 };
    engine.pointerDown(1, a0);
    engine.pointerDown(2, b0);
    // A 45° twist about the midpoint, at the same distance.
    const r = distance(a0, b0) / 2;
    engine.pointerMove(1, { x: 500 - r * Math.SQRT1_2, y: 400 - r * Math.SQRT1_2 });
    engine.pointerMove(2, { x: 500 + r * Math.SQRT1_2, y: 400 + r * Math.SQRT1_2 });
    expect(viewport.getState().rotation).toBe(0);
  });

  it('turns into a pan when one finger lifts, with no zoom jump', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(4);
    engine.pointerDown(1, { x: 400, y: 400 });
    engine.pointerDown(2, { x: 600, y: 400 });
    engine.pointerMove(2, { x: 700, y: 400 });
    engine.pointerUp(2);
    const before = viewport.getState();
    engine.pointerMove(1, { x: 420, y: 390 });
    const after = viewport.getState();
    expect(after.scale).toBe(before.scale);
    expect(after.translateX).toBeCloseTo(before.translateX + 20, 9);
    expect(after.translateY).toBeCloseTo(before.translateY - 10, 9);
  });

  it('ignores a third finger', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(4);
    engine.pointerDown(1, { x: 400, y: 400 });
    engine.pointerDown(2, { x: 600, y: 400 });
    engine.pointerDown(3, { x: 500, y: 600 });
    const before = viewport.getState();
    engine.pointerMove(3, { x: 500, y: 700 });
    engine.pointerMove(1, { x: 300, y: 400 });
    expect(viewport.getState()).toEqual(before);
  });
});

describe('GestureEngine: wheel', () => {
  it('zooms exponentially in the scroll delta, anchored at the cursor', () => {
    const { viewport, engine, onChange } = setup();
    viewport.setZoom(4);
    const cursor = { x: 250, y: 300 };
    const under = viewport.screenToImage(cursor);
    const scale0 = viewport.getState().scale;
    engine.wheel(cursor, -200);
    expect(viewport.getState().scale).toBeCloseTo(scale0 * Math.exp(0.2), 9);
    const after = viewport.screenToImage(cursor);
    expect(after.x).toBeCloseTo(under.x, 9);
    expect(after.y).toBeCloseTo(under.y, 9);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('GestureEngine: double-tap', () => {
  it('fits on a double-tap, then goes back to the previous view on the next', () => {
    const { viewport, engine, clock } = setup();
    viewport.setZoom(9, { x: 300, y: 300 });
    const zoomed = viewport.getState();

    tap(engine, clock, 1, { x: 500, y: 400 });
    clock.advance(150);
    tap(engine, clock, 2, { x: 505, y: 404 });
    expect(viewport.getState().scale).toBeCloseTo(viewport.getFitScale(), 12);

    clock.advance(1000);
    tap(engine, clock, 3, { x: 500, y: 400 });
    clock.advance(150);
    tap(engine, clock, 4, { x: 500, y: 400 });
    expect(viewport.getState()).toEqual(zoomed);
  });

  it('measures the interval between the two releases on the injected clock', () => {
    const { viewport, engine, clock } = setup();
    viewport.setZoom(9);
    const zoomed = viewport.getState();
    tap(engine, clock, 1, { x: 500, y: 400 }, 0);
    // 299 ms from release to release is a double-tap...
    clock.advance(259);
    tap(engine, clock, 2, { x: 500, y: 400 }, 40);
    expect(viewport.getState().scale).toBeCloseTo(viewport.getFitScale(), 12);

    viewport.setState(zoomed);
    clock.advance(1000);
    tap(engine, clock, 3, { x: 500, y: 400 }, 0);
    // ...300 ms is not.
    clock.advance(260);
    tap(engine, clock, 4, { x: 500, y: 400 }, 40);
    expect(viewport.getState()).toEqual(zoomed);
  });

  it('needs both taps at roughly the same place', () => {
    const { viewport, engine, clock } = setup();
    viewport.setZoom(9);
    const zoomed = viewport.getState();
    tap(engine, clock, 1, { x: 500, y: 400 });
    clock.advance(100);
    tap(engine, clock, 2, { x: 530, y: 400 });
    expect(viewport.getState()).toEqual(zoomed);
  });
});

describe('GestureEngine: Gesture Lock', () => {
  it('ignores pan, pinch, wheel and double-tap while locked', () => {
    const { viewport, engine, clock, onChange } = setup({ locked: true });
    viewport.setZoom(6);
    const before = viewport.getState();

    engine.pointerDown(1, { x: 500, y: 400 });
    engine.pointerMove(1, { x: 300, y: 300 });
    engine.pointerDown(2, { x: 600, y: 400 });
    engine.pointerMove(2, { x: 800, y: 400 });
    engine.pointerUp(1);
    engine.pointerUp(2);
    engine.wheel({ x: 100, y: 100 }, -500);
    tap(engine, clock, 3, { x: 500, y: 400 });
    clock.advance(100);
    tap(engine, clock, 4, { x: 500, y: 400 });

    expect(viewport.getState()).toEqual(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps tracking pointers while locked, so unlocking mid-drag does not jump', () => {
    const { viewport, engine, setLocked } = setup({ locked: true });
    viewport.setZoom(6);
    engine.pointerDown(1, { x: 500, y: 400 });
    engine.pointerMove(1, { x: 300, y: 300 });
    setLocked(false);
    const before = viewport.getState();
    engine.pointerMove(1, { x: 310, y: 300 });
    expect(viewport.getState().translateX).toBeCloseTo(before.translateX + 10, 9);
  });
});

describe('GestureEngine: dispose', () => {
  it('forgets its pointers', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(6);
    engine.pointerDown(1, { x: 500, y: 400 });
    engine.dispose();
    const before = viewport.getState();
    engine.pointerMove(1, { x: 100, y: 100 });
    expect(viewport.getState()).toEqual(before);
  });
});
