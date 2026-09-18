import type { FilterId, Operation } from '@artiso/shared-types';

export interface DerivedAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  // At most one active structural filter at a time (docs/architecture/03's
  // fixed pipeline ends in a single "structural filter" stage, not a stack
  // of them) -- a later 'filter' entry replaces an earlier one, same
  // last-wins rule as the tonal adjustments.
  filterId: FilterId | null;
  filterParams: Record<string, number>;
}

// Reduces an EditStack down to the single current value of each adjustment
// -- there's one brightness slider with one current value, not a stack of
// compounding adjustments, so a later entry of the same type replaces an
// earlier one rather than accumulating. This is what the WebGL image layer's
// shader uniforms are set from every render.
export function deriveAdjustments(ops: readonly Operation[]): DerivedAdjustments {
  const result: DerivedAdjustments = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    filterId: null,
    filterParams: {},
  };

  for (const op of ops) {
    switch (op.type) {
      case 'brightness':
        result.brightness = op.value;
        break;
      case 'contrast':
        result.contrast = op.value;
        break;
      case 'saturation':
        result.saturation = op.value;
        break;
      case 'filter':
        result.filterId = op.id;
        result.filterParams = op.params ?? {};
        break;
      default:
        break;
    }
  }

  return result;
}
