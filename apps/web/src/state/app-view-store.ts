import { create } from 'zustand';

export type AppView = 'projects' | 'workspace';

interface AppViewState {
  view: AppView;
  activeProjectId: string | null;
  showProjects: () => void;
  showWorkspace: (projectId: string) => void;
}

// Deliberately not Next.js routing: this is a client-side-only static
// export SPA (docs/architecture/10 -- the whole app has to run fully
// offline from a bundled build), and reference ids aren't known at build
// time to pre-render anyway. A plain view switch keeps that simple.
export const useAppViewStore = create<AppViewState>((set) => ({
  view: 'projects',
  activeProjectId: null,
  showProjects: () => set({ view: 'projects' }),
  showWorkspace: (projectId) => set({ view: 'workspace', activeProjectId: projectId }),
}));
