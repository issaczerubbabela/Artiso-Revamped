import { z } from 'zod';
import { FilterIdSchema } from './filter';

const NormalizedUnit = z.number().min(0).max(1);

export const CropOperationSchema = z.object({
  type: z.literal('crop'),
  rect: z.object({ x: NormalizedUnit, y: NormalizedUnit, w: NormalizedUnit, h: NormalizedUnit }),
});
export const RotateOperationSchema = z.object({
  type: z.literal('rotate'),
  degrees: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
});
export const FlipOperationSchema = z.object({
  type: z.literal('flip'),
  axis: z.enum(['horizontal', 'vertical']),
});
export const BrightnessOperationSchema = z.object({
  type: z.literal('brightness'),
  value: z.number().min(-100).max(100),
});
export const ContrastOperationSchema = z.object({
  type: z.literal('contrast'),
  value: z.number().min(-100).max(100),
});
export const SaturationOperationSchema = z.object({
  type: z.literal('saturation'),
  value: z.number().min(-100).max(100),
});
export const FilterOperationSchema = z.object({
  type: z.literal('filter'),
  id: FilterIdSchema,
  params: z.record(z.string(), z.number()).optional(),
});

export const OperationSchema = z.discriminatedUnion('type', [
  CropOperationSchema,
  RotateOperationSchema,
  FlipOperationSchema,
  BrightnessOperationSchema,
  ContrastOperationSchema,
  SaturationOperationSchema,
  FilterOperationSchema,
]);
export type Operation = z.infer<typeof OperationSchema>;

// docs/architecture/11-data-model-schema.md types `User.defaultAdjustments` as
// `Pick<Operation, "brightness"|"contrast"|"saturation">[]`. Applied literally to a
// discriminated union, TS `Pick` only keeps properties common to every member (just
// `type`), which isn't the intent — the intent is "Operation entries restricted to the
// brightness/contrast/saturation variants." Modeled as a narrowed discriminated union.
export const AdjustmentOperationSchema = z.discriminatedUnion('type', [
  BrightnessOperationSchema,
  ContrastOperationSchema,
  SaturationOperationSchema,
]);
export type AdjustmentOperation = z.infer<typeof AdjustmentOperationSchema>;
