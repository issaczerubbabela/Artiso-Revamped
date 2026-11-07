// Off-screen 2D scratch canvases for decode/resize/crop/geometry work.
//
// OffscreenCanvas is the default (it also works inside a Worker), but Safari
// only gained it in 16.4 -- older iPads and iPhones, and some embedded WebKit
// builds, lack it. core-engine must stay DOM-free, so the app shell registers a
// fallback (a detached <canvas>) via setScratchCanvasFactory at startup instead
// of core-engine reaching for `document` itself.
//
// The fallback is typed as OffscreenCanvas: everything core-engine does with a
// scratch canvas (getContext('2d'), drawImage, createImageBitmap(canvas)) is the
// same API on both. Encoding differs (convertToBlob vs toBlob), which is why
// core-engine never encodes -- callers that need a Blob do it in the app.
export type ScratchCanvasFactory = (width: number, height: number) => OffscreenCanvas;

let fallbackFactory: ScratchCanvasFactory | null = null;

export function setScratchCanvasFactory(factory: ScratchCanvasFactory | null): void {
  fallbackFactory = factory;
}

export function createScratchCanvas(width: number, height: number): OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (fallbackFactory) return fallbackFactory(width, height);
  throw new Error('This browser cannot draw images off-screen (no OffscreenCanvas and no fallback registered).');
}
