'use client';

import { useEffect, useState } from 'react';
import {
  CALIBRATION_RULER_MM,
  calibrateFromRuler,
  nativeResolutionGuess,
  physicalPpi,
  pxPerMmCss,
} from '@artiso/core-engine';
import { NumberField, labelStyle, readoutStyle } from '@/components/controls';
import { PanelButton } from '@/workspace/PanelButton';
import { useDisplayStore } from '@/state/display-store';

// Browsers can't know how big the screen physically is, so Real size (1 mm on
// paper = 1 mm on the screen) needs the user to say it once
// (Grid-Feature-Spec.md §10): the diagonal in inches and the native resolution.
// A modal over the canvas rather than a route (ki-canvas-first-design); the values
// stay on this device -- a phone and a desktop have different pixel densities.
export function CalibrationDialog() {
  const open = useDisplayStore((s) => s.calibrationOpen);
  if (!open) return null;
  return <CalibrationForm />;
}

const positive = (n: number) => n > 0 && Number.isFinite(n);

function CalibrationForm() {
  const saved = useDisplayStore((s) => s.screen);
  const setScreen = useDisplayStore((s) => s.setScreen);
  const close = useDisplayStore((s) => s.closeCalibration);

  // Pre-filled from what the browser reports: screen size x pixel ratio. The
  // diagonal is the one thing only the user knows.
  const [guess] = useState(() =>
    typeof window === 'undefined'
      ? { nativeResW: 1920, nativeResH: 1080 }
      : nativeResolutionGuess(window.screen.width, window.screen.height, window.devicePixelRatio || 1),
  );
  const [diagonalIn, setDiagonalIn] = useState(saved?.diagonalIn ?? 0);
  const [resW, setResW] = useState(saved?.nativeResW ?? guess.nativeResW);
  const [resH, setResH] = useState(saved?.nativeResH ?? guess.nativeResH);
  const [measuredMm, setMeasuredMm] = useState(0);
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    setDpr(window.devicePixelRatio || 1);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const valid = positive(diagonalIn) && positive(resW) && positive(resH);
  const ppi = valid ? physicalPpi({ diagonalIn, nativeResW: resW, nativeResH: resH }) : null;
  // The "100 mm" line, drawn at the PPI the numbers above imply. Held to a ruler,
  // it shows whether they are right.
  const rulerPx = ppi ? pxPerMmCss(ppi, dpr) * CALIBRATION_RULER_MM : 0;

  function save() {
    if (!valid) return;
    setScreen({ diagonalIn, nativeResW: Math.round(resW), nativeResH: Math.round(resH) });
    close();
  }

  // The user measured the line and it came out a different length: the true PPI
  // follows, so the diagonal is corrected to match (the resolution is known).
  function correct() {
    if (!ppi || !positive(measuredMm)) return;
    const corrected = calibrateFromRuler(ppi, measuredMm);
    setDiagonalIn(Math.round((Math.hypot(resW, resH) / corrected) * 100) / 100);
    setMeasuredMm(0);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Calibrate your screen"
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-md)',
        zIndex: 20,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'var(--color-surface-raised)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--panel-shadow, 0 10px 30px rgba(0, 0, 0, 0.55))',
          padding: 'var(--space-lg)',
          width: '100%',
          maxWidth: 420,
          maxHeight: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
          fontFamily: 'var(--font-family-body)',
          color: 'var(--color-ink)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--font-heading-size)', fontWeight: 'var(--font-heading-weight)' }}>
          Calibrate your screen
        </span>
        <p style={{ ...labelStyle, textTransform: 'none', letterSpacing: 0, margin: 0, lineHeight: 1.4 }}>
          Real size shows the paper at its true physical size, so you can compare it with the sheet you draw on. A browser
          can&apos;t tell how big your screen is, so tell it once. This stays on this device.
        </p>

        <NumberField
          label="Screen diagonal (inches)"
          value={diagonalIn}
          format={(v) => (v > 0 ? String(v) : '')}
          suffix="in"
          onCommit={setDiagonalIn}
        />
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <NumberField label="Native width" value={resW} format={(v) => String(Math.round(v))} suffix="px" onCommit={setResW} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <NumberField label="Native height" value={resH} format={(v) => String(Math.round(v))} suffix="px" onCommit={setResH} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={labelStyle}>Pixel density</span>
          <span data-testid="calibration-ppi" style={readoutStyle}>
            {ppi ? `${Math.round(ppi * 10) / 10} ppi` : '—'}
          </span>
        </div>

        {ppi ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            <span style={labelStyle}>Check with a ruler (optional)</span>
            <div
              data-testid="calibration-ruler"
              aria-label={`A ${CALIBRATION_RULER_MM} millimetre line`}
              style={{ width: rulerPx, maxWidth: '100%', height: 0, borderTop: '2px solid var(--color-accent)' }}
            />
            <span style={{ ...labelStyle, textTransform: 'none', letterSpacing: 0, lineHeight: 1.4 }}>
              This line should be {CALIBRATION_RULER_MM} mm long. Measure it and enter what you get to correct the
              numbers.
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <NumberField
                  label="Measured length (mm)"
                  value={measuredMm}
                  format={(v) => (v > 0 ? String(v) : '')}
                  suffix="mm"
                  onCommit={setMeasuredMm}
                />
              </div>
              <PanelButton onClick={correct} disabled={!positive(measuredMm)}>
                Correct
              </PanelButton>
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
          <PanelButton onClick={close}>Cancel</PanelButton>
          <PanelButton variant="primary" onClick={save} disabled={!valid}>
            Save
          </PanelButton>
        </div>
      </div>
    </div>
  );
}
