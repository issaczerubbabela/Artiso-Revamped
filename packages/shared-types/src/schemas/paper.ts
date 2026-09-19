import { z } from 'zod';
import { HexColorSchema } from './common';

// Drawing-grid model (docs/architecture/Grid-Feature-Spec.md §3, phase 9).
// Physical units are the source of truth: everything is stored in millimetres.
// Pixels only appear as an *input* unit (converted through DPI) and for screen
// rendering.

export const UnitSchema = z.enum(['mm', 'cm', 'in', 'px']);
export type Unit = z.infer<typeof UnitSchema>;

export const PaperPresetSchema = z.enum(['A3', 'A4', 'A5', 'Letter', 'Legal', 'custom']);
export type PaperPreset = z.infer<typeof PaperPresetSchema>;

export const OrientationSchema = z.enum(['portrait', 'landscape']);
export type Orientation = z.infer<typeof OrientationSchema>;

export const PaperSchema = z.object({
  preset: PaperPresetSchema,
  orientation: OrientationSchema,
  // After orientation is applied, so a landscape A4 is 297 x 210.
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
});
export type Paper = z.infer<typeof PaperSchema>;

// A rectangle in pixels of the *oriented original* (the source image after any
// rotate/flip). Its aspect ratio is always widthMm / heightMm of the paper;
// that is enforced by the crop helpers in core-engine rather than here, so a
// row written by a slightly different client still parses.
export const CropSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  w: z.number().positive(),
  h: z.number().positive(),
});
export type Crop = z.infer<typeof CropSchema>;

export const LabelSchemeSchema = z.enum(['numbers', 'letters']);
export type LabelScheme = z.infer<typeof LabelSchemeSchema>;

export const GridSettingsSchema = z.object({
  cellMm: z.number().positive(),
  showSquares: z.boolean(),
  showDiagonals: z.boolean(),
  showRadial: z.boolean(),
  radialStepDeg: z.number().int().min(1).max(90),
  labels: z.object({
    enabled: z.boolean(),
    // Chosen independently per axis (spec §7): columns = letters, rows =
    // numbers gives "C4".
    columns: LabelSchemeSchema,
    rows: LabelSchemeSchema,
  }),
  // ONE style shared by every layer of this grid (spec §9). Opacity is 0..1
  // here, unlike the legacy guide `GridConfig` whose opacity is 0..100.
  style: z.object({
    color: HexColorSchema,
    widthPx: z.number().min(0.5).max(6),
    opacity: z.number().min(0).max(1),
  }),
  // Reserved for later (spec §13); always 0 in v1.
  marginMm: z.literal(0),
});
export type GridSettings = z.infer<typeof GridSettingsSchema>;

export const ScreenCalibrationSchema = z.object({
  diagonalIn: z.number().positive(),
  nativeResW: z.number().int().positive(),
  nativeResH: z.number().int().positive(),
});
export type ScreenCalibration = z.infer<typeof ScreenCalibrationSchema>;

// Device-local (localStorage), never synced: a phone and a desktop have
// different physical pixel densities, so a calibration is meaningless on any
// other device.
export const DisplaySchema = z.object({
  dpi: z.number().positive().default(300),
  screen: ScreenCalibrationSchema.nullable().default(null),
});
export type Display = z.infer<typeof DisplaySchema>;
