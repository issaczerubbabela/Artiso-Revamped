import type { Crop, Paper } from '@artiso/shared-types';
import type { Dimensions } from '../geometry';
import { initialCrop } from './crop';
import { defaultPaperForImage, paperAspect } from './presets';

/**
 * What a freshly imported image starts with (so the grid is usable in one tap):
 * A4 turned to match the image and the largest centred crop of that shape.
 */
export function defaultFraming(oriented: Dimensions): { paper: Paper; crop: Crop } {
  const paper = defaultPaperForImage(oriented.width, oriented.height);
  return { paper, crop: initialCrop(oriented.width, oriented.height, paperAspect(paper)) };
}
