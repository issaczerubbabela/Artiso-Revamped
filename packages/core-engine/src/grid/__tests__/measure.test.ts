import { describe, expect, it } from 'vitest';
import { formatMeasurement, measureDistance, snapToAxis } from '../measure';
import { GridConfigError } from '../types';

// Measurement (GLOSSARY.md): a distance across the reference in paper mm, read
// in the paper unit setting and in cells.

describe('measureDistance', () => {
  it('is the straight-line length in mm and in cells', () => {
    // A 3-4-5 triangle: 30 x 40 mm is 50 mm, two cells of 25 mm.
    expect(measureDistance({ x: 10, y: 10 }, { x: 40, y: 50 }, 25)).toEqual({ mm: 50, cells: 2 });
  });

  it('is zero for a point and the same either way round', () => {
    expect(measureDistance({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)).toEqual({ mm: 0, cells: 0 });
    const a = measureDistance({ x: 0, y: 0 }, { x: 12, y: 0 }, 7);
    const b = measureDistance({ x: 12, y: 0 }, { x: 0, y: 0 }, 7);
    expect(a).toEqual(b);
    expect(a.cells).toBeCloseTo(12 / 7, 12);
  });

  it('rejects a cell size that is not positive', () => {
    expect(() => measureDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, 0)).toThrow(GridConfigError);
  });
});

describe('formatMeasurement', () => {
  const m = { mm: 42, cells: 42 / 25 };

  it('reads millimetres and cells, as in "42 mm · 1.7 cells"', () => {
    expect(formatMeasurement(m, 'mm', 300)).toBe('42 mm · 1.7 cells');
  });

  it('reads centimetres', () => {
    expect(formatMeasurement(m, 'cm', 300)).toBe('4.2 cm · 1.7 cells');
  });

  it('reads inches', () => {
    expect(formatMeasurement({ mm: 25.4, cells: 1 }, 'in', 300)).toBe('1 in · 1 cell');
    expect(formatMeasurement({ mm: 50, cells: 2 }, 'in', 300)).toBe('1.969 in · 2 cells');
  });

  it('reads pixels at the document DPI', () => {
    expect(formatMeasurement({ mm: 25.4, cells: 0.5 }, 'px', 300)).toBe('300 px · 0.5 cells');
  });

  it('rounds to the precision of each unit', () => {
    expect(formatMeasurement({ mm: 12.345, cells: 1.04 }, 'mm', 300)).toBe('12.3 mm · 1 cell');
    expect(formatMeasurement({ mm: 0, cells: 0 }, 'mm', 300)).toBe('0 mm · 0 cells');
  });
});

describe('snapToAxis', () => {
  it('snaps a mostly-horizontal line to horizontal, keeping its run', () => {
    expect(snapToAxis({ x: 10, y: 10 }, { x: 50, y: 18 })).toEqual({ x: 50, y: 10 });
    expect(snapToAxis({ x: 10, y: 10 }, { x: -30, y: 4 })).toEqual({ x: -30, y: 10 });
  });

  it('snaps a mostly-vertical line to vertical', () => {
    expect(snapToAxis({ x: 10, y: 10 }, { x: 14, y: 60 })).toEqual({ x: 10, y: 60 });
  });

  it('prefers horizontal on an exact diagonal', () => {
    expect(snapToAxis({ x: 0, y: 0 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 0 });
  });

  it('snaps along an explicit axis', () => {
    expect(snapToAxis({ x: 0, y: 0 }, { x: 30, y: 2 }, 'vertical')).toEqual({ x: 0, y: 2 });
  });
});
