'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowsIn } from '@phosphor-icons/react';
import { IconButton } from '@/components/chrome/IconButton';
import { useWorkspaceStore } from '@/state/workspace-store';
import { useDisplayStore } from '@/state/display-store';
import { useBreakpoint } from './use-breakpoint';
import { Toolbar } from './Toolbar';
import { BottomSheet } from './BottomSheet';
import { SideRail } from './SideRail';
import { SideDock } from './SideDock';
import { TabStrip } from './TabStrip';
import { PANEL_TITLES, ToolPanel } from './ToolPanel';
import { PaneStage } from './PaneStage';
import { CalibrationDialog } from './CalibrationDialog';

// How long the edge-revealed chrome lingers after the pointer leaves it (ms). A
// delay, not an animation: the chrome still appears and disappears instantly.
const REVEAL_HIDE_DELAY_MS = 250;

// Adaptive, not two apps (CLAUDE.md): one component tree, chrome swaps by
// breakpoint (docs/architecture/06-workspace-interaction.md, docs/design.md §7).
// The canvas is always full-bleed on the Drafting Board surface, and every piece
// of chrome floats over it as a matte panel:
//   Wide (>=1024)    floating icon rail + floating dock + floating top bar (tabs)
//   Regular (768-1023) the same rail and dock (no tabs; the dock is the overlay drawer)
//   Compact (<768)   floating bottom toolbar + floating bottom sheet
// Nothing takes layout space from the canvas; each panel reports where it is and
// the canvas fits its content to whatever is left uncovered.
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
  const canvasSurface = useDisplayStore((s) => s.canvasSurface);
  // Immersive mode: which edge the mouse has revealed the chrome from, if any.
  const [revealed, setRevealed] = useState<'left' | 'right' | null>(null);
  // The revealed chrome hides a moment after the pointer leaves both the edge hint
  // and the panel, so it also goes away if the mouse never entered the panel, and
  // crossing the gap between hint and panel does not flicker it.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHide = () => {
    if (hideTimer.current !== null) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };
  const scheduleHide = () => {
    cancelHide();
    hideTimer.current = setTimeout(() => setRevealed(null), REVEAL_HIDE_DELAY_MS);
  };
  const reveal = (edge: 'left' | 'right') => {
    cancelHide();
    setRevealed(edge);
  };
  useEffect(() => cancelHide, []);

  const canvasArea = <div className="workspace__canvas">{hasReference ? <PaneStage /> : <EmptyState error={importError} />}</div>;

  // Split view (Wide only): the focused pane is the live session and takes
  // every tool and panel; the parked pane draws its snapshot and focuses on
  // click. Panes are keyed by physical side so a focus swap changes only
  // which one is the live session -- neither CanvasStage remounts, so each
  // keeps its own pan/zoom.
  const splitActive = breakpoint === 'wide' && splitParked !== null && hasReference;
  const splitCanvasArea = (
    <div className="workspace__canvas" style={{ display: 'flex', gap: 2 }}>
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

  // Presentation (immersive) mode is a display toggle over the same tree, not a
  // fork: the same canvas renders with the chrome hidden, so the view fits the
  // whole viewport. A tappable exit pill and the current-tool chip stay; a mouse
  // at either 4px edge hint reveals the rail / dock again (docs/design.md §7).
  if (presentationMode && hasReference) {
    const railRevealed = revealed === 'left';
    const dockRevealed = revealed === 'right' && toolMode !== 'idle';
    return (
      <div className="workspace surface" data-surface={canvasSurface}>
        {canvasArea}
        {toolMode !== 'idle' ? <span className="panel pill tool-chip">{PANEL_TITLES[toolMode]}</span> : null}
        {/* Tiny on purpose: the photo is the point of this mode. Tappable and
            focusable, so touch and keyboard never depend on the hover reveal. */}
        <div className="panel pill present-exit">
          <IconButton icon={ArrowsIn} label="Exit presentation" tooltipSide="bottom" onClick={() => setPresentationMode(false)} />
        </div>
        <div
          className="edge-hint"
          data-edge="left"
          onPointerEnter={() => reveal('left')}
          onPointerLeave={scheduleHide}
        />
        {toolMode !== 'idle' ? (
          <div
            className="edge-hint"
            data-edge="right"
            onPointerEnter={() => reveal('right')}
            onPointerLeave={scheduleHide}
          />
        ) : null}
        {railRevealed || dockRevealed ? (
          <div className="chrome-layer">
            {railRevealed ? <SideRail onPointerEnter={cancelHide} onPointerLeave={scheduleHide} /> : null}
            <div className="chrome-center" />
            {dockRevealed ? <SideDock onPointerEnter={cancelHide} onPointerLeave={scheduleHide} /> : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (breakpoint !== 'compact') {
    return (
      <div className="workspace surface" data-surface={canvasSurface}>
        {splitActive ? splitCanvasArea : canvasArea}
        <div className="chrome-layer">
          <SideRail />
          {/* Tabs are Wide-only: mobile stays single-reference. */}
          <div className="chrome-center">{breakpoint === 'wide' && hasReference ? <TabStrip /> : null}</div>
          <SideDock />
        </div>
        <CalibrationDialog />
      </div>
    );
  }

  return (
    <div className="workspace surface" data-surface={canvasSurface}>
      {canvasArea}
      <div className="compact-stack">
        {toolMode !== 'idle' && hasReference ? (
          <BottomSheet title={PANEL_TITLES[toolMode]}>
            <ToolPanel mode={toolMode} />
          </BottomSheet>
        ) : null}
        <Toolbar />
      </div>
      <CalibrationDialog />
    </div>
  );
}

function EmptyState({ error }: { error: string | null }) {
  return (
    <div className="empty">
      <h1>Artiso</h1>
      <span style={{ fontSize: 'var(--font-body-size)', color: 'var(--color-ink-muted)' }}>
        Import a reference photo to get started.
      </span>
      {error ? <span style={{ fontSize: 'var(--font-label-size)', color: 'var(--color-danger)' }}>{error}</span> : null}
    </div>
  );
}
