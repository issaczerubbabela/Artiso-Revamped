import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common';
import { GridConfigSchema } from './grid-config';
import { GridSettingsSchema } from './paper';
import { AdjustmentOperationSchema } from './operation';
import { ExportSettingsSchema } from './export-settings';

export const UserSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  createdAt: IsoDateTimeSchema,
  defaultGridConfig: GridConfigSchema,
  // Drawing-grid defaults (phase 9); optional so existing profiles still parse.
  defaultGridSettings: GridSettingsSchema.optional(),
  defaultAdjustments: z.array(AdjustmentOperationSchema),
  defaultExportSettings: ExportSettingsSchema,
});
export type User = z.infer<typeof UserSchema>;
