import { describe, expect, it, vi } from 'vitest';
import {
  GLIDE_DECAY_PER_MS,
  GLIDE_MIN_START_SPEED,
  GestureEngine,
  type FrameScheduler,
  type GestureClock,
} from '../gesture-engine';
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

function setup(options: { locked?: boolean; viewport?: Viewport; rotationLocked?: boolean; reducedMotion?: boolean } = {}) {
  const viewport = options.viewport ?? new Viewport(1000, 800, 210, 297, DRAW);
  const clock = new FakeClock();
  const scheduler = new FakeScheduler();
  const onChange = vi.fn();
  let locked = options.locked ?? false;
  const engine = new GestureEngine({
    viewport,
    onChange,
    isGestureLocked: () => locked,
    isRotationLocked: () => options.rotationLocked ?? false,
    prefersReducedMotion: () => options.reducedMotion ?? false,
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
const deg = (d: number) => (d * Math.PI) / 180;

// Puts fingers 1 and 2 `radius` px either side of `centre`, along `degrees`
// (finger 1 behind, finger 2 ahead), one pointer move each.
function twistTo(engine: GestureEngine, centre: Point, radius: number, degrees: number): void {
  const dx = radius * Math.cos(deg(degrees));
  const dy = radius * Math.sin(deg(degrees));
  engine.pointerMove(1, { x: centre.x - dx, y: centre.y - dy });
  engine.pointerMove(2, { x: centre.x + dx, y: centre.y + dy });
}

// Runs up to `count` display frames, 16 ms apart on the fake clock.
function runFrames(scheduler: FakeScheduler, clock: FakeClock, count: number): void {
  for (let i = 0; i < count && scheduler.pending.size > 0; i++) {
    clock.advance(16);
    const callbacks = [...scheduler.pending.values()];
    scheduler.pending.clear();
    for (const callback of callbacks) callback(clock.now());
  }
}

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

  it('does not glide when the finger stopped before lifting', () => {
    const { viewport, engine, scheduler, clock } = setup();
    viewport.setZoom(10);
    engine.pointerDown(1, { x: 500, y: 400 });
    clock.advance(16);
    engine.pointerMove(1, { x: 400, y: 400 });
    clock.advance(16);
    engine.pointerMove(1, { x: 300, y: 400 });
    clock.advance(120);
    engine.pointerUp(1);
    expect(scheduler.pending.size).toBe(0);
  });
});

describe('GestureEngine: two-finger pinch, pan and twist', () => {
  it('zooms by the change in finger distance and keeps the content under the fingers', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(10);
    const a0 = { x: 400, y: 400 };
    const b0 = { x: 600, y: 400 };
    const scale0 = viewport.getState().scale;
    const under = viewport.screenToImage(midpoint(a0, b0));

    engine.pointerDown(1, a0);
    engine.pointerDown(2, b0);
    // Both fingers spread to 1.5x the distance about the same midpoint.
    engine.pointerMove(1, { x: 350, y: 400 });
    engine.pointerMove(2, { x: 650, y: 400 });

    expect(viewport.getState().scale).toBeCloseTo(scale0 * 1.5, 9);
    const after = viewport.imageToScreen(under);
    expect(after.x).toBeCloseTo(500, 6);
    expect(after.y).toBeCloseTo(400, 6);
  });

  it('pans with the midpoint while pinching, in one gesture', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(10);
    const under = viewport.screenToImage({ x: 500, y: 400 });
    engine.pointerDown(1, { x: 400, y: 400 });
    engine.pointerDown(2, { x: 600, y: 400 });
    // Spread to 300px apart while the midpoint moves 60px right and 30px down.
    engine.pointerMove(1, { x: 410, y: 430 });
    engine.pointerMove(2, { x: 710, y: 430 });
    const after = viewport.imageToScreen(under);
    expect(after.x).toBeCloseTo(560, 6);
    expect(after.y).toBeCloseTo(430, 6);
    expect(viewport.getState().rotation).toBe(0);
  });

  it('springs back to fit after pinching in past it', () => {
    const { viewport, engine, scheduler, clock } = setup();
    const fit = viewport.getState().scale;
    engine.pointerDown(1, { x: 300, y: 400 });
    engine.pointerDown(2, { x: 700, y: 400 });
    engine.pointerMove(1, { x: 480, y: 400 });
    engine.pointerMove(2, { x: 520, y: 400 });
    // Stretched past the limit, with resistance: below fit, but not 10x below.
    const stretched = viewport.getState().scale;
    expect(stretched).toBeLessThan(fit);
    expect(stretched).toBeGreaterThan(fit / 1.3);

    engine.pointerUp(1);
    engine.pointerUp(2);
    expect(scheduler.pending.size).toBe(1);
    runFrames(scheduler, clock, 60);
    expect(scheduler.pending.size).toBe(0);
    expect(viewport.getState().scale).toBeCloseTo(fit, 12);
  });

  it('springs back to the zoom limit after pinching out past it, about the fingers', () => {
    const { viewport, engine, scheduler, clock } = setup();
    viewport.setZoom(28, { x: 500, y: 400 });
    engine.pointerDown(1, { x: 450, y: 400 });
    engine.pointerDown(2, { x: 550, y: 400 });
    engine.pointerMove(1, { x: 350, y: 400 });
    engine.pointerMove(2, { x: 650, y: 400 });
    expect(viewport.getState().scale).toBeGreaterThan(30);
    const anchor = viewport.screenToImage({ x: 500, y: 400 });
    engine.pointerUp(1);
    engine.pointerUp(2);
    // Part-way back after a few frames...
    runFrames(scheduler, clock, 2);
    const mid = viewport.getState().scale;
    expect(mid).toBeGreaterThan(30);
    expect(mid).toBeLessThan(30 * 1.3);
    // ...and exactly on the limit at the end, with the fingers' point still put.
    runFrames(scheduler, clock, 60);
    expect(viewport.getState().scale).toBe(30);
    const at = viewport.imageToScreen(anchor);
    expect(at.x).toBeCloseTo(500, 6);
    expect(at.y).toBeCloseTo(400, 6);
  });

  it('under reduced motion, stops at the zoom limit with nothing to spring back', () => {
    const { viewport, engine, scheduler } = setup({ reducedMotion: true });
    const fit = viewport.getState().scale;
    engine.pointerDown(1, { x: 300, y: 400 });
    engine.pointerDown(2, { x: 700, y: 400 });
    engine.pointerMove(1, { x: 480, y: 400 });
    engine.pointerMove(2, { x: 520, y: 400 });
    expect(viewport.getState().scale).toBeCloseTo(fit, 12);
    engine.pointerUp(1);
    engine.pointerUp(2);
    expect(scheduler.pending.size).toBe(0);
    expect(viewport.getState().scale).toBeCloseTo(fit, 12);
  });

  it('does not turn the view for a twist under the ~10° dead zone', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(10);
    engine.pointerDown(1, { x: 400, y: 400 });
    engine.pointerDown(2, { x: 600, y: 400 });
    twistTo(engine, { x: 500, y: 400 }, 100, 9);
    expect(viewport.getState().rotation).toBe(0);
  });

  it('turns past the dead zone from where it is, then follows the fingers 1:1', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(10);
    const centre = { x: 500, y: 400 };
    engine.pointerDown(1, { x: 400, y: 400 });
    engine.pointerDown(2, { x: 600, y: 400 });
    twistTo(engine, centre, 100, 12);
    expect(viewport.getState().rotation).toBeCloseTo(deg(2), 9);
    twistTo(engine, centre, 100, 40);
    expect(viewport.getState().rotation).toBeCloseTo(deg(30), 9);
    // The other way, back through the start.
    twistTo(engine, centre, 100, -20);
    expect(viewport.getState().rotation).toBeCloseTo(deg(-30), 9);
  });

  it('keeps the point between the fingers fixed while turning and zooming', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(10);
    const centre = { x: 500, y: 400 };
    const under = viewport.screenToImage(centre);
    engine.pointerDown(1, { x: 400, y: 400 });
    engine.pointerDown(2, { x: 600, y: 400 });
    twistTo(engine, centre, 100, 30);
    twistTo(engine, centre, 150, 60);
    const at = viewport.imageToScreen(under);
    expect(at.x).toBeCloseTo(500, 6);
    expect(at.y).toBeCloseTo(400, 6);
    expect(viewport.getState().rotation).toBeCloseTo(deg(50), 9);
  });

  it('snaps to the nearest right angle on release when within 5°', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(10);
    const centre = { x: 500, y: 400 };
    engine.pointerDown(1, { x: 400, y: 400 });
    engine.pointerDown(2, { x: 600, y: 400 });
    twistTo(engine, centre, 100, 96); // 86° shown
    expect(viewport.getState().rotation).toBeCloseTo(deg(86), 9);
    engine.pointerUp(1);
    // Still turned while one finger is down.
    expect(viewport.getState().rotation).toBeCloseTo(deg(86), 9);
    engine.pointerUp(2);
    expect(viewport.getState().rotation).toBeCloseTo(Math.PI / 2, 12);
  });

  it('does not snap at 45° or anywhere more than 5° from a right angle', () => {
    for (const shown of [45, 84, 30]) {
      const { viewport, engine } = setup();
      viewport.setZoom(10);
      engine.pointerDown(1, { x: 400, y: 400 });
      engine.pointerDown(2, { x: 600, y: 400 });
      twistTo(engine, { x: 500, y: 400 }, 100, shown + 10);
      engine.pointerUp(1);
      engine.pointerUp(2);
      expect(viewport.getState().rotation).toBeCloseTo(deg(shown), 9);
    }
  });

  it('never keeps turning after release: rotation has no momentum', () => {
    const { viewport, engine, scheduler, clock } = setup();
    viewport.setZoom(10);
    engine.pointerDown(1, { x: 400, y: 400 });
    engine.pointerDown(2, { x: 600, y: 400 });
    for (let step = 1; step <= 10; step++) {
      clock.advance(8);
      twistTo(engine, { x: 500 + step * 20, y: 400 }, 100, 10 + step * 4);
    }
    const released = viewport.getState();
    engine.pointerUp(1);
    engine.pointerUp(2);
    expect(scheduler.pending.size).toBe(0);
    runFrames(scheduler, clock, 30);
    expect(viewport.getState()).toEqual(released);
  });

  it('with rotation locked, ignores the twist but still pinches and pans', () => {
    const { viewport, engine } = setup({ rotationLocked: true });
    viewport.setZoom(10);
    const scale0 = viewport.getState().scale;
    const under = viewport.screenToImage({ x: 500, y: 400 });
    engine.pointerDown(1, { x: 400, y: 400 });
    engine.pointerDown(2, { x: 600, y: 400 });
    twistTo(engine, { x: 540, y: 420 }, 150, 60);
    expect(viewport.getState().rotation).toBe(0);
    expect(viewport.getState().scale).toBeCloseTo(scale0 * 1.5, 9);
    const at = viewport.imageToScreen(under);
    expect(at.x).toBeCloseTo(540, 6);
    expect(at.y).toBeCloseTo(420, 6);
  });

  it('turns into a pan when one finger lifts, with no zoom jump', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(10);
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
    viewport.setZoom(10);
    engine.pointerDown(1, { x: 400, y: 400 });
    engine.pointerDown(2, { x: 600, y: 400 });
    engine.pointerDown(3, { x: 500, y: 600 });
    const before = viewport.getState();
    engine.pointerMove(3, { x: 500, y: 700 });
    engine.pointerMove(1, { x: 300, y: 400 });
    expect(viewport.getState()).toEqual(before);
  });
});

describe('GestureEngine: flick glide', () => {
  function flick(engine: GestureEngine, clock: FakeClock, speed: number): void {
    engine.pointerDown(1, { x: 500, y: 400 });
    for (let step = 1; step <= 5; step++) {
      clock.advance(10);
      engine.pointerMove(1, { x: 500 - step * speed * 10, y: 400 });
    }
    engine.pointerUp(1);
  }

  it('glides on in the flick direction with decaying speed, then stops', () => {
    const { viewport, engine, scheduler, clock } = setup();
    viewport.setZoom(20);
    flick(engine, clock, 1); // 1 px/ms to the left
    const released = viewport.getState().translateX;
    expect(scheduler.pending.size).toBe(1);

    // Ten 16ms frames: each moves v*dt, then v decays by 0.995^dt.
    runFrames(scheduler, clock, 10);
    let expected = 0;
    let v = 1;
    for (let i = 0; i < 10; i++) {
      expected += v * 16;
      v *= Math.pow(GLIDE_DECAY_PER_MS, 16);
    }
    expect(viewport.getState().translateX).toBeCloseTo(released - expected, 6);

    runFrames(scheduler, clock, 200);
    expect(scheduler.pending.size).toBe(0);
    // About speed x 200 ms in total.
    const total = released - viewport.getState().translateX;
    expect(total).toBeGreaterThan(180);
    expect(total).toBeLessThan(215);
  });

  it('does not glide after a slow drag', () => {
    const { viewport, engine, scheduler, clock } = setup();
    viewport.setZoom(20);
    flick(engine, clock, GLIDE_MIN_START_SPEED / 2);
    expect(scheduler.pending.size).toBe(0);
  });

  it('stops the glide when a finger touches down', () => {
    const { viewport, engine, scheduler, clock } = setup();
    viewport.setZoom(20);
    flick(engine, clock, 1);
    runFrames(scheduler, clock, 3);
    engine.pointerDown(2, { x: 100, y: 100 });
    expect(scheduler.pending.size).toBe(0);
    const caught = viewport.getState();
    runFrames(scheduler, clock, 10);
    expect(viewport.getState()).toEqual(caught);
  });

  it('never glides after a two-finger gesture', () => {
    const { viewport, engine, scheduler, clock } = setup();
    viewport.setZoom(20);
    engine.pointerDown(1, { x: 400, y: 400 });
    engine.pointerDown(2, { x: 600, y: 400 });
    engine.pointerUp(2);
    for (let step = 1; step <= 5; step++) {
      clock.advance(10);
      engine.pointerMove(1, { x: 400 - step * 20, y: 400 });
    }
    engine.pointerUp(1);
    expect(scheduler.pending.size).toBe(0);
  });

  it('has no glide under reduced motion', () => {
    const { viewport, engine, scheduler, clock } = setup({ reducedMotion: true });
    viewport.setZoom(20);
    flick(engine, clock, 2);
    expect(scheduler.pending.size).toBe(0);
  });
});

describe('GestureEngine: desktop input', () => {
  it('Shift+drag turns the view about the visible centre and snaps on release', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(10);
    const pivot = viewport.getVisibleCenter();
    const under = viewport.screenToImage(pivot);
    const r = 200;
    const at = (degrees: number) => ({ x: pivot.x + r * Math.cos(deg(degrees)), y: pivot.y + r * Math.sin(deg(degrees)) });
    engine.pointerDown(1, at(0));
    for (const d of [10, 20, 30]) engine.pointerMove(1, at(d), { shiftKey: true });
    expect(viewport.getState().rotation).toBeCloseTo(deg(30), 9);
    for (const d of [60, 88]) engine.pointerMove(1, at(d), { shiftKey: true });
    engine.pointerUp(1);
    expect(viewport.getState().rotation).toBeCloseTo(Math.PI / 2, 12);
    const still = viewport.imageToScreen(under);
    expect(still.x).toBeCloseTo(pivot.x, 6);
    expect(still.y).toBeCloseTo(pivot.y, 6);
  });

  it('Shift+drag does nothing while rotation is locked', () => {
    const { viewport, engine } = setup({ rotationLocked: true });
    viewport.setZoom(10);
    const before = viewport.getState();
    engine.pointerDown(1, { x: 700, y: 400 });
    engine.pointerMove(1, { x: 700, y: 600 }, { shiftKey: true });
    engine.pointerUp(1);
    expect(viewport.getState()).toEqual(before);
  });

  it('a trackpad gesture pinches and turns like two fingers', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(10);
    const scale0 = viewport.getState().scale;
    const cursor = { x: 300, y: 300 };
    const under = viewport.screenToImage(cursor);
    engine.trackpadGestureStart(cursor);
    engine.trackpadGestureChange(cursor, 1.2, 5);
    expect(viewport.getState().rotation).toBe(0);
    engine.trackpadGestureChange(cursor, 1.5, 47);
    expect(viewport.getState().rotation).toBeCloseTo(deg(37), 9);
    expect(viewport.getState().scale).toBeCloseTo(scale0 * 1.5, 9);
    const at = viewport.imageToScreen(under);
    expect(at.x).toBeCloseTo(300, 6);
    expect(at.y).toBeCloseTo(300, 6);
    engine.trackpadGestureChange(cursor, 1.5, 96);
    engine.trackpadGestureEnd();
    expect(viewport.getState().rotation).toBeCloseTo(Math.PI / 2, 12);
  });

  it('ignores a trackpad gesture while fingers are down (iPad sends both)', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(10);
    engine.pointerDown(1, { x: 400, y: 400 });
    const before = viewport.getState();
    engine.trackpadGestureStart({ x: 500, y: 400 });
    engine.trackpadGestureChange({ x: 500, y: 400 }, 2, 90);
    engine.trackpadGestureEnd();
    expect(viewport.getState()).toEqual(before);
  });

  it('Ctrl+wheel (a trackpad pinch in Chromium) zooms at the cursor', () => {
    const { viewport, engine } = setup();
    viewport.setZoom(10);
    const cursor = { x: 250, y: 300 };
    const under = viewport.screenToImage(cursor);
    const scale0 = viewport.getState().scale;
    engine.wheel(cursor, -10, { ctrlKey: true });
    expect(viewport.getState().scale).toBeCloseTo(scale0 * Math.exp(0.1), 9);
    const after = viewport.imageToScreen(under);
    expect(after.x).toBeCloseTo(cursor.x, 6);
    expect(after.y).toBeCloseTo(cursor.y, 6);
    // A Ctrl+mouse-wheel notch is capped.
    const scale1 = viewport.getState().scale;
    engine.wheel(cursor, -100, { ctrlKey: true });
    expect(viewport.getState().scale).toBeCloseTo(scale1 * Math.exp(0.25), 9);
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
  it('never counts a two-finger tap as a tap (that is the undo shortcut)', () => {
    const { viewport, engine, clock } = setup();
    viewport.setZoom(9, { x: 300, y: 300 });
    const zoomed = viewport.getState();
    for (let i = 0; i < 2; i++) {
      engine.pointerDown(10 + i * 2, { x: 500, y: 400 });
      engine.pointerDown(11 + i * 2, { x: 600, y: 400 });
      clock.advance(40);
      engine.pointerUp(10 + i * 2);
      engine.pointerUp(11 + i * 2);
      clock.advance(100);
    }
    expect(viewport.getState()).toEqual(zoomed);
  });

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

  it('fits and squares up a turned view, and the next double-tap turns it back', () => {
    const { viewport, engine, clock } = setup();
    viewport.setZoom(9);
    viewport.setRotation(deg(37));
    const turned = viewport.getState();
    tap(engine, clock, 1, { x: 500, y: 400 });
    clock.advance(150);
    tap(engine, clock, 2, { x: 500, y: 400 });
    expect(viewport.getState().rotation).toBe(0);
    expect(viewport.getState().scale).toBeCloseTo(viewport.getFitScale(0), 12);
    clock.advance(1000);
    tap(engine, clock, 3, { x: 500, y: 400 });
    clock.advance(150);
    tap(engine, clock, 4, { x: 500, y: 400 });
    expect(viewport.getState()).toEqual(turned);
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

describe('GestureEngine: which pointers it takes', () => {
  // Pencil-only Drawing: the Pencil draws, so only fingers move the view.
  function setupFingersOnly() {
    const viewport = new Viewport(1000, 800, 210, 297, DRAW);
    const engine = new GestureEngine({ viewport, onChange: () => {}, acceptsPointer: (type) => type === 'touch' });
    viewport.setZoom(6);
    return { viewport, engine };
  }

  it('ignores a pointer type it does not accept', () => {
    const { viewport, engine } = setupFingersOnly();
    const before = viewport.getState();
    engine.pointerDown(1, { x: 500, y: 400 }, 'pen');
    engine.pointerMove(1, { x: 300, y: 300 });
    engine.pointerUp(1);
    expect(viewport.getState()).toEqual(before);
    expect(engine.isTracking(1)).toBe(false);
  });

  it('still pans with the pointers it accepts', () => {
    const { viewport, engine } = setupFingersOnly();
    const before = viewport.getState();
    engine.pointerDown(2, { x: 500, y: 400 }, 'touch');
    engine.pointerMove(2, { x: 480, y: 400 });
    expect(viewport.getState().translateX).toBeCloseTo(before.translateX - 20, 9);
  });

  it('takes every pointer when no type is given', () => {
    const { viewport, engine } = setupFingersOnly();
    const before = viewport.getState();
    engine.pointerDown(3, { x: 500, y: 400 });
    engine.pointerMove(3, { x: 490, y: 400 });
    expect(viewport.getState().translateX).toBeCloseTo(before.translateX - 10, 9);
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
