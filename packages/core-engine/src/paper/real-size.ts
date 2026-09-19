import type { ScreenCalibration } from '@artiso/shared-types';
import { MM_PER_INCH } from './units';

// Real size (1:1): 1 mm on the paper is 1 mm on the user's physical screen
// (Grid-Feature-Spec.md §10). Browsers can't report the physical screen size, so
// the user supplies diagonal + native resolution once.

/** Physical pixels per inch of the screen. */
export function physicalPpi(screen: ScreenCalibration): number {
  return Math.hypot(screen.nativeResW, screen.nativeResH) / screen.diagonalIn;
}

/** The viewport `scale` (CSS px per mm) at which paper is drawn at its physical size. */
export function pxPerMmCss(ppi: number, devicePixelRatio: number): number {
  return ppi / devicePixelRatio / MM_PER_INCH;
}

/** The native resolution a browser reports for the screen, used to pre-fill the calibration form. */
export function nativeResolutionGuess(
  screenWidth: number,
  screenHeight: number,
  devicePixelRatio: number,
): { nativeResW: number; nativeResH: number } {
  return {
    nativeResW: Math.round(screenWidth * devicePixelRatio),
    nativeResH: Math.round(screenHeight * devicePixelRatio),
  };
}

export const CALIBRATION_RULER_MM = 100;

/**
 * Corrects the assumed PPI from a ruler check: the app drew a line meant to be
 * `rulerMm` long, the user measured it as `measuredMm`. A longer line means the
 * screen has fewer pixels per inch than assumed, and vice versa.
 */
export function calibrateFromRuler(currentPpi: number, measuredMm: number, rulerMm: number = CALIBRATION_RULER_MM): number {
  if (!(measuredMm > 0)) throw new RangeError(`measuredMm must be positive, got ${measuredMm}`);
  return (currentPpi * rulerMm) / measuredMm;
}
