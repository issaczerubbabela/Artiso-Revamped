import { z } from 'zod';

export const ExportSettingsSchema = z.object({
  format: z.enum(['png', 'jpeg']),
  quality: z.number().min(0).max(100),
  includeGrid: z.boolean(),
  includeAdjustments: z.boolean(),
  profileId: z.string().optional(),
});
export type ExportSettings = z.infer<typeof ExportSettingsSchema>;
