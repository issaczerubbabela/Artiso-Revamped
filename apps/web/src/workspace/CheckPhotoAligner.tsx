'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { orderCorners } from '@artiso/core-engine';
import type { PhotoPoint } from '@artiso/shared-types';
import { PanelButton } from '@/workspace/PanelButton';
import { useCheckPhotoStore, type CheckAlignment } from '@/state/check-photo-store';
import { cancelCheckAlignment, commitCheckAlignment } from '@/session/check-photo';

// Space kept around the photo inside the stage (CSS px).
const STAGE_MARGIN = 24;
// A press this close to a corner (CSS px) picks it up rather than placing a new one.
const GRAB_RADIUS = 28;
// The loupe: its diameter, how much it magnifies, and how far above the finger
// it floats so the finger never covers what it shows.
const LOUPE_SIZE = 132;
const LOUPE_ZOOM = 3;
const LOUPE_LIFT = 96;
// Arrow keys nudge a focused corner by 1 photo pixel, 10 with Shift.
const NUDGE_PX = 1;
const NUDGE_FAST_PX = 10;

interface Fit {
  scale: number;
  x: number;
  y: number;
}

// Corner placement for the Drawing Check: the photo fills the screen, the
// artist taps the paper's four corners -- in any order -- and drags any of them
// to adjust. A magnifier loupe floats above the finger while it is down, so the
// corner can be put exactly on the paper's edge. Every corner is also a focusable
// handle that the arrow keys nudge, and "Use photo edges" places all four at
// once, so nothing here needs touch (story 56).
//
// A full-screen takeover is the rare, justified case ki-canvas-first-design
// allows: it lasts four taps, corner accuracy is what the whole check rests
// on, and what fills the screen is the artist's own drawing. It never
// navigates away -- Cancel or Done drops straight back onto the canvas.
export function CheckPhotoAligner() {
  const alignment = useCheckPhotoStore((s) => s.alignment);
  if (!alignment) return null;
  return <Aligner alignment={alignment} />;
}

function Aligner({ alignment }: { alignment: CheckAlignment }) {
  const error = useCheckPhotoStore((s) => s.error);
  const setCorners = useCheckPhotoStore((s) => s.setAlignmentCorners);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [drag, setDrag] = useState<{ index: number; pointerId: number } | null>(null);
  const { bitmap, corners } = alignment;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') cancelCheckAlignment();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fit: Fit = (() => {
    const scale = Math.max(
      0.0001,
      Math.min((size.width - STAGE_MARGIN * 2) / bitmap.width, (size.height - STAGE_MARGIN * 2) / bitmap.height),
    );
    return { scale, x: (size.width - bitmap.width * scale) / 2, y: (size.height - bitmap.height * scale) / 2 };
  })();
  const toScreen = (p: PhotoPoint) => ({ x: fit.x + p.x * fit.scale, y: fit.y + p.y * fit.scale });
  const toPhoto = (x: number, y: number): PhotoPoint => ({
    x: clamp((x - fit.x) / fit.scale, 0, bitmap.width),
    y: clamp((y - fit.y) / fit.scale, 0, bitmap.height),
  });

  // The photo and the outline of the corners placed so far.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.drawImage(bitmap, fit.x, fit.y, bitmap.width * fit.scale, bitmap.height * fit.scale);

    const outline = corners.length === 4 ? [...orderCorners(corners)] : corners;
    if (outline.length >= 2) {
      ctx.beginPath();
      outline.forEach((p, i) => {
        const s = toScreen(p);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      if (outline.length === 4) ctx.closePath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#34e2e2';
      ctx.stroke();
    }
  });

  // The loupe: the photo around the corner being placed, magnified.
  const dragged = drag ? corners[drag.index] : undefined;
  useEffect(() => {
    const loupe = loupeRef.current;
    if (!loupe || !dragged) return;
    const dpr = window.devicePixelRatio || 1;
    loupe.width = Math.round(LOUPE_SIZE * dpr);
    loupe.height = Math.round(LOUPE_SIZE * dpr);
    const ctx = loupe.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#131416';
    ctx.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    const span = LOUPE_SIZE / (fit.scale * LOUPE_ZOOM);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, dragged.x - span / 2, dragged.y - span / 2, span, span, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    const c = LOUPE_SIZE / 2;
    ctx.strokeStyle = '#34e2e2';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c, 0);
    ctx.lineTo(c, LOUPE_SIZE);
    ctx.moveTo(0, c);
    ctx.lineTo(LOUPE_SIZE, c);
    ctx.stroke();
  });

  function pointFromEvent(event: PointerEvent): { x: number; y: number } {
    const rect = stageRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function nearestCorner(x: number, y: number): number {
    let best = -1;
    let bestDistance = GRAB_RADIUS;
    corners.forEach((p, i) => {
      const s = toScreen(p);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d <= bestDistance) {
        best = i;
        bestDistance = d;
      }
    });
    return best;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const { x, y } = pointFromEvent(event);
    let index = nearestCorner(x, y);
    if (index < 0) {
      if (corners.length >= 4) return;
      index = corners.length;
      setCorners([...corners, toPhoto(x, y)]);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ index, pointerId: event.pointerId });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const { x, y } = pointFromEvent(event);
    const next = [...useCheckPhotoStore.getState().alignment!.corners];
    next[drag.index] = toPhoto(x, y);
    setCorners(next);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (drag?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDrag(null);
  }

  function nudge(index: number, event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? NUDGE_FAST_PX : NUDGE_PX;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = [...corners];
    const p = next[index]!;
    next[index] = { x: clamp(p.x + delta[0]!, 0, bitmap.width), y: clamp(p.y + delta[1]!, 0, bitmap.height) };
    setCorners(next);
  }

  // All four corners at once, just inside the photo's edges, for keyboard use
  // or a photo framed tightly on the paper.
  function placeAtPhotoEdges() {
    const inset = Math.round(Math.min(bitmap.width, bitmap.height) * 0.05);
    setCorners([
      { x: inset, y: inset },
      { x: bitmap.width - inset, y: inset },
      { x: bitmap.width - inset, y: bitmap.height - inset },
      { x: inset, y: bitmap.height - inset },
    ]);
  }

  const placed = corners.length;
  const instruction =
    placed < 4 ? `Tap corner ${placed + 1} of 4 of your paper` : 'Drag a corner to adjust it, then choose Done';
  const loupeAt = dragged ? toScreen(dragged) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Line up the Check Photo"
      className="check-aligner"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface)',
      }}
    >
      <div
        className="panel"
        style={{
          margin: 'var(--space-md)',
          padding: 'var(--space-sm) var(--space-md)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--space-sm)',
        }}
      >
        <span
          role="status"
          data-testid="check-aligner-instruction"
          style={{ flex: '1 1 220px', fontSize: 'var(--font-body-size)' }}
        >
          {instruction}
        </span>
        <PanelButton onClick={cancelCheckAlignment}>Cancel</PanelButton>
        <PanelButton onClick={placeAtPhotoEdges}>Use photo edges</PanelButton>
        <PanelButton onClick={() => setCorners([])} disabled={placed === 0}>
          Clear corners
        </PanelButton>
        <PanelButton variant="primary" disabled={placed !== 4} onClick={() => void commitCheckAlignment()}>
          Done
        </PanelButton>
        {error ? (
          <span role="alert" style={{ flexBasis: '100%', fontSize: 'var(--font-label-size)', color: 'var(--color-danger)' }}>
            {error}
          </span>
        ) : null}
      </div>

      <div
        ref={stageRef}
        data-testid="check-aligner-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ position: 'relative', flex: 1, minHeight: 0, touchAction: 'none', cursor: 'crosshair' }}
      >
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        {corners.map((p, i) => {
          const s = toScreen(p);
          return (
            <button
              key={i}
              type="button"
              aria-label={`Corner ${i + 1}`}
              onKeyDown={(event) => nudge(i, event)}
              style={{
                position: 'absolute',
                left: s.x - 22,
                top: s.y - 22,
                width: 44,
                height: 44,
                padding: 0,
                border: 'none',
                background: 'transparent',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: '2px solid #34e2e2',
                  background: drag?.index === i ? '#34e2e2' : 'rgba(19,20,22,.6)',
                }}
              />
            </button>
          );
        })}
        {loupeAt ? (
          <canvas
            ref={loupeRef}
            data-testid="check-loupe"
            aria-hidden
            style={{
              position: 'absolute',
              width: LOUPE_SIZE,
              height: LOUPE_SIZE,
              left: clamp(loupeAt.x - LOUPE_SIZE / 2, 0, Math.max(0, size.width - LOUPE_SIZE)),
              // Above the finger, or below it near the top edge.
              top:
                loupeAt.y - LOUPE_LIFT - LOUPE_SIZE / 2 >= 0
                  ? loupeAt.y - LOUPE_LIFT - LOUPE_SIZE / 2
                  : loupeAt.y + LOUPE_LIFT - LOUPE_SIZE / 2,
              borderRadius: '50%',
              border: '2px solid var(--color-border-strong)',
              boxShadow: '0 6px 18px rgba(0,0,0,.5)',
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
