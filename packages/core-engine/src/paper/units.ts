import type { Unit } from '@artiso/shared-types';

export const MM_PER_INCH = 25.4;

function assertDpi(dpi: number): void {
  if (!(dpi > 0) || !Number.isFinite(dpi)) {
    throw new RangeError(`dpi must be a positive finite number, got ${dpi}`);
  }
}

// Everything is stored in millimetres (Grid-Feature-Spec.md §1). Pixels are only
// an input unit: `mm = px / dpi * 25.4`. Pixels are not a physical size, so the
// px path needs a DPI and every other unit ignores it.
export function toMm(value: number, unit: Unit, dpi: number): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'in':
      return value * MM_PER_INCH;
    case 'px':
      assertDpi(dpi);
      return (value / dpi) * MM_PER_INCH;
  }
}

export function fromMm(mm: number, unit: Unit, dpi: number): number {
  switch (unit) {
    case 'mm':
      return mm;
    case 'cm':
      return mm / 10;
    case 'in':
      return mm / MM_PER_INCH;
    case 'px':
      assertDpi(dpi);
      return (mm / MM_PER_INCH) * dpi;
  }
}
