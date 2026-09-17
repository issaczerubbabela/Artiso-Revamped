import { describe, expect, it } from 'vitest';
import { deriveAdjustments } from '../derive-adjustments';

describe('deriveAdjustments', () => {
  it('defaults to no adjustment and no grayscale', () => {
    expect(deriveAdjustments([])).toEqual({ brightness: 0, contrast: 0, saturation: 0, grayscale: false });
  });

  it('picks up a single value of each type', () => {
    expect(
      deriveAdjustments([
        { type: 'brightness', value: 20 },
        { type: 'contrast', value: -10 },
        { type: 'saturation', value: 5 },
        { type: 'filter', id: 'grayscale' },
      ]),
    ).toEqual({ brightness: 20, contrast: -10, saturation: 5, grayscale: true });
  });

  it('a later value of the same type replaces an earlier one', () => {
    expect(
      deriveAdjustments([
        { type: 'brightness', value: 20 },
        { type: 'brightness', value: -30 },
      ]),
    ).toEqual({ brightness: -30, contrast: 0, saturation: 0, grayscale: false });
  });

  it('ignores geometry operations', () => {
    expect(
      deriveAdjustments([
        { type: 'crop', rect: { x: 0, y: 0, w: 1, h: 1 } },
        { type: 'rotate', degrees: 90 },
      ]),
    ).toEqual({ brightness: 0, contrast: 0, saturation: 0, grayscale: false });
  });

  it('ignores a non-grayscale filter id (nothing else exists yet in Phase 1)', () => {
    expect(deriveAdjustments([{ type: 'filter', id: 'invert' }]).grayscale).toBe(false);
  });
});
