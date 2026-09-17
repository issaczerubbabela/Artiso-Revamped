import { importImage } from '@artiso/core-engine';
import { LOCAL_OWNER_ID, createReference, getOrCreateDefaultProject, saveAsset } from '@artiso/api-client';
import { getPlatformAdapter } from '@/platform/get-platform-adapter';
import { useWorkspaceStore } from '@/state/workspace-store';
import { DEFAULT_GRID_CONFIG } from '@/state/default-grid-config';

// Import module's full pipeline (.agents/workflows/build-image-import-pipeline.md):
// pick (via the PlatformAdapter seam, never a raw file input here) -> decode/
// downsample/thumbnail/hash (core-engine) -> register the asset + create the
// Reference (api-client's local persistence) -> hand off to the workspace.
export async function importReference(): Promise<void> {
  const store = useWorkspaceStore.getState();
  store.setImportError(null);
  store.setImporting(true);

  try {
    const blob = await getPlatformAdapter().pickImage();
    const imported = await importImage(blob);

    const project = await getOrCreateDefaultProject();
    const asset = await saveAsset({
      ownerId: LOCAL_OWNER_ID,
      contentHash: imported.contentHash,
      width: imported.originalWidth,
      height: imported.originalHeight,
      sizeBytes: imported.sizeBytes,
      originalBlob: blob,
      thumbnailBlob: await bitmapToBlob(imported.thumbnailBitmap),
    });
    const reference = await createReference({
      projectId: project.id,
      originalAssetId: asset.id,
      gridConfig: DEFAULT_GRID_CONFIG,
    });

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
