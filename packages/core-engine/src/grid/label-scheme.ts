import type { LabelScheme } from '@artiso/shared-types';
import { columnLetter } from './labels';

/**
 * The label for a 0-based column/row index (Grid-Feature-Spec.md §7): `numbers`
 * start at 1; `letters` are spreadsheet-style A..Z, AA, AB, ...
 */
export function labelFor(index: number, scheme: LabelScheme): string {
  return scheme === 'numbers' ? String(index + 1) : columnLetter(index);
}
