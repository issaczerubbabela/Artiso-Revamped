// Working out what a pasted or dropped file is (issue #10). Browsers often hand
// over a file with no type -- a HEIC photo dragged in from the Files app on an
// iPad, say -- so the extension stands in for it.

const TYPES_BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

const UNTYPED = new Set(['', 'application/octet-stream']);

// The file's MIME type: the one the browser gave, or one inferred from the
// file name's extension when it gave none. '' when neither says anything.
export function resolveImageType(type: string, name: string): string {
  if (!UNTYPED.has(type)) return type;
  const dot = name.lastIndexOf('.');
  const extension = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  return TYPES_BY_EXTENSION[extension] ?? type;
}

// Any image at all, including formats the import then turns down.
export function isImageFile(type: string): boolean {
  return type.startsWith('image/');
}

export function isHeicType(type: string): boolean {
  return /^image\/hei[cf](-sequence)?$/.test(type);
}

// What to tell the artist when the browser could not decode an image. Some
// browsers can't open HEIC at all; converting it is out of scope, so they are
// asked for a JPEG instead.
export function decodeFailedMessage(type: string): string {
  if (isHeicType(type)) return "This browser can't open HEIC photos. Convert it to JPEG and try again.";
  return 'Could not decode the selected image.';
}
