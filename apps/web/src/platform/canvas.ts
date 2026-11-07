import { createScratchCanvas, setScratchCanvasFactory } from '@artiso/core-engine';

// Browsers without OffscreenCanvas (Safari before 16.4, i.e. older iPads and
// iPhones) get a detached <canvas> instead; see core-engine's scratch-canvas.ts.
// Called once at startup, before anything is imported or exported.
export function installCanvasFallback(): void {
  if (typeof OffscreenCanvas !== 'undefined' || typeof document === 'undefined') return;
  setScratchCanvasFactory((width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    // Same 2D drawing API as OffscreenCanvas; encoding goes through canvasToBlob.
    return canvas as unknown as OffscreenCanvas;
  });
}

export { createScratchCanvas };

// Encodes a scratch canvas from either implementation.
export function canvasToBlob(canvas: OffscreenCanvas | HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image.'))), type, quality);
  });
}
