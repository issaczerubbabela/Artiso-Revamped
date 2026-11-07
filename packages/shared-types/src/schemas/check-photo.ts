import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common';

// A point in the photo's own pixels (x right, y down from its top-left).
export const PhotoPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});
export type PhotoPoint = z.infer<typeof PhotoPointSchema>;

// The image a Check Photo holds. Stored at working resolution (not the camera
// original), so `width`/`height` are the pixels the corners are measured in.
export const CheckPhotoImageSchema = z.object({
  // `{ownerId}/{referenceId}.{ext}` in the private `check-photos` bucket.
  storageKey: z.string(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  sizeBytes: z.number().int().nonnegative(),
});
export type CheckPhotoImage = z.infer<typeof CheckPhotoImageSchema>;

// A Check Photo (GLOSSARY.md): the latest photo of the artist's own drawing,
// lined up with the paper by its four corners, for the Drawing Check. Its own
// synced entity, kept apart from the Reference -- never in the EditStack,
// never exported, private to its owner, at most one per owner per reference
// (docs/adr/0001-check-photos-synced-apart-from-the-reference.md).
export const CheckPhotoSchema = z.object({
  id: IdSchema,
  ownerId: IdSchema,
  referenceId: IdSchema,
  image: CheckPhotoImageSchema,
  // The paper's four corners in photo pixels, in the order they were placed.
  // core-engine's orderCorners sorts them, so the order carries no meaning.
  corners: z.tuple([PhotoPointSchema, PhotoPointSchema, PhotoPointSchema, PhotoPointSchema]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type CheckPhoto = z.infer<typeof CheckPhotoSchema>;
