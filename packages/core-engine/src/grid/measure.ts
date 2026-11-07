import type { Unit } from '@artiso/shared-types';
import { formatLength } from '../paper/units';
import { assertCellMm } from './square-grid';

// Measurement (GLOSSARY.md): a temporary distance drawn across the reference
// and read in paper units and in cells. Pure maths in paper millimetres -- the
// content units the canvas draws in -- so a length never depends on the zoom
// or the View Rotation.

export interface MmPoint {
  x: number;
  y: number;
}

export interface Measurement {
  /** Straight-line length in paper mm. */
  mm: number;
  /** The same length in grid cells (cell widths). */
  cells: number;
}

export function measureDistance(start: MmPoint, end: MmPoint, cellMm: number): Measurement {
  assertCellMm(cellMm);
  const mm = Math.hypot(end.x - start.x, end.y - start.y);
  return { mm, cells: mm / cellMm };
}

const CELL_DECIMALS = 1;

/**
 * A measurement as the artist reads it, e.g. "42 mm · 1.7 cells": the length
 * in the paper unit setting (at that unit's usual precision; px needs the
 * document DPI), then in cells to one decimal.
 */
export function formatMeasurement(measurement: Measurement, unit: Unit, dpi: number): string {
  const cells = Number(measurement.cells.toFixed(CELL_DECIMALS));
  return `${formatLength(measurement.mm, unit, dpi)} ${unit} · ${cells} ${cells === 1 ? 'cell' : 'cells'}`;
}

export type MeasureAxis = 'horizontal' | 'vertical';

/** The axis a line from `start` to `end` is closest to (horizontal on a tie). */
export function nearestAxis(start: MmPoint, end: MmPoint): MeasureAxis {
  return Math.abs(end.y - start.y) > Math.abs(end.x - start.x) ? 'vertical' : 'horizontal';
}

/**
 * `end` moved onto the horizontal or vertical line through `start` -- along
 * the paper's own axes, i.e. the grid lines, whatever the View Rotation. With
 * no axis given, the one the line is already closest to.
 */
export function snapToAxis(start: MmPoint, end: MmPoint, axis: MeasureAxis = nearestAxis(start, end)): MmPoint {
  return axis === 'horizontal' ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
}
