'use client';

import { PanelButton } from './PanelButton';
import { SyncStatusBadge } from './SyncStatusBadge';
import { useWorkspaceStore, type ToolMode } from '@/state/workspace-store';
import { importReference } from '@/session/import-reference';
import { closeWorkspace } from '@/session/close-workspace';

const MODES: { id: ToolMode; label: string }[] = [
  { id: 'crop', label: 'Crop' },
  { id: 'rotateFlip', label: 'Rotate/Flip' },
  { id: 'adjustments', label: 'Adjust' },
  { id: 'filters', label: 'Filters' },
  { id: 'grid', label: 'Grid' },
  { id: 'annotate', label: 'Draw' },
  { id: 'presets', label: 'Presets' },
  { id: 'export', label: 'Export' },
];

// Context-aware: controls are disabled, not hidden, until a reference is
// loaded (docs/architecture/06-workspace-interaction.md). Labeled by
// default, never icon-only (ki-simplicity-first). Compact-breakpoint bottom
// toolbar only -- see SideRail.tsx for the Wide equivalent.
export function Toolbar() {
  const toolMode = useWorkspaceStore((s) => s.toolMode);
  const setToolMode = useWorkspaceStore((s) => s.setToolMode);
  const hasReference = useWorkspaceStore((s) => s.workingBitmap !== null);
  const isImporting = useWorkspaceStore((s) => s.isImporting);

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: 'var(--space-sm) var(--space-md)',
        background: 'var(--color-surface-raised)',
        boxShadow: 'var(--shadow-dock)',
        overflowX: 'auto',
      }}
    >
      {hasReference ? <PanelButton onClick={closeWorkspace}>Projects</PanelButton> : null}
      <PanelButton onClick={() => void importReference()} disabled={isImporting}>
        {isImporting ? 'Importing…' : 'Import'}
      </PanelButton>
      {MODES.map((mode) => (
        <PanelButton
          key={mode.id}
          active={toolMode === mode.id}
          disabled={!hasReference}
          onClick={() => setToolMode(toolMode === mode.id ? 'idle' : mode.id)}
        >
          {mode.label}
        </PanelButton>
      ))}
      <SyncStatusBadge />
    </nav>
  );
}
