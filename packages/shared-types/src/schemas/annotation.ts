import { z } from 'zod';
import { HexColorSchema, IdSchema } from './common';

// Normalized [0,1] fractions of the current working image's width/height --
// same resolution-independence convention as GridConfig's radial centerX/Y
// and perspective horizonY, so annotations keep their relative position if
// the working bitmap is later re-decoded at a different working resolution.
// Explicit simplifying assumption (docs/phases/phase-7-guides-workspace-
// export.md): annotations are NOT re-transformed if a later crop/rotate/flip
// changes the image geometry -- the canonical Import -> Prepare -> Grid ->
// Draw -> Export workflow (ki-sequential-progressive-workflow) puts
// crop/rotate/flip ("Prepare") before annotating ("Draw"), so going back to
// re-crop after annotating is an edge case, not the golden path.
const PointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

const AnnotationStyleSchema = z.object({
  color: HexColorSchema,
  thickness: z.enum(['thin', 'medium', 'thick']),
});

export const ArrowAnnotationSchema = AnnotationStyleSchema.extend({
  type: z.literal('arrow'),
  id: IdSchema,
  start: PointSchema,
  end: PointSchema,
});

export const CircleAnnotationSchema = AnnotationStyleSchema.extend({
  type: z.literal('circle'),
  id: IdSchema,
  center: PointSchema,
  radiusX: z.number().min(0).max(1),
  radiusY: z.number().min(0).max(1),
});

export const NoteAnnotationSchema = AnnotationStyleSchema.extend({
  type: z.literal('note'),
  id: IdSchema,
  position: PointSchema,
  text: z.string().min(1).max(280),
});

// pressure is optional per-point since not every input source reports it
// (mouse/touch fall back to a fixed stroke width; a stylus's varying
// pressure is why 05-canvas-renderer.md left the Viewport input-source-
// agnostic in the first place).
export const FreehandAnnotationSchema = AnnotationStyleSchema.extend({
  type: z.literal('freehand'),
  id: IdSchema,
  points: z.array(PointSchema.extend({ pressure: z.number().min(0).max(1).optional() })).min(2),
});

export const AnnotationSchema = z.discriminatedUnion('type', [
  ArrowAnnotationSchema,
  CircleAnnotationSchema,
  NoteAnnotationSchema,
  FreehandAnnotationSchema,
]);
export type Annotation = z.infer<typeof AnnotationSchema>;
export type ArrowAnnotation = z.infer<typeof ArrowAnnotationSchema>;
export type CircleAnnotation = z.infer<typeof CircleAnnotationSchema>;
export type NoteAnnotation = z.infer<typeof NoteAnnotationSchema>;
export type FreehandAnnotation = z.infer<typeof FreehandAnnotationSchema>;
