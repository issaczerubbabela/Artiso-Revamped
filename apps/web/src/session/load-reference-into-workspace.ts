import { applyGeometryOps, decodeBlobToWorkingBitmap } from '@artiso/core-engine';
import { downloadAndCacheAsset, getAssetBlob, syncReferenceNow } from '@artiso/api-client';
import type { Project, Reference } from '@artiso/shared-types';
import { useAuthStore } from '@/state/auth-store';
import { useWorkspaceStore, type PaneSession } from '@/state/workspace-store';

// Shared by resume-session.ts (auto-resume on boot) and open-project.ts
// (explicitly picking a project from ProjectsScreen): re-derives the working
// bitmap from the persisted original Blob -- nothing bitmap-shaped survives
// a page reload -- and replays the saved EditStack's geometry ops on top of
// it, then restores the rest of the EditStack and GridConfig as data.
export async function buildSession(project: Project, reference: Reference): Promise<PaneSession> {
  let originalBlob = await getAssetBlob(reference.originalAssetId, 'original');
  if (!originalBlob) {
    // Not cached locally -- this reference's asset was uploaded from a
    // different device. Best-effort: if this fails (offline, signed out,
    // not actually in Storage), the clear error below still fires.
    await downloadAndCacheAsset(reference.originalAssetId).catch(() => {});
    originalBlob = await getAssetBlob(reference.originalAssetId, 'original');
  }
  if (!originalBlob) throw new Error('Original image is no longer available.');

  const decoded = await decodeBlobToWorkingBitmap(originalBlob);
  const geometryOps = reference.editStack.filter(
    (op) => op.type === 'crop' || op.type === 'rotate' || op.type === 'flip',
  );
  const replayed = geometryOps.length > 0 ? await applyGeometryOps(decoded.bitmap, geometryOps) : decoded;

  return {
    projectId: project.id,
    projectName: project.name,
    referenceId: reference.id,
    assetId: reference.originalAssetId,
    workingBitmap: replayed.bitmap,
    workingWidth: replayed.width,
    workingHeight: replayed.height,
    editStack: reference.editStack,
    gridConfig: reference.gridConfig,
    secondaryGridConfig: reference.secondaryGridConfig,
    annotations: reference.annotations,
    removedAnnotationIds: reference.removedAnnotationIds,
    role: project.role,
  };
}

export async function loadReferenceIntoWorkspace(project: Project, reference: Reference): Promise<void> {
  useWorkspaceStore.getState().loadReference(await buildSession(project, reference));
  // Refresh on open (docs/phases/phase-8-collaboration-split-view.md): pull
  // in whatever a collaborator changed since this device last synced. Runs in
  // the background -- the reference is already showing from its local copy.
  if (useAuthStore.getState().user) void syncReferenceNow(project.id, reference.id);
}
