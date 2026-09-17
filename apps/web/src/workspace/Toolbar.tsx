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

// Context-aware: controls are disabled, not hidden, until a reference is
// loaded (docs/architecture/06-workspace-interaction.md). Labeled by
// default, never icon-only (ki-simplicity-first). Compact-breakpoint bottom
// toolbar only in this pass -- the Wide side-rail variant is follow-up work.
export function Toolbar() {
  const toolMode = useWorkspaceStore((s) => s.toolMode);
  const setToolMode = useWorkspaceStore((s) => s.setToolMode);
  const hasReference = useWorkspaceStore((s) => s.workingBitmap !== null);
  const isImporting = useWorkspaceStore((s) => s.isImporting);

  return (
    <nav
      style={{
        display: 'flex',
        gap: 'var(--space-sm)',
        padding: 'var(--space-sm) var(--space-md)',
        background: 'var(--color-surface-raised)',
        boxShadow: 'var(--shadow-dock)',
        overflowX: 'auto',
      }}
    >
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
    </nav>
  );
}
