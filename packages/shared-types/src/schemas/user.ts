import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common';
import { GridConfigSchema } from './grid-config';
import { AdjustmentOperationSchema } from './operation';
import { ExportSettingsSchema } from './export-settings';

export const UserSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  createdAt: IsoDateTimeSchema,
  defaultGridConfig: GridConfigSchema,
  defaultAdjustments: z.array(AdjustmentOperationSchema),
  defaultExportSettings: ExportSettingsSchema,
});
export type User = z.infer<typeof UserSchema>;
