import { deepEqual, getProject, getReference, subscribeReferenceUpdates, syncReferenceNow } from '@artiso/api-client';
import type { Operation } from '@artiso/shared-types';
import { useAuthStore } from '@/state/auth-store';
import { hasPendingPersist, useWorkspaceStore } from '@/state/workspace-store';
import { buildSession, loadReferenceIntoWorkspace } from './load-reference-into-workspace';
import { refreshProjectsFromServer } from './auth-bootstrap';

// Collaboration freshness (docs/phases/phase-8-collaboration-split-view.md):
// refresh on open, on window focus, and on a timer -- not live push. A
// refresh is just a sync, which both pushes any unsynced local edit and
// merges in whatever a collaborator (or another of the user's devices) did.
const REFRESH_INTERVAL_MS = 30_000;

function geometryOps(editStack: Operation[]): Operation[] {
  return editStack.filter((op) => op.type === 'crop' || op.type === 'rotate' || op.type === 'flip');
}

// Sync changed a reference's *local* copy (a merge landed). The open
// workspace keeps its own in-memory copy and re-saves it wholesale on the
// next edit, so it must take the merged result or it would overwrite it.
async function adoptFromLocal(referenceId: string): Promise<void> {
  const store = useWorkspaceStore.getState();
  const isActive = store.referenceId === referenceId;
  const isParked = store.splitParked?.referenceId === referenceId;
  if (!isActive && !isParked) return;

  const reference = await getReference(referenceId);
  if (!reference) return;
  const project = await getProject(reference.projectId);
  if (!project) return;

  if (isParked) {
    // The parked pane is never edited, so it can simply be rebuilt.
    useWorkspaceStore.getState().replaceParked(await buildSession(project, reference));
    return;
  }

  // Never overwrite an edit still waiting out the persist debounce; it will
  // save, sync, and the next refresh merges everything together.
  if (hasPendingPersist()) return;
  const current = useWorkspaceStore.getState();
  if (current.referenceId !== referenceId) return;

  // A collaborator changed the crop/rotation, which changes the working
  // bitmap itself -- that needs a real reload, not a field swap.
  if (!deepEqual(geometryOps(reference.editStack), geometryOps(current.editStack))) {
    await loadReferenceIntoWorkspace(project, reference);
    return;
  }

  current.adoptSyncedFields({
    editStack: reference.editStack,
    gridConfig: reference.gridConfig,
    secondaryGridConfig: reference.secondaryGridConfig,
    annotations: reference.annotations,
    removedAnnotationIds: reference.removedAnnotationIds,
  });
}

function refreshOpenReferences(): void {
  if (!useAuthStore.getState().user) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const state = useWorkspaceStore.getState();
  if (state.projectId && state.referenceId) void syncReferenceNow(state.projectId, state.referenceId);
  if (state.splitParked) void syncReferenceNow(state.splitParked.projectId, state.splitParked.referenceId);
  // Also picks up projects newly shared with this user, and access removed.
  void refreshProjectsFromServer();
}

export function startLiveRefresh(): () => void {
  const unsubscribe = subscribeReferenceUpdates((referenceId) => void adoptFromLocal(referenceId));
  const interval = setInterval(refreshOpenReferences, REFRESH_INTERVAL_MS);
  window.addEventListener('focus', refreshOpenReferences);
  document.addEventListener('visibilitychange', refreshOpenReferences);
  return () => {
    unsubscribe();
    clearInterval(interval);
    window.removeEventListener('focus', refreshOpenReferences);
    document.removeEventListener('visibilitychange', refreshOpenReferences);
  };
}
