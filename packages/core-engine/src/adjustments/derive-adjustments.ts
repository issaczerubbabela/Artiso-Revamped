import type { Operation } from '@artiso/shared-types';

export interface DerivedAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: boolean;
}

// Reduces an EditStack down to the single current value of each adjustment
// -- there's one brightness slider with one current value, not a stack of
// compounding adjustments, so a later entry of the same type replaces an
// earlier one rather than accumulating. This is what the WebGL image layer's
// shader uniforms are set from every render.
export function deriveAdjustments(ops: readonly Operation[]): DerivedAdjustments {
  const result: DerivedAdjustments = { brightness: 0, contrast: 0, saturation: 0, grayscale: false };

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
        if (op.id === 'grayscale') result.grayscale = true;
        break;
      default:
        break;
    }
  }

  return result;
}
