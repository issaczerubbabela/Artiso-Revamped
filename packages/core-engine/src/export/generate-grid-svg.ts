import type { GridConfig } from '@artiso/shared-types';
import type { GridGeometry } from '../grid/types';

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

function renderLayer({ geometry, config }: GridSvgLayer): string {
  const strokeWidth = THICKNESS_PX[config.thickness];
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
        `  <text x="${label.x}" y="${label.y}" font-family="system-ui, sans-serif" font-size="${LABEL_FONT_PX}" fill="${config.color}" fill-opacity="${opacity}" text-anchor="middle" dominant-baseline="middle">${escapeXml(label.text)}</text>`,
    )
    .join('\n');

  return [lines, labels].filter(Boolean).join('\n');
}
