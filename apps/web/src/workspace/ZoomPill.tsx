'use client';

import type { CSSProperties } from 'react';
import type { StageViewInfo } from '@/canvas/CanvasStage';

interface ZoomPillProps {
  info: StageViewInfo;
  onFit: () => void;
  onRealSize: () => void;
}

// The matte panel material (docs/design.md §5), with the values inline as
// fallbacks so the pill still reads correctly if a token is missing.
const PILL_STYLE: CSSProperties = {
  position: 'absolute',
  right: 'var(--space-md)',
  bottom: 'var(--space-md)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
  padding: 'var(--space-xs)',
  background: 'var(--panel-bg, rgba(19, 20, 22, 0.86))',
  backdropFilter: 'blur(var(--panel-blur, 10px))',
  border: '1px solid var(--panel-border, rgba(255, 255, 255, 0.055))',
  boxShadow: 'var(--panel-shadow, 0 10px 30px rgba(0, 0, 0, 0.55))',
  borderRadius: 'var(--radius-md, 12px)',
  fontFamily: 'var(--font-family-body)',
  color: 'var(--color-ink)',
  // The pill floats over the canvas but must not steal the canvas's own gestures.
  touchAction: 'manipulation',
};

const BUTTON_STYLE: CSSProperties = {
  minHeight: 'var(--touch-target-min)',
  minWidth: 'var(--touch-target-min)',
  padding: '0 var(--space-sm)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid transparent',
  background: 'transparent',
  color: 'inherit',
  fontFamily: 'inherit',
  fontSize: 'var(--font-body-size)',
  fontWeight: 'var(--font-label-weight)',
  cursor: 'pointer',
};

// Per-pane view controls (Grid-Feature-Spec.md §10): Fit to screen, Real size
// (1:1), the zoom as a percentage of "fit", and a "1:1" badge while the paper is
// shown at its true physical size. Each pane has its own, since each pane has its
// own viewport. Deliberately not a live readout of the cursor -- it only reports
// this pane's zoom.
export function ZoomPill({ info, onFit, onRealSize }: ZoomPillProps) {
  const percent = info.fitScale > 0 ? Math.round((info.scale / info.fitScale) * 100) : 100;
  return (
    <div role="group" aria-label="View controls" data-testid="zoom-pill" style={PILL_STYLE}>
      <button type="button" aria-label="Fit to screen" onClick={onFit} style={BUTTON_STYLE}>
        Fit
      </button>
      <button
        type="button"
        aria-label="Real size"
        aria-pressed={info.isRealSize}
        onClick={onRealSize}
        style={{
          ...BUTTON_STYLE,
          border: `1px solid ${info.isRealSize ? 'var(--color-accent)' : 'transparent'}`,
        }}
      >
        Real size
      </button>
      <span
        data-testid="zoom-readout"
        style={{
          fontFamily: 'var(--font-family-mono)',
          fontSize: 'var(--font-mono-size)',
          fontWeight: 'var(--font-mono-weight)',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-ink-muted)',
          minWidth: '4ch',
          textAlign: 'right',
          padding: '0 var(--space-xs)',
        }}
      >
        {percent}%
      </span>
      {info.isRealSize ? (
        <span
          data-testid="real-size-badge"
          style={{
            fontFamily: 'var(--font-family-mono)',
            fontSize: 'var(--font-mono-size)',
            fontWeight: 'var(--font-mono-weight)',
            color: 'var(--color-accent-contrast)',
            background: 'var(--color-accent)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px var(--space-xs)',
          }}
        >
          1:1
        </span>
      ) : null}
    </div>
  );
}
