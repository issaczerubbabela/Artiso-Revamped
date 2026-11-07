import {
  getDiagonals,
  getLines,
  getRadialRays,
  layoutLabels,
  type LineSegment,
  type MmRect,
} from '@artiso/core-engine';
import type { GridSettings } from '@artiso/shared-types';
import { viewMatrix, type Point, type ViewportState } from './viewport';

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

/**
 * The paper-mm rectangle that covers a `width` x `height` CSS px viewport seen
 * through `view`. Turned views cover the bounding box of the screen's four
 * corners mapped back to mm (a little more than the screen; culling only needs
 * a superset).
 */
export function visibleMmRect(view: ViewportState, width: number, height: number): MmRect {
  const { scale, translateX, translateY, rotation } = view;
  if (rotation === 0) return { x: -translateX / scale, y: -translateY / scale, w: width / scale, h: height / scale };
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ].map((screen) => {
    const dx = (screen.x - translateX) / scale;
    const dy = (screen.y - translateY) / scale;
    return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
  });
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
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

    // Paper mm -> screen CSS px through the one view transform (View Rotation
    // included). At 0° this is exactly translate + mm * scale.
    const rotated = view.rotation !== 0;
    const m = viewMatrix(view);
    const toScreen = rotated
      ? (x: number, y: number): Point => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f })
      : (x: number, y: number): Point => ({ x: translateX + x * scale, y: translateY + y * scale });

    // The part of the paper on screen, in mm -- everything is culled to it.
    const visible = visibleMmRect(view, width, height);

    ctx.save();
    ctx.beginPath();
    if (rotated) {
      // The paper's outline as a turned quadrilateral.
      const corners = [
        toScreen(0, 0),
        toScreen(paper.widthMm, 0),
        toScreen(paper.widthMm, paper.heightMm),
        toScreen(0, paper.heightMm),
      ];
      ctx.moveTo(corners[0]!.x, corners[0]!.y);
      for (const corner of [...corners.slice(1), corners[0]!]) ctx.lineTo(corner.x, corner.y);
    } else {
      ctx.rect(translateX, translateY, paper.widthMm * scale, paper.heightMm * scale);
    }
    ctx.clip();

    ctx.globalAlpha = settings.style.opacity;
    ctx.strokeStyle = settings.style.color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';

    if (settings.showSquares && hasCell && cellPx >= MIN_SQUARE_CELL_PX) {
      const lines = getLines(paper, cellMm, visible);
      if (rotated) {
        // Turned lines are no longer pixel-aligned, so there is nothing to snap.
        this.strokeSegments(lines, toScreen);
      } else {
        const toX = (mm: number) => translateX + mm * scale;
        const toY = (mm: number) => translateY + mm * scale;
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
    }

    if (settings.showDiagonals && hasCell && cellPx >= MIN_DIAGONAL_CELL_PX) {
      this.strokeSegments(getDiagonals(paper, cellMm, visible), toScreen);
    }

    if (settings.showRadial) {
      this.strokeSegments(getRadialRays(paper, settings.radialStepDeg), toScreen);
    }

    // Unclipped from here: labels sit on the paper edge or pin to the viewport.
    ctx.restore();

    // Labels belong to the squares, so hiding the squares hides them too.
    if (settings.showSquares && settings.labels.enabled && hasCell) {
      this.drawLabels(input, options.labelScale ?? 1);
    }
  }

  private strokeSegments(segments: LineSegment[], toScreen: (x: number, y: number) => Point): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (const s of segments) {
      const from = toScreen(s.x1, s.y1);
      const to = toScreen(s.x2, s.y2);
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    }
    ctx.stroke();
  }

  // Labels read upright on screen at any View Rotation. At 0° they are laid
  // out directly in screen px. Turned, they are laid out in the paper-aligned
  // frame (the screen turned back by the angle), each sized by the footprint
  // its upright box has in that frame, so neighbours still never overlap; then
  // each is drawn upright, centred where its anchor lands on screen. Labels
  // pin to the turned screen's bounding box in that frame.
  private drawLabels(input: DrawingGridInput, labelScale: number): void {
    const { paper, settings, view, width, height } = input;
    const ctx = this.ctx;
    const fontPx = LABEL_FONT_PX * labelScale;
    ctx.font = `${fontPx}px ${LABEL_FONT_FAMILY}`;
    const padding = { x: 4 * labelScale, y: 2 * labelScale };
    const gap = 4 * labelScale;

    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (view.rotation === 0) {
      const labels = layoutLabels({
        paper,
        cellMm: settings.cellMm,
        labels: settings.labels,
        view: { scale: view.scale, offsetX: view.translateX, offsetY: view.translateY },
        viewport: { width, height },
        measure: (text) => ({ width: ctx.measureText(text).width, height: fontPx }),
        padding,
        gap,
      });
      for (const label of labels) this.drawLabel(label.text, label.x, label.y, label.width, label.height);
      return;
    }

    const cos = Math.cos(view.rotation);
    const sin = Math.sin(view.rotation);
    const ac = Math.abs(cos);
    const as = Math.abs(sin);
    // Screen px -> the paper-aligned frame (px, origin at the paper's corner).
    const toFrame = (x: number, y: number): Point => {
      const dx = x - view.translateX;
      const dy = y - view.translateY;
      return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
    };
    const corners = [toFrame(0, 0), toFrame(width, 0), toFrame(width, height), toFrame(0, height)];
    const minX = Math.min(...corners.map((p) => p.x));
    const minY = Math.min(...corners.map((p) => p.y));
    const maxX = Math.max(...corners.map((p) => p.x));
    const maxY = Math.max(...corners.map((p) => p.y));

    const boxOf = (text: string) => ({
      width: ctx.measureText(text).width + padding.x * 2,
      height: fontPx + padding.y * 2,
    });
    const labels = layoutLabels({
      paper,
      cellMm: settings.cellMm,
      labels: settings.labels,
      view: { scale: view.scale, offsetX: -minX, offsetY: -minY },
      viewport: { width: maxX - minX, height: maxY - minY },
      // The upright box's footprint in the turned frame; padding is already in it.
      measure: (text) => {
        const box = boxOf(text);
        return { width: box.width * ac + box.height * as, height: box.width * as + box.height * ac };
      },
      padding: { x: 0, y: 0 },
      gap,
    });

    for (const label of labels) {
      const fx = label.x + label.width / 2 + minX;
      const fy = label.y + label.height / 2 + minY;
      const cx = view.translateX + fx * cos - fy * sin;
      const cy = view.translateY + fx * sin + fy * cos;
      const box = boxOf(label.text);
      this.drawLabel(label.text, cx - box.width / 2, cy - box.height / 2, box.width, box.height);
    }
  }

  private drawLabel(text: string, x: number, y: number, width: number, height: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = LABEL_BACKGROUND;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.fillText(text, x + width / 2, y + height / 2);
  }
}
