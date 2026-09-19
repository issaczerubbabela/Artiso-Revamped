import type { LabelScheme } from '@artiso/shared-types';
import { labelFor } from './label-scheme';
import { cellRange, getCols, getRows, type PaperSize } from './square-grid';

// Sticky edge labels (docs/architecture/Grid-Feature-Spec.md §7).
//
// Labels sit on all four edges only -- column labels along the top and bottom,
// row labels down the left and right -- never inside cells. They keep a
// constant on-screen size, are centred on the visible part of their cell
// (cell ∩ paper ∩ viewport), pin to the viewport edge when the paper edge
// scrolls out of view, and thin out (every 2nd / 5th / 10th ...) rather than
// overlap.
//
// This is a pure function of the view. It is deliberately separate from the
// cached line geometry: panning/zooming re-runs *this* (cheap, culled to the
// viewport) but never regenerates the grid lines (ki-grid-image-independence).

/** `screen = mm * scale + offset`, in CSS pixels. */
export interface LabelView {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface TextSize {
  width: number;
  height: number;
}

export type LabelEdge = 'top' | 'bottom' | 'left' | 'right';

export interface PlacedLabel {
  text: string;
  edge: LabelEdge;
  /** 0-based column (top/bottom) or row (left/right) index. */
  index: number;
  /** The label rectangle in viewport CSS px; the text is centred in it. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabelLayoutInput {
  paper: PaperSize;
  cellMm: number;
  labels: { enabled: boolean; columns: LabelScheme; rows: LabelScheme };
  view: LabelView;
  viewport: { width: number; height: number };
  /** Size of the bare text at the label font; padding is added around it. */
  measure: (text: string) => TextSize;
  /** Padding around the text inside the rectangle (CSS px). */
  padding?: { x: number; y: number };
  /** Minimum space kept between neighbouring labels (CSS px). */
  gap?: number;
}

const DEFAULT_PADDING = { x: 4, y: 2 };
const DEFAULT_GAP = 4;

/** 1, 2, 5, 10, 20, 50, 100, ... -- the "every Nth label" ladder. */
export function* densitySteps(): Generator<number> {
  for (let magnitude = 1; magnitude < 1e9; magnitude *= 10) {
    yield magnitude;
    yield magnitude * 2;
    yield magnitude * 5;
  }
}

/** The smallest step whose spacing (step * cellPx) leaves room for a label of `labelPx` plus a gap. */
export function densityStep(cellPx: number, labelPx: number, gap: number): number {
  for (const step of densitySteps()) {
    if (step * cellPx >= labelPx + gap) return step;
  }
  return Infinity;
}

interface AxisPlacement {
  text: string;
  index: number;
  /** Centre along the axis, viewport CSS px. */
  centre: number;
  width: number;
  height: number;
}

interface AxisInput {
  count: number;
  cellMm: number;
  sizeMm: number;
  scheme: LabelScheme;
  scale: number;
  offset: number;
  viewportSize: number;
  /** Which dimension of the label runs along this axis. */
  alongAxis: 'width' | 'height';
  measure: (text: string) => TextSize;
  padding: { x: number; y: number };
  gap: number;
}

function placeAlongAxis(a: AxisInput): AxisPlacement[] {
  if (a.count < 1) return [];
  const boxOf = (text: string) => {
    const t = a.measure(text);
    return { width: t.width + a.padding.x * 2, height: t.height + a.padding.y * 2 };
  };

  // The last label is the longest for both schemes, so it sets the density.
  const widest = boxOf(labelFor(a.count - 1, a.scheme))[a.alongAxis];
  const step = densityStep(a.cellMm * a.scale, widest, a.gap);
  if (!Number.isFinite(step)) return [];

  const range = cellRange(
    (0 - a.offset) / a.scale,
    (a.viewportSize - a.offset) / a.scale,
    a.cellMm,
    a.count,
  );
  if (!range) return [];

  const placed: AxisPlacement[] = [];
  let lastEnd = -Infinity;
  for (let i = range.first; i <= range.last; i++) {
    // Show every `step`-th label counted from 1, so 5, 10, 15 rather than 1, 6, 11.
    if ((i + 1) % step !== 0) continue;

    // The visible part of the cell: cell ∩ paper ∩ viewport.
    const a0 = a.offset + i * a.cellMm * a.scale;
    const a1 = a.offset + Math.min((i + 1) * a.cellMm, a.sizeMm) * a.scale;
    const lo = Math.max(a0, 0);
    const hi = Math.min(a1, a.viewportSize);
    if (hi <= lo) continue;

    const text = labelFor(i, a.scheme);
    const box = boxOf(text);
    const centre = (lo + hi) / 2;
    const start = centre - box[a.alongAxis] / 2;
    // Never overlap the previous label. Earlier (fuller) cells win, so a narrow
    // partial edge cell only gets its label when there is room for it.
    if (start < lastEnd + a.gap) continue;
    lastEnd = start + box[a.alongAxis];
    placed.push({ text, index: i, centre, width: box.width, height: box.height });
  }
  return placed;
}

function overlaps(a: PlacedLabel, b: PlacedLabel): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function layoutLabels(input: LabelLayoutInput): PlacedLabel[] {
  const { paper, cellMm, labels, view, viewport, measure } = input;
  if (!labels.enabled) return [];
  const padding = input.padding ?? DEFAULT_PADDING;
  const gap = input.gap ?? DEFAULT_GAP;
  if (!(view.scale > 0) || !(cellMm > 0)) return [];

  const paperLeft = view.offsetX;
  const paperTop = view.offsetY;
  const paperRight = view.offsetX + paper.widthMm * view.scale;
  const paperBottom = view.offsetY + paper.heightMm * view.scale;
  // Nothing of the paper on screen: nothing to label.
  if (paperRight <= 0 || paperLeft >= viewport.width || paperBottom <= 0 || paperTop >= viewport.height) return [];

  const cols = getCols(paper.widthMm, cellMm);
  const rows = getRows(paper.heightMm, cellMm);

  const columnPlacements = placeAlongAxis({
    count: cols,
    cellMm,
    sizeMm: paper.widthMm,
    scheme: labels.columns,
    scale: view.scale,
    offset: view.offsetX,
    viewportSize: viewport.width,
    alongAxis: 'width',
    measure,
    padding,
    gap,
  });
  const rowPlacements = placeAlongAxis({
    count: rows,
    cellMm,
    sizeMm: paper.heightMm,
    scheme: labels.rows,
    scale: view.scale,
    offset: view.offsetY,
    viewportSize: viewport.height,
    alongAxis: 'height',
    measure,
    padding,
    gap,
  });

  // Pinned to the viewport: an edge that has scrolled out of view clamps to the
  // viewport edge instead (§7).
  const topY = Math.max(paperTop, 0);
  const bottomY = Math.min(paperBottom, viewport.height);
  const leftX = Math.max(paperLeft, 0);
  const rightX = Math.min(paperRight, viewport.width);

  const rowLabels: PlacedLabel[] = [];
  for (const p of rowPlacements) {
    const y = p.centre - p.height / 2;
    rowLabels.push({ text: p.text, edge: 'left', index: p.index, x: leftX, y, width: p.width, height: p.height });
    rowLabels.push({ text: p.text, edge: 'right', index: p.index, x: rightX - p.width, y, width: p.width, height: p.height });
  }

  // Where a column label and a row label meet at a corner, the row label wins.
  const columnLabels: PlacedLabel[] = [];
  for (const p of columnPlacements) {
    const x = p.centre - p.width / 2;
    const top: PlacedLabel = { text: p.text, edge: 'top', index: p.index, x, y: topY, width: p.width, height: p.height };
    const bottom: PlacedLabel = {
      text: p.text,
      edge: 'bottom',
      index: p.index,
      x,
      y: bottomY - p.height,
      width: p.width,
      height: p.height,
    };
    if (!rowLabels.some((r) => overlaps(top, r))) columnLabels.push(top);
    if (!rowLabels.some((r) => overlaps(bottom, r))) columnLabels.push(bottom);
  }

  return [...columnLabels, ...rowLabels];
}
