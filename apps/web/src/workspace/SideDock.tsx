'use client';

import { useWorkspaceStore } from '@/state/workspace-store';
import { PanelButton } from './PanelButton';
import { PANEL_TITLES, ToolPanel } from './ToolPanel';

const DOCK_WIDTH = 300;

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
export function SideDock() {
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
        <ToolPanel mode={toolMode} />
      </div>
    </div>
  );
}
