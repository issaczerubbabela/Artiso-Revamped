'use client';

import {
  ArrowsClockwise,
  DownloadSimple,
  FrameCorners,
  GridFour,
  PencilSimple,
  SlidersHorizontal,
  Sparkle,
  Stack,
  type Icon,
} from '@phosphor-icons/react';
import { useWorkspaceStore, type ToolMode } from '@/state/workspace-store';

export interface ToolDef {
  id: Exclude<ToolMode, 'idle'>;
  // The accessible name (also the tooltip text). Kept identical to the labels
  // the previous text toolbar used, so assistive tech and tests are unaffected.
  label: string;
  // The short label shown under the icon on Compact.
  short: string;
  icon: Icon;
}

// The tools, grouped by what they are for (docs/design.md §7): prepare the
// reference, then the grid and drawing, then output. Groups are separated by a
// divider; "Session" (Projects, Import) and the Present action sit outside them.
export const TOOL_GROUPS: readonly (readonly ToolDef[])[] = [
  [
    { id: 'paper', label: 'Paper', short: 'Paper', icon: FrameCorners },
    { id: 'rotateFlip', label: 'Rotate/Flip', short: 'Rotate', icon: ArrowsClockwise },
    { id: 'adjustments', label: 'Adjust', short: 'Adjust', icon: SlidersHorizontal },
    { id: 'filters', label: 'Filters', short: 'Filters', icon: Sparkle },
  ],
  [
    { id: 'grid', label: 'Grid', short: 'Grid', icon: GridFour },
    { id: 'annotate', label: 'Draw', short: 'Draw', icon: PencilSimple },
  ],
  [
    { id: 'presets', label: 'Presets', short: 'Presets', icon: Stack },
    { id: 'export', label: 'Export', short: 'Export', icon: DownloadSimple },
  ],
];

// The state both the Wide/Regular rail and the Compact toolbar read, so the
// enabling rules live in one place. Context-aware: controls are disabled, not
// hidden, until a reference is loaded (docs/architecture/06-workspace-interaction.md).
export function useToolbarState() {
  const toolMode = useWorkspaceStore((s) => s.toolMode);
  const setToolMode = useWorkspaceStore((s) => s.setToolMode);
  const hasReference = useWorkspaceStore((s) => s.workingBitmap !== null);
  const isImporting = useWorkspaceStore((s) => s.isImporting);
  const isViewer = useWorkspaceStore((s) => s.role === 'viewer');
  const setPresentationMode = useWorkspaceStore((s) => s.setPresentationMode);

  return {
    toolMode,
    hasReference,
    isImporting,
    // A viewer can only export; every editing tool is disabled for them.
    isDisabled: (tool: ToolDef) => !hasReference || (isViewer && tool.id !== 'export'),
    // Choosing the active tool again closes its panel.
    toggleTool: (tool: ToolDef) => setToolMode(toolMode === tool.id ? 'idle' : tool.id),
    present: () => setPresentationMode(true),
  };
}
