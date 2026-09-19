'use client';

import type { CSSProperties } from 'react';
import type { StageViewInfo } from '@/canvas/CanvasStage';
import { useReportChromeRect } from '@/components/chrome/chrome-insets';
import { PanelButton } from './PanelButton';

interface ZoomPillProps {
  info: StageViewInfo;
  onFit: () => void;
  onRealSize: () => void;
  // Where the pane wants it (px from the pane's right and bottom edges): clear of
  // any panel that floats over that corner.
  position: Pick<CSSProperties, 'right' | 'bottom'>;
}

// Per-pane view controls (Grid-Feature-Spec.md §10): Fit to screen, Real size
// (1:1), the zoom as a percentage of "fit", and a "1:1" badge while the paper is
// shown at its true physical size. Each pane has its own, since each pane has its
// own viewport. Deliberately not a live readout of the cursor -- it only reports
// this pane's zoom.
//
// A matte pill (docs/design.md §5) that reports itself as an overlay so the canvas
// keeps the paper clear of it, while other overlays position around panels only.
export function ZoomPill({ info, onFit, onRealSize, position }: ZoomPillProps) {
  const reportRect = useReportChromeRect('bottom', { overlay: true });
  const percent = info.fitScale > 0 ? Math.round((info.scale / info.fitScale) * 100) : 100;
  return (
    <div
      ref={reportRect}
      role="group"
      aria-label="View controls"
      data-testid="zoom-pill"
      className="panel pill zoom-pill"
      style={position}
    >
      <PanelButton variant="ghost" aria-label="Fit to screen" onClick={onFit}>
        Fit
      </PanelButton>
      <PanelButton variant="ghost" aria-label="Real size" aria-pressed={info.isRealSize} onClick={onRealSize}>
        Real size
      </PanelButton>
      <span data-testid="zoom-readout" className="readout">
        {percent}%
      </span>
      {info.isRealSize ? (
        <span data-testid="real-size-badge" className="badge-1to1">
          1:1
        </span>
      ) : null}
    </div>
  );
}
