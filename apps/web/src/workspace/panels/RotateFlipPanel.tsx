'use client';

import { Switch } from '@/components/controls';
import { PanelButton } from '@/workspace/PanelButton';
import { useDisplayStore } from '@/state/display-store';
import { useWorkspaceStore } from '@/state/workspace-store';

// Single-action, no preview-then-confirm: each tap commits immediately
// (.agents/workflows/build-crop-rotate-flip.md). Rotate always appends a
// relative +90deg step against the current working bitmap -- four taps
// cycles back to the original orientation.
//
// These are Rotate (edit): recorded in the reference's edits and exported. Lock
// rotation below is about View Rotation instead -- how this device shows the
// reference -- so it is a device-local switch, never an edit (GLOSSARY.md).
export function RotateFlipPanel() {
  const appendGeometryOp = useWorkspaceStore((s) => s.appendGeometryOp);
  const rotationLocked = useDisplayStore((s) => s.rotationLocked);
  const setRotationLocked = useDisplayStore((s) => s.setRotationLocked);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
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
      <Switch label="Lock rotation" checked={rotationLocked} onChange={setRotationLocked} />
    </div>
  );
}
