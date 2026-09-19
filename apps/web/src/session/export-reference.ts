import { PDFDocument } from 'pdf-lib';
import {
  MM_PER_CSS_PX,
  decodeOriginalBitmap,
  deriveAdjustments,
  generateDrawingGridSvg,
  generateGridGeometry,
  renderFramedBitmap,
  resolveAnnotationGeometry,
  type GridSvgLayer,
} from '@artiso/core-engine';
import { AnnotationLayer, DrawingGridLayer, GridLayer, ImageLayer } from '@artiso/renderer';
import type { Annotation, Crop, ExportSettings, GridConfig, GridSettings, Operation, Paper } from '@artiso/shared-types';
import { getAssetBlob } from '@artiso/api-client';
import { getPlatformAdapter } from '@/platform/get-platform-adapter';

export interface ExportOptions extends ExportSettings {
  assetId: string;
  editStack: Operation[];
  paper: Paper;
  crop: Crop;
  gridSettings: GridSettings;
  // The Guides layer, drawn beneath the grid.
  secondaryGridConfig: GridConfig | null;
  annotations: Annotation[];
}

const IDENTITY_VIEWPORT = { scale: 1, translateX: 0, translateY: 0 };
const NO_ADJUSTMENTS = { brightness: 0, contrast: 0, saturation: 0, filterId: null, filterParams: {} } as const;
const POINTS_PER_MM = 72 / 25.4;

// Re-runs the exact same core-engine/renderer functions the live preview
// uses -- rotate/flip and the crop region, the adjustment shader, the grid --
// against the full-resolution original asset instead of the downsampled working
// bitmap, with no viewport transform (export is the whole framed paper, not the
// current pan/zoom). Never a separate export-only reimplementation
// (.agents/workflows/build-export-pipeline.md's "re-run, don't reimplement"
// rule -- the #1 way export output drifts from what the artist saw).
//
// The output is the crop region at its native resolution. The grid is drawn at
// the paper's physical scale (pixels per millimetre follows from the crop), with
// line widths and label sizes scaled from screen pixels so it looks as it did on
// screen; the SVG and PDF are sized in real millimetres.
export async function exportReference(options: ExportOptions): Promise<void> {
  const { paper, gridSettings } = options;

  // SVG is always grid-only (docs/architecture/07-export-engine.md) -- no
  // raster compositing at all, just the same segment functions the live preview
  // and PNG/JPEG export use, in millimetres. Needs no image, so it bails out
  // before any decoding.
  if (options.format === 'svg') {
    const guides: GridSvgLayer[] = options.secondaryGridConfig
      ? [
          {
            geometry: generateGridGeometry(paper.widthMm, paper.heightMm, options.secondaryGridConfig),
            config: { ...options.secondaryGridConfig, visible: true },
          },
        ]
      : [];
    const svg = generateDrawingGridSvg({ paper, settings: gridSettings, guides });
    await getPlatformAdapter().saveFile(new Blob([svg], { type: 'image/svg+xml' }), 'reference.svg');
    return;
  }

  const originalBlob = await getAssetBlob(options.assetId, 'original');
  if (!originalBlob) throw new Error('Original image is no longer available.');

  const sourceBitmap = await decodeOriginalBitmap(originalBlob);
  const geometry = await renderFramedBitmap(sourceBitmap, options.editStack, options.crop, Number.POSITIVE_INFINITY).finally(
    () => sourceBitmap.close(),
  );

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
    const pxPerMm = geometry.width / paper.widthMm;
    // Screen px -> output px at 96 dpi, so a 1px line is as thick relative to the
    // paper as it looked on screen at real size.
    const scaleUp = pxPerMm * MM_PER_CSS_PX;
    const view = { scale: pxPerMm, translateX: 0, translateY: 0 };
    const gridCanvas = new OffscreenCanvas(geometry.width, geometry.height);

    // Guides first, then the grid over them. Export's includeGrid toggle is its
    // own decision, independent of whether the grid happens to be hidden in the
    // live workspace right now.
    if (options.secondaryGridConfig) {
      new GridLayer(gridCanvas).draw(
        [
          {
            geometry: generateGridGeometry(paper.widthMm, paper.heightMm, options.secondaryGridConfig),
            config: { ...options.secondaryGridConfig, visible: true },
          },
        ],
        view,
        geometry.width,
        geometry.height,
        { lineScale: scaleUp, labelScale: scaleUp },
      );
    }
    new DrawingGridLayer(gridCanvas).draw(
      { paper, settings: gridSettings, view, width: geometry.width, height: geometry.height },
      { clear: !options.secondaryGridConfig, lineScale: scaleUp, labelScale: scaleUp },
    );
    outputCtx.drawImage(gridCanvas, 0, 0);
  }

  // Annotations bake in the same way -- independent of includeGrid, since an
  // arrow pointing something out is unrelated to whether the grid overlay is
  // included, same "independent overlay" relationship the grid has with
  // adjustments/filters.
  if (options.includeAnnotations !== false && options.annotations.length > 0) {
    const annotationCanvas = new OffscreenCanvas(geometry.width, geometry.height);
    const annotationLayer = new AnnotationLayer(annotationCanvas);
    const resolved = resolveAnnotationGeometry(geometry.width, geometry.height, options.annotations);
    annotationLayer.draw(resolved, null, IDENTITY_VIEWPORT, geometry.width, geometry.height);
    outputCtx.drawImage(annotationCanvas, 0, 0);
  }

  // PDF bakes the exact same raster composite PNG does into a single page the
  // size of the paper itself, so it prints at physical scale.
  if (options.format === 'pdf') {
    const pngBlob = await outputCanvas.convertToBlob({ type: 'image/png' });
    const pdfDoc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(new Uint8Array(await pngBlob.arrayBuffer()));
    const pageWidth = paper.widthMm * POINTS_PER_MM;
    const pageHeight = paper.heightMm * POINTS_PER_MM;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(pngImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    const pdfBytes = await pdfDoc.save();
    await getPlatformAdapter().saveFile(new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }), 'reference.pdf');
    return;
  }

  const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await outputCanvas.convertToBlob({ type: mimeType, quality: options.quality / 100 });
  await getPlatformAdapter().saveFile(blob, `reference.${options.format}`);
}
