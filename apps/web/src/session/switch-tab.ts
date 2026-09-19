import { getProject, getReference } from '@artiso/api-client';
import { useTabsStore, type ReferenceTab } from '@/state/tabs-store';
import { useWorkspaceStore } from '@/state/workspace-store';
import { closeWorkspace } from './close-workspace';
import { loadReferenceIntoWorkspace } from './load-reference-into-workspace';

// Multi-reference workspace (Wide breakpoint): only one canvas is visible, so
// switching a tab loads that reference into the single active workspace
// session. loadReference flushes the outgoing reference's pending edit first.
export async function switchToTab(tab: ReferenceTab): Promise<void> {
  const store = useWorkspaceStore.getState();
  if (store.referenceId === tab.referenceId) return;
  // Clicking the tab of the parked pane just focuses that pane.
  if (store.splitParked?.referenceId === tab.referenceId) {
    store.focusSplitPane();
    return;
  }
  const [project, reference] = await Promise.all([getProject(tab.projectId), getReference(tab.referenceId)]);
  if (!project || !reference) {
    // The project/reference was deleted since this tab opened -- drop the
    // stale tab rather than leaving one that can never load.
    useTabsStore.getState().closeTab(tab.referenceId);
    return;
  }
  await loadReferenceIntoWorkspace(project, reference);
}

// Closing the active tab moves to a neighbor; closing the last one returns
// to the Projects screen. Closing an inactive tab just removes it.
export async function closeTabAndSwitch(referenceId: string): Promise<void> {
  const { tabs, closeTab } = useTabsStore.getState();
  const index = tabs.findIndex((t) => t.referenceId === referenceId);
  if (index === -1) return;
  const store = useWorkspaceStore.getState();
  const wasActive = store.referenceId === referenceId;
  closeTab(referenceId);

  // In split view, closing either pane's tab collapses back to one pane:
  // closing the parked one just ends the split; closing the focused one
  // hands focus to the parked pane first.
  if (store.splitParked) {
    if (store.splitParked.referenceId === referenceId) {
      store.closeSplit();
      return;
    }
    if (wasActive) {
      store.focusSplitPane();
      useWorkspaceStore.getState().closeSplit();
      return;
    }
  }
  if (!wasActive) return;

  const remaining = useTabsStore.getState().tabs;
  const next = remaining[Math.min(index, remaining.length - 1)];
  if (next) await switchToTab(next);
  else closeWorkspace();
}
