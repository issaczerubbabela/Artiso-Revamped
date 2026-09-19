'use client';

import { PanelButton } from './PanelButton';
import { useTabsStore } from '@/state/tabs-store';
import { useWorkspaceStore } from '@/state/workspace-store';
import { closeWorkspace } from '@/session/close-workspace';
import { closeTabAndSwitch, switchToTab } from '@/session/switch-tab';

// Multi-reference workspace tabs (docs/phases/phase-7-guides-workspace-
// export.md). Wide breakpoint only -- mobile stays single-reference, so
// WorkspaceShell simply never renders this on Compact. A thin strip, not a
// second focal point (CLAUDE.md's canvas-first rule).
export function TabStrip() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeReferenceId = useWorkspaceStore((s) => s.referenceId);

  return (
    <div
      role="tablist"
      aria-label="Open references"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: 'var(--space-xs) var(--space-md)',
        background: 'var(--color-surface-raised)',
        boxShadow: 'var(--shadow-dock)',
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.referenceId === activeReferenceId;
        return (
          <div key={tab.referenceId} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <PanelButton
              role="tab"
              aria-selected={isActive}
              active={isActive}
              onClick={() => void switchToTab(tab)}
              style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {tab.title}
            </PanelButton>
            <PanelButton aria-label={`Close ${tab.title}`} onClick={() => void closeTabAndSwitch(tab.referenceId)}>
              ×
            </PanelButton>
          </div>
        );
      })}
      <PanelButton onClick={closeWorkspace}>Add reference</PanelButton>
    </div>
  );
}
