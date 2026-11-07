import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID_SETTINGS } from '../../paper/defaults';
import {
  cellAt,
  cellBounds,
  cellCount,
  cellGridSize,
  cellKey,
  cellLabel,
  cellLayoutOf,
  invalidatesDoneCells,
  nextCell,
  parseCellKey,
  type CellGrid,
} from '../cells';

// A4 portrait with 25 mm cells: 9 columns (the last 10 mm wide) and 12 rows
// (the last 22 mm tall).
const A4: CellGrid = { paper: { widthMm: 210, heightMm: 297 }, cellMm: 25 };
// A tiny 3 x 2 grid for the ordering tests: A1 B1 C1 / A2 B2 C2.
const SMALL: CellGrid = { paper: { widthMm: 30, heightMm: 20 }, cellMm: 10 };

describe('cellGridSize / cellCount', () => {
  it('counts partial cells at the right and bottom edges', () => {
    expect(cellGridSize(A4)).toEqual({ cols: 9, rows: 12 });
    expect(cellCount(A4)).toBe(108);
  });

  it('has no phantom cell on an exact multiple', () => {
    expect(cellCount(SMALL)).toBe(6);
  });

  it('is one cell when the cell is larger than the paper', () => {
    expect(cellCount({ paper: { widthMm: 210, heightMm: 297 }, cellMm: 500 })).toBe(1);
  });
});

describe('cellAt', () => {
  it('finds the cell under a point in paper millimetres', () => {
    expect(cellAt(A4, { x: 0, y: 0 })).toEqual({ col: 0, row: 0 });
    expect(cellAt(A4, { x: 60, y: 80 })).toEqual({ col: 2, row: 3 });
  });

  it('puts a point on an inner line in the cell after it', () => {
    expect(cellAt(A4, { x: 25, y: 50 })).toEqual({ col: 1, row: 2 });
  });

  it('includes the paper’s right and bottom edges in the last (partial) cells', () => {
    expect(cellAt(A4, { x: 210, y: 297 })).toEqual({ col: 8, row: 11 });
    expect(cellAt(A4, { x: 205, y: 290 })).toEqual({ col: 8, row: 11 });
    expect(cellAt(SMALL, { x: 30, y: 20 })).toEqual({ col: 2, row: 1 });
  });

  it('is null off the paper', () => {
    expect(cellAt(A4, { x: -0.1, y: 10 })).toBeNull();
    expect(cellAt(A4, { x: 10, y: -0.1 })).toBeNull();
    expect(cellAt(A4, { x: 210.1, y: 10 })).toBeNull();
    expect(cellAt(A4, { x: 10, y: 297.1 })).toBeNull();
    expect(cellAt(A4, { x: Number.NaN, y: 10 })).toBeNull();
  });
});

describe('cellLabel', () => {
  it('letters the column and numbers the row by default: "C4"', () => {
    expect(cellLabel({ col: 2, row: 3 }, DEFAULT_GRID_SETTINGS.labels)).toBe('C4');
    expect(cellLabel({ col: 0, row: 0 }, DEFAULT_GRID_SETTINGS.labels)).toBe('A1');
    expect(cellLabel({ col: 26, row: 11 }, DEFAULT_GRID_SETTINGS.labels)).toBe('AA12');
  });

  it('follows each axis’ own scheme', () => {
    expect(cellLabel({ col: 2, row: 3 }, { columns: 'numbers', rows: 'letters' })).toBe('3D');
  });

  it('separates two numbers, or two letter runs, so the label stays readable', () => {
    expect(cellLabel({ col: 2, row: 11 }, { columns: 'numbers', rows: 'numbers' })).toBe('3-12');
    expect(cellLabel({ col: 2, row: 3 }, { columns: 'letters', rows: 'letters' })).toBe('C-D');
  });
});

describe('cellBounds', () => {
  it('is the cell’s square in paper millimetres', () => {
    expect(cellBounds(A4, { col: 2, row: 3 })).toEqual({ x: 50, y: 75, w: 25, h: 25 });
  });

  it('cuts the last column and row at the paper edge', () => {
    const b = cellBounds(A4, { col: 8, row: 11 });
    expect(b.x).toBe(200);
    expect(b.y).toBe(275);
    expect(b.w).toBeCloseTo(10);
    expect(b.h).toBeCloseTo(22);
  });
});

describe('nextCell', () => {
  const order = (grid: CellGrid, direction: 1 | -1, steps: number, options = {}) => {
    const labels: string[] = [];
    let cell = { col: 0, row: 0 };
    for (let i = 0; i < steps; i++) {
      const next = nextCell(grid, cell, direction, options);
      if (!next) break;
      cell = next;
      labels.push(cellLabel(cell, DEFAULT_GRID_SETTINGS.labels));
    }
    return labels;
  };

  it('steps along a row, then to the start of the next: A1 B1 C1 A2', () => {
    expect(order(SMALL, 1, 6)).toEqual(['B1', 'C1', 'A2', 'B2', 'C2', 'A1']);
  });

  it('steps backwards and wraps from the first cell to the last', () => {
    expect(order(SMALL, -1, 3)).toEqual(['C2', 'B2', 'A2']);
  });

  it('starts at the first cell (or the last, backwards) when nothing is focused', () => {
    expect(nextCell(SMALL, null, 1)).toEqual({ col: 0, row: 0 });
    expect(nextCell(SMALL, null, -1)).toEqual({ col: 2, row: 1 });
  });

  it('can skip Done Cells', () => {
    const done = new Set([cellKey({ col: 1, row: 0 }), cellKey({ col: 0, row: 1 })]);
    expect(order(SMALL, 1, 4, { skip: done })).toEqual(['C1', 'B2', 'C2', 'A1']);
    expect(nextCell(SMALL, { col: 2, row: 0 }, -1, { skip: done })).toEqual({ col: 0, row: 0 });
  });

  it('does not skip when the option is off, even with Done Cells', () => {
    expect(nextCell(SMALL, { col: 0, row: 0 }, 1)).toEqual({ col: 1, row: 0 });
  });

  it('is null when every other cell is skipped', () => {
    const all = new Set(['0,0', '1,0', '2,0', '0,1', '1,1', '2,1']);
    expect(nextCell(SMALL, { col: 0, row: 0 }, 1, { skip: all })).toBeNull();
    const allButCurrent = new Set(['1,0', '2,0', '0,1', '1,1', '2,1']);
    expect(nextCell(SMALL, { col: 0, row: 0 }, 1, { skip: allButCurrent })).toBeNull();
  });

  it('clamps a cell left over from a larger grid into range first', () => {
    expect(nextCell(SMALL, { col: 7, row: 9 }, 1)).toEqual({ col: 0, row: 0 });
  });
});

describe('cellKey / parseCellKey', () => {
  it('round-trips', () => {
    expect(parseCellKey(cellKey({ col: 3, row: 11 }))).toEqual({ col: 3, row: 11 });
  });

  it('rejects malformed keys', () => {
    expect(parseCellKey('x')).toBeNull();
    expect(parseCellKey('1,-2')).toBeNull();
    expect(parseCellKey('1.5,2')).toBeNull();
  });
});

describe('invalidatesDoneCells', () => {
  const paper = { widthMm: 210, heightMm: 297 };
  const crop = { x: 0, y: 0, w: 2100, h: 2970 };
  const before = cellLayoutOf(paper, DEFAULT_GRID_SETTINGS, crop);

  it('is false when nothing about the cells changed', () => {
    expect(invalidatesDoneCells(before, cellLayoutOf({ ...paper }, { ...DEFAULT_GRID_SETTINGS }, { ...crop }))).toBe(false);
  });

  it('is true when the cell size changes', () => {
    expect(invalidatesDoneCells(before, cellLayoutOf(paper, { ...DEFAULT_GRID_SETTINGS, cellMm: 20 }, crop))).toBe(true);
  });

  it('is true when the paper changes size or turns', () => {
    expect(invalidatesDoneCells(before, cellLayoutOf({ widthMm: 297, heightMm: 420 }, DEFAULT_GRID_SETTINGS, crop))).toBe(true);
    expect(invalidatesDoneCells(before, cellLayoutOf({ widthMm: 297, heightMm: 210 }, DEFAULT_GRID_SETTINGS, crop))).toBe(true);
  });

  it('is true when the paper is framed on a different part of the photo', () => {
    expect(invalidatesDoneCells(before, cellLayoutOf(paper, DEFAULT_GRID_SETTINGS, { ...crop, x: 40 }))).toBe(true);
  });

  it('is false for style, labels and the other overlays', () => {
    const restyled = {
      ...DEFAULT_GRID_SETTINGS,
      showDiagonals: true,
      showRadial: true,
      labels: { enabled: false, columns: 'numbers' as const, rows: 'letters' as const },
      style: { color: '#ff0000', widthPx: 4, opacity: 0.2 },
    };
    expect(invalidatesDoneCells(before, cellLayoutOf(paper, restyled, crop))).toBe(false);
  });

  it('ignores float noise', () => {
    expect(invalidatesDoneCells(before, cellLayoutOf({ widthMm: 210 + 1e-9, heightMm: 297 }, DEFAULT_GRID_SETTINGS, crop))).toBe(false);
  });
});
