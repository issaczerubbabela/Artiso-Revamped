'use client';

import { PanelButton } from './PanelButton';
import { useReportChromeRect } from '@/components/chrome/chrome-insets';
import { useTabsStore } from '@/state/tabs-store';
import { useWorkspaceStore } from '@/state/workspace-store';
import { closeWorkspace } from '@/session/close-workspace';
import { closeTabAndSwitch, switchToTab } from '@/session/switch-tab';
import { openInSplit } from '@/session/split-view';

// Multi-reference workspace tabs (docs/phases/phase-7-guides-workspace-
// export.md), as the floating top bar of the Wide chrome (docs/design.md §7).
// Wide only -- mobile stays single-reference, so WorkspaceShell never renders
// this on Compact/Regular. A small matte pill, not a second focal point
// (CLAUDE.md's canvas-first rule); it reports its rectangle so the canvas fits
// itself clear of it.
export function TabStrip() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeReferenceId = useWorkspaceStore((s) => s.referenceId);
  const parkedReferenceId = useWorkspaceStore((s) => s.splitParked?.referenceId ?? null);
  const closeSplit = useWorkspaceStore((s) => s.closeSplit);
  const reportRect = useReportChromeRect('top');

  return (
    <div
      ref={reportRect}
      role="tablist"
      aria-label="Open references"
      data-testid="tab-strip"
      className="panel pill tabbar"
    >
      {tabs.map((tab) => {
        const isActive = tab.referenceId === activeReferenceId;
        const isParked = tab.referenceId === parkedReferenceId;
        return (
          <div key={tab.referenceId} className="tabbar__item">
            <PanelButton
              role="tab"
              aria-selected={isActive}
              active={isActive}
              className="tabbar__title"
              onClick={() => void switchToTab(tab)}
              // The other pane's tab, in split view -- outlined rather than
              // filled so the focused pane stays the one accent-marked tab.
              style={isParked ? { borderColor: 'var(--color-accent)' } : undefined}
            >
              {tab.title}
            </PanelButton>
            {!isActive && !isParked ? (
              <PanelButton aria-label={`Open ${tab.title} beside`} onClick={() => void openInSplit(tab)}>
                Split
              </PanelButton>
            ) : null}
            <PanelButton aria-label={`Close ${tab.title}`} onClick={() => void closeTabAndSwitch(tab.referenceId)}>
              ×
            </PanelButton>
          </div>
        );
      })}
      {parkedReferenceId ? <PanelButton onClick={closeSplit}>Close split</PanelButton> : null}
      <PanelButton onClick={closeWorkspace}>Add reference</PanelButton>
    </div>
  );
}
