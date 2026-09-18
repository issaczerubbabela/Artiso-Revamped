import { applyGeometryOps, deriveAdjustments, generateGridGeometry } from '@artiso/core-engine';
import { GridLayer, ImageLayer } from '@artiso/renderer';
import type { ExportSettings, GridConfig, Operation } from '@artiso/shared-types';
import { getAssetBlob } from '@artiso/api-client';
import { getPlatformAdapter } from '@/platform/get-platform-adapter';

export interface ExportOptions extends ExportSettings {
  assetId: string;
  editStack: Operation[];
  gridConfig: GridConfig;
}

const IDENTITY_VIEWPORT = { scale: 1, translateX: 0, translateY: 0 };
const NO_ADJUSTMENTS = { brightness: 0, contrast: 0, saturation: 0, filterId: null, filterParams: {} } as const;

// Re-runs the exact same core-engine/renderer functions the live preview
// uses -- crop/rotate/flip, the adjustment shader, grid geometry -- against
// the full-resolution original asset instead of the downsampled working
// bitmap, with no viewport transform (export is the whole image, not the
// current pan/zoom framing). Never a separate export-only reimplementation
// (.agents/workflows/build-export-pipeline.md's "re-run, don't reimplement"
// rule -- the #1 way export output drifts from what the artist saw).
export async function exportReference(options: ExportOptions): Promise<void> {
  const originalBlob = await getAssetBlob(options.assetId, 'original');
  if (!originalBlob) throw new Error('Original image is no longer available.');

  const sourceBitmap = await createImageBitmap(originalBlob, { imageOrientation: 'from-image' });
  const geometryOps = options.editStack.filter(
    (op) => op.type === 'crop' || op.type === 'rotate' || op.type === 'flip',
  );
  const geometry =
    geometryOps.length > 0
      ? await applyGeometryOps(sourceBitmap, geometryOps)
      : { bitmap: sourceBitmap, width: sourceBitmap.width, height: sourceBitmap.height };

  const outputCanvas = new OffscreenCanvas(geometry.width, geometry.height);
  const outputCtx = outputCanvas.getContext('2d');
  if (!outputCtx) throw new Error('2D context unavailable');

  // "Transparent-Grid" profile: includeImage: false skips the image layer
  // entirely, leaving just the grid on a transparent background -- the
  // canvas starts transparent by default, so there's nothing to draw here.
  if (options.includeImage !== false) {
    const imageCanvas = new OffscreenCanvas(geometry.width, geometry.height);
    const imageLayer = new ImageLayer(imageCanvas);
    imageLayer.setSource(geometry.bitmap);
    const adjustments = options.includeAdjustments ? deriveAdjustments(options.editStack) : NO_ADJUSTMENTS;
    imageLayer.draw(IDENTITY_VIEWPORT, geometry.width, geometry.height, adjustments);
    imageLayer.dispose();
    outputCtx.drawImage(imageCanvas, 0, 0);
  }

  if (options.includeGrid) {
    const gridCanvas = new OffscreenCanvas(geometry.width, geometry.height);
    const gridLayer = new GridLayer(gridCanvas);
    const gridGeometry = generateGridGeometry(geometry.width, geometry.height, options.gridConfig);
    // Export's includeGrid toggle is its own decision, independent of
    // whether the grid happens to be hidden in the live workspace right now.
    gridLayer.draw(gridGeometry, { ...options.gridConfig, visible: true }, IDENTITY_VIEWPORT, geometry.width, geometry.height);
    outputCtx.drawImage(gridCanvas, 0, 0);
  }

  const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await outputCanvas.convertToBlob({ type: mimeType, quality: options.quality / 100 });
  await getPlatformAdapter().saveFile(blob, `reference.${options.format}`);
}
