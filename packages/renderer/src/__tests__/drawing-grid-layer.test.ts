import { describe, expect, it } from 'vitest';
import { getDiagonals, getLines, getRadialRays, layoutLabels } from '@artiso/core-engine';
import type { GridSettings } from '@artiso/shared-types';
import {
  DrawingGridLayer,
  LABEL_BACKGROUND,
  LABEL_FONT_PX,
  LABEL_TEXT_COLOR,
  MIN_DIAGONAL_CELL_PX,
  MIN_SQUARE_CELL_PX,
  crispCoordinate,
  type DrawingGridInput,
} from '../drawing-grid-layer';

// A recording stand-in for a 2D context: every stroke is captured with the
// path that was built and the style it was drawn in, in screen coordinates.
interface Stroke {
  segments: Array<[number, number, number, number]>;
  strokeStyle: string;
  lineWidth: number;
  globalAlpha: number;
  clipped: boolean;
}

function recordingCanvas() {
  const log: string[] = [];
  const strokes: Stroke[] = [];
  const fills: Array<{ x: number; y: number; w: number; h: number; fillStyle: string }> = [];
  const texts: Array<{ text: string; x: number; y: number; fillStyle: string }> = [];
  let path: Array<[number, number, number, number]> = [];
  let last: [number, number] = [0, 0];
  let clipDepth = 0;
  const stack: number[] = [];
  const clips: Array<{ x: number; y: number; w: number; h: number }> = [];
  let pendingRect: { x: number; y: number; w: number; h: number } | null = null;

  const ctx = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    lineCap: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    setTransform: (...args: number[]) => log.push(`setTransform(${args.join(',')})`),
    clearRect: () => log.push('clearRect'),
    save: () => {
      stack.push(clipDepth);
      log.push('save');
    },
    restore: () => {
      clipDepth = stack.pop() ?? 0;
      log.push('restore');
    },
    beginPath: () => {
      path = [];
      pendingRect = null;
    },
    rect: (x: number, y: number, w: number, h: number) => {
      pendingRect = { x, y, w, h };
    },
    clip: () => {
      if (pendingRect) clips.push(pendingRect);
      clipDepth += 1;
      log.push('clip');
    },
    moveTo: (x: number, y: number) => {
      last = [x, y];
    },
    lineTo: (x: number, y: number) => {
      path.push([last[0], last[1], x, y]);
      last = [x, y];
    },
    stroke: () => {
      strokes.push({
        segments: path,
        strokeStyle: ctx.strokeStyle,
        lineWidth: ctx.lineWidth,
        globalAlpha: ctx.globalAlpha,
        clipped: clipDepth > 0,
      });
      log.push('stroke');
      path = [];
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      fills.push({ x, y, w, h, fillStyle: ctx.fillStyle });
      log.push('fillRect');
    },
    fillText: (text: string, x: number, y: number) => {
      texts.push({ text, x, y, fillStyle: ctx.fillStyle });
      log.push('fillText');
    },
    measureText: (text: string) => ({ width: text.length * 7 }),
  };

  return {
    canvas: { getContext: () => ctx } as unknown as HTMLCanvasElement,
    ctx,
    log,
    strokes,
    fills,
    texts,
    clips,
  };
}

const A4 = { widthMm: 210, heightMm: 297 };

const SETTINGS: GridSettings = {
  cellMm: 25,
  showSquares: true,
  showDiagonals: false,
  showRadial: false,
  radialStepDeg: 15,
  labels: { enabled: true, columns: 'letters', rows: 'numbers' },
  style: { color: '#ff8800', widthPx: 1, opacity: 0.7 },
  marginMm: 0,
};

// The whole A4 sheet at 2 px/mm inside a 600 x 800 canvas, paper's corner at (20, 30).
type InputOverrides = Omit<Partial<DrawingGridInput>, 'settings'> & { settings?: Partial<GridSettings> };

function input(overrides: InputOverrides = {}): DrawingGridInput {
  const { settings, ...rest } = overrides;
  return {
    paper: A4,
    settings: { ...SETTINGS, ...settings },
    view: { scale: 2, translateX: 20, translateY: 30 },
    width: 600,
    height: 800,
    ...rest,
  };
}

function render(overrides: InputOverrides = {}, options: Parameters<DrawingGridLayer['draw']>[1] = {}) {
  const rec = recordingCanvas();
  new DrawingGridLayer(rec.canvas).draw(input(overrides), options);
  return rec;
}

describe('crispCoordinate', () => {
  it('centres an odd-width line on a device pixel', () => {
    expect(crispCoordinate(10.2, 1, 1)).toBe(10.5);
    expect(crispCoordinate(10.9, 1, 1)).toBe(10.5);
    expect(crispCoordinate(10, 3, 1)).toBe(10.5);
  });

  it('puts an even-width line on a pixel edge', () => {
    expect(crispCoordinate(10.4, 2, 1)).toBe(10);
    expect(crispCoordinate(10.6, 2, 1)).toBe(11);
  });

  it('works in device pixels at a higher pixel ratio', () => {
    // 1 CSS px at dpr 2 is 2 device px (even): snap to a device-pixel edge.
    expect(crispCoordinate(10.3, 1, 2)).toBe(10.5);
    // 0.5 CSS px at dpr 2 is 1 device px (odd): centre on a device-pixel centre.
    expect(crispCoordinate(10.3, 0.5, 2)).toBe(10.25);
  });

  it('never collapses a hairline below one device pixel', () => {
    expect(crispCoordinate(10.3, 0.1, 1)).toBe(10.5);
  });
});

describe('DrawingGridLayer', () => {
  it('sets the pixel-ratio transform and clears the canvas first', () => {
    const { log } = render({}, { pixelRatio: 2 });
    expect(log[0]).toBe('setTransform(2,0,0,2,0,0)');
    expect(log[1]).toBe('clearRect');
  });

  it('does not clear when told something is already drawn beneath it', () => {
    expect(render({}, { clear: false }).log).not.toContain('clearRect');
  });

  it('draws nothing for a degenerate view', () => {
    const { strokes, texts } = render({ view: { scale: 0, translateX: 0, translateY: 0 } });
    expect(strokes).toHaveLength(0);
    expect(texts).toHaveLength(0);
  });

  describe('squares', () => {
    it('strokes every grid line in one batched, clipped path with the shared style', () => {
      const { strokes, clips } = render();
      expect(strokes).toHaveLength(1);
      const [squares] = strokes;
      // 210/25 -> 9 columns (lines at k = 0..8), 297/25 -> 12 rows (k = 0..11).
      expect(squares?.segments).toHaveLength(getLines(A4, 25).length);
      expect(squares).toMatchObject({ strokeStyle: '#ff8800', lineWidth: 1, globalAlpha: 0.7, clipped: true });
      // Clipped to the paper rectangle on screen.
      expect(clips).toEqual([{ x: 20, y: 30, w: 420, h: 594 }]);
    });

    it('maps mm to screen through the view and snaps lines to whole device pixels', () => {
      const { strokes } = render();
      const verticals = strokes[0]!.segments.filter(([x1, , x2]) => x1 === x2);
      // First vertical: x = 0 mm -> 20 px, snapped to a pixel centre.
      expect(verticals[0]![0]).toBe(20.5);
      // k = 2: 50 mm -> 20 + 100 = 120 -> 120.5.
      expect(verticals[2]![0]).toBe(120.5);
      // Spans the paper's height on screen: y from 30 to 30 + 594.
      expect(verticals[0]![1]).toBe(30);
      expect(verticals[0]![3]).toBe(624);
    });

    it('keeps the line width constant in screen px regardless of zoom', () => {
      const zoomedOut = render({ view: { scale: 1, translateX: 0, translateY: 0 } }).strokes[0]!;
      const zoomedIn = render({ view: { scale: 8, translateX: 0, translateY: 0 } }).strokes[0]!;
      expect(zoomedOut.lineWidth).toBe(1);
      expect(zoomedIn.lineWidth).toBe(1);
    });

    it('scales the line width for export via lineScale', () => {
      expect(render({}, { lineScale: 3 }).strokes[0]!.lineWidth).toBe(3);
    });

    it('is skipped when the cells are too small to read', () => {
      // 25 mm cell at scale 0.1 = 2.5 px < MIN_SQUARE_CELL_PX.
      expect(2.5).toBeLessThan(MIN_SQUARE_CELL_PX);
      const { strokes } = render({ view: { scale: 0.1, translateX: 0, translateY: 0 } });
      expect(strokes).toHaveLength(0);
    });

    it('only generates the lines that intersect the viewport', () => {
      // Zoomed in so only a corner of the paper is on screen.
      const zoomed = render({ view: { scale: 12, translateX: 0, translateY: 0 }, width: 400, height: 300 });
      expect(zoomed.strokes[0]!.segments.length).toBeLessThan(getLines(A4, 25).length);
      expect(zoomed.strokes[0]!.segments.length).toBeGreaterThan(0);
    });

    it('is not drawn when showSquares is off', () => {
      const { strokes } = render({ settings: { showSquares: false } });
      expect(strokes).toHaveLength(0);
    });
  });

  describe('overlays and draw order', () => {
    const ALL = { showSquares: true, showDiagonals: true, showRadial: true };

    it('draws squares, then diagonals, then radial, each as its own batched path', () => {
      const { strokes } = render({ settings: ALL });
      expect(strokes).toHaveLength(3);
      expect(strokes[0]!.segments).toHaveLength(getLines(A4, 25).length);
      expect(strokes[1]!.segments).toHaveLength(getDiagonals(A4, 25).length);
      expect(strokes[2]!.segments).toHaveLength(getRadialRays(A4, 15).length);
    });

    it('uses ONE shared style for every layer', () => {
      const { strokes } = render({ settings: ALL });
      for (const s of strokes) {
        expect(s).toMatchObject({ strokeStyle: '#ff8800', lineWidth: 1, globalAlpha: 0.7, clipped: true });
      }
    });

    it('draws labels last, after leaving the paper clip', () => {
      const { log } = render({ settings: ALL });
      const lastStroke = log.lastIndexOf('stroke');
      const restore = log.indexOf('restore');
      const firstFill = log.indexOf('fillRect');
      expect(restore).toBeGreaterThan(lastStroke);
      expect(firstFill).toBeGreaterThan(restore);
      // Nothing is stroked after the labels start.
      expect(log.slice(firstFill)).not.toContain('stroke');
    });

    it('draws diagonals only when the cells are large enough', () => {
      // 25 mm at scale 0.25 = 6.25 px: squares yes, diagonals no.
      expect(6.25).toBeGreaterThanOrEqual(MIN_SQUARE_CELL_PX);
      expect(6.25).toBeLessThan(MIN_DIAGONAL_CELL_PX);
      const small = render({ settings: ALL, view: { scale: 0.25, translateX: 0, translateY: 0 } });
      expect(small.strokes).toHaveLength(2); // squares + radial
      const large = render({ settings: ALL, view: { scale: 1, translateX: 0, translateY: 0 } });
      expect(large.strokes).toHaveLength(3);
    });

    it('draws the radial spokes alone when the squares are off', () => {
      const { strokes, texts } = render({ settings: { showSquares: false, showRadial: true } });
      expect(strokes).toHaveLength(1);
      expect(strokes[0]!.segments).toHaveLength(24);
      expect(texts).toHaveLength(0);
    });

    it('draws only as many spokes as the step gives', () => {
      const { strokes } = render({ settings: { showSquares: false, showRadial: true, radialStepDeg: 90 } });
      expect(strokes[0]!.segments).toHaveLength(4);
    });

    it('starts every radial spoke at the paper centre on screen', () => {
      const { strokes } = render({ settings: { showSquares: false, showRadial: true } });
      // Centre: (20 + 105*2, 30 + 148.5*2).
      for (const [x1, y1] of strokes[0]!.segments) {
        expect(x1).toBeCloseTo(230, 9);
        expect(y1).toBeCloseTo(327, 9);
      }
    });
  });

  describe('labels', () => {
    it('draws small translucent rectangles with centred white text', () => {
      const { fills, texts } = render();
      expect(fills.length).toBeGreaterThan(0);
      expect(fills.length).toBe(texts.length);
      for (const fill of fills) expect(fill.fillStyle).toBe(LABEL_BACKGROUND);
      for (const text of texts) expect(text.fillStyle).toBe(LABEL_TEXT_COLOR);
      // Each text is centred in its rectangle.
      fills.forEach((fill, i) => {
        expect(texts[i]!.x).toBeCloseTo(fill.x + fill.w / 2, 9);
        expect(texts[i]!.y).toBeCloseTo(fill.y + fill.h / 2, 9);
      });
    });

    it('draws exactly the labels the layout function returns', () => {
      const rec = recordingCanvas();
      new DrawingGridLayer(rec.canvas).draw(input());
      const expected = layoutLabels({
        paper: A4,
        cellMm: 25,
        labels: SETTINGS.labels,
        view: { scale: 2, offsetX: 20, offsetY: 30 },
        viewport: { width: 600, height: 800 },
        measure: (text) => ({ width: text.length * 7, height: LABEL_FONT_PX }),
        padding: { x: 4, y: 2 },
        gap: 4,
      });
      expect(rec.texts.map((t) => t.text).sort()).toEqual(expected.map((l) => l.text).sort());
      expect(rec.texts).toHaveLength(expected.length);
    });

    it('sets the label font from the label scale', () => {
      const normal = render();
      const large = render({}, { labelScale: 2 });
      expect(normal.ctx.font).toContain(`${LABEL_FONT_PX}px`);
      expect(large.ctx.font).toContain(`${LABEL_FONT_PX * 2}px`);
    });

    it('draws none when labels are disabled', () => {
      const { texts, fills } = render({ settings: { labels: { enabled: false, columns: 'letters', rows: 'numbers' } } });
      expect(texts).toHaveLength(0);
      expect(fills).toHaveLength(0);
    });

    it('draws none when the squares are hidden, even with labels enabled', () => {
      const { texts } = render({ settings: { showSquares: false, showRadial: true } });
      expect(texts).toHaveLength(0);
    });

    it('pins labels to the viewport when the paper edge is scrolled out of view', () => {
      // Paper's top-left is far up and left of the canvas.
      const { fills } = render({ view: { scale: 2, translateX: -100, translateY: -200 } });
      const top = Math.min(...fills.map((f) => f.y));
      const left = Math.min(...fills.map((f) => f.x));
      expect(top).toBe(0);
      expect(left).toBe(0);
    });
  });

  describe('robustness', () => {
    it('does not throw on an invalid cell size (a slider mid-edit)', () => {
      const rec = recordingCanvas();
      const layer = new DrawingGridLayer(rec.canvas);
      expect(() => layer.draw(input({ settings: { cellMm: 0, showDiagonals: true } }))).not.toThrow();
      expect(() => layer.draw(input({ settings: { cellMm: NaN } }))).not.toThrow();
      expect(rec.texts).toHaveLength(0);
    });

    it('throws a clear error when the canvas has no 2D context', () => {
      const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
      expect(() => new DrawingGridLayer(canvas)).toThrow('2D context unavailable');
    });
  });
});
