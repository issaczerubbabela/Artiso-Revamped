'use client';

import { useEffect, useState } from 'react';
import { CanvasStage } from '@/canvas/CanvasStage';
import { useWorkspaceStore, type ToolMode } from '@/state/workspace-store';
import { resumeSession } from '@/session/resume-session';
import { Toolbar } from './Toolbar';
import { BottomSheet } from './BottomSheet';
import { CropOverlay, type NormalizedRect } from './panels/CropOverlay';
import { CropPanel } from './panels/CropPanel';
import { RotateFlipPanel } from './panels/RotateFlipPanel';
import { AdjustmentsPanel } from './panels/AdjustmentsPanel';
import { GridPanel } from './panels/GridPanel';
import { ExportPanel } from './panels/ExportPanel';

const FULL_FRAME: NormalizedRect = { x: 0, y: 0, w: 1, h: 1 };

const PANEL_TITLES: Record<ToolMode, string> = {
  idle: '',
  crop: 'Crop',
  rotateFlip: 'Rotate & flip',
  adjustments: 'Adjustments',
  grid: 'Grid',
  export: 'Export',
};

// Compact-breakpoint workspace shell: canvas dominates, chrome is a toolbar
// plus one bottom sheet for whichever tool mode is active -- never more than
// one mode's controls visible at once (ki-sequential-progressive-workflow).
// The Wide-breakpoint side-dock variant is follow-up work; this pass only
// builds the Compact chrome.
export function WorkspaceShell() {
  const toolMode = useWorkspaceStore((s) => s.toolMode);
  const hasReference = useWorkspaceStore((s) => s.workingBitmap !== null);
  const importError = useWorkspaceStore((s) => s.importError);
  const requestViewportReset = useWorkspaceStore((s) => s.requestViewportReset);
  const [cropRect, setCropRect] = useState<NormalizedRect>(FULL_FRAME);

  useEffect(() => {
    void resumeSession();
  }, []);

  useEffect(() => {
    if (toolMode === 'crop') {
      setCropRect(FULL_FRAME);
      requestViewportReset();
    }
  }, [toolMode, requestViewportReset]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--color-surface)' }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {hasReference ? (
          <>
            <CanvasStage />
            {toolMode === 'crop' ? <CropOverlay rect={cropRect} onChange={setCropRect} /> : null}
          </>
        ) : (
          <EmptyState error={importError} />
        )}
      </div>

      {toolMode !== 'idle' && hasReference ? (
        <BottomSheet title={PANEL_TITLES[toolMode]}>
          {toolMode === 'crop' && <CropPanel rect={cropRect} onResetRect={() => setCropRect(FULL_FRAME)} />}
          {toolMode === 'rotateFlip' && <RotateFlipPanel />}
          {toolMode === 'adjustments' && <AdjustmentsPanel />}
          {toolMode === 'grid' && <GridPanel />}
          {toolMode === 'export' && <ExportPanel />}
        </BottomSheet>
      ) : null}

      <Toolbar />
    </div>
  );
}

function EmptyState({ error }: { error: string | null }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 'var(--space-sm)',
        padding: 'var(--space-lg)',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-family-base)',
          fontSize: 'var(--font-heading-size)',
          fontWeight: 'var(--font-heading-weight)',
          margin: 0,
        }}
      >
        Artiso
      </h1>
      <span
        style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-body-size)', color: 'var(--color-ink-muted)' }}
      >
        Import a reference photo to get started.
      </span>
      {error ? (
        <span
          style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-danger)' }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
