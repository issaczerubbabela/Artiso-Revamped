'use client';

import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { SHEET_DETENTS, settleSheet, sheetHeights, stepSheetDetent, type SheetDetent } from '@artiso/ui';
import { PanelButton } from './PanelButton';
import { useReportChromeRect } from '@/components/chrome/chrome-insets';
import { useWorkspaceStore } from '@/state/workspace-store';

const DETENT_NAMES: Record<SheetDetent, string> = { peek: 'Peek', half: 'Half', full: 'Full' };

// Flick speed is measured over the end of the drag only.
const VELOCITY_WINDOW_MS = 80;

// The canvas is re-fitted around the sheet only up to half the screen: a sheet
// pulled to full height covers the photo on purpose, and fitting the photo into
// the sliver left above it would just shrink it to nothing.
const MAX_FIT_COVER = 0.5;

interface Drag {
  pointerId: number;
  startY: number;
  startHeight: number;
  samples: { t: number; y: number }[];
}

// A large tool panel as an iPad-style bottom sheet (docs/design.md §7): at
// Compact for every panel, and at Regular (iPad portrait) for Grid, Filters and
// Export. A grab bar on top; three resting heights -- peek, half and full --
// that the sheet is dragged between; dragged or flicked down past peek, it
// closes. Height changes are instant swaps (the sheet follows the finger
// directly while dragged, and then simply rests), never animated.
//
// The grab bar is a keyboard slider (Arrow Up/Down, Home/End) with the height
// as its value, and Escape anywhere in the sheet closes it.
export function BottomSheet({ title, children }: { title: string; children: ReactNode }) {
  const setToolMode = useWorkspaceStore((s) => s.setToolMode);
  const reportRect = useReportChromeRect('bottom', { maxCoverFraction: MAX_FIT_COVER });
  const sheetRef = useRef<HTMLElement | null>(null);
  const [detent, setDetent] = useState<SheetDetent>('half');
  const [available, setAvailable] = useState<number | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const setSheetRef = useCallback(
    (el: HTMLElement | null) => {
      sheetRef.current = el;
      reportRect(el);
    },
    [reportRect],
  );

  // How tall the sheet may grow: from its (fixed) bottom edge to the top of the
  // stack it lives in. Measured before paint and on every resize.
  useLayoutEffect(() => {
    const measure = () => {
      const sheet = sheetRef.current;
      const stack = sheet?.parentElement;
      if (!sheet || !stack) return;
      const next = Math.max(0, Math.round(sheet.getBoundingClientRect().bottom - stack.getBoundingClientRect().top));
      setAvailable((prev) => (prev === next ? prev : next));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const heights = available === null ? null : sheetHeights(available);
  const height = dragHeight ?? (heights ? heights[detent] : null);

  const close = () => setToolMode('idle');

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!heights || height === null) return;
    // Buttons in the header (Close) keep their own taps.
    if ((event.target as Element).closest('button')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Not capturable; the drag still works while the pointer stays on the bar.
    }
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: height,
      samples: [{ t: event.timeStamp, y: event.clientY }],
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId || !heights) return;
    d.samples.push({ t: event.timeStamp, y: event.clientY });
    while (d.samples.length > 2 && event.timeStamp - d.samples[0]!.t > VELOCITY_WINDOW_MS) d.samples.shift();
    setDragHeight(Math.min(heights.full, Math.max(0, d.startHeight + (d.startY - event.clientY))));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragHeight(null);
    if (!heights) return;
    const finalHeight = Math.min(heights.full, Math.max(0, d.startHeight + (d.startY - event.clientY)));
    const first = d.samples[0]!;
    const dt = event.timeStamp - first.t;
    // Positive = moving down (the sheet shrinking).
    const velocity = dt > 0 && dt <= VELOCITY_WINDOW_MS * 2 ? (event.clientY - first.y) / dt : 0;
    const rest = settleSheet(heights, finalHeight, velocity);
    if (rest === 'closed') close();
    else setDetent(rest);
  };

  const onPointerCancel = () => {
    drag.current = null;
    setDragHeight(null);
  };

  const onGrabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next: Partial<Record<string, SheetDetent>> = {
      ArrowUp: stepSheetDetent(detent, 1),
      ArrowRight: stepSheetDetent(detent, 1),
      ArrowDown: stepSheetDetent(detent, -1),
      ArrowLeft: stepSheetDetent(detent, -1),
      Home: 'peek',
      End: 'full',
    };
    const to = next[event.key];
    if (!to) return;
    event.preventDefault();
    setDetent(to);
  };

  return (
    <section
      ref={setSheetRef}
      aria-label={title}
      data-testid="bottom-sheet"
      data-detent={dragHeight === null ? detent : 'dragging'}
      className="panel sheet"
      style={height === null ? undefined : { height }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        close();
      }}
    >
      <div
        className="sheet__top"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Sheet size"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={SHEET_DETENTS.length - 1}
          aria-valuenow={SHEET_DETENTS.indexOf(detent)}
          aria-valuetext={DETENT_NAMES[detent]}
          data-testid="sheet-grabber"
          className="sheet__grabber"
          onKeyDown={onGrabKeyDown}
        >
          <span aria-hidden className="sheet__bar" />
        </div>
        <div className="panel-header">
          <h2 className="panel-title">{title}</h2>
          <PanelButton onClick={close} aria-label="Close panel">
            Close
          </PanelButton>
        </div>
      </div>
      <div className="sheet__body">{children}</div>
    </section>
  );
}
