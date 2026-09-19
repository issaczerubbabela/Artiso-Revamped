import { applyRemoteReference, listReferencesByProject, pullReferencesForProject } from '@artiso/api-client';
import type { Project } from '@artiso/shared-types';
import { useAppViewStore } from '@/state/app-view-store';
import { loadReferenceIntoWorkspace } from './load-reference-into-workspace';

// Opening a project from ProjectsScreen. A Project can hold multiple
// References in the data model, but Import creates exactly one per Project
// and the Phase 7 multi-reference workspace opens references as tabs (from
// any Project) rather than several from one -- so this opens the first one,
// and loadReference adds its tab.
export async function openProject(project: Project): Promise<void> {
  let [reference] = await listReferencesByProject(project.id);

  // A project pulled from another device (mergeRemoteProjects on sign-in)
  // has no local References yet -- pull and cache them before giving up.
  if (!reference) {
    const remoteReferences = await pullReferencesForProject(project.id).catch(() => []);
    for (const remote of remoteReferences) {
      await applyRemoteReference(remote);
    }
    [reference] = await listReferencesByProject(project.id);
  }

  if (!reference) throw new Error('This project has no reference to open yet.');
  await loadReferenceIntoWorkspace(project, reference);
  useAppViewStore.getState().showWorkspace(project.id);
}
