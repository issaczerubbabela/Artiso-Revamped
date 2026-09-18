import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common';
import { OperationSchema } from './operation';
import { GridConfigSchema } from './grid-config';

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
  notes: z.string(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  version: z.number().int().nonnegative(),
});
export type Reference = z.infer<typeof ReferenceSchema>;
