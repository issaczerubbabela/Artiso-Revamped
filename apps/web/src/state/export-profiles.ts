import type { ExportSettings } from '@artiso/shared-types';

export interface ExportProfile {
  id: string;
  label: string;
  settings: ExportSettings;
}

// Named ExportSettings presets (docs/phases/phase-3-filters-presets-export.md):
// per docs/architecture/07, "export profiles are just named presets over
// ExportSettings, stored the same way as filter/grid Presets -- no separate
// data model." These five are seeded as quick-select constants rather than
// database rows, since they're fixed starting points every user gets, not
// user-created content; a real user Preset (see PresetsPanel.tsx) also
// bundles an ExportSettings and can capture any of these as a starting point.
export const EXPORT_PROFILES: ExportProfile[] = [
  {
    id: 'original',
    label: 'Original',
    settings: { format: 'png', quality: 100, includeGrid: false, includeAdjustments: false, includeImage: true },
  },
  {
    id: 'print-a4',
    label: 'Print A4',
    settings: { format: 'png', quality: 100, includeGrid: true, includeAdjustments: true, includeImage: true },
  },
  {
    id: 'classroom',
    label: 'Classroom',
    settings: { format: 'jpeg', quality: 80, includeGrid: true, includeAdjustments: true, includeImage: true },
  },
  {
    id: 'high-res',
    label: 'High-Res',
    settings: { format: 'png', quality: 100, includeGrid: false, includeAdjustments: true, includeImage: true },
  },
  {
    id: 'transparent-grid',
    label: 'Transparent Grid',
    settings: { format: 'png', quality: 100, includeGrid: true, includeAdjustments: false, includeImage: false },
  },
];
