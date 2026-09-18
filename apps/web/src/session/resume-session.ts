import { listProjects, listReferencesByProject } from '@artiso/api-client';
import { useAppViewStore } from '@/state/app-view-store';
import { loadReferenceIntoWorkspace } from './load-reference-into-workspace';

// Phase 1's "exit and resume an editing session without data loss" exit
// criterion, now layered under Phase 2's Projects screen: if any local
// project has a reference, boots straight into the most recently updated
// one (continuity) rather than always landing on an empty Projects list.
// Users can still reach the Projects screen via WorkspaceShell's "Back to
// Projects" button to switch/manage projects. If there's nothing to resume,
// the app-view-store's 'projects' default stands.
export async function resumeSession(): Promise<void> {
  const projects = await listProjects();
  if (projects.length === 0) return;

  const candidates = (
    await Promise.all(
      projects.map(async (project) => {
        const references = await listReferencesByProject(project.id);
        return references.map((reference) => ({ project, reference }));
      }),
    )
  ).flat();

  const mostRecent = candidates.sort((a, b) => (a.reference.updatedAt < b.reference.updatedAt ? 1 : -1))[0];
  if (!mostRecent) return;

  await loadReferenceIntoWorkspace(mostRecent.project, mostRecent.reference);
  useAppViewStore.getState().showWorkspace(mostRecent.project.id);
}
