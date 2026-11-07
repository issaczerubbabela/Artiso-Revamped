'use client';

import { useCallback } from 'react';
import { cellCount, cellKey, cellLabel, type CellLayout } from '@artiso/core-engine';
import { gridOf, useCellFocusStore } from '@/state/cell-focus-store';
import { useWorkspaceStore } from '@/state/workspace-store';
import { CellFocusBar, DoneCellsNotice } from './CellFocusBar';
import { useBreakpoint } from './use-breakpoint';

// The zoom pill's row (its height plus a gap): on Compact the Cell Focus bar
// sits above it, since the two do not fit side by side on a phone.
const PILL_ROW_PX = 62;

// One pane's Cell Focus chrome: the bar (focused pane only) and the "Done Cells
// cleared" notice, stacked in a band along the bottom-left of the pane.
export function CellFocusControls({
  referenceId,
  layout,
  showSquares,
  withBar,
  position,
}: {
  referenceId: string | null;
  layout: CellLayout;
  showSquares: boolean;
  withBar: boolean;
  position: { left: number; bottom: number };
}) {
  const compact = useBreakpoint() === 'compact';
  const entry = useCellFocusStore((s) => (referenceId ? s.references[referenceId] : undefined));
  const notice = useCellFocusStore((s) => (s.notice && s.notice.referenceId === referenceId ? s.notice : null));
  const dismissNotice = useCellFocusStore((s) => s.dismissNotice);
  const labels = useWorkspaceStore((s) => s.gridSettings.labels);
  const noticeId = notice?.id;
  const onDismiss = useCallback(() => {
    if (noticeId !== undefined) dismissNotice(noticeId);
  }, [dismissNotice, noticeId]);

  const cell = entry?.active && showSquares ? entry.cell : null;
  const bar = withBar && referenceId && cell;
  if (!bar && !notice) return null;

  const store = useCellFocusStore.getState;
  return (
    <div
      className="cell-focus-band"
      style={{ left: position.left, bottom: position.bottom + (compact ? PILL_ROW_PX : 0) }}
    >
      {bar && entry ? (
        <CellFocusBar
          label={cellLabel(cell, labels)}
          doneCount={entry.done.length}
          cellCount={cellCount(gridOf(layout))}
          isDone={entry.done.includes(cellKey(cell))}
          labelled={compact}
          onPrevious={() => store().step(referenceId, layout, -1)}
          onNext={() => store().step(referenceId, layout, 1)}
          onToggleDone={() => store().toggleDone(referenceId, layout)}
          onExit={() => store().exit(referenceId)}
        />
      ) : null}
      {notice ? <DoneCellsNotice key={notice.id} count={notice.count} onUndo={notice.undo} onDismiss={onDismiss} /> : null}
    </div>
  );
}
