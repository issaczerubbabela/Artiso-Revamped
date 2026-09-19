import {
  getDiagonals,
  getLines,
  getRadialRays,
  layoutLabels,
  type LineSegment,
  type MmRect,
} from '@artiso/core-engine';
import type { GridSettings } from '@artiso/shared-types';
import type { ViewportState } from './viewport';

type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface DrawingGridInput {
  paper: { widthMm: number; heightMm: number };
  settings: GridSettings;
  // scale = CSS px per mm; translate = where the paper's top-left sits, in CSS px.
  view: ViewportState;
  // The canvas size in CSS px (the viewport the labels pin to).
  width: number;
  height: number;
}

export interface DrawingGridOptions {
  // Backing store pixels per CSS pixel. Default 1.
  pixelRatio?: number;
  // Multiplies the line width. Export draws at many px per mm, so it scales
  // widthPx (defined in screen px) to look the same as it does on screen.
  lineScale?: number;
  // Multiplies the label size (presentation mode, export).
  labelScale?: number;
  // Clear the canvas first (default). Pass false when something else, such as
  // the guides layer beneath, has already been drawn on it.
  clear?: boolean;
}

export const LABEL_FONT_PX = 11;
export const LABEL_BACKGROUND = 'rgba(0, 0, 0, 0.45)';
export const LABEL_TEXT_COLOR = '#ffffff';
const LABEL_FONT_FAMILY = '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace';

// Below these on-screen cell sizes a layer is skipped: a fine grid zoomed all
// the way out would otherwise turn into a solid fill and cost thousands of
// strokes for nothing readable. The labels thin out on their own.
export const MIN_SQUARE_CELL_PX = 3;
export const MIN_DIAGONAL_CELL_PX = 8;

/**
 * Snaps an axis-aligned line's coordinate (CSS px) so a line of `lineWidth` CSS
 * px covers whole device pixels -- an odd device width is centred on a pixel
 * centre, an even one on a pixel edge -- which keeps 1px lines crisp
 * (Grid-Feature-Spec.md §9).
 */
export function crispCoordinate(cssPx: number, lineWidth: number, pixelRatio: number): number {
  const deviceWidth = Math.max(1, Math.round(lineWidth * pixelRatio));
  const device = cssPx * pixelRatio;
  const snapped = deviceWidth % 2 === 1 ? Math.floor(device) + 0.5 : Math.round(device);
  return snapped / pixelRatio;
}

// Canvas2D pass that draws the drawing grid (docs/architecture/
// Grid-Feature-Spec.md §6-§9) in *screen space*: geometry comes from core-engine
// in millimetres and is mapped through the view, so the line width stays
// constant at any zoom. Everything is clipped to the paper; each overlay is one
// batched path with the one shared style; only lines/cells inside the viewport
// are generated. Order: squares, diagonals, radial, then the labels on top.
//
// Line geometry is derived from (paper, settings, visible rect) only -- pan and
// zoom change the view, never the geometry (ki-grid-image-independence). The
// labels are re-laid-out from the view every draw, which is the documented
// carve-out for sticky labels.
export class DrawingGridLayer {
  private readonly ctx: Canvas2DContext;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    const ctx = canvas.getContext('2d') as Canvas2DContext | null;
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
  }

  draw(input: DrawingGridInput, options: DrawingGridOptions = {}): void {
    const { paper, settings, view, width, height } = input;
    const pixelRatio = options.pixelRatio ?? 1;
    const ctx = this.ctx;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (options.clear ?? true) ctx.clearRect(0, 0, width, height);

    const { scale, translateX, translateY } = view;
    if (!(scale > 0)) return;

    const cellMm = settings.cellMm;
    const hasCell = Number.isFinite(cellMm) && cellMm > 0;
    const cellPx = cellMm * scale;
    const lineWidth = settings.style.widthPx * (options.lineScale ?? 1);

    // The part of the paper on screen, in mm -- everything is culled to it.
    const visible: MmRect = { x: -translateX / scale, y: -translateY / scale, w: width / scale, h: height / scale };
    const toX = (mm: number) => translateX + mm * scale;
    const toY = (mm: number) => translateY + mm * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(translateX, translateY, paper.widthMm * scale, paper.heightMm * scale);
    ctx.clip();

    ctx.globalAlpha = settings.style.opacity;
    ctx.strokeStyle = settings.style.color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';

    if (settings.showSquares && hasCell && cellPx >= MIN_SQUARE_CELL_PX) {
      const lines = getLines(paper, cellMm, visible);
      ctx.beginPath();
      for (const line of lines) {
        if (line.x1 === line.x2) {
          const x = crispCoordinate(toX(line.x1), lineWidth, pixelRatio);
          ctx.moveTo(x, toY(line.y1));
          ctx.lineTo(x, toY(line.y2));
        } else {
          const y = crispCoordinate(toY(line.y1), lineWidth, pixelRatio);
          ctx.moveTo(toX(line.x1), y);
          ctx.lineTo(toX(line.x2), y);
        }
      }
      ctx.stroke();
    }

    if (settings.showDiagonals && hasCell && cellPx >= MIN_DIAGONAL_CELL_PX) {
      this.strokeSegments(getDiagonals(paper, cellMm, visible), toX, toY);
    }

    if (settings.showRadial) {
      this.strokeSegments(getRadialRays(paper, settings.radialStepDeg), toX, toY);
    }

    // Unclipped from here: labels sit on the paper edge or pin to the viewport.
    ctx.restore();

    // Labels belong to the squares, so hiding the squares hides them too.
    if (settings.showSquares && settings.labels.enabled && hasCell) {
      this.drawLabels(input, options.labelScale ?? 1);
    }
  }

  private strokeSegments(segments: LineSegment[], toX: (mm: number) => number, toY: (mm: number) => number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (const s of segments) {
      ctx.moveTo(toX(s.x1), toY(s.y1));
      ctx.lineTo(toX(s.x2), toY(s.y2));
    }
    ctx.stroke();
  }

  private drawLabels(input: DrawingGridInput, labelScale: number): void {
    const { paper, settings, view, width, height } = input;
    const ctx = this.ctx;
    const fontPx = LABEL_FONT_PX * labelScale;
    ctx.font = `${fontPx}px ${LABEL_FONT_FAMILY}`;

    const labels = layoutLabels({
      paper,
      cellMm: settings.cellMm,
      labels: settings.labels,
      view: { scale: view.scale, offsetX: view.translateX, offsetY: view.translateY },
      viewport: { width, height },
      measure: (text) => ({ width: ctx.measureText(text).width, height: fontPx }),
      padding: { x: 4 * labelScale, y: 2 * labelScale },
      gap: 4 * labelScale,
    });
    if (labels.length === 0) return;

    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const label of labels) {
      ctx.fillStyle = LABEL_BACKGROUND;
      ctx.fillRect(label.x, label.y, label.width, label.height);
      ctx.fillStyle = LABEL_TEXT_COLOR;
      ctx.fillText(label.text, label.x + label.width / 2, label.y + label.height / 2);
    }
  }
}
