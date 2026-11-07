'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { LockSimple, LockSimpleOpen } from '@phosphor-icons/react';
import { viewRotationDegrees } from '@artiso/renderer';
import type { StageViewInfo } from '@/canvas/CanvasStage';
import { useReportChromeRect } from '@/components/chrome/chrome-insets';
import { PanelButton } from './PanelButton';

interface ZoomPillProps {
  info: StageViewInfo;
  onFit: () => void;
  onRealSize: () => void;
  // Turns the view back to 0° (tapping the angle).
  onResetRotation: () => void;
  // Where the pane wants it (px from the pane's right and bottom edges): clear of
  // any panel that floats over that corner.
  position: Pick<CSSProperties, 'right' | 'bottom'>;
  // Touch Lock (GLOSSARY.md): on, the view is frozen, so the buttons that
  // would move it are unavailable.
  touchLocked: boolean;
  onTouchLock: (locked: boolean) => void;
}

// How long the lock must be pressed to unlock, so a bump never unlocks it.
export const TOUCH_LOCK_UNLOCK_MS = 1000;
export const TOUCH_LOCK_UNLOCK_HINT = 'Press and hold the lock for 1 second to unlock.';

// Per-pane view controls (Grid-Feature-Spec.md §10): Fit to screen, Real size
// (1:1), the zoom as a percentage of "fit", and a "1:1" badge while the paper is
// shown at its true physical size. Each pane has its own, since each pane has its
// own viewport. Deliberately not a live readout of the cursor -- it only reports
// this pane's zoom.
//
// Whenever the view is turned (View Rotation, GLOSSARY.md) the angle shows next
// to the zoom, in whole degrees; tapping it squares the view back up.
//
// A matte pill (docs/design.md §5) that reports itself as an overlay so the canvas
// keeps the paper clear of it, while other overlays position around panels only.
export function ZoomPill({ info, onFit, onRealSize, onResetRotation, position, touchLocked, onTouchLock }: ZoomPillProps) {
  const reportRect = useReportChromeRect('bottom', { overlay: true });
  const percent = info.fitScale > 0 ? Math.round((info.scale / info.fitScale) * 100) : 100;
  const degrees = viewRotationDegrees(info.rotation);
  return (
    <div
      ref={reportRect}
      role="group"
      aria-label="View controls"
      data-testid="zoom-pill"
      className="panel pill zoom-pill"
      style={position}
    >
      <TouchLockButton locked={touchLocked} onChange={onTouchLock} />
      <PanelButton variant="ghost" aria-label="Fit to screen" disabled={touchLocked} onClick={onFit}>
        Fit
      </PanelButton>
      <PanelButton variant="ghost" aria-label="Real size" aria-pressed={info.isRealSize} disabled={touchLocked} onClick={onRealSize}>
        Real size
      </PanelButton>
      <span data-testid="zoom-readout" className="readout">
        {percent}%
      </span>
      {degrees !== 0 ? (
        <PanelButton
          variant="ghost"
          data-testid="rotation-readout"
          className="readout"
          aria-label={`View Rotation ${degrees}°, reset to 0°`}
          title="Reset rotation"
          disabled={touchLocked}
          onClick={onResetRotation}
        >
          {degrees}°
        </PanelButton>
      ) : null}
      {info.isRealSize ? (
        <span data-testid="real-size-badge" className="badge-1to1">
          1:1
        </span>
      ) : null}
    </div>
  );
}

// The Touch Lock button. Locking is one tap. Unlocking takes a 1-second press
// -- of a finger, the Pencil, the mouse, or Enter/Space held on the keyboard --
// so a sleeve brushing the pill can't undo it. Holding shows as pressed-in for
// as long as the press lasts (an instant state, not an animation).
function TouchLockButton({ locked, onChange }: { locked: boolean; onChange: (locked: boolean) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A hold that unlocked must not let the click that ends it lock again.
  const swallowClick = useRef(false);
  const [holding, setHolding] = useState(false);

  const stop = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const start = () => {
    swallowClick.current = false;
    if (!locked || timer.current !== null) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      swallowClick.current = true;
      onChange(false);
    }, TOUCH_LOCK_UNLOCK_MS);
  };
  useEffect(() => stop, []);

  const Icon = locked ? LockSimple : LockSimpleOpen;
  return (
    <PanelButton
      variant="ghost"
      className="touch-lock"
      data-holding={holding || undefined}
      aria-label="Touch Lock"
      aria-pressed={locked}
      aria-description={locked ? TOUCH_LOCK_UNLOCK_HINT : undefined}
      title={locked ? 'Hold to unlock' : 'Touch Lock'}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) start();
      }}
      onKeyUp={stop}
      onBlur={stop}
      // A long press must not raise the iPad's callout or the context menu.
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (swallowClick.current) {
          swallowClick.current = false;
          return;
        }
        if (!locked) onChange(true);
      }}
    >
      <Icon size={20} weight={locked ? 'fill' : 'regular'} aria-hidden />
      {locked ? 'Locked' : 'Lock'}
    </PanelButton>
  );
}
