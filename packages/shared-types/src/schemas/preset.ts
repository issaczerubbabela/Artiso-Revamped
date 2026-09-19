import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common';
import { GridConfigSchema } from './grid-config';
import { GridSettingsSchema } from './paper';
import { OperationSchema } from './operation';
import { ExportSettingsSchema } from './export-settings';

export const PresetSchema = z.object({
  id: IdSchema,
  ownerId: IdSchema,
  name: z.string().min(1),
  gridConfig: GridConfigSchema,
  // Drawing-grid settings (phase 9). Optional so presets saved before the
  // overhaul keep parsing; applying a preset without it leaves the grid alone.
  gridSettings: GridSettingsSchema.optional(),
  filterStack: z.array(OperationSchema),
  exportSettings: ExportSettingsSchema,
  createdAt: IsoDateTimeSchema,
});
export type Preset = z.infer<typeof PresetSchema>;
