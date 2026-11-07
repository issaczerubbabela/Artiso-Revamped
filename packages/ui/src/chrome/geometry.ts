// Pure placement maths for the iPad-pattern chrome (docs/design.md §7):
// popovers anchored to a rail button, the canvas context menu, and the bottom
// sheet's resting heights. No DOM: the app measures, these decide.

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

// The arrow never sits closer than this to a popover's top or bottom edge, so it
// stays clear of the rounded corners.
export const POPOVER_ARROW_INSET_PX = 20;

export interface PopoverPlacement {
  // Which side of the anchor the popover opens on (the arrow is on the other).
  side: 'right' | 'left';
  left: number;
  top: number;
  // Tallest the popover may be and still fit inside the bounds.
  maxHeight: number;
  // Arrow centre, in px from the popover's top edge.
  arrow: number;
}

// A popover beside its anchor: to the right when it fits, else to the left;
// vertically centred on the anchor, then slid to stay inside `bounds`. The arrow
// keeps pointing at the anchor's centre whatever the slide.
export function placePopover({
  anchor,
  size,
  bounds,
  gap,
}: {
  anchor: Rect;
  size: Size;
  bounds: Rect;
  gap: number;
}): PopoverPlacement {
  const maxHeight = Math.max(0, bounds.bottom - bounds.top);
  const height = Math.min(size.height, maxHeight);
  const fitsRight = anchor.right + gap + size.width <= bounds.right;
  const fitsLeft = anchor.left - gap - size.width >= bounds.left;
  const side = fitsRight || !fitsLeft ? 'right' : 'left';
  const left = side === 'right' ? anchor.right + gap : anchor.left - gap - size.width;
  const centre = (anchor.top + anchor.bottom) / 2;
  const top = clamp(centre - height / 2, bounds.top, bounds.bottom - height);
  const arrow = clamp(centre - top, POPOVER_ARROW_INSET_PX, Math.max(POPOVER_ARROW_INSET_PX, height - POPOVER_ARROW_INSET_PX));
  return { side, left, top, maxHeight, arrow };
}

// A context menu at a press point: just below and to the right of it (so the
// finger that long-pressed is not on the first item), flipped up or left when it
// would run off the bounds, and clamped inside them as a last resort.
export function placeMenu({
  point,
  size,
  bounds,
  offset,
}: {
  point: Point;
  size: Size;
  bounds: Rect;
  offset: number;
}): { left: number; top: number } {
  let left = point.x + offset;
  if (left + size.width > bounds.right) left = point.x - offset - size.width;
  let top = point.y + offset;
  if (top + size.height > bounds.bottom) top = point.y - offset - size.height;
  return {
    left: clamp(left, bounds.left, bounds.right - size.width),
    top: clamp(top, bounds.top, bounds.bottom - size.height),
  };
}

// ---------- Bottom sheet resting heights ----------

export type SheetDetent = 'peek' | 'half' | 'full';

export const SHEET_DETENTS: readonly SheetDetent[] = ['peek', 'half', 'full'];

// Grab bar + title + about one row of controls.
const PEEK_PX = 168;

// px/ms. A release faster than this moves one height in its direction instead
// of to the nearest one.
export const SHEET_FLICK_SPEED = 0.5;

export type SheetHeights = Record<SheetDetent, number>;

// The three heights for a sheet that may grow to `available` px.
export function sheetHeights(available: number): SheetHeights {
  const full = Math.max(0, Math.round(available));
  const half = Math.round(full / 2);
  const peek = Math.min(PEEK_PX, Math.round(full * 0.35));
  return { peek, half, full };
}

// Where a dragged sheet comes to rest. `velocity` is px/ms of height change
// direction-normalised so that positive means moving *down* (shrinking).
// Dragged under half the peek height, or flicked down from around peek, the
// sheet closes: that is swipe-down-to-close.
export function settleSheet(heights: SheetHeights, height: number, velocity: number): SheetDetent | 'closed' {
  if (height < heights.peek / 2) return 'closed';
  if (velocity >= SHEET_FLICK_SPEED) {
    const below = [...SHEET_DETENTS].reverse().find((d) => heights[d] < height);
    return below ?? 'closed';
  }
  if (velocity <= -SHEET_FLICK_SPEED) {
    return SHEET_DETENTS.find((d) => heights[d] > height) ?? 'full';
  }
  let best: SheetDetent = 'peek';
  for (const d of SHEET_DETENTS) {
    if (Math.abs(heights[d] - height) < Math.abs(heights[best] - height)) best = d;
  }
  return best;
}

// One height up (+1) or down (-1), for the keyboard. Never closes: Escape does.
export function stepSheetDetent(detent: SheetDetent, direction: 1 | -1): SheetDetent {
  const index = SHEET_DETENTS.indexOf(detent) + direction;
  return SHEET_DETENTS[clamp(index, 0, SHEET_DETENTS.length - 1)]!;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}
