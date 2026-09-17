'use client';

import { PanelButton } from '@/workspace/PanelButton';
import { useWorkspaceStore } from '@/state/workspace-store';
import type { NormalizedRect } from './CropOverlay';

interface CropPanelProps {
  rect: NormalizedRect;
  onResetRect: () => void;
}

export function CropPanel({ rect, onResetRect }: CropPanelProps) {
  const appendGeometryOp = useWorkspaceStore((s) => s.appendGeometryOp);
  const setToolMode = useWorkspaceStore((s) => s.setToolMode);

  function apply() {
    void appendGeometryOp({ type: 'crop', rect });
    setToolMode('idle');
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
      <PanelButton variant="primary" onClick={apply}>
        Apply crop
      </PanelButton>
      <PanelButton onClick={onResetRect}>Reset selection</PanelButton>
      <PanelButton onClick={() => setToolMode('idle')}>Cancel</PanelButton>
    </div>
  );
}
