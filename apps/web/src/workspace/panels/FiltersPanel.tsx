'use client';

import { deriveAdjustments } from '@artiso/core-engine';
import type { FilterId } from '@artiso/shared-types';
import { PanelButton } from '@/workspace/PanelButton';
import { useWorkspaceStore } from '@/state/workspace-store';

// The full Stage 6 filter suite (docs/architecture/03-image-processing-filters.md),
// closing Phase 1's grayscale-only gap. At most one active at a time -- these
// are alternative "looks" for the reference image, not a compositable stack
// (matching the fixed pipeline's single "structural filter" slot). Every
// selection and param drag is a uniform update on the renderer's one
// already-compiled shader (see packages/renderer/src/gl/shader-source.ts) --
// nothing here ever triggers a shader recompile.
const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'highContrast', label: 'High contrast' },
  { id: 'lowContrast', label: 'Low contrast' },
  { id: 'threshold', label: 'Threshold' },
  { id: 'posterize', label: 'Posterize' },
  { id: 'pencilSketch', label: 'Pencil sketch' },
  { id: 'edgeDetect', label: 'Edge detect' },
  { id: 'invert', label: 'Invert' },
  { id: 'blur', label: 'Blur' },
  { id: 'sharpen', label: 'Sharpen' },
];

const PARAM_CONFIG: Partial<Record<FilterId, { key: string; label: string; min: number; max: number; fallback: number }>> = {
  threshold: { key: 'cutoff', label: 'Cutoff', min: 0, max: 100, fallback: 50 },
  posterize: { key: 'levels', label: 'Levels', min: 2, max: 16, fallback: 4 },
  blur: { key: 'radius', label: 'Radius', min: 1, max: 6, fallback: 2 },
  sharpen: { key: 'amount', label: 'Amount', min: 0, max: 100, fallback: 50 },
};

export function FiltersPanel() {
  const editStack = useWorkspaceStore((s) => s.editStack);
  const setFilter = useWorkspaceStore((s) => s.setFilter);
  const { filterId, filterParams } = deriveAdjustments(editStack);
  const paramConfig = filterId ? PARAM_CONFIG[filterId] : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <PanelButton active={filterId === null} onClick={() => setFilter(null)}>
          None
        </PanelButton>
        {FILTERS.map((filter) => (
          <PanelButton key={filter.id} active={filterId === filter.id} onClick={() => setFilter(filter.id)}>
            {filter.label}
          </PanelButton>
        ))}
      </div>

      {paramConfig && filterId ? (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <span
            style={{
              fontFamily: 'var(--font-family-base)',
              fontSize: 'var(--font-label-size)',
              color: 'var(--color-ink-muted)',
            }}
          >
            {paramConfig.label} ({filterParams[paramConfig.key] ?? paramConfig.fallback})
          </span>
          <input
            type="range"
            min={paramConfig.min}
            max={paramConfig.max}
            value={filterParams[paramConfig.key] ?? paramConfig.fallback}
            onChange={(event) => setFilter(filterId, { [paramConfig.key]: Number(event.target.value) })}
            style={{ accentColor: 'var(--color-accent)' }}
          />
        </label>
      ) : null}
    </div>
  );
}
