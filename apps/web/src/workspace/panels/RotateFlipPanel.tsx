'use client';

import { PanelButton } from '@/workspace/PanelButton';
import { useWorkspaceStore } from '@/state/workspace-store';

// Single-action, no preview-then-confirm: each tap commits immediately
// (.agents/workflows/build-crop-rotate-flip.md). Rotate always appends a
// relative +90deg step against the current working bitmap -- four taps
// cycles back to the original orientation.
export function RotateFlipPanel() {
  const appendGeometryOp = useWorkspaceStore((s) => s.appendGeometryOp);

  return (
    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
      <PanelButton onClick={() => void appendGeometryOp({ type: 'rotate', degrees: 90 })}>
        Rotate 90°
      </PanelButton>
      <PanelButton onClick={() => void appendGeometryOp({ type: 'flip', axis: 'horizontal' })}>
        Flip horizontal
      </PanelButton>
      <PanelButton onClick={() => void appendGeometryOp({ type: 'flip', axis: 'vertical' })}>
        Flip vertical
      </PanelButton>
    </div>
  );
}
