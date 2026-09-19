import { getProject, getReference } from '@artiso/api-client';
import { useTabsStore, type ReferenceTab } from '@/state/tabs-store';
import { useWorkspaceStore } from '@/state/workspace-store';
import { closeWorkspace } from './close-workspace';
import { loadReferenceIntoWorkspace } from './load-reference-into-workspace';

// Multi-reference workspace (Wide breakpoint): only one canvas is visible, so
// switching a tab loads that reference into the single active workspace
// session. loadReference flushes the outgoing reference's pending edit first.
export async function switchToTab(tab: ReferenceTab): Promise<void> {
  if (useWorkspaceStore.getState().referenceId === tab.referenceId) return;
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
  const wasActive = useWorkspaceStore.getState().referenceId === referenceId;
  closeTab(referenceId);
  if (!wasActive) return;

  const remaining = useTabsStore.getState().tabs;
  const next = remaining[Math.min(index, remaining.length - 1)];
  if (next) await switchToTab(next);
  else closeWorkspace();
}
