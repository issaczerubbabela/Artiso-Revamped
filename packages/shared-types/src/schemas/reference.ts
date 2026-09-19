import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common';
import { OperationSchema } from './operation';
import { GridConfigSchema } from './grid-config';
import { AnnotationSchema } from './annotation';

export const ReferenceSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  originalAssetId: IdSchema,
  editStack: z.array(OperationSchema),
  gridConfig: GridConfigSchema,
  // Layered grids (docs/phases/phase-7-guides-workspace-export.md): an
  // optional second guide overlaid on the primary one (e.g. a rule-of-thirds
  // overlay on a rectangular grid). Nullable + defaulted so References saved
  // before this field existed keep parsing without a data migration.
  secondaryGridConfig: GridConfigSchema.nullable().default(null),
  // Annotation layer (docs/phases/phase-7-guides-workspace-export.md): drawn
  // on top of the image/grid, never affecting the EditStack pipeline or grid
  // geometry (ki-grid-image-independence's "independent overlay" pattern
  // extended to a second overlay type). Defaulted so References saved before
  // this field existed keep parsing without a data migration.
  annotations: z.array(AnnotationSchema).default([]),
  // Ids of annotations someone deleted. Collaborative merge unions two
  // people's annotation lists by id, which alone would resurrect a deleted
  // annotation from the other side; this tombstone list is what lets a
  // deletion survive a merge (docs/phases/phase-8-collaboration-split-view.md).
  removedAnnotationIds: z.array(IdSchema).default([]),
  notes: z.string(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  version: z.number().int().nonnegative(),
});
export type Reference = z.infer<typeof ReferenceSchema>;
