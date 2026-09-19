import { describe, expect, it } from 'vitest';
import {
  densityStep,
  layoutLabels,
  type LabelEdge,
  type LabelLayoutInput,
  type PlacedLabel,
} from '../label-layout';

// 8 px per character, 12 px tall; the default padding (4, 2) makes a label box
// 8 * chars + 8 wide and 16 tall.
const measure = (text: string) => ({ width: text.length * 8, height: 12 });

const A4 = { widthMm: 210, heightMm: 297 };

function input(overrides: Partial<LabelLayoutInput> = {}): LabelLayoutInput {
  return {
    paper: A4,
    cellMm: 30,
    labels: { enabled: true, columns: 'letters', rows: 'numbers' },
    view: { scale: 2, offsetX: 10, offsetY: 10 },
    viewport: { width: 800, height: 800 },
    measure,
    ...overrides,
  };
}

const onEdge = (labels: PlacedLabel[], edge: LabelEdge) =>
  labels.filter((l) => l.edge === edge).sort((a, b) => a.index - b.index);

const centreX = (l: PlacedLabel) => l.x + l.width / 2;
const centreY = (l: PlacedLabel) => l.y + l.height / 2;

describe('layoutLabels placement', () => {
  it('labels all four edges, one label per column and per row', () => {
    const labels = layoutLabels(input());
    // 210 / 30 = 7 columns, 297 / 30 = 9.9 -> 10 rows (the last one partial).
    expect(onEdge(labels, 'top').map((l) => l.text)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(onEdge(labels, 'bottom').map((l) => l.text)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(onEdge(labels, 'left').map((l) => l.text)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(onEdge(labels, 'right').map((l) => l.text)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  });

  it('returns nothing when labels are disabled', () => {
    expect(layoutLabels(input({ labels: { enabled: false, columns: 'letters', rows: 'numbers' } }))).toEqual([]);
  });

  it('sits on the paper edges and never inside a cell', () => {
    const labels = layoutLabels(input());
    // Paper on screen: x 10..430, y 10..604.
    for (const l of onEdge(labels, 'top')) expect(l.y).toBe(10);
    for (const l of onEdge(labels, 'bottom')) expect(l.y + l.height).toBe(604);
    for (const l of onEdge(labels, 'left')) expect(l.x).toBe(10);
    for (const l of onEdge(labels, 'right')) expect(l.x + l.width).toBe(430);
  });

  it('makes each label just big enough for its text, smaller than the cell', () => {
    const labels = layoutLabels(input());
    const ten = onEdge(labels, 'left')[9]!;
    expect(ten.width).toBe(2 * 8 + 8);
    expect(ten.height).toBe(16);
    const a = onEdge(labels, 'top')[0]!;
    expect(a.width).toBeLessThan(30 * 2); // cell is 60 px
    expect(a.height).toBeLessThan(30 * 2);
  });

  it('centres each label on its cell', () => {
    const labels = layoutLabels(input());
    // Column C is cell 2: mm 60..90 -> screen 130..190 -> centre 160.
    expect(centreX(onEdge(labels, 'top')[2]!)).toBeCloseTo(10 + 75 * 2, 9);
    // Row 3 is cell 2: mm 60..90 -> centre 10 + 150.
    expect(centreY(onEdge(labels, 'left')[2]!)).toBeCloseTo(10 + 75 * 2, 9);
  });

  it('labels a partial edge cell, centred on its visible part', () => {
    // Row 10 is the partial one: mm 270..297 -> screen 550..604.
    const ten = onEdge(layoutLabels(input()), 'left')[9]!;
    expect(centreY(ten)).toBeCloseTo((550 + 604) / 2, 9);

    // 210 / 25 leaves a 10 mm last column (index 8 = "I") at scale 10.
    const wide = layoutLabels(
      input({ cellMm: 25, view: { scale: 10, offsetX: 0, offsetY: 0 }, viewport: { width: 3000, height: 4000 } }),
    );
    const i = onEdge(wide, 'top').find((l) => l.text === 'I')!;
    expect(centreX(i)).toBeCloseTo((2000 + 2100) / 2, 9);
  });

  it('lets columns and rows use different schemes independently', () => {
    const swapped = layoutLabels(input({ labels: { enabled: true, columns: 'numbers', rows: 'letters' } }));
    expect(onEdge(swapped, 'top').map((l) => l.text)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(onEdge(swapped, 'left')[0]?.text).toBe('A');
    const same = layoutLabels(input({ labels: { enabled: true, columns: 'numbers', rows: 'numbers' } }));
    expect(onEdge(same, 'top')[0]?.text).toBe('1');
    expect(onEdge(same, 'left')[0]?.text).toBe('1');
  });
});

describe('layoutLabels sticky pinning', () => {
  it('pins top and left labels to the viewport when the paper edge scrolls out of view', () => {
    // Paper on screen: x -50..370, y -100..494.
    const labels = layoutLabels(input({ view: { scale: 2, offsetX: -50, offsetY: -100 } }));
    for (const l of onEdge(labels, 'top')) expect(l.y).toBe(0);
    for (const l of onEdge(labels, 'left')) expect(l.x).toBe(0);
    // The bottom/right edges are still on screen, so they stay on the paper.
    for (const l of onEdge(labels, 'bottom')) expect(l.y + l.height).toBe(494);
    for (const l of onEdge(labels, 'right')) expect(l.x + l.width).toBe(370);
  });

  it('pins bottom and right labels to the viewport when the far edges scroll out of view', () => {
    // Paper on screen: x 500..920, y 500..1094; the viewport is 800 x 800.
    const labels = layoutLabels(input({ view: { scale: 2, offsetX: 500, offsetY: 500 } }));
    for (const l of onEdge(labels, 'bottom')) expect(l.y + l.height).toBe(800);
    for (const l of onEdge(labels, 'right')) expect(l.x + l.width).toBe(800);
    for (const l of onEdge(labels, 'top')) expect(l.y).toBe(500);
    for (const l of onEdge(labels, 'left')) expect(l.x).toBe(500);
  });

  it('keeps labels a constant size while the zoom changes', () => {
    const at = (scale: number) => onEdge(layoutLabels(input({ view: { scale, offsetX: 10, offsetY: 10 } })), 'top')[0]!;
    expect(at(2).width).toBe(at(8).width);
    expect(at(2).height).toBe(at(8).height);
  });

  it('only labels the columns and rows that are visible', () => {
    // Viewport shows paper x from 100 mm on: cells 3..6.
    const labels = layoutLabels(input({ view: { scale: 4, offsetX: -400, offsetY: 0 } }));
    const indexes = onEdge(labels, 'top').map((l) => l.index);
    expect(indexes).toEqual([3, 4, 5, 6]);
  });

  it('centres a label on the visible part of a cell cut by the viewport', () => {
    // Cell 3 spans mm 90..120 -> screen -40..80 at scale 4 / offset -400; only 0..80 is visible.
    const labels = layoutLabels(input({ view: { scale: 4, offsetX: -400, offsetY: 0 } }));
    const d = onEdge(labels, 'top').find((l) => l.index === 3)!;
    expect(centreX(d)).toBeCloseTo(40, 9);
  });

  it('labels nothing when the paper is entirely off screen', () => {
    expect(layoutLabels(input({ view: { scale: 2, offsetX: 900, offsetY: 10 } }))).toEqual([]);
    expect(layoutLabels(input({ view: { scale: 2, offsetX: -1000, offsetY: 10 } }))).toEqual([]);
    expect(layoutLabels(input({ view: { scale: 2, offsetX: 10, offsetY: -700 } }))).toEqual([]);
  });

  it('ignores a degenerate view', () => {
    expect(layoutLabels(input({ view: { scale: 0, offsetX: 0, offsetY: 0 } }))).toEqual([]);
    expect(layoutLabels(input({ cellMm: 0 }))).toEqual([]);
  });
});

describe('layoutLabels density', () => {
  // 5 mm cells at 1 px/mm are 5 px wide: far smaller than a label.
  const dense = () =>
    layoutLabels(input({ cellMm: 5, view: { scale: 1, offsetX: 0, offsetY: 0 }, viewport: { width: 300, height: 400 } }));

  it('thins to every Nth label so labels never overlap', () => {
    const labels = dense();
    // Widest column label is "AP" (24 px box + 4 gap = 28 px) -> step 10 (50 px).
    const columns = onEdge(labels, 'top');
    expect(columns.length).toBeGreaterThan(0);
    for (const l of columns) expect((l.index + 1) % 10).toBe(0);
    // Row labels are 16 px tall -> step 5 (25 px >= 20 px).
    const rows = onEdge(labels, 'left');
    expect(rows.length).toBeGreaterThan(0);
    for (const l of rows) expect((l.index + 1) % 5).toBe(0);
  });

  it('labels multiples of N (5, 10, 15) rather than 1, 6, 11', () => {
    expect(onEdge(dense(), 'left').map((l) => l.text).slice(0, 3)).toEqual(['5', '10', '15']);
  });

  it.each([0.5, 1, 2, 5, 10])('never overlaps neighbouring labels on an edge at scale %s', (scale) => {
    const labels = layoutLabels(
      input({ cellMm: 5, view: { scale, offsetX: 20, offsetY: 20 }, viewport: { width: 900, height: 1200 } }),
    );
    for (const edge of ['top', 'bottom'] as const) {
      const sorted = onEdge(labels, edge).sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]!.x).toBeGreaterThanOrEqual(sorted[i - 1]!.x + sorted[i - 1]!.width);
      }
    }
    for (const edge of ['left', 'right'] as const) {
      const sorted = onEdge(labels, edge).sort((a, b) => a.y - b.y);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]!.y).toBeGreaterThanOrEqual(sorted[i - 1]!.y + sorted[i - 1]!.height);
      }
    }
  });

  it('drops a narrow partial cell label that would collide with its neighbour', () => {
    // Measured on the row axis: row labels always win corner collisions, so
    // they are unaffected by the column labels around them. 82 mm at 10 mm
    // cells is nine rows, the last one 2 mm (6 px) tall.
    const narrow = layoutLabels(
      input({
        paper: { widthMm: 40, heightMm: 82 },
        cellMm: 10,
        view: { scale: 3, offsetX: 0, offsetY: 0 },
        viewport: { width: 400, height: 400 },
      }),
    );
    const indexes = onEdge(narrow, 'left').map((l) => l.index);
    expect(indexes).toContain(7);
    expect(indexes).not.toContain(8);

    // Widen the partial cell to 8 mm (24 px) and it fits, so it is labelled.
    const roomy = layoutLabels(
      input({
        paper: { widthMm: 40, heightMm: 88 },
        cellMm: 10,
        view: { scale: 3, offsetX: 0, offsetY: 0 },
        viewport: { width: 400, height: 400 },
      }),
    );
    expect(onEdge(roomy, 'left').map((l) => l.index)).toContain(8);
  });

  it('resolves a corner collision in favour of the row label', () => {
    // 8 mm cells at 3 px/mm are 24 px: room for a 16 px label along each axis,
    // but the first column label and first row label meet at the corner.
    const labels = layoutLabels(
      input({
        paper: { widthMm: 80, heightMm: 80 },
        cellMm: 8,
        view: { scale: 3, offsetX: 0, offsetY: 0 },
        viewport: { width: 400, height: 400 },
      }),
    );
    expect(onEdge(labels, 'left')[0]?.text).toBe('1');
    expect(onEdge(labels, 'top').map((l) => l.index)).not.toContain(0);
    expect(onEdge(labels, 'top').map((l) => l.index)).toContain(1);
    // After resolution no column label overlaps any row label.
    const columns = labels.filter((l) => l.edge === 'top' || l.edge === 'bottom');
    const rows = labels.filter((l) => l.edge === 'left' || l.edge === 'right');
    for (const c of columns) {
      for (const r of rows) {
        const overlap = c.x < r.x + r.width && r.x < c.x + c.width && c.y < r.y + r.height && r.y < c.y + c.height;
        expect(overlap).toBe(false);
      }
    }
  });
});

describe('densityStep', () => {
  it('walks the 1, 2, 5, 10, 20, 50 ladder', () => {
    expect(densityStep(100, 20, 4)).toBe(1);
    expect(densityStep(12, 20, 4)).toBe(2); // 12 < 24, 24 >= 24
    expect(densityStep(6, 20, 4)).toBe(5); // 5 * 6 = 30 >= 24
    expect(densityStep(2, 20, 4)).toBe(20); // 10 * 2 = 20 < 24, 20 * 2 = 40 >= 24
    expect(densityStep(1, 20, 4)).toBe(50);
  });

  it('never needs thinning once the cell fits the label', () => {
    expect(densityStep(24, 20, 4)).toBe(1);
  });
});
