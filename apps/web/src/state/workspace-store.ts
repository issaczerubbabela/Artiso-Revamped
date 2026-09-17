import { create } from 'zustand';

// Stub for where real workspace state (active Reference, tool mode, viewport,
// edit stack — see docs/architecture/00-system-overview.md §3) plugs in once
// Phase 1 feature work starts.
interface WorkspaceState {
  activeReferenceId: string | null;
  setActiveReferenceId: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeReferenceId: null,
  setActiveReferenceId: (id) => set({ activeReferenceId: id }),
}));
