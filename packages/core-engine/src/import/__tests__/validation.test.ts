import { describe, expect, it } from 'vitest';
import { computeResizeDimensions, validateMimeType, validateSourceDimensions } from '../validation';
import { ImageImportError } from '../errors';

describe('validateMimeType', () => {
  it('accepts jpeg, png, and webp', () => {
    expect(() => validateMimeType('image/jpeg')).not.toThrow();
    expect(() => validateMimeType('image/png')).not.toThrow();
    expect(() => validateMimeType('image/webp')).not.toThrow();
  });

  it('rejects an unsupported format', () => {
    expect(() => validateMimeType('image/heic')).toThrow(ImageImportError);
    try {
      validateMimeType('image/heic');
    } catch (error) {
      expect(error).toBeInstanceOf(ImageImportError);
      expect((error as ImageImportError).code).toBe('unsupported-format');
    }
  });
});

describe('validateSourceDimensions', () => {
  it('accepts dimensions under the cap', () => {
    expect(() => validateSourceDimensions(4000, 3000)).not.toThrow();
  });

  it('rejects dimensions over the cap', () => {
    expect(() => validateSourceDimensions(20000, 3000)).toThrow(ImageImportError);
  });
});

describe('computeResizeDimensions', () => {
  it('never upscales an image already smaller than the target', () => {
    expect(computeResizeDimensions(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it('downscales the long edge to the target, preserving aspect ratio', () => {
    expect(computeResizeDimensions(4096, 2048, 2048)).toEqual({ width: 2048, height: 1024 });
  });

  it('handles a portrait image the same way', () => {
    expect(computeResizeDimensions(2048, 4096, 2048)).toEqual({ width: 1024, height: 2048 });
  });

  it('never produces a zero dimension', () => {
    expect(computeResizeDimensions(10000, 1, 256)).toEqual({ width: 256, height: 1 });
  });
});
