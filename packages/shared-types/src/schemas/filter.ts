import { z } from 'zod';

export const FilterIdSchema = z.enum([
  'grayscale',
  'highContrast',
  'lowContrast',
  'threshold',
  'posterize',
  'pencilSketch',
  'edgeDetect',
  'invert',
  'blur',
  'sharpen',
]);
export type FilterId = z.infer<typeof FilterIdSchema>;
