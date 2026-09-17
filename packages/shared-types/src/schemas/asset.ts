import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common';

export const AssetSchema = z.object({
  id: IdSchema,
  ownerId: IdSchema,
  storageKey: z.string(),
  contentHash: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: IsoDateTimeSchema,
});
export type Asset = z.infer<typeof AssetSchema>;
