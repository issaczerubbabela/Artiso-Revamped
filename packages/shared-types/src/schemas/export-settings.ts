import { z } from 'zod';

export const ExportSettingsSchema = z.object({
  format: z.enum(['png', 'jpeg']),
  quality: z.number().min(0).max(100),
  includeGrid: z.boolean(),
  includeAdjustments: z.boolean(),
  // Optional (defaults to true at call sites) so ExportSettings rows written
  // before this field existed still parse -- added for the "Transparent-Grid"
  // export profile (docs/phases/phase-3-filters-presets-export.md), which
  // exports just the grid on a transparent background with no image at all.
  includeImage: z.boolean().optional(),
  profileId: z.string().optional(),
});
export type ExportSettings = z.infer<typeof ExportSettingsSchema>;
