import { describe, expect, it } from 'vitest';
import type { GridSettings } from '@artiso/shared-types';
import { MM_PER_CSS_PX, generateDrawingGridSvg, generateGridSvg } from '../generate-grid-svg';
import { getDiagonals } from '../../grid/diagonals';
import { getRadialRays } from '../../grid/radial-rays';
import { getLines } from '../../grid/square-grid';
import type { GridGeometry } from '../../grid/types';

const STYLE = { color: '#ff00aa', opacity: 80, thickness: 'medium' as const, visible: true };

// An n x n grid of evenly spaced interior lines, as the retired rectangular
// generator used to produce -- just a convenient piece of geometry to render.
function evenGrid(width: number, height: number, n: number): GridGeometry {
  const lines: GridGeometry['lines'] = [];
  for (let k = 1; k < n; k++) {
    lines.push({ x1: (width * k) / n, y1: 0, x2: (width * k) / n, y2: height });
    lines.push({ x1: 0, y1: (height * k) / n, x2: width, y2: (height * k) / n });
  }
  return { lines, labels: [] };
}

describe('generateGridSvg', () => {
  it('wraps the geometry in a viewBox-scoped svg element', () => {
    const geometry = evenGrid(100, 200, 2);
    const svg = generateGridSvg(100, 200, [{ geometry, config: STYLE }]);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200" viewBox="0 0 100 200">');
  });

  it('emits one <line> per geometry line, styled from config', () => {
    const geometry = evenGrid(100, 100, 2);
    const svg = generateGridSvg(100, 100, [{ geometry, config: STYLE }]);
    const lineCount = (svg.match(/<line /g) ?? []).length;
    expect(lineCount).toBe(geometry.lines.length);
    expect(svg).toContain('stroke="#ff00aa"');
    expect(svg).toContain('stroke-opacity="0.8"');
  });

  it('emits <text> for labels and escapes special characters', () => {
    const geometry: GridGeometry = { lines: [], labels: [{ text: '<A&B>', x: 5, y: 5 }] };
    const svg = generateGridSvg(10, 10, [{ geometry, config: STYLE }]);
    expect(svg).toContain('<text x="5" y="5"');
    expect(svg).toContain('>&lt;A&amp;B&gt;<');
  });

  it('omits a layer entirely when its config is not visible', () => {
    const geometry = evenGrid(100, 100, 2);
    const svg = generateGridSvg(100, 100, [{ geometry, config: { ...STYLE, visible: false } }]);
    expect(svg).not.toContain('<line');
  });

  it('composes multiple layers (layered guides) into one document', () => {
    const primary = evenGrid(100, 100, 2);
    const secondary = evenGrid(100, 100, 3);
    const svg = generateGridSvg(100, 100, [
      { geometry: primary, config: STYLE },
      { geometry: secondary, config: { ...STYLE, color: '#000000' } },
    ]);
    const lineCount = (svg.match(/<line /g) ?? []).length;
    expect(lineCount).toBe(primary.lines.length + secondary.lines.length);
    expect(svg).toContain('stroke="#ff00aa"');
    expect(svg).toContain('stroke="#000000"');
  });
});

describe('generateDrawingGridSvg', () => {
  const A4 = { widthMm: 210, heightMm: 297 };
  const SETTINGS: GridSettings = {
    cellMm: 30,
    showSquares: true,
    showDiagonals: false,
    showRadial: false,
    radialStepDeg: 15,
    labels: { enabled: true, columns: 'letters', rows: 'numbers' },
    style: { color: '#ff8800', widthPx: 1, opacity: 0.7 },
    marginMm: 0,
  };
  const build = (over: Partial<GridSettings> = {}, guides = undefined as Parameters<typeof generateDrawingGridSvg>[0]['guides']) =>
    generateDrawingGridSvg({ paper: A4, settings: { ...SETTINGS, ...over }, guides });
  const segmentCount = (svg: string, id: string) => {
    const d = new RegExp(`<path id="${id}" d="([^"]*)"`).exec(svg)?.[1] ?? '';
    return (d.match(/M/g) ?? []).length;
  };

  it('is sized in real millimetres so it prints at physical scale', () => {
    const svg = build();
    expect(svg).toContain('width="210mm" height="297mm" viewBox="0 0 210 297"');
  });

  it('has no background, so it can be laid over paper', () => {
    expect(build()).not.toMatch(/<rect[^>]*width="210"/);
  });

  it('draws the same square lines the screen does', () => {
    expect(segmentCount(build(), 'squares')).toBe(getLines(A4, 30).length);
  });

  it('draws diagonals and radial spokes only when they are on, one path each', () => {
    const svg = build({ showDiagonals: true, showRadial: true });
    expect(segmentCount(svg, 'squares')).toBe(getLines(A4, 30).length);
    expect(segmentCount(svg, 'diagonals')).toBe(getDiagonals(A4, 30).length);
    expect(segmentCount(svg, 'radial')).toBe(getRadialRays(A4, 15).length);
    const plain = build();
    expect(plain).not.toContain('id="diagonals"');
    expect(plain).not.toContain('id="radial"');
  });

  it('omits the grid group entirely when no overlay is on', () => {
    const svg = build({ showSquares: false });
    expect(svg).not.toContain('id="grid"');
    expect(svg).not.toContain('id="labels"');
  });

  it('applies the one shared style, converting screen px to mm at 96 dpi', () => {
    const svg = build({ style: { color: '#123456', widthPx: 2, opacity: 0.5 } });
    expect(svg).toContain('stroke="#123456"');
    expect(svg).toContain('stroke-opacity="0.5"');
    expect(svg).toContain(`stroke-width="${Number((2 * MM_PER_CSS_PX).toFixed(3))}"`);
  });

  it('labels the edges with small translucent rectangles and white text', () => {
    const svg = build();
    expect(svg).toContain('id="labels"');
    expect(svg).toContain('fill="rgba(0,0,0,0.45)"');
    expect(svg).toContain('fill="#ffffff"');
    // 210 / 30 = 7 columns lettered A..G along both the top and bottom edges.
    expect((svg.match(/>A<\/text>/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain('>G</text>');
    // A 10-row grid (297 / 30 rounds up) is numbered down both sides.
    expect(svg).toContain('>10</text>');
  });

  it('omits labels when they are disabled', () => {
    expect(build({ labels: { enabled: false, columns: 'letters', rows: 'numbers' } })).not.toContain('<text');
  });

  it('thins the labels on a fine grid rather than overlapping them', () => {
    const fine = build({ cellMm: 1 });
    const labelCount = (fine.match(/<text /g) ?? []).length;
    // Far fewer than one per column and row on both edges (2 * (210 + 297)).
    expect(labelCount).toBeLessThan(2 * (210 + 297) / 4);
    expect(labelCount).toBeGreaterThan(0);
  });

  it('composes the Guides layer in millimetres beneath the grid', () => {
    const guide: GridGeometry = { lines: [{ x1: 0, y1: 99, x2: 210, y2: 99 }], labels: [] };
    const svg = build({}, [{ geometry: guide, config: { ...STYLE, visible: true } }]);
    expect(svg).toContain('id="guides"');
    expect(svg.indexOf('id="guides"')).toBeLessThan(svg.indexOf('id="grid"'));
    // The guide's 1.5 screen-px line is a fraction of a millimetre on paper.
    expect(svg).toContain(`stroke-width="${Number((1.5 * MM_PER_CSS_PX).toFixed(3))}"`);
  });

  it('skips a hidden guide', () => {
    const guide: GridGeometry = { lines: [{ x1: 0, y1: 99, x2: 210, y2: 99 }], labels: [] };
    expect(build({}, [{ geometry: guide, config: { ...STYLE, visible: false } }])).not.toContain('id="guides"');
  });
});
