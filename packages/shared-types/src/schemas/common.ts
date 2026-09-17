import { z } from 'zod';

export const IdSchema = z.string().uuid();
export const IsoDateTimeSchema = z.string().datetime();
export const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a 6-digit hex color');
