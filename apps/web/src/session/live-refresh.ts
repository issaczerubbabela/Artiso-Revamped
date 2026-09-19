import { deepEqual, getProject, getReference, subscribeReferenceUpdates, syncReferenceNow } from '@artiso/api-client';
import { orientationOps } from '@artiso/core-engine';
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

// What decides the working bitmap: the rotate/flip operations, the paper and the
// crop. (Legacy crop operations still in an EditStack are ignored once a
// reference has a paper, so they can't cause a reload.)
function framingOf(editStack: Operation[], paper: unknown, crop: unknown) {
  return { orientation: orientationOps(editStack), paper, crop };
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

  // A reference the other side hasn't migrated yet arrives without a paper or
  // crop. This device already migrated it, so keep our framing rather than
  // treating the difference as a collaborator's change.
  const unmigrated = reference.paper === null || reference.crop === null;

  // A collaborator changed the crop, paper or rotation, which changes the
  // working bitmap itself -- that needs a real reload, not a field swap.
  if (
    !unmigrated &&
    !deepEqual(
      framingOf(reference.editStack, reference.paper, reference.crop),
      framingOf(current.editStack, current.paper, current.crop),
    )
  ) {
    await loadReferenceIntoWorkspace(project, reference);
    return;
  }
  if (unmigrated && !deepEqual(orientationOps(reference.editStack), orientationOps(current.editStack))) {
    await loadReferenceIntoWorkspace(project, reference);
    return;
  }

  current.adoptSyncedFields({
    editStack: reference.editStack,
    gridConfig: reference.gridConfig,
    secondaryGridConfig: unmigrated ? current.secondaryGridConfig : reference.secondaryGridConfig,
    gridSettings: reference.gridSettings ?? current.gridSettings,
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
