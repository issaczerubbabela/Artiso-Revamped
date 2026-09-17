export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

type Listener = () => void;

// Plain module-level pub-sub, not a Zustand store -- api-client has no React
// dependency. apps/web wires this to components via useSyncExternalStore.
const statusByProject = new Map<string, SyncStatus>();
const listeners = new Set<Listener>();

export function getSyncStatus(projectId: string): SyncStatus {
  return statusByProject.get(projectId) ?? 'offline';
}

export function setSyncStatus(projectId: string, status: SyncStatus): void {
  statusByProject.set(projectId, status);
  for (const listener of listeners) listener();
}

export function subscribeSyncStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
