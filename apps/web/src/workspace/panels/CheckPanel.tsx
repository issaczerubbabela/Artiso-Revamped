'use client';

import type { KeyboardEvent } from 'react';
import { Slider, labelStyle } from '@/components/controls';
import { PanelButton } from '@/workspace/PanelButton';
import { useCheckPhotoStore } from '@/state/check-photo-store';
import { useWorkspaceStore } from '@/state/workspace-store';
import { adjustCheckPhotoCorners, removeCheckPhoto, takeCheckPhoto } from '@/session/check-photo';

const SECTION_STYLE = { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' } as const;

// The Drawing Check (GLOSSARY.md): take a Check Photo of the drawing, line it
// up by the paper's four corners, then blend it over the reference -- with the
// grid still on top -- to see where proportions drift. Opacity and the hold
// button are view state only; the photo never changes the reference, its edits
// or its exports, and only its owner ever sees it.
export function CheckPanel() {
  const referenceId = useWorkspaceStore((s) => s.referenceId);
  const shown = useCheckPhotoStore((s) => (referenceId ? s.byReference[referenceId] : undefined));
  const opacity = useCheckPhotoStore((s) => s.opacity);
  const setOpacity = useCheckPhotoStore((s) => s.setOpacity);
  const holding = useCheckPhotoStore((s) => s.holding);
  const setHolding = useCheckPhotoStore((s) => s.setHolding);
  const busy = useCheckPhotoStore((s) => s.busy);
  const error = useCheckPhotoStore((s) => s.error);
  const alignment = useCheckPhotoStore((s) => s.alignment);

  // Press and hold (pointer, or Space/Enter held down) shows only the photo.
  const holdKey = (event: KeyboardEvent<HTMLButtonElement>, down: boolean) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (!down || !event.repeat) setHolding(down);
  };

  return (
    <div style={SECTION_STYLE}>
      <span style={labelStyle}>
        Photograph your drawing, line it up by the paper’s corners, and compare it with the reference.
      </span>

      <PanelButton variant={shown ? 'default' : 'primary'} disabled={busy || alignment !== null} aria-busy={busy} onClick={() => void takeCheckPhoto()}>
        {busy ? 'Opening…' : shown ? 'Retake Check Photo' : 'Take Check Photo'}
      </PanelButton>
      {error && !alignment ? (
        <span role="alert" style={{ fontSize: 'var(--font-label-size)', color: 'var(--color-danger)' }}>
          {error}
        </span>
      ) : null}

      {shown ? (
        <>
          <Slider
            label="Check Photo opacity"
            value={Math.round(opacity * 100)}
            min={0}
            max={100}
            format={(v) => `${v}%`}
            onChange={(v) => setOpacity(v / 100)}
          />
          <PanelButton
            active={holding}
            aria-pressed={holding}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setHolding(true);
            }}
            onPointerUp={() => setHolding(false)}
            onPointerCancel={() => setHolding(false)}
            onLostPointerCapture={() => setHolding(false)}
            onKeyDown={(event) => holdKey(event, true)}
            onKeyUp={(event) => holdKey(event, false)}
            onBlur={() => setHolding(false)}
            onContextMenu={(event) => event.preventDefault()}
            style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            Hold to show only the photo
          </PanelButton>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <PanelButton onClick={() => void adjustCheckPhotoCorners()} disabled={alignment !== null}>
              Adjust corners
            </PanelButton>
            <PanelButton onClick={() => void removeCheckPhoto()}>Delete Check Photo</PanelButton>
          </div>
        </>
      ) : null}
    </div>
  );
}
