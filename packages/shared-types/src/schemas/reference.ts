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
  notes: z.string(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  version: z.number().int().nonnegative(),
});
export type Reference = z.infer<typeof ReferenceSchema>;
