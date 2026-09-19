'use client';

import type { ToolMode } from '@/state/workspace-store';
import { PaperCropPanel } from './panels/PaperCropPanel';
import { RotateFlipPanel } from './panels/RotateFlipPanel';
import { AdjustmentsPanel } from './panels/AdjustmentsPanel';
import { FiltersPanel } from './panels/FiltersPanel';
import { GridPanel } from './panels/GridPanel';
import { AnnotationPanel } from './panels/AnnotationPanel';
import { PresetsPanel } from './panels/PresetsPanel';
import { ExportPanel } from './panels/ExportPanel';

export const PANEL_TITLES: Record<ToolMode, string> = {
  idle: '',
  paper: 'Paper & crop',
  rotateFlip: 'Rotate & flip',
  adjustments: 'Adjustments',
  filters: 'Filters',
  grid: 'Grid',
  annotate: 'Draw',
  presets: 'Presets',
  export: 'Export',
};

// The panel for a tool mode. Shared by the Wide dock and the Compact bottom
// sheet so the mode-to-panel mapping lives in one place.
export function ToolPanel({ mode }: { mode: ToolMode }) {
  switch (mode) {
    case 'paper':
      return <PaperCropPanel />;
    case 'rotateFlip':
      return <RotateFlipPanel />;
    case 'adjustments':
      return <AdjustmentsPanel />;
    case 'filters':
      return <FiltersPanel />;
    case 'grid':
      return <GridPanel />;
    case 'annotate':
      return <AnnotationPanel />;
    case 'presets':
      return <PresetsPanel />;
    case 'export':
      return <ExportPanel />;
    case 'idle':
      return null;
  }
}
