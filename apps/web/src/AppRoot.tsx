'use client';

import { useEffect } from 'react';
import { useAppViewStore } from '@/state/app-view-store';
import { ProjectsScreen } from '@/projects/ProjectsScreen';
import { WorkspaceShell } from '@/workspace/WorkspaceShell';
import { bootstrapAuth } from '@/session/auth-bootstrap';
import { resumeSession } from '@/session/resume-session';
import { startLiveRefresh } from '@/session/live-refresh';

// Bootstraps exactly once at the app root -- resumeSession in particular
// must not live inside WorkspaceShell's own mount effect, since the user
// can navigate back to ProjectsScreen and into a *different* project,
// remounting WorkspaceShell; re-running "resume the most recent session"
// at that point would silently override the project they just chose.
export function AppRoot() {
  const view = useAppViewStore((s) => s.view);

  useEffect(() => {
    void bootstrapAuth();
    void resumeSession();
    return startLiveRefresh();
  }, []);

  return view === 'workspace' ? <WorkspaceShell /> : <ProjectsScreen />;
}
