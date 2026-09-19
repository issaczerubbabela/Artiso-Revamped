import { describe, expect, it } from 'vitest';
import { CALIBRATION_RULER_MM, calibrateFromRuler, nativeResolutionGuess, physicalPpi, pxPerMmCss } from '../real-size';

describe('physicalPpi', () => {
  it('is the diagonal in pixels over the diagonal in inches', () => {
    // 1920x1080 on 15.6": diagonal 2202.9 px -> ~141.2 ppi
    expect(physicalPpi({ diagonalIn: 15.6, nativeResW: 1920, nativeResH: 1080 })).toBeCloseTo(141.21, 1);
  });

  it('gives exactly 100 for a 3-4-5 screen', () => {
    // 300x400 px -> 500 px diagonal on a 5" diagonal
    expect(physicalPpi({ diagonalIn: 5, nativeResW: 300, nativeResH: 400 })).toBeCloseTo(100, 12);
  });
});

describe('pxPerMmCss', () => {
  it('is (ppi / dpr) / 25.4', () => {
    expect(pxPerMmCss(254, 1)).toBeCloseTo(10, 12);
    expect(pxPerMmCss(254, 2)).toBeCloseTo(5, 12);
  });

  it('makes 1 mm on paper 1 mm on the screen: 96 ppi at dpr 1 is ~3.78 CSS px per mm', () => {
    expect(pxPerMmCss(96, 1)).toBeCloseTo(3.7795, 3);
  });

  it('is independent of dpr once the ppi is physical (a hi-dpi screen draws fewer CSS px per mm)', () => {
    const ppi = 220;
    // The same physical length in device px is the same either way.
    expect(pxPerMmCss(ppi, 2) * 2).toBeCloseTo(pxPerMmCss(ppi, 1), 12);
  });
});

describe('nativeResolutionGuess', () => {
  it('multiplies the CSS screen size by the pixel ratio', () => {
    expect(nativeResolutionGuess(1536, 864, 1.25)).toEqual({ nativeResW: 1920, nativeResH: 1080 });
    expect(nativeResolutionGuess(1440, 900, 2)).toEqual({ nativeResW: 2880, nativeResH: 1800 });
  });

  it('rounds fractional results', () => {
    expect(nativeResolutionGuess(1707, 960, 1.5)).toEqual({ nativeResW: 2561, nativeResH: 1440 });
  });
});

describe('calibrateFromRuler', () => {
  it('leaves the ppi alone when the drawn line measures exactly right', () => {
    expect(calibrateFromRuler(141, CALIBRATION_RULER_MM)).toBeCloseTo(141, 12);
  });

  it('lowers the ppi when the line measures longer than intended', () => {
    expect(calibrateFromRuler(100, 125)).toBeCloseTo(80, 12);
  });

  it('raises the ppi when the line measures shorter than intended', () => {
    expect(calibrateFromRuler(100, 50)).toBeCloseTo(200, 12);
  });

  it('recovers the true ppi from the pixel count of the line that was drawn', () => {
    const assumed = 140;
    const measured = 108; // the line drawn for 100 mm at `assumed` ppi measures 108 mm
    // The line was drawn with this many device pixels...
    const pixelsDrawn = (CALIBRATION_RULER_MM / 25.4) * assumed;
    // ...and those pixels span `measured` mm, so the screen's true density is:
    const truePpi = (pixelsDrawn * 25.4) / measured;
    expect(calibrateFromRuler(assumed, measured)).toBeCloseTo(truePpi, 9);
    // Redrawing 100 mm at the corrected ppi then measures 100 mm.
    const redrawnPixels = (CALIBRATION_RULER_MM / 25.4) * calibrateFromRuler(assumed, measured);
    expect((redrawnPixels * 25.4) / truePpi).toBeCloseTo(CALIBRATION_RULER_MM, 9);
  });

  it('rejects a non-positive measurement', () => {
    expect(() => calibrateFromRuler(100, 0)).toThrow(RangeError);
    expect(() => calibrateFromRuler(100, -3)).toThrow(RangeError);
  });
});
