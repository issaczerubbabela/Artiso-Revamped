import { deterministicUuid, importImage } from '@artiso/core-engine';
import { LOCAL_OWNER_ID, createReference, saveAsset, scheduleReferenceSync, updateProject } from '@artiso/api-client';
import { getPlatformAdapter } from '@/platform/get-platform-adapter';
import { useWorkspaceStore } from '@/state/workspace-store';
import { useAppViewStore } from '@/state/app-view-store';
import { useAuthStore } from '@/state/auth-store';
import { DEFAULT_GRID_CONFIG } from '@/state/default-grid-config';
import { createProjectAction } from './project-actions';

// Import module's full pipeline (.agents/workflows/build-image-import-pipeline.md):
// pick (via the PlatformAdapter seam, never a raw file input here) -> decode/
// downsample/thumbnail/hash (core-engine) -> create a new Project + Reference
// (api-client's local persistence, pushed to Supabase if signed in) -> hand
// off to the workspace. Each import is its own Project -- multi-reference
// projects are a data-model allowance only until Phase 6's workspace UI.
export async function importReference(): Promise<void> {
  const store = useWorkspaceStore.getState();
  store.setImportError(null);
  store.setImporting(true);

  try {
    const blob = await getPlatformAdapter().pickImage();
    const imported = await importImage(blob);
    const ownerId = useAuthStore.getState().user?.id ?? LOCAL_OWNER_ID;

    const project = await createProjectAction(`Reference — ${new Date().toLocaleDateString()}`);
    const assetId = await deterministicUuid(`${ownerId}:${imported.contentHash}`);
    const asset = await saveAsset({
      id: assetId,
      ownerId,
      contentHash: imported.contentHash,
      width: imported.originalWidth,
      height: imported.originalHeight,
      sizeBytes: imported.sizeBytes,
      originalBlob: blob,
      thumbnailBlob: await bitmapToBlob(imported.thumbnailBitmap),
    });
    // Only set locally here -- pushed to Supabase later, from inside the
    // sync queue, after the asset it points at is confirmed synced (see
    // queue.ts's runReferenceSync). Pushing it immediately would race the
    // asset upload and violate projects_thumbnail_asset_id_fkey.
    await updateProject(project.id, { thumbnailAssetId: asset.id });
    const reference = await createReference({
      projectId: project.id,
      originalAssetId: asset.id,
      gridConfig: DEFAULT_GRID_CONFIG,
    });

    if (useAuthStore.getState().user) scheduleReferenceSync(project.id, reference.id);

    store.loadReference({
      projectId: project.id,
      referenceId: reference.id,
      assetId: asset.id,
      workingBitmap: imported.workingBitmap,
      workingWidth: imported.workingWidth,
      workingHeight: imported.workingHeight,
      editStack: [],
      gridConfig: reference.gridConfig,
    });
    useAppViewStore.getState().showWorkspace(project.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed.';
    // The user simply closing the file picker isn't an error worth surfacing.
    if (message !== 'Import cancelled') store.setImportError(message);
  } finally {
    store.setImporting(false);
  }
}

async function bitmapToBlob(bitmap: ImageBitmap): Promise<Blob> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  return canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
}
