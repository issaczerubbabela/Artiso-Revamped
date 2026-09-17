import { DEFAULT_WORKING_LONG_EDGE, THUMBNAIL_LONG_EDGE } from './constants';
import { ImageImportError } from './errors';
import { sha256Hex } from './hash';
import { computeResizeDimensions, validateMimeType, validateSourceDimensions } from './validation';

export interface ImportedImage {
  workingBitmap: ImageBitmap;
  workingWidth: number;
  workingHeight: number;
  thumbnailBitmap: ImageBitmap;
  thumbnailWidth: number;
  thumbnailHeight: number;
  originalWidth: number;
  originalHeight: number;
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ImportImageOptions {
  workingLongEdge?: number;
}

// The full Import pipeline stage (docs/architecture/01-image-import.md):
// decode -> validate -> downsample to a working bitmap -> generate a
// thumbnail in the same decode pass -> content-hash for dedupe. The
// full-resolution decoded bitmap is never returned or held onto past this
// function -- only the caller's original Blob (persisted separately) and the
// capped working/thumbnail bitmaps survive into the interactive path.
//
// Needs createImageBitmap/OffscreenCanvas, so it can't run under Vitest's
// Node environment -- exercised via the Playwright E2E golden path instead.
// (validateMimeType/validateSourceDimensions/computeResizeDimensions/sha256Hex
// are unit tested directly since they're pure or Node-available.)
export async function importImage(blob: Blob, options: ImportImageOptions = {}): Promise<ImportedImage> {
  const workingLongEdge = options.workingLongEdge ?? DEFAULT_WORKING_LONG_EDGE;

  validateMimeType(blob.type);

  const [contentHash, sourceBitmap] = await Promise.all([
    blob.arrayBuffer().then(sha256Hex),
    decodeBitmap(blob),
  ]);

  validateSourceDimensions(sourceBitmap.width, sourceBitmap.height);

  try {
    const working = computeResizeDimensions(sourceBitmap.width, sourceBitmap.height, workingLongEdge);
    const thumbnail = computeResizeDimensions(sourceBitmap.width, sourceBitmap.height, THUMBNAIL_LONG_EDGE);

    const [workingBitmap, thumbnailBitmap] = await Promise.all([
      resizeBitmap(sourceBitmap, working.width, working.height),
      resizeBitmap(sourceBitmap, thumbnail.width, thumbnail.height),
    ]);

    return {
      workingBitmap,
      workingWidth: working.width,
      workingHeight: working.height,
      thumbnailBitmap,
      thumbnailWidth: thumbnail.width,
      thumbnailHeight: thumbnail.height,
      originalWidth: sourceBitmap.width,
      originalHeight: sourceBitmap.height,
      contentHash,
      mimeType: blob.type,
      sizeBytes: blob.size,
    };
  } finally {
    sourceBitmap.close();
  }
}

async function decodeBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageImportError('decode-failed', 'Could not decode the selected image.');
  }
}

async function resizeBitmap(source: ImageBitmap, width: number, height: number): Promise<ImageBitmap> {
  if (width === source.width && height === source.height) {
    return createImageBitmap(source);
  }
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(source, 0, 0, width, height);
  return createImageBitmap(canvas);
}
