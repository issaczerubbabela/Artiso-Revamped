import { PDFDocument } from 'pdf-lib';
import { applyGeometryOps, deriveAdjustments, generateGridGeometry, generateGridSvg, type GridSvgLayer } from '@artiso/core-engine';
import { GridLayer, ImageLayer, type GridDrawLayer } from '@artiso/renderer';
import type { ExportSettings, GridConfig, Operation } from '@artiso/shared-types';
import { getAssetBlob } from '@artiso/api-client';
import { getPlatformAdapter } from '@/platform/get-platform-adapter';

export interface ExportOptions extends ExportSettings {
  assetId: string;
  editStack: Operation[];
  gridConfig: GridConfig;
  secondaryGridConfig: GridConfig | null;
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

  // SVG is always grid-only (docs/architecture/07-export-engine.md) -- no
  // raster compositing at all, just the same GridGeometry the live preview
  // and PNG/JPEG export use, rendered as vector lines/labels. Bails out
  // before any canvas work since there's no image layer to composite.
  if (options.format === 'svg') {
    const svgLayers: GridSvgLayer[] = [
      {
        geometry: generateGridGeometry(geometry.width, geometry.height, options.gridConfig),
        config: { ...options.gridConfig, visible: true },
      },
    ];
    if (options.secondaryGridConfig) {
      svgLayers.push({
        geometry: generateGridGeometry(geometry.width, geometry.height, options.secondaryGridConfig),
        config: { ...options.secondaryGridConfig, visible: true },
      });
    }
    const svg = generateGridSvg(geometry.width, geometry.height, svgLayers);
    await getPlatformAdapter().saveFile(new Blob([svg], { type: 'image/svg+xml' }), 'reference.svg');
    return;
  }

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
    // Export's includeGrid toggle is its own decision, independent of
    // whether the grid happens to be hidden in the live workspace right now
    // -- both the primary and (if present) the layered secondary guide
    // force visible: true here for the same reason.
    const layers: GridDrawLayer[] = [
      {
        geometry: generateGridGeometry(geometry.width, geometry.height, options.gridConfig),
        config: { ...options.gridConfig, visible: true },
      },
    ];
    if (options.secondaryGridConfig) {
      layers.push({
        geometry: generateGridGeometry(geometry.width, geometry.height, options.secondaryGridConfig),
        config: { ...options.secondaryGridConfig, visible: true },
      });
    }
    gridLayer.draw(layers, IDENTITY_VIEWPORT, geometry.width, geometry.height);
    outputCtx.drawImage(gridCanvas, 0, 0);
  }

  // PDF bakes the exact same raster composite PNG does into a single-page
  // PDF (page size in points == image size in pixels -- physical page
  // sizing/DPI is out of scope for this pass) rather than a separate
  // encode path, keeping the "re-run, don't reimplement" rule intact all
  // the way to the final format.
  if (options.format === 'pdf') {
    const pngBlob = await outputCanvas.convertToBlob({ type: 'image/png' });
    const pdfDoc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(new Uint8Array(await pngBlob.arrayBuffer()));
    const page = pdfDoc.addPage([geometry.width, geometry.height]);
    page.drawImage(pngImage, { x: 0, y: 0, width: geometry.width, height: geometry.height });
    const pdfBytes = await pdfDoc.save();
    await getPlatformAdapter().saveFile(new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }), 'reference.pdf');
    return;
  }

  const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await outputCanvas.convertToBlob({ type: mimeType, quality: options.quality / 100 });
  await getPlatformAdapter().saveFile(blob, `reference.${options.format}`);
}
