import { describe, expect, it } from 'vitest';
import { computeGeometryDimensions } from '../dimensions';

describe('computeGeometryDimensions', () => {
  it('returns source dimensions with no ops', () => {
    expect(computeGeometryDimensions({ width: 800, height: 600 }, [])).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('applies a crop rect proportionally', () => {
    const result = computeGeometryDimensions({ width: 1000, height: 800 }, [
      { type: 'crop', rect: { x: 0.1, y: 0.1, w: 0.5, h: 0.25 } },
    ]);
    expect(result).toEqual({ width: 500, height: 200 });
  });

  it('swaps width/height on a 90 or 270 degree rotation', () => {
    expect(computeGeometryDimensions({ width: 800, height: 600 }, [{ type: 'rotate', degrees: 90 }])).toEqual({
      width: 600,
      height: 800,
    });
    expect(computeGeometryDimensions({ width: 800, height: 600 }, [{ type: 'rotate', degrees: 270 }])).toEqual({
      width: 600,
      height: 800,
    });
  });

  it('does not swap dimensions on a 180 degree rotation', () => {
    expect(computeGeometryDimensions({ width: 800, height: 600 }, [{ type: 'rotate', degrees: 180 }])).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('returns to original dimensions after four 90 degree rotations', () => {
    const ops = Array(4).fill({ type: 'rotate', degrees: 90 } as const);
    expect(computeGeometryDimensions({ width: 800, height: 600 }, ops)).toEqual({ width: 800, height: 600 });
  });

  it('does not change dimensions on flip', () => {
    expect(computeGeometryDimensions({ width: 800, height: 600 }, [{ type: 'flip', axis: 'horizontal' }])).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('ignores non-geometry operations', () => {
    expect(
      computeGeometryDimensions({ width: 800, height: 600 }, [
        { type: 'brightness', value: 50 },
        { type: 'filter', id: 'grayscale' },
      ]),
    ).toEqual({ width: 800, height: 600 });
  });

  it('applies a chain of geometry ops in order', () => {
    const result = computeGeometryDimensions({ width: 1000, height: 800 }, [
      { type: 'crop', rect: { x: 0, y: 0, w: 0.5, h: 0.5 } },
      { type: 'rotate', degrees: 90 },
    ]);
    // crop -> 500x400, then rotate 90 swaps to 400x500
    expect(result).toEqual({ width: 400, height: 500 });
  });
});
