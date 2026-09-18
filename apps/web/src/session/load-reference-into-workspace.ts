import { applyGeometryOps, decodeBlobToWorkingBitmap } from '@artiso/core-engine';
import { getAssetBlob } from '@artiso/api-client';
import type { Project, Reference } from '@artiso/shared-types';
import { useWorkspaceStore } from '@/state/workspace-store';

// Shared by resume-session.ts (auto-resume on boot) and open-project.ts
// (explicitly picking a project from ProjectsScreen): re-derives the working
// bitmap from the persisted original Blob -- nothing bitmap-shaped survives
// a page reload -- and replays the saved EditStack's geometry ops on top of
// it, then restores the rest of the EditStack and GridConfig as data.
export async function loadReferenceIntoWorkspace(project: Project, reference: Reference): Promise<void> {
  const originalBlob = await getAssetBlob(reference.originalAssetId, 'original');
  if (!originalBlob) throw new Error('Original image is no longer available.');

  const decoded = await decodeBlobToWorkingBitmap(originalBlob);
  const geometryOps = reference.editStack.filter(
    (op) => op.type === 'crop' || op.type === 'rotate' || op.type === 'flip',
  );
  const replayed = geometryOps.length > 0 ? await applyGeometryOps(decoded.bitmap, geometryOps) : decoded;

  useWorkspaceStore.getState().loadReference({
    projectId: project.id,
    referenceId: reference.id,
    assetId: reference.originalAssetId,
    workingBitmap: replayed.bitmap,
    workingWidth: replayed.width,
    workingHeight: replayed.height,
    editStack: reference.editStack,
    gridConfig: reference.gridConfig,
  });
}
