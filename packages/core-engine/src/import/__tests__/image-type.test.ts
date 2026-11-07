import { describe, expect, it } from 'vitest';
import { decodeFailedMessage, isHeicType, isImageFile, resolveImageType } from '../image-type';

// Paste and drop (issue #10) hand over files whose type the browser may not
// know: a HEIC photo dragged from Files often arrives with no type at all.

describe('resolveImageType', () => {
  it('keeps a type the browser already gave', () => {
    expect(resolveImageType('image/png', 'photo.heic')).toBe('image/png');
  });

  it('works out the type from the extension when the browser gave none', () => {
    expect(resolveImageType('', 'IMG_0001.HEIC')).toBe('image/heic');
    expect(resolveImageType('', 'scan.heif')).toBe('image/heif');
    expect(resolveImageType('', 'a.jpg')).toBe('image/jpeg');
    expect(resolveImageType('application/octet-stream', 'b.jpeg')).toBe('image/jpeg');
    expect(resolveImageType('', 'c.png')).toBe('image/png');
    expect(resolveImageType('', 'd.webp')).toBe('image/webp');
  });

  it('leaves an unknown file alone', () => {
    expect(resolveImageType('', 'notes')).toBe('');
    expect(resolveImageType('text/plain', 'notes.txt')).toBe('text/plain');
  });
});

describe('isImageFile', () => {
  it('is true for any image type, known or not', () => {
    expect(isImageFile('image/png')).toBe(true);
    expect(isImageFile('image/gif')).toBe(true);
    expect(isImageFile('image/heic')).toBe(true);
  });

  it('is false for everything else', () => {
    expect(isImageFile('text/plain')).toBe(false);
    expect(isImageFile('')).toBe(false);
    expect(isImageFile('application/pdf')).toBe(false);
  });
});

describe('decoding failures', () => {
  it('recognises HEIC and HEIF', () => {
    expect(isHeicType('image/heic')).toBe(true);
    expect(isHeicType('image/heif')).toBe(true);
    expect(isHeicType('image/heic-sequence')).toBe(true);
    expect(isHeicType('image/jpeg')).toBe(false);
  });

  it('asks for a JPEG when the browser cannot open a HEIC photo', () => {
    expect(decodeFailedMessage('image/heic')).toMatch(/convert it to JPEG/i);
    expect(decodeFailedMessage('image/heif')).toMatch(/convert it to JPEG/i);
  });

  it('says the image could not be opened otherwise', () => {
    expect(decodeFailedMessage('image/png')).toBe('Could not decode the selected image.');
  });
});
