import {
  applyRemotePreset,
  applyRemoteProject,
  deleteProject,
  getCurrentUser,
  listPresets,
  listProjects,
  onAuthStateChange,
  pullPresets,
  pullProjects,
} from '@artiso/api-client';
import { useAuthStore } from '@/state/auth-store';
import { useWorkspaceStore } from '@/state/workspace-store';
import { closeWorkspace } from './close-workspace';

let subscribed = false;

// No account wall on launch (docs/phases/phase-2-cloud-projects-sync.md):
// this only ever reflects auth state and opportunistically merges remote
// projects/presets when signed in -- it never blocks the app from being
// fully usable signed-out.
export async function bootstrapAuth(): Promise<void> {
  const user = await getCurrentUser();
  useAuthStore.getState().setUser(user);
  if (user) {
    void mergeRemoteProjects(user.id);
    void mergeRemotePresets(user.id);
  }

  if (!subscribed) {
    subscribed = true;
    onAuthStateChange((nextUser) => {
      useAuthStore.getState().setUser(nextUser);
      if (nextUser) {
        void mergeRemoteProjects(nextUser.id);
        void mergeRemotePresets(nextUser.id);
      }
    });
  }
}

// Projects have no `version` field (unlike References), so this uses
// updatedAt as an ad-hoc last-write-wins signal for the user's own projects:
// only overwrite a local one if the remote copy is actually newer, so an
// unsynced local rename doesn't get clobbered by an opportunistic merge.
// Projects shared *with* the user are different -- the server is the only
// authority on them (the user can't edit them, and their role can change
// without updatedAt moving), so those always take the remote copy. A shared
// project the server no longer lists means access was removed: drop the
// local copy too (see below).
async function mergeRemoteProjects(userId: string): Promise<void> {
  try {
    const [remoteProjects, localProjects] = await Promise.all([pullProjects(userId), listProjects()]);
    const localById = new Map(localProjects.map((project) => [project.id, project]));
    await Promise.all(
      remoteProjects.map((remote) => {
        const local = localById.get(remote.id);
        if (!local || remote.role !== 'owner' || remote.updatedAt > local.updatedAt) {
          return applyRemoteProject(remote);
        }
        return undefined;
      }),
    );

    const remoteIds = new Set(remoteProjects.map((project) => project.id));
    for (const local of localProjects) {
      if (local.role === 'owner' || remoteIds.has(local.id)) continue;
      // If they're looking at it right now, close it first so they don't keep
      // editing something they no longer have access to.
      if (useWorkspaceStore.getState().projectId === local.id) closeWorkspace();
      await deleteProject(local.id);
    }

    // A role can change (editor -> viewer) while the project is open.
    const open = useWorkspaceStore.getState();
    const openProject = remoteProjects.find((project) => project.id === open.projectId);
    if (openProject && openProject.role !== open.role) useWorkspaceStore.setState({ role: openProject.role });
  } catch {
    // Best-effort: the sync status indicator surfaces ongoing problems once
    // a reference is actually open; a failed opportunistic merge on launch
    // isn't itself something to interrupt the user about.
  }
}

// Re-pulls the user's projects (own and shared) -- used to pick up a project
// someone just shared, or a role change, without waiting for a sign-in.
export async function refreshProjectsFromServer(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (user) await mergeRemoteProjects(user.id);
}

// Presets have no updatedAt/version field (they're small, occasionally-
// renamed bundles, not continuously-edited documents like a Reference), so
// there's no timestamp to arbitrate a conflict with -- this only ever adds a
// remote preset this device doesn't have yet, never overwrites an existing
// local one, so a rename that hasn't synced out yet can't be clobbered by
// coming back in.
async function mergeRemotePresets(ownerId: string): Promise<void> {
  try {
    const [remotePresets, localPresets] = await Promise.all([pullPresets(ownerId), listPresets()]);
    const localIds = new Set(localPresets.map((preset) => preset.id));
    await Promise.all(
      remotePresets.filter((preset) => !localIds.has(preset.id)).map((preset) => applyRemotePreset(preset)),
    );
  } catch {
    // Best-effort, same rationale as mergeRemoteProjects.
  }
}
