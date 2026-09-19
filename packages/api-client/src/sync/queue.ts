import type { Reference } from '@artiso/shared-types';
import {
  applyMergedReference,
  applyRemoteReference,
  getAsset,
  getAssetBlob,
  getProject,
  getReference,
  getSyncBase,
  saveSyncBase,
} from '../local';
import { syncAsset } from './asset';
import { emitReferenceUpdated } from './events';
import { mergeReferences } from './merge-reference';
import { syncProject } from './project';
import { pullReference, syncReference } from './reference';
import { setSyncStatus } from './status';

const DEBOUNCE_MS = 2000;
const MAX_MERGE_ATTEMPTS = 4;
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

// Runs a sync immediately instead of waiting out the debounce -- used to
// refresh a shared Reference on open, on window focus, and on a timer, so
// collaborators' changes arrive without anyone editing (Phase 8: refresh,
// not live push). Also pushes any unsynced local edit, so it's always safe.
export function syncReferenceNow(projectId: string, referenceId: string): Promise<void> {
  return runReferenceSync(projectId, referenceId);
}

const running = new Set<string>();
const rerunRequested = new Set<string>();

// One sync per Reference at a time: the debounce timer, a focus refresh and
// the periodic refresh can all fire together, and two overlapping
// push-merge cycles would just fight each other. A request that arrives
// mid-run is remembered and run once afterwards.
async function runReferenceSync(projectId: string, referenceId: string): Promise<void> {
  if (running.has(referenceId)) {
    rerunRequested.add(referenceId);
    return;
  }
  running.add(referenceId);
  try {
    await runReferenceSyncOnce(projectId, referenceId);
  } finally {
    running.delete(referenceId);
  }
  if (rerunRequested.delete(referenceId)) await runReferenceSync(projectId, referenceId);
}

async function runReferenceSyncOnce(projectId: string, referenceId: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setSyncStatus(projectId, 'offline');
    return;
  }

  try {
    const reference = await getReference(referenceId);
    if (!reference) return;
    const project = await getProject(projectId);
    const role = project?.role ?? 'owner';

    // Viewers are read-only: they never push, they only take newer copies.
    if (role === 'viewer') {
      await pullIfNewer(reference);
      setSyncStatus(projectId, 'synced');
      return;
    }

    // Only the owner uploads the asset and owns the project row. An editor's
    // local copy of both came *from* the owner, and RLS would reject the
    // write anyway.
    if (role === 'owner') {
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
      if (project) await syncProject(project).catch(() => {});
    }

    await pushWithMerge(reference);
    setSyncStatus(projectId, 'synced');
  } catch {
    setSyncStatus(projectId, 'error');
  }
}

// Pushes a Reference, and when the server already has a newer version
// (someone else -- or another of this user's devices -- edited it), merges
// their copy with ours by field group rather than letting either side's
// work be overwritten (see merge-reference.ts), then pushes the merge.
async function pushWithMerge(start: Reference): Promise<void> {
  let local = start;
  let localChanged = false;

  for (let attempt = 0; attempt < MAX_MERGE_ATTEMPTS; attempt++) {
    if ((await syncReference(local)) === 'synced') {
      await saveSyncBase(local);
      if (localChanged) emitReferenceUpdated(local.id);
      return;
    }

    const remote = await pullReference(local.id);
    if (!remote) return;
    const merged = mergeReferences((await getSyncBase(local.id)) ?? null, local, remote);

    // If the user edited while we were merging, the compare-and-swap refuses
    // and we redo the merge from their newer copy instead of clobbering it.
    if (await applyMergedReference(local.version, merged)) {
      local = merged;
      localChanged = true;
    } else {
      local = (await getReference(local.id)) ?? local;
    }
  }
  throw new Error('Merge did not converge after several attempts.');
}

// A viewer has no local edits to protect, so a newer remote copy simply replaces
// the local one.
async function pullIfNewer(local: Reference): Promise<void> {
  const remote = await pullReference(local.id);
  if (!remote || remote.version <= local.version) return;
  await applyRemoteReference(remote);
  await saveSyncBase(remote);
  emitReferenceUpdated(remote.id);
}
