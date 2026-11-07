'use client';

import { formatMeasurement, measureDistance } from '@artiso/core-engine';
import { Switch } from '@/components/controls';
import { PanelButton } from '@/workspace/PanelButton';
import { useDisplayStore } from '@/state/display-store';
import { useInputStore } from '@/state/input-store';
import { useMeasureStore } from '@/state/measure-store';
import { useWorkspaceStore, type AnnotationTool } from '@/state/workspace-store';

const TOOL_OPTIONS: { id: AnnotationTool; label: string }[] = [
  { id: 'arrow', label: 'Arrow' },
  { id: 'circle', label: 'Circle' },
  { id: 'note', label: 'Note' },
  { id: 'freehand', label: 'Freehand' },
  { id: 'measure', label: 'Measure' },
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
  const pencilOnly = useInputStore((s) => s.pencilOnly);
  const setPencilOnly = useInputStore((s) => s.setPencilOnly);

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
            border: '1px solid var(--color-border-strong)',
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

      {annotationTool === 'measure' ? <MeasureReadout /> : null}

      <span style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}>
        Draw directly on the reference. Arrow, circle, and freehand are placed by dragging; note is placed by a tap.
      </span>

      {/* Offered once a Pencil has been used here: someone who never uses one
          keeps drawing with a finger and never needs it. */}
      {pencilOnly !== 'unset' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <Switch label="Pencil-only Drawing" checked={pencilOnly === 'on'} onChange={setPencilOnly} />
          <span style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}>
            Only the Pencil draws; fingers move the view.
          </span>
        </div>
      ) : null}

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

// Measure's readout: the Measurement's length in the paper unit setting and in
// cells, e.g. "42 mm · 1.7 cells". It is never saved; the next one replaces it.
function MeasureReadout() {
  const measurement = useMeasureStore((s) => s.measurement);
  const referenceId = useWorkspaceStore((s) => s.referenceId);
  const cellMm = useWorkspaceStore((s) => s.gridSettings.cellMm);
  const unit = useDisplayStore((s) => s.unit);
  const dpi = useDisplayStore((s) => s.dpi);
  const shown = measurement && measurement.referenceId === referenceId ? measurement : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      <span style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}>
        Measurement
      </span>
      <output
        data-testid="measure-readout"
        aria-live="polite"
        style={{
          fontFamily: shown ? 'var(--font-family-mono)' : 'var(--font-family-body)',
          fontSize: shown ? 'var(--font-mono-size)' : 'var(--font-label-size)',
          color: shown ? 'var(--color-ink)' : 'var(--color-ink-muted)',
        }}
      >
        {shown
          ? formatMeasurement(measureDistance(shown.start, shown.end, cellMm), unit, dpi)
          : 'Drag across the reference to measure. Hold at the end to straighten the line.'}
      </output>
    </div>
  );
}
