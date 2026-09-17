'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useWorkspaceStore } from '@/state/workspace-store';

export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CropOverlayProps {
  rect: NormalizedRect;
  onChange: (rect: NormalizedRect) => void;
}

type HandleId = 'nw' | 'ne' | 'sw' | 'se' | 'move';

const MIN_SIZE = 0.05;

// DOM overlay (not canvas-painted) per docs/architecture/02-image-editing.md,
// for trivial hit-testing. Assumes the canvas is showing the image at
// fit-to-frame scale (see workspace-store's viewportResetSignal) so it can
// compute the on-screen crop-box position from workingWidth/workingHeight
// alone, without needing live access to the renderer's Viewport transform.
export function CropOverlay({ rect, onChange }: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const workingWidth = useWorkspaceStore((s) => s.workingWidth);
  const workingHeight = useWorkspaceStore((s) => s.workingHeight);
  const [fitRect, setFitRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const dragRef = useRef<{ handle: HandleId; startX: number; startY: number; startRect: NormalizedRect } | null>(
    null,
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !workingWidth || !workingHeight) return;

    function measure() {
      const box = container!.getBoundingClientRect();
      const scale = Math.min(box.width / workingWidth, box.height / workingHeight);
      const width = workingWidth * scale;
      const height = workingHeight * scale;
      setFitRect({ left: (box.width - width) / 2, top: (box.height - height) / 2, width, height });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [workingWidth, workingHeight]);

  function beginDrag(handle: HandleId) {
    return (event: ReactPointerEvent) => {
      event.stopPropagation();
      event.preventDefault();
      (event.target as Element).setPointerCapture(event.pointerId);
      dragRef.current = { handle, startX: event.clientX, startY: event.clientY, startRect: rect };
    };
  }

  function onPointerMove(event: ReactPointerEvent) {
    const drag = dragRef.current;
    if (!drag || fitRect.width === 0 || fitRect.height === 0) return;
    const dx = (event.clientX - drag.startX) / fitRect.width;
    const dy = (event.clientY - drag.startY) / fitRect.height;
    const start = drag.startRect;
    onChange(applyDrag(drag.handle, start, dx, dy));
  }

  function endDrag() {
    dragRef.current = null;
  }

  const boxStyle: CSSProperties = {
    position: 'absolute',
    left: fitRect.left + rect.x * fitRect.width,
    top: fitRect.top + rect.y * fitRect.height,
    width: rect.w * fitRect.width,
    height: rect.h * fitRect.height,
    border: '2px solid var(--color-accent)',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
    touchAction: 'none',
    pointerEvents: 'auto',
  };

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={boxStyle} onPointerDown={beginDrag('move')} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <CropHandle corner="nw" cursor="nwse-resize" onPointerDown={beginDrag('nw')} onPointerMove={onPointerMove} onPointerUp={endDrag} />
        <CropHandle corner="ne" cursor="nesw-resize" onPointerDown={beginDrag('ne')} onPointerMove={onPointerMove} onPointerUp={endDrag} />
        <CropHandle corner="sw" cursor="nesw-resize" onPointerDown={beginDrag('sw')} onPointerMove={onPointerMove} onPointerUp={endDrag} />
        <CropHandle corner="se" cursor="nwse-resize" onPointerDown={beginDrag('se')} onPointerMove={onPointerMove} onPointerUp={endDrag} />
      </div>
    </div>
  );
}

function CropHandle({
  corner,
  cursor,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  corner: 'nw' | 'ne' | 'sw' | 'se';
  cursor: string;
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: () => void;
}) {
  // 44px, centered on the corner point -- meets the min touch-target size
  // even for this interactive drag handle.
  const style: CSSProperties = {
    position: 'absolute',
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    left: corner === 'ne' || corner === 'se' ? '100%' : 0,
    top: corner === 'sw' || corner === 'se' ? '100%' : 0,
    cursor,
    touchAction: 'none',
    pointerEvents: 'auto',
  };
  return (
    <div
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}

function applyDrag(handle: HandleId, start: NormalizedRect, dx: number, dy: number): NormalizedRect {
  switch (handle) {
    case 'move':
      return {
        ...start,
        x: clamp(start.x + dx, 0, 1 - start.w),
        y: clamp(start.y + dy, 0, 1 - start.h),
      };
    case 'se':
      return {
        ...start,
        w: clamp(start.w + dx, MIN_SIZE, 1 - start.x),
        h: clamp(start.h + dy, MIN_SIZE, 1 - start.y),
      };
    case 'nw': {
      const x = clamp(start.x + dx, 0, start.x + start.w - MIN_SIZE);
      const y = clamp(start.y + dy, 0, start.y + start.h - MIN_SIZE);
      return { x, y, w: start.x + start.w - x, h: start.y + start.h - y };
    }
    case 'ne': {
      const y = clamp(start.y + dy, 0, start.y + start.h - MIN_SIZE);
      return { x: start.x, y, w: clamp(start.w + dx, MIN_SIZE, 1 - start.x), h: start.y + start.h - y };
    }
    case 'sw': {
      const x = clamp(start.x + dx, 0, start.x + start.w - MIN_SIZE);
      return { x, y: start.y, w: start.x + start.w - x, h: clamp(start.h + dy, MIN_SIZE, 1 - start.y) };
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
