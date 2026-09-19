import { describe, expect, it } from 'vitest';
import type { Annotation } from '@artiso/shared-types';
import { resolveAnnotationGeometry } from '../resolve-annotation-geometry';

describe('resolveAnnotationGeometry', () => {
  it('scales an arrow annotation from normalized to pixel coordinates', () => {
    const annotations: Annotation[] = [
      { type: 'arrow', id: 'a1', start: { x: 0.25, y: 0.5 }, end: { x: 0.75, y: 0.5 }, color: '#ff0000', thickness: 'thin' },
    ];
    const [resolved] = resolveAnnotationGeometry(200, 100, annotations);
    expect(resolved).toEqual({
      type: 'arrow',
      id: 'a1',
      start: { x: 50, y: 50 },
      end: { x: 150, y: 50 },
      color: '#ff0000',
      thickness: 'thin',
    });
  });

  it('scales a circle annotation, independently in x and y', () => {
    const annotations: Annotation[] = [
      { type: 'circle', id: 'c1', center: { x: 0.5, y: 0.5 }, radiusX: 0.1, radiusY: 0.2, color: '#00ff00', thickness: 'medium' },
    ];
    const [resolved] = resolveAnnotationGeometry(400, 200, annotations);
    expect(resolved).toEqual({
      type: 'circle',
      id: 'c1',
      centerX: 200,
      centerY: 100,
      radiusX: 40,
      radiusY: 40,
      color: '#00ff00',
      thickness: 'medium',
    });
  });

  it('scales a note annotation position and preserves its text', () => {
    const annotations: Annotation[] = [
      { type: 'note', id: 'n1', position: { x: 0.1, y: 0.9 }, text: 'Fix proportions', color: '#0000ff', thickness: 'thin' },
    ];
    const [resolved] = resolveAnnotationGeometry(100, 100, annotations);
    expect(resolved).toEqual({ type: 'note', id: 'n1', x: 10, y: 90, text: 'Fix proportions', color: '#0000ff' });
  });

  it('scales every point of a freehand annotation and preserves pressure', () => {
    const annotations: Annotation[] = [
      {
        type: 'freehand',
        id: 'f1',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1, pressure: 0.5 },
        ],
        color: '#ffffff',
        thickness: 'thick',
      },
    ];
    const [resolved] = resolveAnnotationGeometry(50, 50, annotations);
    expect(resolved).toEqual({
      type: 'freehand',
      id: 'f1',
      points: [
        { x: 0, y: 0, pressure: undefined },
        { x: 50, y: 50, pressure: 0.5 },
      ],
      color: '#ffffff',
      thickness: 'thick',
    });
  });

  it('resolves an empty list to an empty list', () => {
    expect(resolveAnnotationGeometry(100, 100, [])).toEqual([]);
  });
});
