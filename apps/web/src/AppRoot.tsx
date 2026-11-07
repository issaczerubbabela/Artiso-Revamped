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
    return startLiveRefresh();
  }, []);

  return (
    <>
      {view === 'workspace' ? <WorkspaceShell /> : <ProjectsScreen />}
      {/* Paste and drop open images as new tabs from either screen. */}
      <PasteDropImport />
    </>
  );
}
