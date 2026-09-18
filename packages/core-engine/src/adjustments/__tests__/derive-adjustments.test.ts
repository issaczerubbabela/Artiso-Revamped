import { describe, expect, it } from 'vitest';
import { deriveAdjustments } from '../derive-adjustments';

describe('deriveAdjustments', () => {
  it('defaults to no adjustment and no active filter', () => {
    expect(deriveAdjustments([])).toEqual({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      filterId: null,
      filterParams: {},
    });
  });

  it('picks up a single value of each type', () => {
    expect(
      deriveAdjustments([
        { type: 'brightness', value: 20 },
        { type: 'contrast', value: -10 },
        { type: 'saturation', value: 5 },
        { type: 'filter', id: 'grayscale' },
      ]),
    ).toEqual({ brightness: 20, contrast: -10, saturation: 5, filterId: 'grayscale', filterParams: {} });
  });

  it('a later value of the same type replaces an earlier one', () => {
    expect(
      deriveAdjustments([
        { type: 'brightness', value: 20 },
        { type: 'brightness', value: -30 },
      ]),
    ).toEqual({ brightness: -30, contrast: 0, saturation: 0, filterId: null, filterParams: {} });
  });

  it('ignores geometry operations', () => {
    expect(
      deriveAdjustments([
        { type: 'crop', rect: { x: 0, y: 0, w: 1, h: 1 } },
        { type: 'rotate', degrees: 90 },
      ]),
    ).toEqual({ brightness: 0, contrast: 0, saturation: 0, filterId: null, filterParams: {} });
  });

  it('only one filter is active at a time -- a later filter replaces an earlier one', () => {
    const result = deriveAdjustments([
      { type: 'filter', id: 'grayscale' },
      { type: 'filter', id: 'invert' },
    ]);
    expect(result.filterId).toBe('invert');
  });

  it('carries the active filter\'s params through', () => {
    const result = deriveAdjustments([{ type: 'filter', id: 'threshold', params: { cutoff: 42 } }]);
    expect(result.filterId).toBe('threshold');
    expect(result.filterParams).toEqual({ cutoff: 42 });
  });
});
