import { applyRemoteProject, getCurrentUser, listProjects, onAuthStateChange, pullProjects } from '@artiso/api-client';
import { useAuthStore } from '@/state/auth-store';

let subscribed = false;

// No account wall on launch (docs/phases/phase-2-cloud-projects-sync.md):
// this only ever reflects auth state and opportunistically merges remote
// projects when signed in -- it never blocks the app from being fully
// usable signed-out.
export async function bootstrapAuth(): Promise<void> {
  const user = await getCurrentUser();
  useAuthStore.getState().setUser(user);
  if (user) void mergeRemoteProjects(user.id);

  if (!subscribed) {
    subscribed = true;
    onAuthStateChange((nextUser) => {
      useAuthStore.getState().setUser(nextUser);
      if (nextUser) void mergeRemoteProjects(nextUser.id);
    });
  }
}

// Projects have no `version` field (unlike References), so this uses
// updatedAt as an ad-hoc last-write-wins signal: only overwrite a local
// project if the remote copy is actually newer, so an unsynced local rename
// doesn't get clobbered by an opportunistic startup merge.
async function mergeRemoteProjects(ownerId: string): Promise<void> {
  try {
    const [remoteProjects, localProjects] = await Promise.all([pullProjects(ownerId), listProjects()]);
    const localById = new Map(localProjects.map((project) => [project.id, project]));
    await Promise.all(
      remoteProjects.map((remote) => {
        const local = localById.get(remote.id);
        if (!local || remote.updatedAt > local.updatedAt) {
          return applyRemoteProject(remote);
        }
        return undefined;
      }),
    );
  } catch {
    // Best-effort: the sync status indicator surfaces ongoing problems once
    // a reference is actually open; a failed opportunistic merge on launch
    // isn't itself something to interrupt the user about.
  }
}
