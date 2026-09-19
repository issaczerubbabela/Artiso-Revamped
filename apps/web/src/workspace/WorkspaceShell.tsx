'use client';

import { useWorkspaceStore } from '@/state/workspace-store';
import { useBreakpoint } from './use-breakpoint';
import { PanelButton } from './PanelButton';
import { Toolbar } from './Toolbar';
import { BottomSheet } from './BottomSheet';
import { SideRail } from './SideRail';
import { SideDock } from './SideDock';
import { TabStrip } from './TabStrip';
import { PANEL_TITLES, ToolPanel } from './ToolPanel';
import { PaneStage } from './PaneStage';
import { CalibrationDialog } from './CalibrationDialog';

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
  const presentationMode = useWorkspaceStore((s) => s.presentationMode);
  const setPresentationMode = useWorkspaceStore((s) => s.setPresentationMode);
  const splitParked = useWorkspaceStore((s) => s.splitParked);
  const splitFocusedSide = useWorkspaceStore((s) => s.splitFocusedSide);
  const focusSplitPane = useWorkspaceStore((s) => s.focusSplitPane);

  const canvasArea = (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      {hasReference ? <PaneStage /> : <EmptyState error={importError} />}
    </div>
  );

  // Split view (Wide only): the focused pane is the live session and takes
  // every tool and panel; the parked pane draws its snapshot and focuses on
  // click. Panes are keyed by physical side so a focus swap changes only
  // which one is the live session -- neither CanvasStage remounts, so each
  // keeps its own pan/zoom.
  const splitActive = breakpoint === 'wide' && splitParked !== null && hasReference;
  const splitCanvasArea = (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 2 }}>
      {(['left', 'right'] as const).map((side) => {
        const isFocused = side === splitFocusedSide;
        return (
          <div
            key={side}
            data-testid={`split-pane-${side}`}
            data-focused={isFocused}
            onPointerDownCapture={isFocused ? undefined : focusSplitPane}
            style={{
              position: 'relative',
              flex: 1,
              minWidth: 0,
              outline: isFocused ? '2px solid var(--color-accent)' : '2px solid transparent',
              outlineOffset: -2,
            }}
          >
            <PaneStage session={isFocused ? undefined : (splitParked ?? undefined)} />
          </div>
        );
      })}
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
          {splitActive ? splitCanvasArea : canvasArea}
        </div>
        <SideDock />
        <CalibrationDialog />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--color-surface)' }}>
      {canvasArea}

      {toolMode !== 'idle' && hasReference ? (
        <BottomSheet title={PANEL_TITLES[toolMode]}>
          <ToolPanel mode={toolMode} />
        </BottomSheet>
      ) : null}

      <Toolbar />
      <CalibrationDialog />
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
