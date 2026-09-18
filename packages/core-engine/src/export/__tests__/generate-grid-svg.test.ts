import { describe, expect, it } from 'vitest';
import { generateGridSvg } from '../generate-grid-svg';
import { generateRectangularGrid } from '../../grid/generate-rectangular-grid';
import type { GridGeometry } from '../../grid/types';

const STYLE = { color: '#ff00aa', opacity: 80, thickness: 'medium' as const, visible: true };

describe('generateGridSvg', () => {
  it('wraps the geometry in a viewBox-scoped svg element', () => {
    const geometry = generateRectangularGrid(100, 200, { rows: 2, cols: 2, numberingMode: 'off' });
    const svg = generateGridSvg(100, 200, [{ geometry, config: STYLE }]);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200" viewBox="0 0 100 200">');
  });

  it('emits one <line> per geometry line, styled from config', () => {
    const geometry = generateRectangularGrid(100, 100, { rows: 2, cols: 2, numberingMode: 'off' });
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
    const geometry = generateRectangularGrid(100, 100, { rows: 2, cols: 2, numberingMode: 'off' });
    const svg = generateGridSvg(100, 100, [{ geometry, config: { ...STYLE, visible: false } }]);
    expect(svg).not.toContain('<line');
  });

  it('composes multiple layers (layered guides) into one document', () => {
    const primary = generateRectangularGrid(100, 100, { rows: 2, cols: 2, numberingMode: 'off' });
    const secondary = generateRectangularGrid(100, 100, { rows: 3, cols: 3, numberingMode: 'off' });
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
