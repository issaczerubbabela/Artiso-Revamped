'use client';

import { PanelButton } from '@/workspace/PanelButton';
import { useWorkspaceStore, type AnnotationTool } from '@/state/workspace-store';

const TOOL_OPTIONS: { id: AnnotationTool; label: string }[] = [
  { id: 'arrow', label: 'Arrow' },
  { id: 'circle', label: 'Circle' },
  { id: 'note', label: 'Note' },
  { id: 'freehand', label: 'Freehand' },
];

const THICKNESS_OPTIONS: ('thin' | 'medium' | 'thick')[] = ['thin', 'medium', 'thick'];

// Tool/style controls for the annotation layer -- the actual drawing
// happens directly on CanvasStage's own annotation canvas (pointer capture
// wired there), this panel only picks what the next stroke/shape looks
// like. Arrows/circles/freehand are drawn by dragging; a note is placed by
// a single tap, which opens an inline text field positioned at that point.
export function AnnotationPanel() {
  const annotationTool = useWorkspaceStore((s) => s.annotationTool);
  const setAnnotationTool = useWorkspaceStore((s) => s.setAnnotationTool);
  const annotationColor = useWorkspaceStore((s) => s.annotationColor);
  const annotationThickness = useWorkspaceStore((s) => s.annotationThickness);
  const setAnnotationStyle = useWorkspaceStore((s) => s.setAnnotationStyle);
  const annotations = useWorkspaceStore((s) => s.annotations);
  const removeLastAnnotation = useWorkspaceStore((s) => s.removeLastAnnotation);
  const clearAnnotations = useWorkspaceStore((s) => s.clearAnnotations);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        <span style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}>
          Tool
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          {TOOL_OPTIONS.map((tool) => (
            <PanelButton key={tool.id} active={annotationTool === tool.id} onClick={() => setAnnotationTool(tool.id)}>
              {tool.label}
            </PanelButton>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        <span style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}>
          Color
        </span>
        <input
          type="color"
          value={annotationColor}
          onChange={(event) => setAnnotationStyle({ annotationColor: event.target.value })}
          style={{
            minHeight: 'var(--touch-target-min)',
            minWidth: 'var(--touch-target-min)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            background: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        <span style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}>
          Thickness
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          {THICKNESS_OPTIONS.map((thickness) => (
            <PanelButton
              key={thickness}
              active={annotationThickness === thickness}
              onClick={() => setAnnotationStyle({ annotationThickness: thickness })}
            >
              {thickness}
            </PanelButton>
          ))}
        </div>
      </div>

      <span style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}>
        Draw directly on the reference. Arrow, circle, and freehand are placed by dragging; note is placed by a tap.
      </span>

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <PanelButton onClick={removeLastAnnotation} disabled={annotations.length === 0}>
          Undo last
        </PanelButton>
        <PanelButton onClick={clearAnnotations} disabled={annotations.length === 0}>
          Clear all
        </PanelButton>
      </div>
    </div>
  );
}
