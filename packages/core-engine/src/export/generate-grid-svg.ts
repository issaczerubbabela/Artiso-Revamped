import type { GridConfig, GridSettings } from '@artiso/shared-types';
import { getDiagonals } from '../grid/diagonals';
import { layoutLabels } from '../grid/label-layout';
import { getRadialRays } from '../grid/radial-rays';
import { getLines, type PaperSize } from '../grid/square-grid';
import type { GridGeometry, LineSegment } from '../grid/types';

export interface GridSvgLayer {
  geometry: GridGeometry;
  config: Pick<GridConfig, 'color' | 'opacity' | 'thickness' | 'visible'>;
}

// Mirrors packages/renderer/src/grid-layer.ts's THICKNESS_PX -- kept as a
// separate copy rather than a shared import because core-engine must not
// depend on renderer (docs/architecture/00-system-overview.md's layering:
// renderer depends on core-engine, never the reverse). Update both if this
// scale ever changes.
const THICKNESS_PX: Record<GridConfig['thickness'], number> = {
  veryThin: 0.5,
  thin: 1,
  medium: 1.5,
  thick: 2.5,
  extraThick: 4,
};

const LABEL_FONT_PX = 14;

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&apos;';
    }
  });
}

// SVG grid-only export (docs/architecture/07-export-engine.md, docs/phases/
// phase-7-guides-workspace-export.md): a vector rendering of one or more
// GridGeometry layers with no image layer at all -- print-shop workflows
// print this onto transparency film to overlay on physical paper/canvas, so
// there's deliberately no background rect (transparent by default). Re-runs
// the same GridGeometry the live preview and raster export use (never a
// separate geometry derivation), same "re-run, don't reimplement" rule as
// the rest of the export pipeline.
export function generateGridSvg(width: number, height: number, layers: GridSvgLayer[]): string {
  const groups = layers
    .filter((layer) => layer.config.visible)
    .map((layer) => renderLayer(layer))
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${groups}
</svg>
`;
}

/** One CSS pixel (96 per inch) in millimetres: how screen-px line widths and label sizes map onto paper. */
export const MM_PER_CSS_PX = 25.4 / 96;

const LABEL_BACKGROUND = 'rgba(0,0,0,0.45)';
const DRAWING_LABEL_FONT_PX = 11;
// Monospace glyphs are ~0.6 em wide; enough to size a label box without a font.
const MONO_ADVANCE_EM = 0.6;

export interface DrawingGridSvgInput {
  paper: PaperSize;
  settings: GridSettings;
  // The Guides layer, generated over the paper with its size in mm.
  guides?: GridSvgLayer[];
}

const fmt = (n: number): number => Number(n.toFixed(3));

function pathOf(segments: LineSegment[]): string {
  return segments.map((s) => `M${fmt(s.x1)} ${fmt(s.y1)}L${fmt(s.x2)} ${fmt(s.y2)}`).join('');
}

// SVG export of the drawing grid (docs/architecture/Grid-Feature-Spec.md): the
// same segment functions the screen draws, in paper millimetres, with the
// document sized in real millimetres so it prints at physical scale (onto film
// to lay over paper). Line widths and label sizes are screen pixels on screen, so
// they are converted at 96 px per inch. No background: transparent by default.
//
// Labels can't pin to a viewport in a static document, so they are laid out
// against the paper itself, with the same thinning as on screen.
export function generateDrawingGridSvg({ paper, settings, guides = [] }: DrawingGridSvgInput): string {
  const { widthMm: W, heightMm: H } = paper;
  const strokeWidth = fmt(settings.style.widthPx * MM_PER_CSS_PX);
  const parts: string[] = [];

  const guideMarkup = guides
    .filter((layer) => layer.config.visible)
    .map((layer) => renderLayer(layer, MM_PER_CSS_PX))
    .filter(Boolean)
    .join('\n');
  if (guideMarkup) parts.push(`<g id="guides">\n${guideMarkup}\n</g>`);

  const paths: LineSegment[][] = [];
  if (settings.showSquares) paths.push(getLines(paper, settings.cellMm));
  if (settings.showDiagonals) paths.push(getDiagonals(paper, settings.cellMm));
  if (settings.showRadial) paths.push(getRadialRays(paper, settings.radialStepDeg));
  const layerNames = [
    settings.showSquares && 'squares',
    settings.showDiagonals && 'diagonals',
    settings.showRadial && 'radial',
  ].filter(Boolean);
  if (paths.length > 0) {
    const style = `fill="none" stroke="${settings.style.color}" stroke-width="${strokeWidth}" stroke-opacity="${settings.style.opacity}" stroke-linecap="butt"`;
    parts.push(
      `<g id="grid" ${style}>\n${paths.map((segments, i) => `  <path id="${layerNames[i]}" d="${pathOf(segments)}" />`).join('\n')}\n</g>`,
    );
  }

  if (settings.showSquares && settings.labels.enabled) {
    const fontMm = DRAWING_LABEL_FONT_PX * MM_PER_CSS_PX;
    const labels = layoutLabels({
      paper,
      cellMm: settings.cellMm,
      labels: settings.labels,
      view: { scale: 1, offsetX: 0, offsetY: 0 },
      viewport: { width: W, height: H },
      measure: (text) => ({ width: text.length * fontMm * MONO_ADVANCE_EM, height: fontMm }),
      padding: { x: 4 * MM_PER_CSS_PX, y: 2 * MM_PER_CSS_PX },
      gap: 4 * MM_PER_CSS_PX,
    });
    if (labels.length > 0) {
      const body = labels
        .map(
          (l) =>
            `  <rect x="${fmt(l.x)}" y="${fmt(l.y)}" width="${fmt(l.width)}" height="${fmt(l.height)}" fill="${LABEL_BACKGROUND}" />\n` +
            `  <text x="${fmt(l.x + l.width / 2)}" y="${fmt(l.y + l.height / 2)}" text-anchor="middle" dominant-baseline="central">${escapeXml(l.text)}</text>`,
        )
        .join('\n');
      parts.push(
        `<g id="labels" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="${fmt(fontMm)}" fill="#ffffff">\n${body}\n</g>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(W)}mm" height="${fmt(H)}mm" viewBox="0 0 ${fmt(W)} ${fmt(H)}">
${parts.join('\n')}
</svg>
`;
}

function renderLayer({ geometry, config }: GridSvgLayer, strokeScale = 1): string {
  const strokeWidth = fmt(THICKNESS_PX[config.thickness] * strokeScale);
  const opacity = config.opacity / 100;

  const lines = geometry.lines
    .map(
      (line) =>
        `  <line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${config.color}" stroke-width="${strokeWidth}" stroke-opacity="${opacity}" />`,
    )
    .join('\n');

  const labels = geometry.labels
    .map(
      (label) =>
        `  <text x="${label.x}" y="${label.y}" font-family="system-ui, sans-serif" font-size="${fmt(LABEL_FONT_PX * strokeScale)}" fill="${config.color}" fill-opacity="${opacity}" text-anchor="middle" dominant-baseline="middle">${escapeXml(label.text)}</text>`,
    )
    .join('\n');

  return [lines, labels].filter(Boolean).join('\n');
}
