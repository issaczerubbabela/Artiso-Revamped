export type ImageImportErrorCode = 'unsupported-format' | 'decode-failed' | 'oversized';

export class ImageImportError extends Error {
  constructor(
    public readonly code: ImageImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ImageImportError';
  }
}
