import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common';
import { GridConfigSchema } from './grid-config';
import { OperationSchema } from './operation';
import { ExportSettingsSchema } from './export-settings';

export const PresetSchema = z.object({
  id: IdSchema,
  ownerId: IdSchema,
  name: z.string().min(1),
  gridConfig: GridConfigSchema,
  filterStack: z.array(OperationSchema),
  exportSettings: ExportSettingsSchema,
  createdAt: IsoDateTimeSchema,
});
export type Preset = z.infer<typeof PresetSchema>;
