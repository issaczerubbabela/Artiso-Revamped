import { useEffect } from 'react';
import { decodeBlobToWorkingBitmap, importImage, warpPerspective } from '@artiso/core-engine';
import {
  LOCAL_OWNER_ID,
  deleteCheckPhoto,
  getCheckPhoto,
  saveCheckPhoto,
  scheduleReferenceSync,
  subscribeCheckPhotoUpdates,
  updateCheckPhotoCorners,
} from '@artiso/api-client';
import type { CheckPhoto, Paper, PhotoPoint } from '@artiso/shared-types';
import { getPlatformAdapter } from '@/platform/get-platform-adapter';
import { canvasToBlob, createScratchCanvas } from '@/platform/canvas';
import { useAuthStore } from '@/state/auth-store';
import { useCheckPhotoStore } from '@/state/check-photo-store';
import { useWorkspaceStore } from '@/state/workspace-store';

// The Drawing Check (GLOSSARY.md): take a Check Photo of the drawing, line it
// up with the paper by its four corners, and lay it over the reference. The
// photo is its own entity, saved and synced apart from the reference
// (docs/adr/0001-check-photos-synced-apart-from-the-reference.md): nothing
// here touches the EditStack, the grid or an export.

// The straightened photo's long edge in pixels: sharp enough to compare
// proportions at any useful zoom, small enough to straighten quickly.
const STRAIGHTENED_LONG_EDGE = 1600;
const STORED_JPEG_QUALITY = 0.85;

// The reference's open session (focused or parked), for its project and paper.
function openSession(referenceId: string): { projectId: string; paper: Paper } | null {
  const store = useWorkspaceStore.getState();
  if (store.referenceId === referenceId && store.projectId) return { projectId: store.projectId, paper: store.paper };
  const parked = store.splitParked;
  if (parked?.referenceId === referenceId) return { projectId: parked.projectId, paper: parked.paper };
  return null;
}

// Phones and tablets have a camera to hand; a desktop gets the file picker.
function prefersCamera(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}

// Takes a photo (camera on iPad/phone, file picker elsewhere), decodes it
// through the import path, and opens corner placement. Nothing is saved until
// the corners are placed.
export async function takeCheckPhoto(): Promise<void> {
  const referenceId = useWorkspaceStore.getState().referenceId;
  if (!referenceId) return;
  const check = useCheckPhotoStore.getState();
  check.setError(null);
  check.setBusy(true);
  try {
    const picked = await getPlatformAdapter().pickImage({ camera: prefersCamera() });
    const imported = await importImage(picked);
    imported.thumbnailBitmap.close();
    // Stored at working resolution, not the camera original: quick to sync
    // from a phone, and the corners are measured in these pixels.
    const blob = await encodeJpeg(imported.workingBitmap);
    useCheckPhotoStore.getState().setAlignment({
      referenceId,
      bitmap: imported.workingBitmap,
      corners: [],
      isNew: true,
      blob,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not take the Check Photo.';
    if (message !== 'Import cancelled') useCheckPhotoStore.getState().setError(message);
  } finally {
    useCheckPhotoStore.getState().setBusy(false);
  }
}

// Re-opens corner placement on the current photo, with its corners in place.
export async function adjustCheckPhotoCorners(): Promise<void> {
  const referenceId = useWorkspaceStore.getState().referenceId;
  if (!referenceId) return;
  const local = await getCheckPhoto(referenceId);
  if (!local) return;
  const { bitmap } = await decodeBlobToWorkingBitmap(local.blob);
  useCheckPhotoStore.getState().setAlignment({
    referenceId,
    bitmap,
    corners: local.photo.corners.map((p) => ({ ...p })),
    isNew: false,
    blob: null,
  });
}

export function cancelCheckAlignment(): void {
  useCheckPhotoStore.getState().setAlignment(null);
}

// Saves the placed corners: a new photo replaces the old one; otherwise the
// existing photo's corners change. Then straightens it and queues the sync.
export async function commitCheckAlignment(): Promise<void> {
  const check = useCheckPhotoStore.getState();
  const alignment = check.alignment;
  if (!alignment || alignment.corners.length !== 4) return;
  const corners = alignment.corners as CheckPhoto['corners'];
  const session = openSession(alignment.referenceId);

  let straightened: HTMLCanvasElement;
  try {
    straightened = straighten(alignment.bitmap, corners, session?.paper ?? null);
  } catch {
    check.setError('Those corners don’t outline the paper. Move them onto its four corners.');
    return;
  }

  let photo: CheckPhoto | null;
  if (alignment.isNew && alignment.blob) {
    const now = new Date().toISOString();
    photo = {
      id: crypto.randomUUID(),
      ownerId: useAuthStore.getState().user?.id ?? LOCAL_OWNER_ID,
      referenceId: alignment.referenceId,
      image: {
        storageKey: 'local',
        mimeType: alignment.blob.type as CheckPhoto['image']['mimeType'],
        width: alignment.bitmap.width,
        height: alignment.bitmap.height,
        sizeBytes: alignment.blob.size,
      },
      corners,
      createdAt: now,
      updatedAt: now,
    };
    await saveCheckPhoto(photo, alignment.blob);
  } else {
    photo = await updateCheckPhotoCorners(alignment.referenceId, corners);
  }
  if (!photo) return;

  bumpLoad(alignment.referenceId);
  check.setShown(alignment.referenceId, { photo, straightened });
  check.setError(null);
  check.setAlignment(null);
  queueSync(alignment.referenceId, session?.projectId);
}

export async function removeCheckPhoto(): Promise<void> {
  const referenceId = useWorkspaceStore.getState().referenceId;
  if (!referenceId) return;
  await deleteCheckPhoto(referenceId);
  bumpLoad(referenceId);
  useCheckPhotoStore.getState().setShown(referenceId, null);
  queueSync(referenceId, openSession(referenceId)?.projectId);
}

function queueSync(referenceId: string, projectId: string | undefined): void {
  if (projectId && useAuthStore.getState().user) scheduleReferenceSync(projectId, referenceId);
}

// Loads (or reloads) a reference's Check Photo from this device's store. A
// newer load or a local save supersedes a slower earlier one.
const loadTokens = new Map<string, number>();
function bumpLoad(referenceId: string): number {
  const token = (loadTokens.get(referenceId) ?? 0) + 1;
  loadTokens.set(referenceId, token);
  return token;
}

async function loadCheckPhoto(referenceId: string): Promise<void> {
  const token = bumpLoad(referenceId);
  const local = await getCheckPhoto(referenceId);
  let shown = null;
  if (local) {
    const { bitmap } = await decodeBlobToWorkingBitmap(local.blob);
    try {
      shown = { photo: local.photo, straightened: straighten(bitmap, local.photo.corners, openSession(referenceId)?.paper ?? null) };
    } catch {
      shown = null;
    } finally {
      bitmap.close();
    }
  }
  if (loadTokens.get(referenceId) !== token) return;
  useCheckPhotoStore.getState().setShown(referenceId, shown);
}

// Keeps the open references' Check Photos loaded: the focused pane's and a
// split view's parked pane's, and reloads one when sync brings a change from
// another device (a phone photo arriving on the iPad).
export function useCheckPhotoLoader(): void {
  const referenceId = useWorkspaceStore((s) => s.referenceId);
  const parkedId = useWorkspaceStore((s) => s.splitParked?.referenceId ?? null);

  useEffect(() => {
    const open = [referenceId, parkedId].filter((id): id is string => id !== null);
    const check = useCheckPhotoStore.getState();
    for (const id of Object.keys(check.byReference)) if (!open.includes(id)) check.setShown(id, null);
    for (const id of open) if (!useCheckPhotoStore.getState().byReference[id]) void loadCheckPhoto(id).catch(() => {});
  }, [referenceId, parkedId]);

  useEffect(
    () =>
      subscribeCheckPhotoUpdates((id) => {
        if (openSession(id)) void loadCheckPhoto(id).catch(() => {});
      }),
    [],
  );
}

// The photo straightened to the paper's shape. The layer stretches it over the
// paper rectangle, so the aspect only sets how the pixels are spent.
function straighten(bitmap: ImageBitmap, corners: readonly PhotoPoint[], paper: Paper | null): HTMLCanvasElement {
  const aspect = paper ? paper.widthMm / paper.heightMm : bitmap.width / bitmap.height;
  const width = Math.max(1, Math.round(aspect >= 1 ? STRAIGHTENED_LONG_EDGE : STRAIGHTENED_LONG_EDGE * aspect));
  const height = Math.max(1, Math.round(aspect >= 1 ? STRAIGHTENED_LONG_EDGE / aspect : STRAIGHTENED_LONG_EDGE));

  const scratch = createScratchCanvas(bitmap.width, bitmap.height);
  const sourceCtx = scratch.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  if (!sourceCtx) throw new Error('2D context unavailable');
  sourceCtx.drawImage(bitmap, 0, 0);
  const source = sourceCtx.getImageData(0, 0, bitmap.width, bitmap.height);

  const pixels = warpPerspective(source, corners, width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  const out = ctx.createImageData(width, height);
  out.data.set(pixels);
  ctx.putImageData(out, 0, 0);
  return canvas;
}

async function encodeJpeg(bitmap: ImageBitmap): Promise<Blob> {
  const canvas = createScratchCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  return canvasToBlob(canvas, 'image/jpeg', STORED_JPEG_QUALITY);
}
