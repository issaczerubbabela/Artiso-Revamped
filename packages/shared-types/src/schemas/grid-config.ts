import { z } from 'zod';
import { HexColorSchema } from './common';

// Style fields shared by every guide type -- draw-time concerns the renderer
// reads regardless of how a type's geometry was generated (docs/architecture/
// 04-grid-engine.md, .agents/workflows/add-new-grid-type-recipe.md).
const BaseGridStyleSchema = z.object({
  color: HexColorSchema,
  opacity: z.number().min(0).max(100),
  thickness: z.enum(['veryThin', 'thin', 'medium', 'thick', 'extraThick']),
  visible: z.boolean(),
});

export const RectangularGridConfigSchema = BaseGridStyleSchema.extend({
  type: z.literal('rectangular'),
  rows: z.number().int().positive(),
  cols: z.number().int().positive(),
  numberingMode: z.enum(['off', 'numbers', 'letters', 'alphanumeric', 'roman', 'custom']),
  snapToImage: z.boolean(),
});

export const PerspectiveGridConfigSchema = BaseGridStyleSchema.extend({
  type: z.literal('perspective'),
  vanishingPointCount: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  horizonY: z.number().min(0).max(1),
  lineCount: z.number().int().min(2).max(48),
  thirdPointPosition: z.enum(['above', 'below']),
});

export const RadialGridConfigSchema = BaseGridStyleSchema.extend({
  type: z.literal('radial'),
  centerX: z.number().min(0).max(1),
  centerY: z.number().min(0).max(1),
  rings: z.number().int().positive(),
  spokes: z.number().int().positive(),
});

export const RuleOfThirdsGridConfigSchema = BaseGridStyleSchema.extend({
  type: z.literal('ruleOfThirds'),
});

export const GoldenRatioGridConfigSchema = BaseGridStyleSchema.extend({
  type: z.literal('goldenRatio'),
  orientation: z.enum(['horizontal', 'vertical', 'both']),
});

// A grid config missing `type` entirely is data written before this
// discriminated union existed -- treated as 'rectangular', the only type
// that existed then, so existing stored References/Presets keep parsing
// without a migration step.
export const GridConfigSchema = z.preprocess((value) => {
  if (value && typeof value === 'object' && !('type' in value)) {
    return { ...value, type: 'rectangular' };
  }
  return value;
}, z.discriminatedUnion('type', [
  RectangularGridConfigSchema,
  PerspectiveGridConfigSchema,
  RadialGridConfigSchema,
  RuleOfThirdsGridConfigSchema,
  GoldenRatioGridConfigSchema,
]));
export type GridConfig = z.infer<typeof GridConfigSchema>;
export type RectangularGridConfig = z.infer<typeof RectangularGridConfigSchema>;
export type PerspectiveGridConfig = z.infer<typeof PerspectiveGridConfigSchema>;
export type RadialGridConfig = z.infer<typeof RadialGridConfigSchema>;
export type RuleOfThirdsGridConfig = z.infer<typeof RuleOfThirdsGridConfigSchema>;
export type GoldenRatioGridConfig = z.infer<typeof GoldenRatioGridConfigSchema>;
