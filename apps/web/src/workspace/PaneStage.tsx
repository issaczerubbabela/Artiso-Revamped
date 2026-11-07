'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { cellAt, cellBounds, type CellRef } from '@artiso/core-engine';
import { DOUBLE_TAP_INTERVAL_MS, LongPressDetector, NO_INSETS, TapDetector } from '@artiso/renderer';
import { CanvasStage, type CanvasStageHandle, type StageViewInfo } from '@/canvas/CanvasStage';
import { useChromeInsets } from '@/components/chrome/chrome-insets';
import type { PaneSession } from '@/state/workspace-store';
import { useDisplayStore } from '@/state/display-store';
import { useWorkspaceStore } from '@/state/workspace-store';
import { ZoomPill } from './ZoomPill';
import { CanvasMenu, type CanvasMenuItem } from './CanvasMenu';
import { CellFocusControls } from './CellFocusControls';
import { gridOf, useCellFocusStore } from '@/state/cell-focus-store';
import { CELL_FOCUS_NEEDS_SQUARES, registerCentreCell, useDoneCellsGuard, usePaneGrid } from '@/session/cell-focus';

// Where a pane's zoom pill sits when nothing floats over that corner.
const PILL_MARGIN_PX = 16;
// A press within this long of a split-view pane becoming focused is the press
// that focused it (React may have swapped the panes just before or just after
// this pane's own listener saw the press).
const PANE_ACTIVATION_GRACE_MS = 100;
// Pointers that start on these are using a control, not the canvas.
const CONTROLS = '.zoom-pill, .canvas-menu, .cell-focus-band';

// One pane: its canvas plus its own view controls. Each pane in a split view has
// its own viewport, so Fit and Real size act on this pane's canvas and nothing
// else. `session` is the parked pane's snapshot; the focused pane omits it.
//
// The pane fills its container edge to edge and floating chrome sits over it, so
// it measures which part of itself that chrome covers and tells the canvas to
// fit inside the rest (docs/architecture/06-workspace-interaction.md, "Inset-
// aware view"). Presentation mode has no chrome, so it fits the whole pane.
export function PaneStage({ session }: { session?: PaneSession }) {
  const paneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<CanvasStageHandle>(null);
  const [info, setInfo] = useState<StageViewInfo | null>(null);
  const presentationMode = useWorkspaceStore((s) => s.presentationMode);
  // The controls belong to the drawing view; the Paper & crop tool has its own.
  const cropping = useWorkspaceStore((s) => !session && s.toolMode === 'paper');
  const screen = useDisplayStore((s) => s.screen);
  const openCalibration = useDisplayStore((s) => s.openCalibration);
  const measured = useChromeInsets(paneRef);
  const insets = presentationMode ? NO_INSETS : measured.insets;
  const clearance = presentationMode ? NO_INSETS : measured.clearance;
  // Real size was asked for before the screen was calibrated: once the
  // calibration is saved, carry on and zoom to it.
  const wantsRealSize = useRef(false);

  const calibrationOpen = useDisplayStore((s) => s.calibrationOpen);
  const gridHidden = useDisplayStore((s) => s.gridHidden);
  const setGridHidden = useDisplayStore((s) => s.setGridHidden);
  // The canvas menu, open at this client point.
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const insetsRef = useRef(insets);
  insetsRef.current = insets;

  // Cell Focus (GLOSSARY.md): this pane's reference, its cells and its
  // device-local focus and Done Cells.
  const grid = usePaneGrid(session);
  useDoneCellsGuard(session, grid);
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  // When this split-view pane last became the focused one. The press that
  // focuses a pane only focuses it: it is not also a tap on a cell.
  const activatedAt = useRef(Number.NEGATIVE_INFINITY);
  const wasParked = useRef(session !== undefined);
  useLayoutEffect(() => {
    if (wasParked.current && !session) activatedAt.current = performance.now();
    wasParked.current = session !== undefined;
  }, [session]);
  const revealRequest = useCellFocusStore((s) => s.revealRequest);

  // Where the canvas menu may open from. Not in the Paper tool (its drags frame
  // the crop), not in Presentation mode (no chrome, and a classroom display
  // must not pop up menus), and a long-press not while the Draw tool is drawing.
  const menuAllowed = useCallback(
    (via: 'press' | 'click') => {
      const state = useWorkspaceStore.getState();
      if (state.presentationMode) return false;
      if (!session && state.toolMode === 'paper') return false;
      if (via === 'press' && !session && state.toolMode === 'annotate') return false;
      return true;
    },
    [session],
  );

  // The centre of the part of this pane the chrome leaves visible: where a
  // keyboard-opened menu appears.
  const visibleCentre = useCallback(() => {
    const el = paneRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const i = insetsRef.current;
    return { x: r.left + i.left + (r.width - i.left - i.right) / 2, y: r.top + i.top + (r.height - i.top - i.bottom) / 2 };
  }, []);

  // The cell under a client point, while this pane's squares are shown.
  const cellAtClient = useCallback((point: { x: number; y: number }): CellRef | null => {
    const { layout, showSquares } = gridRef.current;
    if (!showSquares) return null;
    const content = stageRef.current?.contentPointAt(point.x, point.y);
    return content ? cellAt(gridOf(layout), content) : null;
  }, []);

  // This pane's focused cell, if Cell Focus is on and can be used.
  const focusedCell = useCallback((): CellRef | null => {
    const { referenceId, showSquares } = gridRef.current;
    if (!referenceId || !showSquares) return null;
    const entry = useCellFocusStore.getState().references[referenceId];
    return entry?.active && entry.cell ? entry.cell : null;
  }, []);

  // Long-press (touch or Pencil) opens the menu where the finger is -- except on
  // the focused cell, where it marks or unmarks it as a Done Cell.
  // A tap, while Cell Focus is on, focuses the cell tapped; tapping the focused
  // cell leaves Cell Focus. While it is off, taps do nothing cell-related.
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const sameCell = (a: CellRef | null, b: CellRef | null) => a !== null && b !== null && a.col === b.col && a.row === b.row;
    // Leaving on a tap of the focused cell waits out the double-tap window, so
    // a double-tap (Fit) on it never also leaves Cell Focus.
    let exitTimer: ReturnType<typeof setTimeout> | null = null;
    const clearExit = () => {
      if (exitTimer !== null) clearTimeout(exitTimer);
      exitTimer = null;
    };
    const tapsAllowed = () => {
      const state = useWorkspaceStore.getState();
      if (state.presentationMode) return false;
      // The focused pane's Paper tool frames the crop and its Draw tool draws.
      return !(!sessionRef.current && (state.toolMode === 'paper' || state.toolMode === 'annotate'));
    };
    // The press under way: whether it started on a parked pane, and when.
    let pressFocusesPane = false;
    let pressStartedAt = 0;
    const tapDetector = new TapDetector({
      onTap: (point, info) => {
        if (info.secondOfDouble) {
          clearExit();
          return;
        }
        if (pressFocusesPane || activatedAt.current > pressStartedAt - PANE_ACTIVATION_GRACE_MS) return;
        const focused = focusedCell();
        const { referenceId, layout } = gridRef.current;
        if (!focused || !referenceId || !tapsAllowed()) return;
        const cell = cellAtClient(point);
        if (!cell) return;
        clearExit();
        if (sameCell(cell, focused)) {
          exitTimer = setTimeout(() => {
            exitTimer = null;
            useCellFocusStore.getState().exit(referenceId);
          }, DOUBLE_TAP_INTERVAL_MS);
          return;
        }
        useCellFocusStore.getState().focusCell(referenceId, layout, cell);
      },
    });
    const detector = new LongPressDetector({
      onLongPress: (point) => {
        const focused = focusedCell();
        const { referenceId, layout } = gridRef.current;
        if (focused && referenceId && sameCell(cellAtClient(point), focused)) {
          useCellFocusStore.getState().toggleDone(referenceId, layout);
          return;
        }
        setMenuAt(point);
      },
    });
    const onCanvas = (event: PointerEvent) => !(event.target as Element | null)?.closest(CONTROLS);
    const down = (event: PointerEvent) => {
      if (!onCanvas(event) || (event.pointerType === 'mouse' && event.button !== 0)) {
        detector.cancel();
        tapDetector.cancel();
        return;
      }
      const point = { x: event.clientX, y: event.clientY };
      pressFocusesPane = sessionRef.current !== undefined;
      pressStartedAt = performance.now();
      tapDetector.pointerDown(event.pointerId, point, event.pointerType);
      if (!menuAllowed('press')) {
        detector.cancel();
        return;
      }
      detector.pointerDown(event.pointerId, point, event.pointerType);
    };
    const move = (event: PointerEvent) => {
      const point = { x: event.clientX, y: event.clientY };
      detector.pointerMove(event.pointerId, point);
      tapDetector.pointerMove(event.pointerId, point);
    };
    const up = (event: PointerEvent) => {
      detector.pointerUp(event.pointerId);
      tapDetector.pointerUp(event.pointerId);
    };
    const cancel = (event: PointerEvent) => {
      detector.pointerUp(event.pointerId);
      tapDetector.cancel();
      tapDetector.pointerUp(event.pointerId);
    };
    el.addEventListener('pointerdown', down, true);
    el.addEventListener('pointermove', move, true);
    el.addEventListener('pointerup', up, true);
    el.addEventListener('pointercancel', cancel, true);
    return () => {
      el.removeEventListener('pointerdown', down, true);
      el.removeEventListener('pointermove', move, true);
      el.removeEventListener('pointerup', up, true);
      el.removeEventListener('pointercancel', cancel, true);
      clearExit();
      detector.dispose();
      tapDetector.dispose();
    };
  }, [menuAllowed, cellAtClient, focusedCell]);

  // Stepping (or turning Cell Focus on) asks for the cell to be shown: pan just
  // enough if it is off screen.
  useEffect(() => {
    const { referenceId, layout } = gridRef.current;
    if (!revealRequest || revealRequest.referenceId !== referenceId) return;
    const cell = useCellFocusStore.getState().references[referenceId]?.cell;
    if (cell) stageRef.current?.revealContentRect(cellBounds(gridOf(layout), cell));
  }, [revealRequest]);

  // The focused pane offers the cell in the middle of its view as where Cell
  // Focus starts from the Grid panel.
  useEffect(() => {
    if (session) return;
    return registerCentreCell(() => cellAtClient(visibleCentre()));
  }, [session, cellAtClient, visibleCentre]);

  // Right-click, or the context-menu key / Shift+F10 (which browsers deliver
  // as a contextmenu event with no pointer position).
  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as Element).closest(`${CONTROLS}, input`)) return;
    event.preventDefault();
    if (!menuAllowed('click')) return;
    const fromKeyboard = event.clientX === 0 && event.clientY === 0;
    setMenuAt(fromKeyboard ? visibleCentre() : { x: event.clientX, y: event.clientY });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    event.preventDefault();
    if (menuAllowed('click')) setMenuAt(visibleCentre());
  }

  const closeMenu = useCallback((returnFocus: boolean) => {
    setMenuAt(null);
    if (returnFocus) paneRef.current?.focus({ preventScroll: true });
  }, []);

  const menuItems: CanvasMenuItem[] = [
    { label: 'Fit to screen', onSelect: () => stageRef.current?.fit() },
    { label: 'Reset rotation', onSelect: () => stageRef.current?.resetRotation() },
    { label: gridHidden ? 'Show grid' : 'Hide grid', onSelect: () => setGridHidden(!gridHidden) },
  ];
  // Focus this cell: the cell the menu was opened on (greyed out, saying why,
  // without squares; left out off the paper).
  if (menuAt) {
    const { referenceId, layout, showSquares } = grid;
    const cell = cellAtClient(menuAt);
    if (!showSquares) {
      menuItems.push({ label: 'Focus this cell', onSelect: () => {}, disabled: true, hint: CELL_FOCUS_NEEDS_SQUARES });
    } else if (cell && referenceId) {
      menuItems.push({ label: 'Focus this cell', onSelect: () => useCellFocusStore.getState().focusCell(referenceId, layout, cell) });
    }
  }

  useEffect(() => {
    if (screen && wantsRealSize.current) {
      wantsRealSize.current = false;
      stageRef.current?.realSize();
    }
  }, [screen]);

  // A cancelled calibration must not leave the intent behind, or a later
  // calibration from the Paper panel would zoom this pane unexpectedly. (Declared
  // after the effect above so a save has already been acted on.)
  useEffect(() => {
    if (!calibrationOpen) wantsRealSize.current = false;
  }, [calibrationOpen]);

  function handleRealSize() {
    if (stageRef.current?.realSize()) return;
    wantsRealSize.current = true;
    openCalibration();
  }

  // Clear of any panel over the corner (the clearance already includes the gap),
  // otherwise the ordinary margin.
  const pillPosition = {
    right: Math.max(PILL_MARGIN_PX, clearance.right),
    bottom: Math.max(PILL_MARGIN_PX, clearance.bottom),
  };

  return (
    <div
      ref={paneRef}
      className="pane"
      data-testid="pane"
      data-inset-left={Math.round(insets.left)}
      data-inset-top={Math.round(insets.top)}
      data-inset-right={Math.round(insets.right)}
      data-inset-bottom={Math.round(insets.bottom)}
      // Focusable so the canvas menu is reachable from the keyboard.
      tabIndex={0}
      role="group"
      aria-label="Reference canvas"
      aria-keyshortcuts="Shift+F10 ContextMenu"
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      <CanvasStage ref={stageRef} session={session} insets={insets} onViewChange={setInfo} />
      {info && !presentationMode && !cropping ? (
        <ZoomPill
          info={info}
          position={pillPosition}
          onFit={() => stageRef.current?.fit()}
          onRealSize={handleRealSize}
          onResetRotation={() => stageRef.current?.resetRotation()}
        />
      ) : null}
      {!presentationMode && !cropping ? (
        <CellFocusControls
          referenceId={grid.referenceId}
          layout={grid.layout}
          showSquares={grid.showSquares}
          // Only the focused pane carries the ← → buttons: in a split view, the
          // pane touched last.
          withBar={!session}
          position={{ left: Math.max(PILL_MARGIN_PX, clearance.left), bottom: pillPosition.bottom }}
        />
      ) : null}
      {menuAt ? <CanvasMenu point={menuAt} items={menuItems} onClose={closeMenu} /> : null}
    </div>
  );
}
