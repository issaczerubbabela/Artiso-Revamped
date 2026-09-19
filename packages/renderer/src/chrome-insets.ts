import type { ViewportInsets } from './viewport';

// Which side of the screen a floating panel is anchored to.
export type ChromeEdge = 'left' | 'right' | 'top' | 'bottom';

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// One floating panel's rectangle (same coordinate space as the container's) and
// the edge whose strip it occupies.
export interface ChromeRect extends Box {
  edge: ChromeEdge;
}

// Never let chrome take more than this much of an axis: whatever the panels
// cover, at least this many px of the container stay available for content.
const MIN_VISIBLE_PX = 160;

// Turns the rectangles of floating panels into the insets one canvas container
// should fit its content inside (docs/architecture/06-workspace-interaction.md,
// "Inset-aware view"). Only panels that overlap the container count, so in a
// split view each pane reacts to the chrome that actually covers it. `gap` keeps
// the content clear of a panel's edge.
export function insetsFromChrome(
  container: Box,
  chrome: readonly ChromeRect[],
  gap: number,
  minVisible: number = MIN_VISIBLE_PX,
): ViewportInsets {
  const out: ViewportInsets = { left: 0, top: 0, right: 0, bottom: 0 };

  for (const rect of chrome) {
    const overlaps =
      rect.right > container.left &&
      rect.left < container.right &&
      rect.bottom > container.top &&
      rect.top < container.bottom;
    if (!overlaps) continue;

    switch (rect.edge) {
      case 'left':
        out.left = Math.max(out.left, rect.right + gap - container.left);
        break;
      case 'right':
        out.right = Math.max(out.right, container.right - (rect.left - gap));
        break;
      case 'top':
        out.top = Math.max(out.top, rect.bottom + gap - container.top);
        break;
      case 'bottom':
        out.bottom = Math.max(out.bottom, container.bottom - (rect.top - gap));
        break;
    }
  }

  return limitAxes(container, out, minVisible);
}

function limitAxes(container: Box, insets: ViewportInsets, minVisible: number): ViewportInsets {
  const [left, right] = limitPair(insets.left, insets.right, container.right - container.left, minVisible);
  const [top, bottom] = limitPair(insets.top, insets.bottom, container.bottom - container.top, minVisible);
  return { left, top, right, bottom };
}

// Scales a pair of opposite insets down together when they would leave less than
// `minVisible` of the axis.
function limitPair(a: number, b: number, length: number, minVisible: number): [number, number] {
  const clean = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
  const first = clean(a);
  const second = clean(b);
  const budget = Math.max(0, length - minVisible);
  const total = first + second;
  if (total <= budget || total === 0) return [first, second];
  const factor = budget / total;
  return [first * factor, second * factor];
}
