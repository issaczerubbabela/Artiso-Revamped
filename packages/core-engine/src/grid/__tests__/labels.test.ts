import { describe, expect, it } from 'vitest';
import { columnLetter, generateLabels, toRoman } from '../labels';

describe('columnLetter', () => {
  it('produces spreadsheet-style column names', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    expect(columnLetter(27)).toBe('AB');
    expect(columnLetter(51)).toBe('AZ');
    expect(columnLetter(52)).toBe('BA');
  });
});

describe('toRoman', () => {
  it('converts known values', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(9)).toBe('IX');
    expect(toRoman(40)).toBe('XL');
    expect(toRoman(2024)).toBe('MMXXIV');
  });
});

describe('generateLabels', () => {
  it('returns nothing for "off" and "custom"', () => {
    expect(generateLabels(2, 2, 10, 10, 'off')).toEqual([]);
    expect(generateLabels(2, 2, 10, 10, 'custom')).toEqual([]);
  });

  it('numbers cells sequentially row-major', () => {
    const labels = generateLabels(2, 3, 10, 10, 'numbers');
    expect(labels.map((l) => l.text)).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('letters cells sequentially row-major', () => {
    const labels = generateLabels(1, 3, 10, 10, 'letters');
    expect(labels.map((l) => l.text)).toEqual(['A', 'B', 'C']);
  });

  it('labels alphanumeric as column letter + row number', () => {
    const labels = generateLabels(2, 2, 10, 10, 'alphanumeric');
    expect(labels.map((l) => l.text)).toEqual(['A1', 'B1', 'A2', 'B2']);
  });

  it('centers each label in its cell', () => {
    const labels = generateLabels(2, 2, 10, 20, 'numbers');
    expect(labels[0]).toEqual({ text: '1', x: 5, y: 10 });
    expect(labels[3]).toEqual({ text: '4', x: 15, y: 30 });
  });
});
