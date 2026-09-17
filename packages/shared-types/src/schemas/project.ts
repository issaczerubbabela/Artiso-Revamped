import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common';

export const ProjectSchema = z.object({
  id: IdSchema,
  ownerId: IdSchema,
  name: z.string().min(1),
  tags: z.array(z.string()),
  thumbnailAssetId: IdSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Project = z.infer<typeof ProjectSchema>;
