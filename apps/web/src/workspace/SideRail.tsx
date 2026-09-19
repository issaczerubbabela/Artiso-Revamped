'use client';

import type { PointerEventHandler } from 'react';
import { CornersOut, FolderOpen, Palette, UploadSimple } from '@phosphor-icons/react';
import { IconButton } from '@/components/chrome/IconButton';
import { useReportChromeRect } from '@/components/chrome/chrome-insets';
import { SyncStatusBadge } from './SyncStatusBadge';
import { ViewOnlyBadge } from './ViewOnlyBadge';
import { TOOL_GROUPS, useToolbarState } from './tools';
import { useDisplayStore } from '@/state/display-store';
import { importReference } from '@/session/import-reference';
import { closeWorkspace } from '@/session/close-workspace';

// Wide/Regular chrome: a floating, icon-only matte rail over the full-bleed
// canvas (docs/design.md §7). Every button has an aria-label and a tooltip; the
// active tool's icon is filled and glows amber. It floats, so it never takes
// space from the canvas -- the canvas fits itself around the rectangle this
// reports instead (docs/architecture/06-workspace-interaction.md).
export function SideRail({ onPointerLeave }: { onPointerLeave?: PointerEventHandler<HTMLElement> }) {
  const { toolMode, hasReference, isImporting, isDisabled, toggleTool, present } = useToolbarState();
  const canvasSurface = useDisplayStore((s) => s.canvasSurface);
  const setCanvasSurface = useDisplayStore((s) => s.setCanvasSurface);
  const reportRect = useReportChromeRect('left');
  const neutral = canvasSurface === 'neutral';

  return (
    <nav ref={reportRect} aria-label="Tools" data-testid="side-rail" className="panel rail" onPointerLeave={onPointerLeave}>
      {hasReference ? <IconButton icon={FolderOpen} label="Projects" onClick={closeWorkspace} /> : null}
      <IconButton
        icon={UploadSimple}
        label="Import"
        disabled={isImporting}
        aria-busy={isImporting}
        onClick={() => void importReference()}
      />

      {TOOL_GROUPS.map((group, index) => (
        <div key={group[0]?.id ?? index} style={{ display: 'contents' }}>
          <div role="separator" className="rail__sep" />
          {group.map((tool) => (
            <IconButton
              key={tool.id}
              icon={tool.icon}
              label={tool.label}
              active={toolMode === tool.id}
              disabled={isDisabled(tool)}
              onClick={() => toggleTool(tool)}
            />
          ))}
        </div>
      ))}

      <IconButton icon={CornersOut} label="Present" disabled={!hasReference} onClick={present} />

      <div role="separator" className="rail__sep" />
      {/* A per-device preference, not a tool: cyan, never the tool amber. */}
      <IconButton
        icon={Palette}
        tone="toggle"
        label="Neutral canvas"
        active={neutral}
        onClick={() => setCanvasSurface(neutral ? 'draftingBoard' : 'neutral')}
      />

      <div className="rail__status">
        <ViewOnlyBadge />
        <SyncStatusBadge />
      </div>
    </nav>
  );
}
