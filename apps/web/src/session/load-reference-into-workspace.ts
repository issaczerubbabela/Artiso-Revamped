import { decodeOriginalBitmap, renderFramedBitmap, resolveFraming, type ResolvedFraming } from '@artiso/core-engine';
import { downloadAndCacheAsset, getAssetBlob, syncReferenceNow, updateReference } from '@artiso/api-client';
import type { Project, Reference } from '@artiso/shared-types';
import { useAuthStore } from '@/state/auth-store';
import { useWorkspaceStore, type PaneSession } from '@/state/workspace-store';

// Shared by resume-session.ts (auto-resume on boot) and open-project.ts
// (explicitly picking a project from ProjectsScreen): re-derives the working
// bitmap from the persisted original Blob -- nothing bitmap-shaped survives a
// page reload -- as the crop region of the rotated/flipped original, then
// restores the rest of the EditStack and the grid settings as data.
//
// A reference saved before the drawing-grid overhaul has no paper or crop yet;
// it is migrated here (a legacy crop becomes the crop, paper defaults to A4) so
// it opens straight into a working grid, and the result is written back so the
// migration only happens once.
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

  const original = await decodeOriginalBitmap(originalBlob);
  try {
    const framing = resolveFraming(reference, { width: original.width, height: original.height });
    const framed = await renderFramedBitmap(original, reference.editStack, framing.crop);
    if (framing.migrated) persistMigration(project, reference, framing);

    return {
      projectId: project.id,
      projectName: project.name,
      referenceId: reference.id,
      assetId: reference.originalAssetId,
      workingBitmap: framed.bitmap,
      workingWidth: framed.width,
      workingHeight: framed.height,
      editStack: reference.editStack,
      gridConfig: reference.gridConfig,
      secondaryGridConfig: framing.secondaryGridConfig,
      paper: framing.paper,
      crop: framing.crop,
      gridSettings: framing.gridSettings,
      orientedWidth: framed.orientedWidth,
      orientedHeight: framed.orientedHeight,
      annotations: reference.annotations,
      removedAnnotationIds: reference.removedAnnotationIds,
      role: project.role,
    };
  } finally {
    original.close();
  }
}

// A viewer can't write (RLS would reject the sync), so their copy is migrated
// in memory only and re-derived the next time it is opened.
function persistMigration(project: Project, reference: Reference, framing: ResolvedFraming): void {
  if (project.role === 'viewer') return;
  void updateReference(reference.id, {
    paper: framing.paper,
    crop: framing.crop,
    gridSettings: framing.gridSettings,
    secondaryGridConfig: framing.secondaryGridConfig,
  }).catch(() => {
    // Not fatal: the next open just migrates again.
  });
}

export async function loadReferenceIntoWorkspace(project: Project, reference: Reference): Promise<void> {
  useWorkspaceStore.getState().loadReference(await buildSession(project, reference));
  // Refresh on open (docs/phases/phase-8-collaboration-split-view.md): pull
  // in whatever a collaborator changed since this device last synced. Runs in
  // the background -- the reference is already showing from its local copy.
  if (useAuthStore.getState().user) void syncReferenceNow(project.id, reference.id);
}
