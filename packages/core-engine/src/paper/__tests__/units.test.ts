import { describe, expect, it } from 'vitest';
import type { Unit } from '@artiso/shared-types';
import { fromMm, toMm } from '../units';

describe('toMm', () => {
  it('converts the physical units', () => {
    expect(toMm(21, 'cm', 300)).toBeCloseTo(210, 10);
    expect(toMm(1, 'in', 300)).toBeCloseTo(25.4, 10);
    expect(toMm(150, 'mm', 300)).toBe(150);
  });

  it('converts px through DPI: mm = px / dpi * 25.4', () => {
    expect(toMm(300, 'px', 300)).toBeCloseTo(25.4, 10); // 300 px = 1 in at 300 dpi
    expect(toMm(300, 'px', 150)).toBeCloseTo(50.8, 10); // lower DPI -> bigger physical size
    expect(toMm(2480, 'px', 300)).toBeCloseTo(209.97, 2); // an A4 width at 300 dpi
  });

  it('ignores dpi for physical units, even an invalid one', () => {
    expect(toMm(10, 'mm', 0)).toBe(10);
    expect(toMm(1, 'in', NaN)).toBeCloseTo(25.4, 10);
  });

  it.each([0, -300, NaN, Infinity])('rejects dpi %s for px', (dpi) => {
    expect(() => toMm(100, 'px', dpi)).toThrow(RangeError);
    expect(() => fromMm(100, 'px', dpi)).toThrow(RangeError);
  });
});

describe('fromMm', () => {
  it('converts back for display', () => {
    expect(fromMm(210, 'cm', 300)).toBeCloseTo(21, 10);
    expect(fromMm(25.4, 'in', 300)).toBeCloseTo(1, 10);
    expect(fromMm(25.4, 'px', 300)).toBeCloseTo(300, 10);
  });
});

describe('round trips', () => {
  const units: Unit[] = ['mm', 'cm', 'in', 'px'];
  it.each(units)('toMm then fromMm returns the input for %s', (unit) => {
    for (const value of [0.5, 1, 25, 210, 297, 1234.5]) {
      expect(fromMm(toMm(value, unit, 300), unit, 300)).toBeCloseTo(value, 9);
    }
  });
});
