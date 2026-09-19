import { z } from 'zod';

export const ExportSettingsSchema = z.object({
  // svg is always grid-only (docs/architecture/07-export-engine.md's "SVG
  // grid-only export" -- no image layer, vector lines/labels only, meant for
  // print-shop transparency overlays). pdf bakes the same raster composite
  // PNG/JPEG produce into a single-page PDF.
  format: z.enum(['png', 'jpeg', 'svg', 'pdf']),
  quality: z.number().min(0).max(100),
  includeGrid: z.boolean(),
  includeAdjustments: z.boolean(),
  // Optional (defaults to true at call sites) so ExportSettings rows written
  // before this field existed still parse -- added for the "Transparent-Grid"
  // export profile (docs/phases/phase-3-filters-presets-export.md), which
  // exports just the grid on a transparent background with no image at all.
  includeImage: z.boolean().optional(),
  // Optional (defaults to true at call sites), same backward-compat pattern
  // as includeImage -- added for the annotation layer (docs/phases/phase-7-
  // guides-workspace-export.md). Only applies to raster/PDF output; svg
  // export is always grid-only and never includes annotations.
  includeAnnotations: z.boolean().optional(),
  profileId: z.string().optional(),
});
export type ExportSettings = z.infer<typeof ExportSettingsSchema>;
