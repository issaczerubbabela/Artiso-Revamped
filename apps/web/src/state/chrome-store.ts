import { create } from 'zustand';
import type { ChromeRect } from '@artiso/renderer';

// A floating panel's rectangle as reported by the panel itself, plus whether it
// is an "overlay" (a small control that sits *inside* the uncovered region, like
// the zoom pill, rather than framing it).
export interface ReportedChrome extends ChromeRect {
  overlay: boolean;
}

interface ChromeState {
  rects: Record<string, ReportedChrome>;
  // null removes the panel (it unmounted, was hidden, or has no size).
  report: (id: string, rect: ReportedChrome | null) => void;
}

const same = (a: ReportedChrome, b: ReportedChrome): boolean =>
  a.edge === b.edge &&
  a.overlay === b.overlay &&
  a.left === b.left &&
  a.top === b.top &&
  a.right === b.right &&
  a.bottom === b.bottom;

// Where the floating chrome currently is. The canvas is full-bleed, so it asks
// this to work out which part of itself is actually visible
// (docs/architecture/06-workspace-interaction.md, "Inset-aware view").
export const useChromeStore = create<ChromeState>((set) => ({
  rects: {},
  report: (id, rect) =>
    set((state) => {
      if (rect === null) {
        if (!(id in state.rects)) return state;
        const next = { ...state.rects };
        delete next[id];
        return { rects: next };
      }
      const prev = state.rects[id];
      if (prev && same(prev, rect)) return state;
      return { rects: { ...state.rects, [id]: rect } };
    }),
}));
