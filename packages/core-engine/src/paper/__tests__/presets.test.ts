import { describe, expect, it } from 'vitest';
import {
  NAMED_PAPER_PRESETS,
  PAPER_PRESET_PORTRAIT_MM,
  customPaper,
  defaultPaperForImage,
  paperAspect,
  paperFor,
  swapOrientation,
} from '../presets';

describe('paper presets', () => {
  it('matches the spec sizes (portrait, mm)', () => {
    expect(PAPER_PRESET_PORTRAIT_MM).toEqual({
      A3: { widthMm: 297, heightMm: 420 },
      A4: { widthMm: 210, heightMm: 297 },
      A5: { widthMm: 148, heightMm: 210 },
      Letter: { widthMm: 215.9, heightMm: 279.4 },
      Legal: { widthMm: 215.9, heightMm: 355.6 },
    });
    expect(NAMED_PAPER_PRESETS).toEqual(['A3', 'A4', 'A5', 'Letter', 'Legal']);
  });

  it('applies orientation to width/height', () => {
    expect(paperFor('A4', 'portrait')).toEqual({ preset: 'A4', orientation: 'portrait', widthMm: 210, heightMm: 297 });
    expect(paperFor('A4', 'landscape')).toEqual({ preset: 'A4', orientation: 'landscape', widthMm: 297, heightMm: 210 });
  });
});

describe('swapOrientation', () => {
  it('swaps width and height and keeps the preset', () => {
    const landscape = swapOrientation(paperFor('Letter', 'portrait'));
    expect(landscape).toEqual({ preset: 'Letter', orientation: 'landscape', widthMm: 279.4, heightMm: 215.9 });
  });

  it('is its own inverse', () => {
    const paper = paperFor('A3', 'portrait');
    expect(swapOrientation(swapOrientation(paper))).toEqual(paper);
  });

  it('works for a custom size', () => {
    expect(swapOrientation(customPaper(400, 250))).toEqual({
      preset: 'custom',
      orientation: 'portrait',
      widthMm: 250,
      heightMm: 400,
    });
  });
});

describe('customPaper', () => {
  it('derives the orientation from the dimensions', () => {
    expect(customPaper(500, 250).orientation).toBe('landscape');
    expect(customPaper(250, 500).orientation).toBe('portrait');
    expect(customPaper(300, 300).orientation).toBe('portrait');
  });
});

describe('paperAspect', () => {
  it('is width / height', () => {
    expect(paperAspect(paperFor('A4', 'portrait'))).toBeCloseTo(210 / 297, 12);
    expect(paperAspect(paperFor('A4', 'landscape'))).toBeCloseTo(297 / 210, 12);
  });
});

describe('defaultPaperForImage', () => {
  it('starts on A4 turned to match the image', () => {
    expect(defaultPaperForImage(3000, 2000)).toMatchObject({ preset: 'A4', orientation: 'landscape' });
    expect(defaultPaperForImage(2000, 3000)).toMatchObject({ preset: 'A4', orientation: 'portrait' });
    expect(defaultPaperForImage(2000, 2000)).toMatchObject({ preset: 'A4', orientation: 'portrait' });
  });
});
