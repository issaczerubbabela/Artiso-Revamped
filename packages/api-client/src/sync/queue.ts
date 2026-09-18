import { applyRemoteReference, getAsset, getAssetBlob, getProject, getReference } from '../local';
import { syncAsset } from './asset';
import { syncProject } from './project';
import { pullReference, syncReference } from './reference';
import { setSyncStatus } from './status';

const DEBOUNCE_MS = 2000;
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Debounced ~2s after the last edit to a given Reference (docs/architecture/08)
// -- not on every keystroke/slider tick. Local writes already happened
// synchronously via api-client's local persistence before this is ever
// called; a failure here degrades to a visible "Error" status, never blocked
// editing or lost data (ki-cross-device-continuity).
export function scheduleReferenceSync(projectId: string, referenceId: string): void {
  const existing = pendingTimers.get(referenceId);
  if (existing) clearTimeout(existing);

  setSyncStatus(projectId, 'syncing');
  pendingTimers.set(
    referenceId,
    setTimeout(() => {
      pendingTimers.delete(referenceId);
      void runReferenceSync(projectId, referenceId);
    }, DEBOUNCE_MS),
  );
}

async function runReferenceSync(projectId: string, referenceId: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setSyncStatus(projectId, 'offline');
    return;
  }

  try {
    const reference = await getReference(referenceId);
    if (!reference) return;

    // Upload the asset (if not already uploaded) before anything that
    // references it, per docs/architecture/08 -- both the reference row
    // below and the project's own thumbnail_asset_id (pushed only now, not
    // eagerly at project-creation time) have a foreign key to it, and
    // pushing either first would violate that key before the asset row
    // exists remotely.
    const asset = await getAsset(reference.originalAssetId);
    if (asset) {
      const [originalBlob, thumbnailBlob] = await Promise.all([
        getAssetBlob(asset.id, 'original'),
        getAssetBlob(asset.id, 'thumbnail'),
      ]);
      if (originalBlob && thumbnailBlob) {
        await syncAsset(asset, originalBlob, thumbnailBlob);
      }
    }

    const project = await getProject(projectId);
    if (project) await syncProject(project).catch(() => {});

    const result = await syncReference(reference);
    if (result === 'stale') {
      // Our write lost to a newer version already on the server (last-write-
      // wins) -- pull the authoritative copy back into local rather than
      // silently diverging from it.
      const remote = await pullReference(referenceId);
      if (remote) await applyRemoteReference(remote);
    }

    setSyncStatus(projectId, 'synced');
  } catch {
    setSyncStatus(projectId, 'error');
  }
}
