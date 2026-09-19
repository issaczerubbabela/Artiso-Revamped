import { describe, expect, it } from 'vitest';
import type { Unit } from '@artiso/shared-types';
import { formatLength, fromMm, parseDecimal, toMm } from '../units';

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

describe('parseDecimal', () => {
  it.each([
    ['210', 210],
    ['  25.4 ', 25.4],
    ['25,4', 25.4],
    ['.5', 0.5],
    ['7.', 7],
    ['-3', -3],
    ['0', 0],
  ])('parses %j as %s', (text, expected) => {
    expect(parseDecimal(text)).toBe(expected);
  });

  it.each(['', '  ', 'abc', '1.2.3', '1,2,3', '12mm', '--1', '.', '1e3', 'Infinity', '1 000'])(
    'rejects %j',
    (text) => {
      expect(parseDecimal(text)).toBeNull();
    },
  );
});

describe('formatLength', () => {
  it('rounds to a sensible precision per unit and drops trailing zeros', () => {
    expect(formatLength(210, 'mm', 300)).toBe('210');
    expect(formatLength(210.04, 'mm', 300)).toBe('210');
    expect(formatLength(215.9, 'mm', 300)).toBe('215.9');
    expect(formatLength(210, 'cm', 300)).toBe('21');
    expect(formatLength(215.9, 'cm', 300)).toBe('21.59');
    expect(formatLength(25.4, 'in', 300)).toBe('1');
    expect(formatLength(210, 'in', 300)).toBe('8.268');
    expect(formatLength(210, 'px', 300)).toBe('2480');
  });

  it('follows the dpi for pixels', () => {
    expect(formatLength(25.4, 'px', 96)).toBe('96');
    expect(formatLength(25.4, 'px', 300)).toBe('300');
  });

  it('round-trips a typed value back to the same millimetres, within display precision', () => {
    const typed = formatLength(toMm(21, 'cm', 300), 'cm', 300);
    expect(toMm(parseDecimal(typed)!, 'cm', 300)).toBeCloseTo(210, 9);
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
