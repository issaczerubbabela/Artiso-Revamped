import { describe, expect, it } from 'vitest';
import { checkPhotoAlpha } from '../check-photo-layer';

describe('checkPhotoAlpha', () => {
  it('blends at the chosen opacity', () => {
    expect(checkPhotoAlpha({ opacity: 0.35, holding: false })).toBe(0.35);
    expect(checkPhotoAlpha({ opacity: 0, holding: false })).toBe(0);
  });

  it('shows only the photo while held, whatever the opacity', () => {
    expect(checkPhotoAlpha({ opacity: 0, holding: true })).toBe(1);
    expect(checkPhotoAlpha({ opacity: 0.5, holding: true })).toBe(1);
  });

  it('keeps a bad opacity in range', () => {
    expect(checkPhotoAlpha({ opacity: 4, holding: false })).toBe(1);
    expect(checkPhotoAlpha({ opacity: -1, holding: false })).toBe(0);
    expect(checkPhotoAlpha({ opacity: Number.NaN, holding: false })).toBe(0);
  });
});
