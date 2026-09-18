import { listReferencesByProject } from '@artiso/api-client';
import type { Project } from '@artiso/shared-types';
import { useAppViewStore } from '@/state/app-view-store';
import { loadReferenceIntoWorkspace } from './load-reference-into-workspace';

// Opening a project from ProjectsScreen. A Project can hold multiple
// References in the data model, but the multi-reference workspace UI is
// deferred to Phase 6 (docs/phases/phase-2-cloud-projects-sync.md) -- this
// just opens the first one, matching how Import currently creates exactly
// one Reference per Project.
export async function openProject(project: Project): Promise<void> {
  const [reference] = await listReferencesByProject(project.id);
  if (!reference) throw new Error('This project has no reference to open yet.');
  await loadReferenceIntoWorkspace(project, reference);
  useAppViewStore.getState().showWorkspace(project.id);
}
