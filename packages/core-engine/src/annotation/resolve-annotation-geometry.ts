import type { Annotation } from '@artiso/shared-types';

export interface ResolvedPoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface ResolvedArrowAnnotation {
  type: 'arrow';
  id: string;
  start: ResolvedPoint;
  end: ResolvedPoint;
  color: string;
  thickness: 'thin' | 'medium' | 'thick';
}

export interface ResolvedCircleAnnotation {
  type: 'circle';
  id: string;
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  color: string;
  thickness: 'thin' | 'medium' | 'thick';
}

export interface ResolvedNoteAnnotation {
  type: 'note';
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

export interface ResolvedFreehandAnnotation {
  type: 'freehand';
  id: string;
  points: ResolvedPoint[];
  color: string;
  thickness: 'thin' | 'medium' | 'thick';
}

export type ResolvedAnnotation =
  | ResolvedArrowAnnotation
  | ResolvedCircleAnnotation
  | ResolvedNoteAnnotation
  | ResolvedFreehandAnnotation;

// Converts an Annotation's normalized [0,1] coordinates into image-space
// pixels for the image's *current* width/height -- same "image-space only,
// resolved at draw time" contract as the Grid Engine's GridGeometry
// (ki-grid-image-independence), so AnnotationLayer (like GridLayer) never
// needs to know the image's actual resolution ahead of time and never
// recomputes anything for pan/zoom.
export function resolveAnnotationGeometry(width: number, height: number, annotations: Annotation[]): ResolvedAnnotation[] {
  return annotations.map((annotation) => resolveOne(width, height, annotation));
}

function resolveOne(width: number, height: number, annotation: Annotation): ResolvedAnnotation {
  switch (annotation.type) {
    case 'arrow':
      return {
        type: 'arrow',
        id: annotation.id,
        start: { x: annotation.start.x * width, y: annotation.start.y * height },
        end: { x: annotation.end.x * width, y: annotation.end.y * height },
        color: annotation.color,
        thickness: annotation.thickness,
      };
    case 'circle':
      return {
        type: 'circle',
        id: annotation.id,
        centerX: annotation.center.x * width,
        centerY: annotation.center.y * height,
        radiusX: annotation.radiusX * width,
        radiusY: annotation.radiusY * height,
        color: annotation.color,
        thickness: annotation.thickness,
      };
    case 'note':
      return {
        type: 'note',
        id: annotation.id,
        x: annotation.position.x * width,
        y: annotation.position.y * height,
        text: annotation.text,
        color: annotation.color,
      };
    case 'freehand':
      return {
        type: 'freehand',
        id: annotation.id,
        points: annotation.points.map((point) => ({ x: point.x * width, y: point.y * height, pressure: point.pressure })),
        color: annotation.color,
        thickness: annotation.thickness,
      };
  }
}
