import { useWorkspaceStore } from '@/state/workspace-store';
import { useAppViewStore } from '@/state/app-view-store';

export function closeWorkspace(): void {
  useWorkspaceStore.getState().reset();
  useAppViewStore.getState().showProjects();
}
