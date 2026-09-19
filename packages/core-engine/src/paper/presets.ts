import type { Orientation, Paper, PaperPreset } from '@artiso/shared-types';

export type NamedPaperPreset = Exclude<PaperPreset, 'custom'>;

// Portrait sizes in mm (Grid-Feature-Spec.md §3).
export const PAPER_PRESET_PORTRAIT_MM: Record<NamedPaperPreset, { widthMm: number; heightMm: number }> = {
  A3: { widthMm: 297, heightMm: 420 },
  A4: { widthMm: 210, heightMm: 297 },
  A5: { widthMm: 148, heightMm: 210 },
  Letter: { widthMm: 215.9, heightMm: 279.4 },
  Legal: { widthMm: 215.9, heightMm: 355.6 },
};

export const NAMED_PAPER_PRESETS = Object.keys(PAPER_PRESET_PORTRAIT_MM) as NamedPaperPreset[];

export function paperFor(preset: NamedPaperPreset, orientation: Orientation): Paper {
  const { widthMm, heightMm } = PAPER_PRESET_PORTRAIT_MM[preset];
  return orientation === 'portrait'
    ? { preset, orientation, widthMm, heightMm }
    : { preset, orientation, widthMm: heightMm, heightMm: widthMm };
}

// A custom size's orientation simply follows its dimensions; a square counts
// as portrait.
export function customPaper(widthMm: number, heightMm: number): Paper {
  return {
    preset: 'custom',
    orientation: widthMm > heightMm ? 'landscape' : 'portrait',
    widthMm,
    heightMm,
  };
}

// The portrait/landscape toggle swaps width and height (§4). A preset stays the
// same preset -- landscape A4 is still A4.
export function swapOrientation(paper: Paper): Paper {
  return {
    ...paper,
    orientation: paper.orientation === 'portrait' ? 'landscape' : 'portrait',
    widthMm: paper.heightMm,
    heightMm: paper.widthMm,
  };
}

export function paperAspect(paper: Pick<Paper, 'widthMm' | 'heightMm'>): number {
  return paper.widthMm / paper.heightMm;
}

export const DEFAULT_PAPER_PRESET: NamedPaperPreset = 'A4';

// The paper a freshly imported image starts on: A4, turned to match the image so
// the default crop keeps as much of it as possible.
export function defaultPaperForImage(imageWidth: number, imageHeight: number): Paper {
  return paperFor(DEFAULT_PAPER_PRESET, imageWidth > imageHeight ? 'landscape' : 'portrait');
}
