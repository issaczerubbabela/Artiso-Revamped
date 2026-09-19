import { describe, expect, it } from 'vitest';
import { labelFor } from '../label-scheme';

describe('labelFor', () => {
  it('numbers start at 1', () => {
    expect(labelFor(0, 'numbers')).toBe('1');
    expect(labelFor(1, 'numbers')).toBe('2');
    expect(labelFor(11, 'numbers')).toBe('12');
    expect(labelFor(99, 'numbers')).toBe('100');
  });

  it('letters are spreadsheet style: A..Z, AA, AB, ...', () => {
    expect(labelFor(0, 'letters')).toBe('A');
    expect(labelFor(25, 'letters')).toBe('Z');
    expect(labelFor(26, 'letters')).toBe('AA');
    expect(labelFor(27, 'letters')).toBe('AB');
    expect(labelFor(51, 'letters')).toBe('AZ');
    expect(labelFor(52, 'letters')).toBe('BA');
    expect(labelFor(701, 'letters')).toBe('ZZ');
    expect(labelFor(702, 'letters')).toBe('AAA');
  });

  it('lets columns and rows use different schemes to read as "C4"', () => {
    expect(`${labelFor(2, 'letters')}${labelFor(3, 'numbers')}`).toBe('C4');
    expect(`${labelFor(2, 'numbers')}${labelFor(3, 'numbers')}`).toBe('34');
  });
});
