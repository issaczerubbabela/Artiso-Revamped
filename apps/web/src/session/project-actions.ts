import type { Project } from '@artiso/shared-types';
import {
  createProject as createLocalProject,
  deleteProject as deleteLocalProject,
  listReferencesByProject,
  removeProjectMember,
  syncDeleteProject,
  syncProject,
  syncReferenceNow,
  updateProject as updateLocalProject,
} from '@artiso/api-client';
import { useAuthStore } from '@/state/auth-store';

// Local write always wins first (docs/architecture/08): every action below
// commits to IndexedDB unconditionally, then opportunistically pushes to
// Supabase only when signed in -- sync is additive, never a precondition for
// a mutation to succeed. Push failures are swallowed here; the per-project
// sync status indicator (wired in the workspace) is where a persistent sync
// problem should surface, not a failed one-off project rename.
export async function createProjectAction(name: string): Promise<Project> {
  const user = useAuthStore.getState().user;
  const project = await createLocalProject(name, user?.id);
  if (user) void syncProject(project).catch(() => {});
  return project;
}

export async function renameProjectAction(id: string, name: string): Promise<Project> {
  const updated = await updateLocalProject(id, { name });
  if (useAuthStore.getState().user) void syncProject(updated).catch(() => {});
  return updated;
}

export async function deleteProjectAction(id: string): Promise<void> {
  const wasSignedIn = Boolean(useAuthStore.getState().user);
  await deleteLocalProject(id);
  if (wasSignedIn) void syncDeleteProject(id).catch(() => {});
}

// A project's row (and the asset it points at) only reaches Supabase with its
// first reference sync, but sharing needs the project to exist server-side.
// Runs that sync now, so inviting someone works on a project that's never been
// synced yet.
export async function ensureProjectOnServer(project: Project): Promise<void> {
  const references = await listReferencesByProject(project.id);
  await Promise.all(references.map((reference) => syncReferenceNow(project.id, reference.id)));
}

// A collaborator leaving a project that was shared with them: drop their
// membership on the server, then their local copy. (The owner's copy and
// everyone else's are untouched.)
export async function leaveProjectAction(project: Project): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return;
  await removeProjectMember(project.id, user.id);
  await deleteLocalProject(project.id);
}
