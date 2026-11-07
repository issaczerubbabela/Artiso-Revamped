'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { placePopover, type PopoverPlacement } from '@artiso/ui';
import { IconButton } from '@/components/chrome/IconButton';
import { useWorkspaceStore, type ToolMode } from '@/state/workspace-store';
import { PANEL_TITLES, ToolPanel } from './ToolPanel';
import { CANVAS_TOOLS } from './tools';

// Room kept between the popover and the screen edge, and between it and its button.
const EDGE_PX = 16;
const GAP_PX = 14;

function anchorFor(mode: ToolMode): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="side-rail"] [data-tool="${mode}"]`);
}

// A small tool panel as an iPad-style popover (docs/design.md §7): a matte panel
// beside its rail button with an arrow pointing at it. A tap outside it or Esc
// closes it (and its tool). For a tool that works on the canvas itself (Draw),
// taps on the canvas are strokes, not taps outside, so its popover -- with
// Undo -- stays open while drawing. Floats over the canvas without reserving
// space: it is transient, and the canvas does not re-fit around it.
//
// Non-modal dialog semantics: focus moves into it when it opens, Tab walks its
// controls, Esc returns focus to the rail button.
export function PanelPopover({ mode }: { mode: Exclude<ToolMode, 'idle'> }) {
  const ref = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const setToolMode = useWorkspaceStore((s) => s.setToolMode);
  const [placement, setPlacement] = useState<PopoverPlacement | null>(null);
  const title = PANEL_TITLES[mode];

  const dismiss = useCallback(
    (returnFocus: boolean) => {
      setToolMode('idle');
      if (returnFocus) anchorFor(mode)?.focus();
    },
    [mode, setToolMode],
  );

  // Placed before paint, and again whenever the window or the content resizes.
  useLayoutEffect(() => {
    const el = ref.current;
    const scroller = scrollRef.current;
    if (!el || !scroller) return;
    const place = () => {
      const anchor = anchorFor(mode);
      if (!anchor) return;
      const a = anchor.getBoundingClientRect();
      const next = placePopover({
        anchor: { left: a.left, top: a.top, right: a.right, bottom: a.bottom },
        size: { width: el.offsetWidth, height: scroller.scrollHeight },
        bounds: { left: EDGE_PX, top: EDGE_PX, right: window.innerWidth - EDGE_PX, bottom: window.innerHeight - EDGE_PX },
        gap: GAP_PX,
      });
      setPlacement((prev) =>
        prev &&
        prev.side === next.side &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.arrow === next.arrow &&
        prev.maxHeight === next.maxHeight
          ? prev
          : next,
      );
    };
    place();
    window.addEventListener('resize', place);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    // The content, not the scroller: the scroller's size is what placement sets.
    if (observer) for (const child of Array.from(scroller.children)) observer.observe(child);
    return () => {
      window.removeEventListener('resize', place);
      observer?.disconnect();
    };
  }, [mode]);

  // Focus moves into the popover when it opens (or switches to another tool) --
  // once it is placed, since a hidden element cannot take focus.
  const placed = placement !== null;
  useEffect(() => {
    if (placed) ref.current?.focus({ preventScroll: true });
  }, [mode, placed]);

  // Outside tap / Esc. Capture phase, so a tap on the canvas dismisses even
  // though the canvas captures its own pointers. The rail button toggles itself.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || ref.current?.contains(target)) return;
      if (anchorFor(mode)?.contains(target)) return;
      // Drawing on the canvas is the Draw tool at work, not a tap outside it.
      if (CANVAS_TOOLS.has(mode) && (target as Element).closest?.('[data-testid="pane"]')) return;
      dismiss(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      dismiss(true);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [dismiss, mode]);

  return (
    <section
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      tabIndex={-1}
      data-testid="panel-popover"
      data-side={placement?.side ?? 'right'}
      className="panel popover"
      style={placement ? { left: placement.left, top: placement.top } : { visibility: 'hidden', left: 0, top: 0 }}
    >
      {/* Scrolls inside, so the arrow outside the box is never clipped. */}
      <div ref={scrollRef} className="popover__scroll" style={placement ? { maxHeight: placement.maxHeight } : undefined}>
        <div className="panel-header">
          <h2 className="panel-title">{title}</h2>
          <IconButton icon={X} label="Close panel" tooltipSide="bottom" onClick={() => dismiss(true)} />
        </div>
        <ToolPanel mode={mode} />
      </div>
      {placement ? <span aria-hidden className="popover__arrow" style={{ top: placement.arrow }} /> : null}
    </section>
  );
}
