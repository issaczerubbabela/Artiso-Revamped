import { applyGeometryOps, decodeBlobToWorkingBitmap } from '@artiso/core-engine';
import { getAssetBlob, listProjects, listReferencesByProject } from '@artiso/api-client';
import { useWorkspaceStore } from '@/state/workspace-store';

// Phase 1 exit criterion: "exit and resume an editing session (IndexedDB)
// without data loss." Re-derives the working bitmap from the persisted
// original Blob (nothing bitmap-shaped survives a page reload) and replays
// the saved EditStack's geometry ops on top of it, then restores the rest of
// the EditStack (adjustments/filters) and GridConfig as data -- exactly the
// non-destructive replay model, just triggered by app boot instead of a live
// edit.
export async function resumeSession(): Promise<void> {
  const [project] = await listProjects();
  if (!project) return;

  const references = await listReferencesByProject(project.id);
  const mostRecent = references.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  if (!mostRecent) return;

  const originalBlob = await getAssetBlob(mostRecent.originalAssetId, 'original');
  if (!originalBlob) return;

  const decoded = await decodeBlobToWorkingBitmap(originalBlob);
  const geometryOps = mostRecent.editStack.filter(
    (op) => op.type === 'crop' || op.type === 'rotate' || op.type === 'flip',
  );
  const replayed =
    geometryOps.length > 0 ? await applyGeometryOps(decoded.bitmap, geometryOps) : decoded;

  useWorkspaceStore.getState().loadReference({
    projectId: project.id,
    referenceId: mostRecent.id,
    assetId: mostRecent.originalAssetId,
    workingBitmap: replayed.bitmap,
    workingWidth: replayed.width,
    workingHeight: replayed.height,
    editStack: mostRecent.editStack,
    gridConfig: mostRecent.gridConfig,
  });
}
