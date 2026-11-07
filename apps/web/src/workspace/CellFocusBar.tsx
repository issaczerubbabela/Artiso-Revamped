'use client';

import { useEffect } from 'react';
import { CaretLeft, CaretRight, Check, X } from '@phosphor-icons/react';
import { IconButton } from '@/components/chrome/IconButton';
import { useReportChromeRect } from '@/components/chrome/chrome-insets';
import { PanelButton } from './PanelButton';

// How long the "Done Cells cleared" notice stays up.
export const DONE_CELLS_NOTICE_MS = 6000;

interface CellFocusBarProps {
  // The focused cell's name, e.g. "C4".
  label: string;
  doneCount: number;
  cellCount: number;
  isDone: boolean;
  // Short labels under the icons (Compact: touch has no hover for a tooltip).
  labelled: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToggleDone: () => void;
  onExit: () => void;
}

// Cell Focus's controls (GLOSSARY.md): ← → step through the cells in grid
// order, the readout names the focused cell and counts the Done Cells, ✓ marks
// the focused cell done and × leaves Cell Focus. A matte pill on the canvas
// like the zoom pill, reporting itself as an overlay so the cell it reveals is
// never hidden underneath it. Only the focused pane has one, so in a split view
// the buttons act on the pane touched last.
export function CellFocusBar({
  label,
  doneCount,
  cellCount,
  isDone,
  labelled,
  onPrevious,
  onNext,
  onToggleDone,
  onExit,
}: CellFocusBarProps) {
  const reportRect = useReportChromeRect('bottom', { overlay: true });
  const tooltipSide = 'top' as const;
  return (
    <div ref={reportRect} role="group" aria-label="Cell Focus" data-testid="cell-focus-bar" className="panel pill cell-focus-bar">
      <IconButton
        icon={CaretLeft}
        label="Previous cell"
        visibleLabel={labelled ? 'Previous' : undefined}
        tooltipSide={tooltipSide}
        onClick={onPrevious}
      />
      <span className="cell-focus-bar__readout" aria-live="polite">
        <span data-testid="cell-focus-label" className="cell-focus-bar__label" aria-label={`Focused cell ${label}`}>
          {label}
        </span>
        <span data-testid="cell-focus-count" className="cell-focus-bar__count" aria-label={`${doneCount} of ${cellCount} Done Cells`}>
          {doneCount} / {cellCount}
        </span>
      </span>
      <IconButton
        icon={CaretRight}
        label="Next cell"
        visibleLabel={labelled ? 'Next' : undefined}
        tooltipSide={tooltipSide}
        onClick={onNext}
      />
      <IconButton
        icon={Check}
        label="Done Cell"
        visibleLabel={labelled ? 'Done' : undefined}
        tone="toggle"
        active={isDone}
        tooltipSide={tooltipSide}
        onClick={onToggleDone}
      />
      <IconButton
        icon={X}
        label="Exit Cell Focus"
        visibleLabel={labelled ? 'Exit' : undefined}
        tooltipSide={tooltipSide}
        onClick={onExit}
      />
    </div>
  );
}

// "Done Cells cleared · Undo", for a few seconds after a change of cell size or
// paper wiped them. Undo puts the grid back, and the Done Cells with it.
export function DoneCellsNotice({
  count,
  onUndo,
  onDismiss,
}: {
  count: number;
  onUndo: (() => void) | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, DONE_CELLS_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  return (
    <div role="status" data-testid="done-cells-notice" className="panel pill cell-focus-notice">
      <span>
        {count === 1 ? '1 Done Cell cleared' : `${count} Done Cells cleared`}
      </span>
      {onUndo ? (
        <PanelButton variant="ghost" onClick={onUndo}>
          Undo
        </PanelButton>
      ) : null}
    </div>
  );
}
