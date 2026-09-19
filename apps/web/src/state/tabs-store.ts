import { create } from 'zustand';

export interface ReferenceTab {
  projectId: string;
  referenceId: string;
  title: string;
}

interface TabsState {
  tabs: ReferenceTab[];
  openTab: (tab: ReferenceTab) => void;
  closeTab: (referenceId: string) => void;
}

// Multi-reference workspace (docs/phases/phase-7-guides-workspace-export.md):
// the tabs are just a list of which references the user has open this
// session. The workspace store itself still holds exactly one *active*
// reference -- only one canvas is ever visible -- so switching a tab means
// loading that reference into it (see session/switch-tab.ts), not keeping
// several live sessions in memory. Transient by design: tabs are per
// session, never persisted or synced.
export const useTabsStore = create<TabsState>((set) => ({
  tabs: [],
  openTab: (tab) =>
    set((state) => {
      const existing = state.tabs.find((t) => t.referenceId === tab.referenceId);
      if (!existing) return { tabs: [...state.tabs, tab] };
      // Refresh the title in case the project was renamed since it was opened.
      return { tabs: state.tabs.map((t) => (t.referenceId === tab.referenceId ? tab : t)) };
    }),
  closeTab: (referenceId) => set((state) => ({ tabs: state.tabs.filter((t) => t.referenceId !== referenceId) })),
}));
