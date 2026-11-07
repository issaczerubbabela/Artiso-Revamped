'use client';

import { useEffect, useMemo, useRef } from 'react';
import { cellLayoutOf, type CellLayout, type CellRef } from '@artiso/core-engine';
import type { Crop, Operation, Paper } from '@artiso/shared-types';
import { useCellFocusStore } from '@/state/cell-focus-store';
import { restoreFraming, useWorkspaceStore, type PaneSession } from '@/state/workspace-store';

interface PaneGrid {
  referenceId: string | null;
  paper: Paper;
  crop: Crop;
  cellMm: number;
  editStack: Operation[];
}

// What one pane shows, for Cell Focus: the parked session in a split view, the
// live workspace session otherwise.
export function usePaneGrid(session: PaneSession | undefined): PaneGrid & { layout: CellLayout; showSquares: boolean } {
  const liveReferenceId = useWorkspaceStore((s) => s.referenceId);
  const livePaper = useWorkspaceStore((s) => s.paper);
  const liveCrop = useWorkspaceStore((s) => s.crop);
  const liveGridSettings = useWorkspaceStore((s) => s.gridSettings);
  const liveEditStack = useWorkspaceStore((s) => s.editStack);
  const referenceId = session ? session.referenceId : liveReferenceId;
  const paper = session ? session.paper : livePaper;
  const crop = session ? session.crop : liveCrop;
  const gridSettings = session ? session.gridSettings : liveGridSettings;
  const editStack = session ? session.editStack : liveEditStack;
  const { cellMm, showSquares } = gridSettings;
  // Style changes never reach this: only what moves a cell makes a new layout.
  const layout = useMemo(() => cellLayoutOf(paper, { cellMm }, crop), [paper, cellMm, crop]);
  return { referenceId, paper, crop, cellMm, editStack, layout, showSquares };
}

// Done Cells point at parts of the reference, so a change that moves the cells
// (cell size, paper, framing) clears them. When that change happens while the
// reference is open, a notice offers Undo, which puts the grid back as it was
// -- and with it the Done Cells. A reference that changed elsewhere (another
// device, while it was closed) is just brought up to date quietly.
export function useDoneCellsGuard(session: PaneSession | undefined, grid: PaneGrid & { layout: CellLayout }): void {
  const reconcile = useCellFocusStore((s) => s.reconcile);
  const previous = useRef<PaneGrid | null>(null);
  const isParked = session !== undefined;

  useEffect(() => {
    const { referenceId } = grid;
    const before = previous.current;
    previous.current = { ...grid };
    if (!referenceId) return;
    const sameReference = before !== null && before.referenceId === referenceId;
    // Only the live pane can be edited, so only its changes can be undone.
    const revert = sameReference && !isParked ? revertFor(before, grid) : undefined;
    reconcile(referenceId, grid.layout, { announce: sameReference, revert });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid.referenceId, grid.layout, grid.editStack, isParked, reconcile]);
}

// How to put the grid back from `now` to `before`.
function revertFor(before: PaneGrid, now: PaneGrid): (() => void) | undefined {
  const store = useWorkspaceStore.getState;
  const framingChanged =
    before.paper.widthMm !== now.paper.widthMm ||
    before.paper.heightMm !== now.paper.heightMm ||
    before.crop.x !== now.crop.x ||
    before.crop.y !== now.crop.y ||
    before.crop.w !== now.crop.w ||
    before.crop.h !== now.crop.h;
  const cellChanged = before.cellMm !== now.cellMm;

  // A Rotate (edit) turned the paper with the image: turn it back.
  const last = now.editStack[now.editStack.length - 1];
  if (framingChanged && now.editStack.length === before.editStack.length + 1 && last?.type === 'rotate') {
    const degrees = ((360 - last.degrees) % 360) as 0 | 90 | 180 | 270;
    return () => void store().appendGeometryOp({ type: 'rotate', degrees });
  }
  if (framingChanged) {
    const framing = { paper: before.paper, crop: before.crop };
    return () => {
      if (cellChanged) store().setGridSettings({ cellMm: before.cellMm });
      void restoreFraming(framing);
    };
  }
  if (cellChanged) return () => store().setGridSettings({ cellMm: before.cellMm });
  return undefined;
}

// Says why Cell Focus is unavailable (the Grid panel and the canvas menu).
export const CELL_FOCUS_NEEDS_SQUARES = 'Turn on Squares in the Grid panel to use Cell Focus.';

// The focused pane's "cell at the centre of what is visible", registered by
// that pane: where Cell Focus starts when turned on from the Grid panel and no
// cell has been focused on this reference before.
let centreCellProvider: (() => CellRef | null) | null = null;

export function registerCentreCell(provider: () => CellRef | null): () => void {
  centreCellProvider = provider;
  return () => {
    if (centreCellProvider === provider) centreCellProvider = null;
  };
}

// Turns Cell Focus on for the focused pane's reference (the Grid panel switch),
// at the remembered cell or else the one in the middle of the view.
export function startCellFocus(): void {
  const state = useWorkspaceStore.getState();
  if (!state.referenceId || !state.gridSettings.showSquares) return;
  const layout = cellLayoutOf(state.paper, state.gridSettings, state.crop);
  useCellFocusStore.getState().activate(state.referenceId, layout, centreCellProvider?.() ?? { col: 0, row: 0 });
}
