import type { GridConfig } from '@artiso/shared-types';
import type { GridLabel } from './types';

// 0 -> A, 25 -> Z, 26 -> AA, ... (spreadsheet-style column naming).
export function columnLetter(index: number): string {
  let n = index + 1;
  let result = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

const ROMAN_TABLE: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function toRoman(value: number): string {
  let remaining = value;
  let result = '';
  for (const [amount, symbol] of ROMAN_TABLE) {
    while (remaining >= amount) {
      result += symbol;
      remaining -= amount;
    }
  }
  return result;
}

// "custom" has no built-in generation yet — it needs a per-cell label input
// UI/storage this package doesn't own. Falls back to no labels rather than
// guessing at content, same as "off".
export function generateLabels(
  rows: number,
  cols: number,
  cellWidth: number,
  cellHeight: number,
  mode: GridConfig['numberingMode'],
): GridLabel[] {
  if (mode === 'off' || mode === 'custom') return [];

  const labels: GridLabel[] = [];
  let sequential = 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellWidth + cellWidth / 2;
      const y = row * cellHeight + cellHeight / 2;
      let text: string;
      switch (mode) {
        case 'numbers':
          text = String(sequential);
          break;
        case 'letters':
          text = columnLetter(sequential - 1);
          break;
        case 'alphanumeric':
          // Source spec convention: column letter + row number, e.g. "A1", "B2".
          text = `${columnLetter(col)}${row + 1}`;
          break;
        case 'roman':
          text = toRoman(sequential);
          break;
      }
      labels.push({ text, x, y });
      sequential++;
    }
  }
  return labels;
}
