import type { Crop, GridSettings, LabelScheme } from '@artiso/shared-types';
import type { MmRect } from './clip';
import { labelFor } from './label-scheme';
import { GRID_EPSILON, assertCellMm, getCols, getRows, type PaperSize } from './square-grid';

// Cell queries over the drawing grid (docs/architecture/Grid-Feature-Spec.md
// §6), for Cell Focus and Done Cells (GLOSSARY.md). Pure maths over the paper
// and the cell size, in paper millimetres with the origin at the paper's
// top-left -- the same content units the canvas draws in -- so nothing here
// knows about the screen or the View Rotation: grid order is the same whichever
// way the view is turned.

export interface CellGrid {
  paper: PaperSize;
  cellMm: number;
}

/** A cell by 0-based column (left to right) and row (top to bottom). */
export interface CellRef {
  col: number;
  row: number;
}

export function cellGridSize(grid: CellGrid): { cols: number; rows: number } {
  return { cols: getCols(grid.paper.widthMm, grid.cellMm), rows: getRows(grid.paper.heightMm, grid.cellMm) };
}

/** How many cells the paper holds, the partial last column and row included. */
export function cellCount(grid: CellGrid): number {
  const { cols, rows } = cellGridSize(grid);
  return cols * rows;
}

/**
 * The cell under `point` (paper mm), or null off the paper. A point on an
 * inner line belongs to the cell after it; the paper's right and bottom edges
 * belong to the last (partial) cells.
 */
export function cellAt(grid: CellGrid, point: { x: number; y: number }): CellRef | null {
  assertCellMm(grid.cellMm);
  const { widthMm, heightMm } = grid.paper;
  const { x, y } = point;
  if (!(x >= 0 && x <= widthMm && y >= 0 && y <= heightMm)) return null;
  const { cols, rows } = cellGridSize(grid);
  return {
    col: Math.min(cols - 1, Math.floor(x / grid.cellMm + GRID_EPSILON)),
    row: Math.min(rows - 1, Math.floor(y / grid.cellMm + GRID_EPSILON)),
  };
}

/**
 * A cell's name as the edge labels spell it: column then row, each in its own
 * scheme, so the default reads "C4". When both axes use the same scheme the
 * two parts are joined with a hyphen ("3-12"), or they would run together.
 */
export function cellLabel(cell: CellRef, labels: { columns: LabelScheme; rows: LabelScheme }): string {
  const col = labelFor(cell.col, labels.columns);
  const row = labelFor(cell.row, labels.rows);
  return labels.columns === labels.rows ? `${col}-${row}` : `${col}${row}`;
}

/** The cell's rectangle in paper mm, cut by the paper edge for the last column and row. */
export function cellBounds(grid: CellGrid, cell: CellRef): MmRect {
  assertCellMm(grid.cellMm);
  const { cellMm, paper } = grid;
  const x = cell.col * cellMm;
  const y = cell.row * cellMm;
  return { x, y, w: Math.max(0, Math.min(cellMm, paper.widthMm - x)), h: Math.max(0, Math.min(cellMm, paper.heightMm - y)) };
}

/** A stable key for a cell, for sets of Done Cells. */
export function cellKey(cell: CellRef): string {
  return `${cell.col},${cell.row}`;
}

export function parseCellKey(key: string): CellRef | null {
  const match = /^(\d+),(\d+)$/.exec(key);
  if (!match) return null;
  return { col: Number(match[1]), row: Number(match[2]) };
}

export interface NextCellOptions {
  /** Cell keys to step over (the Done Cells, when skipping them). */
  skip?: ReadonlySet<string>;
}

/**
 * The next (1) or previous (-1) cell in grid order: along a row left to right,
 * then on to the start of the next row (A1, B1, C1 ... then A2), wrapping from
 * the last cell to the first and back. With nothing focused it starts at the
 * first cell (or the last, going back). Null when every other cell is skipped.
 */
export function nextCell(
  grid: CellGrid,
  from: CellRef | null,
  direction: 1 | -1,
  options: NextCellOptions = {},
): CellRef | null {
  const { cols, rows } = cellGridSize(grid);
  const count = cols * rows;
  const skip = options.skip;
  const at = (index: number): CellRef => ({ col: index % cols, row: Math.floor(index / cols) });
  const skipped = (cell: CellRef) => skip?.has(cellKey(cell)) ?? false;

  let index: number;
  let tries: number;
  if (from === null) {
    // The first candidate is the first (or last) cell itself.
    index = direction === 1 ? count - 1 : 0;
    tries = count;
  } else {
    const col = Math.min(Math.max(0, from.col), cols - 1);
    const row = Math.min(Math.max(0, from.row), rows - 1);
    const inRange = col === from.col && row === from.row;
    // A cell left over from a larger grid restarts the order from the beginning.
    index = inRange ? row * cols + col : direction === 1 ? count - 1 : 0;
    tries = inRange ? count - 1 : count;
  }
  for (let i = 0; i < tries; i++) {
    index = (index + direction + count) % count;
    const cell = at(index);
    if (!skipped(cell)) return cell;
  }
  return null;
}

// What Done Cells are counted on: the paper's size, how the photo is framed on
// it (the crop) and the cell size. Anything else about the grid -- its colour,
// line width, opacity, labels, diagonals -- is style, and never moves a cell.
export interface CellLayout {
  widthMm: number;
  heightMm: number;
  cellMm: number;
  crop: Crop | null;
}

export function cellLayoutOf(paper: PaperSize, settings: Pick<GridSettings, 'cellMm'>, crop: Crop | null = null): CellLayout {
  return {
    widthMm: paper.widthMm,
    heightMm: paper.heightMm,
    cellMm: settings.cellMm,
    crop: crop ? { x: crop.x, y: crop.y, w: crop.w, h: crop.h } : null,
  };
}

const LAYOUT_EPSILON = 1e-6;

const near = (a: number, b: number) => Math.abs(a - b) <= LAYOUT_EPSILON * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * Whether going from `before` to `after` makes the Done Cells point at the
 * wrong part of the reference: a new cell size, a new paper size or
 * orientation, or the paper framed on a different part of the photo. A style
 * change never does.
 */
export function invalidatesDoneCells(before: CellLayout, after: CellLayout): boolean {
  if (!near(before.widthMm, after.widthMm) || !near(before.heightMm, after.heightMm) || !near(before.cellMm, after.cellMm)) {
    return true;
  }
  const a = before.crop;
  const b = after.crop;
  if (a === null || b === null) return a !== b;
  return !(near(a.x, b.x) && near(a.y, b.y) && near(a.w, b.w) && near(a.h, b.h));
}
