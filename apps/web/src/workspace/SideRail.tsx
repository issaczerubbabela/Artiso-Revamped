'use client';

import { PanelButton } from './PanelButton';
import { useWorkspaceStore, type ToolMode } from '@/state/workspace-store';
import { importReference } from '@/session/import-reference';

const MODES: { id: ToolMode; label: string }[] = [
  { id: 'crop', label: 'Crop' },
  { id: 'rotateFlip', label: 'Rotate/Flip' },
  { id: 'adjustments', label: 'Adjust' },
  { id: 'grid', label: 'Grid' },
  { id: 'export', label: 'Export' },
];

const RAIL_WIDTH = 92;

// Labels wrap onto a second line rather than truncating -- "Rotate/Flip"
// doesn't fit this rail's width on one line at the default padding, and a
// clipped label defeats the point of labeling controls at all.
const RAIL_BUTTON_STYLE = {
  width: '100%',
  whiteSpace: 'normal' as const,
  textAlign: 'center' as const,
  lineHeight: 1.25,
  padding: 'var(--space-xs) var(--space-xs)',
};

// Wide-breakpoint chrome: a persistent, deliberately slim vertical rail
// replacing the Compact bottom toolbar (docs/architecture/06-workspace-
// interaction.md). Unlike the collapsible SideDock, this one doesn't
// collapse -- it's the fixed, minimal anchor the dock opens and closes
// against, and staying narrow is what keeps the canvas dominant.
export function SideRail() {
  const toolMode = useWorkspaceStore((s) => s.toolMode);
  const setToolMode = useWorkspaceStore((s) => s.setToolMode);
  const hasReference = useWorkspaceStore((s) => s.workingBitmap !== null);
  const isImporting = useWorkspaceStore((s) => s.isImporting);

  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
        width: RAIL_WIDTH,
        flexShrink: 0,
        padding: 'var(--space-md) var(--space-sm)',
        background: 'var(--color-surface-raised)',
        boxShadow: 'var(--shadow-dock)',
        overflowY: 'auto',
      }}
    >
      <PanelButton onClick={() => void importReference()} disabled={isImporting} style={RAIL_BUTTON_STYLE}>
        {isImporting ? '…' : 'Import'}
      </PanelButton>
      {MODES.map((mode) => (
        <PanelButton
          key={mode.id}
          active={toolMode === mode.id}
          disabled={!hasReference}
          onClick={() => setToolMode(toolMode === mode.id ? 'idle' : mode.id)}
          style={RAIL_BUTTON_STYLE}
        >
          {mode.label}
        </PanelButton>
      ))}
    </nav>
  );
}
