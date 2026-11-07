'use client';

import type { PointerEventHandler } from 'react';
import { X } from '@phosphor-icons/react';
import { IconButton } from '@/components/chrome/IconButton';
import { useReportChromeRect } from '@/components/chrome/chrome-insets';
import { useWorkspaceStore } from '@/state/workspace-store';
import { PANEL_TITLES, ToolPanel } from './ToolPanel';

// The side column for large panels (Grid, Filters, Export...) at Wide, and for
// every panel in Presentation mode's edge reveal: a floating matte panel
// at a modest fixed width (300px) so it never competes with the canvas for
// attention. It floats over the full-bleed canvas -- opening or closing it does
// not reflow anything; the canvas re-fits itself around the rectangle reported
// here. Always mounted (hidden when idle) so it can report a zero-size rect and
// keep its place in the tree; hidden means display:none, an instant swap.
export function SideDock({
  open,
  onPointerEnter,
  onPointerLeave,
}: {
  // Whether the active tool's panel belongs in this column (docs/design.md §7:
  // large panels at Wide); defaults to any open tool.
  open?: boolean;
  onPointerEnter?: PointerEventHandler<HTMLElement>;
  onPointerLeave?: PointerEventHandler<HTMLElement>;
}) {
  const toolMode = useWorkspaceStore((s) => s.toolMode);
  const setToolMode = useWorkspaceStore((s) => s.setToolMode);
  const isOpen = toolMode !== 'idle' && (open ?? true);
  const reportRect = useReportChromeRect('right', { active: isOpen });

  return (
    <aside
      ref={reportRect}
      data-testid="side-dock"
      aria-hidden={!isOpen}
      aria-label={PANEL_TITLES[toolMode] || undefined}
      hidden={!isOpen}
      className="panel dock"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="panel-header">
        <h2 className="panel-title">{PANEL_TITLES[toolMode]}</h2>
        <IconButton icon={X} label="Close panel" tooltipSide="bottom" onClick={() => setToolMode('idle')} />
      </div>
      {isOpen ? <ToolPanel mode={toolMode} /> : null}
    </aside>
  );
}
