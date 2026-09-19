'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { NO_INSETS, insetsFromChrome, type Box, type ChromeEdge, type ViewportInsets } from '@artiso/renderer';
import { useChromeStore } from '@/state/chrome-store';

// Keeps content this far clear of a panel's edge, on top of the viewport's own
// fit padding (docs/design.md §6).
export const CHROME_GAP_PX = 12;

// A useLayoutEffect that does not warn during server prerendering.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface ReportOptions {
  // Small controls inside the visible region (the zoom pill) rather than
  // panels framing it. They still reserve space, but other overlays position
  // themselves clear of the panels only.
  overlay?: boolean;
  // Off while the panel is not really on screen.
  active?: boolean;
}

// Returns a callback ref. Attach it to a floating panel and its rectangle is
// reported to the chrome store -- measured synchronously on mount (before paint,
// so the canvas never flashes under a panel that just appeared) and again
// whenever it resizes or the window does.
export function useReportChromeRect(edge: ChromeEdge, options: ReportOptions = {}): (el: HTMLElement | null) => void {
  const { overlay = false, active = true } = options;
  const id = useId();
  const report = useChromeStore((s) => s.report);
  const element = useRef<HTMLElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  const measure = useCallback(() => {
    const el = element.current;
    if (!el || !active) {
      report(id, null);
      return;
    }
    const r = el.getBoundingClientRect();
    // A hidden (display:none) panel has no size and must not reserve space.
    if (r.width === 0 || r.height === 0) {
      report(id, null);
      return;
    }
    report(id, { edge, overlay, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  }, [active, edge, id, overlay, report]);

  const setRef = useCallback(
    (el: HTMLElement | null) => {
      observer.current?.disconnect();
      observer.current = null;
      element.current = el;
      measure();
      if (el && typeof ResizeObserver !== 'undefined') {
        observer.current = new ResizeObserver(measure);
        observer.current.observe(el);
      }
    },
    [measure],
  );

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // Gone with the component.
  useEffect(
    () => () => {
      observer.current?.disconnect();
      report(id, null);
    },
    [id, report],
  );

  return setRef;
}

export interface PaneInsets {
  // What the viewport should fit inside: every panel that covers this container.
  insets: ViewportInsets;
  // The same, ignoring overlay controls -- where such a control should sit so it
  // clears the panels without reserving space for itself.
  clearance: ViewportInsets;
}

// The insets for one canvas container: the chrome rectangles that overlap it,
// turned into how much of each edge is covered. Recomputed when panels move and
// when the container resizes (a split-view pane, a window resize).
export function useChromeInsets(container: RefObject<HTMLElement | null>): PaneInsets {
  const rects = useChromeStore((s) => s.rects);
  const [box, setBox] = useState<Box | null>(null);

  useIsomorphicLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox((prev) =>
        prev && prev.left === r.left && prev.top === r.top && prev.right === r.right && prev.bottom === r.bottom
          ? prev
          : { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      );
    };
    measure();
    window.addEventListener('resize', measure);
    if (typeof ResizeObserver === 'undefined') return () => window.removeEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [container]);

  return useMemo(() => {
    if (!box) return { insets: NO_INSETS, clearance: NO_INSETS };
    const all = Object.values(rects);
    return {
      insets: insetsFromChrome(box, all, CHROME_GAP_PX),
      clearance: insetsFromChrome(
        box,
        all.filter((r) => !r.overlay),
        CHROME_GAP_PX,
      ),
    };
  }, [box, rects]);
}
