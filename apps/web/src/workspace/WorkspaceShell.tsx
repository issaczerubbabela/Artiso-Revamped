'use client';

import { useEffect, useState } from 'react';
import { CanvasStage } from '@/canvas/CanvasStage';
import { useWorkspaceStore, type ToolMode } from '@/state/workspace-store';
import { useBreakpoint } from './use-breakpoint';
import { PanelButton } from './PanelButton';
import { Toolbar } from './Toolbar';
import { BottomSheet } from './BottomSheet';
import { SideRail } from './SideRail';
import { SideDock } from './SideDock';
import { TabStrip } from './TabStrip';
import { CropOverlay, type NormalizedRect } from './panels/CropOverlay';
import { CropPanel } from './panels/CropPanel';
import { RotateFlipPanel } from './panels/RotateFlipPanel';
import { AdjustmentsPanel } from './panels/AdjustmentsPanel';
import { FiltersPanel } from './panels/FiltersPanel';
import { GridPanel } from './panels/GridPanel';
import { AnnotationPanel } from './panels/AnnotationPanel';
import { PresetsPanel } from './panels/PresetsPanel';
import { ExportPanel } from './panels/ExportPanel';

const FULL_FRAME: NormalizedRect = { x: 0, y: 0, w: 1, h: 1 };

const PANEL_TITLES: Record<ToolMode, string> = {
  idle: '',
  crop: 'Crop',
  rotateFlip: 'Rotate & flip',
  adjustments: 'Adjustments',
  filters: 'Filters',
  grid: 'Grid',
  annotate: 'Draw',
  presets: 'Presets',
  export: 'Export',
};

// Adaptive, not two apps (CLAUDE.md): one component tree, chrome swaps by
// breakpoint (docs/architecture/06-workspace-interaction.md). Compact/Regular
// get a bottom toolbar + bottom sheet; Wide gets a persistent left rail plus
// a right dock that collapses smoothly rather than the Compact sheet's
// instant show/hide.
export function WorkspaceShell() {
  const breakpoint = useBreakpoint();
  const toolMode = useWorkspaceStore((s) => s.toolMode);
  const hasReference = useWorkspaceStore((s) => s.workingBitmap !== null);
  const importError = useWorkspaceStore((s) => s.importError);
  const requestViewportReset = useWorkspaceStore((s) => s.requestViewportReset);
  const presentationMode = useWorkspaceStore((s) => s.presentationMode);
  const setPresentationMode = useWorkspaceStore((s) => s.setPresentationMode);
  const [cropRect, setCropRect] = useState<NormalizedRect>(FULL_FRAME);

  useEffect(() => {
    if (toolMode === 'crop') {
      setCropRect(FULL_FRAME);
      requestViewportReset();
    }
  }, [toolMode, requestViewportReset]);

  const canvasArea = (
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
  );

  // Presentation mode is a display toggle over the same tree, not a fork:
  // the same canvasArea renders, just without the toolbar/rail/dock/sheet.
  if (presentationMode && hasReference) {
    return (
      <div style={{ position: 'relative', display: 'flex', height: '100dvh', background: '#000000' }}>
        {canvasArea}
        <PanelButton
          onClick={() => setPresentationMode(false)}
          style={{ position: 'absolute', top: 'var(--space-md)', right: 'var(--space-md)', opacity: 0.85 }}
        >
          Exit presentation
        </PanelButton>
      </div>
    );
  }

  if (breakpoint === 'wide') {
    return (
      <div style={{ display: 'flex', height: '100dvh', background: 'var(--color-surface)' }}>
        <SideRail />
        {/* Tabs are Wide-only: mobile stays single-reference. */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          {hasReference ? <TabStrip /> : null}
          {canvasArea}
        </div>
        <SideDock cropRect={cropRect} onResetCropRect={() => setCropRect(FULL_FRAME)} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--color-surface)' }}>
      {canvasArea}

      {toolMode !== 'idle' && hasReference ? (
        <BottomSheet title={PANEL_TITLES[toolMode]}>
          {toolMode === 'crop' && <CropPanel rect={cropRect} onResetRect={() => setCropRect(FULL_FRAME)} />}
          {toolMode === 'rotateFlip' && <RotateFlipPanel />}
          {toolMode === 'adjustments' && <AdjustmentsPanel />}
          {toolMode === 'filters' && <FiltersPanel />}
          {toolMode === 'grid' && <GridPanel />}
          {toolMode === 'annotate' && <AnnotationPanel />}
          {toolMode === 'presets' && <PresetsPanel />}
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
