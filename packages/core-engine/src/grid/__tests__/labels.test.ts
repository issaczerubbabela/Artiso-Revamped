import { describe, expect, it } from 'vitest';
import { columnLetter } from '../labels';

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
