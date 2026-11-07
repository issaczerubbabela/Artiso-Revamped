'use client';

import { useEffect } from 'react';
import { useAppViewStore } from '@/state/app-view-store';
import { ProjectsScreen } from '@/projects/ProjectsScreen';
import { WorkspaceShell } from '@/workspace/WorkspaceShell';
import { PasteDropImport } from '@/workspace/PasteDropImport';
import { bootstrapAuth } from '@/session/auth-bootstrap';
import { resumeSession } from '@/session/resume-session';
import { startLiveRefresh } from '@/session/live-refresh';
import { registerServiceWorker, requestPersistentStorage } from '@/platform/pwa';
import { installCanvasFallback } from '@/platform/canvas';
import { startKeyboardShortcuts } from '@/session/keyboard-shortcuts';
import { loadGestureHintSeen, useHelpStore } from '@/state/help-store';
import { useWorkspaceStore } from '@/state/workspace-store';
import { ShortcutsCard } from '@/workspace/ShortcutsCard';

// Before any import/export can run (module scope, not an effect).
installCanvasFallback();

// Bootstraps exactly once at the app root -- resumeSession in particular
// must not live inside WorkspaceShell's own mount effect, since the user
// can navigate back to ProjectsScreen and into a *different* project,
// remounting WorkspaceShell; re-running "resume the most recent session"
// at that point would silently override the project they just chose.
export function AppRoot() {
  const view = useAppViewStore((s) => s.view);

  useEffect(() => {
    registerServiceWorker();
    requestPersistentStorage();
    void bootstrapAuth();
    void resumeSession();
    const stopLiveRefresh = startLiveRefresh();
    const stopShortcuts = startKeyboardShortcuts();
    // The gesture hint is for the very first empty canvas: once any reference
    // is open on this device, it has done its job.
    loadGestureHintSeen();
    const markSeenOnOpen = (referenceId: string | null) => {
      if (referenceId && !useHelpStore.getState().gestureHintSeen) useHelpStore.getState().markGestureHintSeen();
    };
    markSeenOnOpen(useWorkspaceStore.getState().referenceId);
    const stopHintWatch = useWorkspaceStore.subscribe((state) => markSeenOnOpen(state.referenceId));
    return () => {
      stopLiveRefresh();
      stopShortcuts();
      stopHintWatch();
    };
  }, []);

  return (
    <>
      {view === 'workspace' ? <WorkspaceShell /> : <ProjectsScreen />}
      {/* Paste and drop open images as new tabs from either screen. */}
      <PasteDropImport />
      {/* Keyboard shortcuts and the card work from either screen too. */}
      <ShortcutsCard />
    </>
  );
}
