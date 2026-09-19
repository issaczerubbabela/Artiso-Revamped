'use client';

import { CornersOut, FolderOpen, UploadSimple } from '@phosphor-icons/react';
import { IconButton } from '@/components/chrome/IconButton';
import { useReportChromeRect } from '@/components/chrome/chrome-insets';
import { SyncStatusBadge } from './SyncStatusBadge';
import { ViewOnlyBadge } from './ViewOnlyBadge';
import { TOOL_GROUPS, useToolbarState } from './tools';
import { importReference } from '@/session/import-reference';
import { closeWorkspace } from '@/session/close-workspace';

// Compact chrome: a floating matte toolbar along the bottom. There is no hover on
// touch, so each icon carries a short label beneath it instead of a tooltip
// (docs/design.md §7). It scrolls sideways; the faded ends say there is more.
// Controls are disabled, not hidden, until a reference is loaded. Wide/Regular
// use SideRail instead.
export function Toolbar() {
  const { toolMode, hasReference, isImporting, isDisabled, toggleTool, present } = useToolbarState();
  const reportRect = useReportChromeRect('bottom');

  return (
    <nav ref={reportRect} aria-label="Tools" data-testid="bottom-toolbar" className="panel pill toolbar">
      <div className="toolbar__scroller">
        {hasReference ? <IconButton icon={FolderOpen} label="Projects" visibleLabel="Projects" onClick={closeWorkspace} /> : null}
        <IconButton
          icon={UploadSimple}
          label="Import"
          visibleLabel={isImporting ? 'Importing…' : 'Import'}
          disabled={isImporting}
          aria-busy={isImporting}
          onClick={() => void importReference()}
        />
        {TOOL_GROUPS.map((group, index) => (
          <div key={group[0]?.id ?? index} style={{ display: 'contents' }}>
            <div role="separator" className="toolbar__sep" />
            {group.map((tool) => (
              <IconButton
                key={tool.id}
                icon={tool.icon}
                label={tool.label}
                visibleLabel={tool.short}
                active={toolMode === tool.id}
                disabled={isDisabled(tool)}
                onClick={() => toggleTool(tool)}
              />
            ))}
          </div>
        ))}
        <IconButton icon={CornersOut} label="Present" visibleLabel="Present" disabled={!hasReference} onClick={present} />
        <ViewOnlyBadge />
        <SyncStatusBadge />
      </div>
    </nav>
  );
}
