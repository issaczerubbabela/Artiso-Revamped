import { z } from 'zod';
import { HexColorSchema } from './common';

export const GridConfigSchema = z.object({
  rows: z.number().int().positive(),
  cols: z.number().int().positive(),
  color: HexColorSchema,
  opacity: z.number().min(0).max(100),
  thickness: z.enum(['veryThin', 'thin', 'medium', 'thick', 'extraThick']),
  numberingMode: z.enum(['off', 'numbers', 'letters', 'alphanumeric', 'roman', 'custom']),
  visible: z.boolean(),
  snapToImage: z.boolean(),
});
export type GridConfig = z.infer<typeof GridConfigSchema>;
