'use client';

import { useSyncExternalStore } from 'react';
import { getSyncStatus, subscribeSyncStatus, type SyncStatus } from '@artiso/api-client';
import { useWorkspaceStore } from '@/state/workspace-store';

const LABELS: Record<SyncStatus, string> = {
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline',
  error: 'Sync error',
};

const COLORS: Record<SyncStatus, string> = {
  synced: 'var(--color-ink-muted)',
  syncing: 'var(--color-accent)',
  offline: 'var(--color-ink-muted)',
  error: 'var(--color-danger)',
};

// Never blocks editing (ki-cross-device-continuity) -- this is read-only
// feedback, and only shown at all once a reference is open (signed-out
// local-only projects have nothing to report).
export function SyncStatusBadge() {
  const projectId = useWorkspaceStore((s) => s.projectId);
  const status = useSyncExternalStore<SyncStatus>(
    subscribeSyncStatus,
    () => (projectId ? getSyncStatus(projectId) : 'offline'),
    () => 'offline',
  );

  if (!projectId) return null;

  return (
    <span role="status" className="status-text" style={{ color: COLORS[status] }}>
      {LABELS[status]}
    </span>
  );
}
