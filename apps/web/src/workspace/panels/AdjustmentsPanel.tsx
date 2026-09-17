'use client';

import { deriveAdjustments } from '@artiso/core-engine';
import { PanelButton } from '@/workspace/PanelButton';
import { useWorkspaceStore } from '@/state/workspace-store';

// Brightness/contrast/saturation + grayscale only (docs/phases/phase-1-web-core-mvp.md
// -- the full filter suite is Phase 3). Every change is a uniform update on
// the renderer's already-compiled shader, never a recompile
// (ki-immediate-feedback).
export function AdjustmentsPanel() {
  const editStack = useWorkspaceStore((s) => s.editStack);
  const setAdjustment = useWorkspaceStore((s) => s.setAdjustment);
  const setGrayscale = useWorkspaceStore((s) => s.setGrayscale);
  const adjustments = deriveAdjustments(editStack);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <AdjustmentSlider
        label="Brightness"
        value={adjustments.brightness}
        onChange={(value) => setAdjustment('brightness', value)}
      />
      <AdjustmentSlider
        label="Contrast"
        value={adjustments.contrast}
        onChange={(value) => setAdjustment('contrast', value)}
      />
      <AdjustmentSlider
        label="Saturation"
        value={adjustments.saturation}
        onChange={(value) => setAdjustment('saturation', value)}
      />
      <PanelButton active={adjustments.grayscale} onClick={() => setGrayscale(!adjustments.grayscale)}>
        Grayscale
      </PanelButton>
    </div>
  );
}

function AdjustmentSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      <span
        style={{
          fontFamily: 'var(--font-family-base)',
          fontSize: 'var(--font-label-size)',
          color: 'var(--color-ink-muted)',
        }}
      >
        {label} ({value})
      </span>
      <input
        type="range"
        min={-100}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ accentColor: 'var(--color-accent)' }}
      />
    </label>
  );
}
