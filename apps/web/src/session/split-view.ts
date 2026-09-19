import { getProject, getReference } from '@artiso/api-client';
import type { ReferenceTab } from '@/state/tabs-store';
import { useWorkspaceStore } from '@/state/workspace-store';
import { buildSession } from './load-reference-into-workspace';

// Split view (Wide breakpoint): opens another open tab's reference beside
// the focused one. The focused pane stays the store's live session; this
// only builds and parks the second pane's snapshot.
export async function openInSplit(tab: ReferenceTab): Promise<void> {
  const store = useWorkspaceStore.getState();
  // A reference can't be open in both panes (edits would diverge).
  if (store.referenceId === tab.referenceId || store.splitParked?.referenceId === tab.referenceId) return;
  const [project, reference] = await Promise.all([getProject(tab.projectId), getReference(tab.referenceId)]);
  if (!project || !reference) return;
  const session = await buildSession(project, reference);
  // Re-check after the await: a tab switch may have raced this load.
  if (useWorkspaceStore.getState().referenceId === session.referenceId) return;
  useWorkspaceStore.getState().openSplit(session);
}
