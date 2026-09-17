'use client';

import { useWorkspaceStore, type ToolMode } from '@/state/workspace-store';
import { PanelButton } from './PanelButton';
import { CropPanel } from './panels/CropPanel';
import { RotateFlipPanel } from './panels/RotateFlipPanel';
import { AdjustmentsPanel } from './panels/AdjustmentsPanel';
import { GridPanel } from './panels/GridPanel';
import { ExportPanel } from './panels/ExportPanel';
import type { NormalizedRect } from './panels/CropOverlay';

const DOCK_WIDTH = 300;

const PANEL_TITLES: Record<ToolMode, string> = {
  idle: '',
  crop: 'Crop',
  rotateFlip: 'Rotate & flip',
  adjustments: 'Adjustments',
  grid: 'Grid',
  export: 'Export',
};

interface SideDockProps {
  cropRect: NormalizedRect;
  onResetCropRect: () => void;
}

// Wide-breakpoint counterpart to the Compact BottomSheet. Deliberately
// capped at a modest fixed width (300px) so it never competes with the
// canvas for attention -- per CLAUDE.md, chrome is a thin frame, not a
// second focal point.
//
// Always mounted, unlike BottomSheet: a smooth collapse needs the element
// to still exist in the DOM while its width animates to 0, so toolMode
// flipping back to 'idle' shrinks the dock shut instead of the content
// vanishing instantly. The inner content div keeps a fixed width and the
// outer wrapper clips it via overflow:hidden, so nothing reflows or wraps
// mid-transition -- it just gets revealed or clipped.
export function SideDock({ cropRect, onResetCropRect }: SideDockProps) {
  const toolMode = useWorkspaceStore((s) => s.toolMode);
  const setToolMode = useWorkspaceStore((s) => s.setToolMode);
  const isOpen = toolMode !== 'idle';

  return (
    <div
      data-testid="side-dock"
      aria-hidden={!isOpen}
      style={{
        width: isOpen ? DOCK_WIDTH : 0,
        flexShrink: 0,
        overflow: 'hidden',
        background: 'var(--color-surface-raised)',
        boxShadow: isOpen ? 'var(--shadow-dock)' : 'none',
        transition: 'width var(--motion-duration) var(--motion-easing), box-shadow var(--motion-duration) var(--motion-easing)',
      }}
    >
      <div
        style={{
          width: DOCK_WIDTH,
          height: '100%',
          boxSizing: 'border-box',
          padding: 'var(--space-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontFamily: 'var(--font-family-base)',
              fontSize: 'var(--font-heading-size)',
              fontWeight: 'var(--font-heading-weight)',
            }}
          >
            {PANEL_TITLES[toolMode]}
          </span>
          <PanelButton onClick={() => setToolMode('idle')} aria-label="Close panel">
            Close
          </PanelButton>
        </div>
        {toolMode === 'crop' && <CropPanel rect={cropRect} onResetRect={onResetCropRect} />}
        {toolMode === 'rotateFlip' && <RotateFlipPanel />}
        {toolMode === 'adjustments' && <AdjustmentsPanel />}
        {toolMode === 'grid' && <GridPanel />}
        {toolMode === 'export' && <ExportPanel />}
      </div>
    </div>
  );
}
