import { describe, expect, it } from 'vitest';
import { CheckPhotoSchema } from '../schemas/check-photo';

const OWNER = '11111111-1111-4111-8111-111111111111';
const REFERENCE = '22222222-2222-4222-8222-222222222222';
const ID = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-11-07T10:00:00.000Z';

const valid = {
  id: ID,
  ownerId: OWNER,
  referenceId: REFERENCE,
  image: {
    storageKey: `${OWNER}/${REFERENCE}.jpg`,
    mimeType: 'image/jpeg',
    width: 1536,
    height: 2048,
    sizeBytes: 412_000,
  },
  corners: [
    { x: 120, y: 80 },
    { x: 1410, y: 140 },
    { x: 1460, y: 1950 },
    { x: 60, y: 1900 },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

describe('CheckPhotoSchema', () => {
  it('accepts the image asset, four corners in photo pixels, the owner, the reference and timestamps', () => {
    expect(CheckPhotoSchema.parse(valid)).toEqual(valid);
  });

  it('requires exactly four corners', () => {
    expect(CheckPhotoSchema.safeParse({ ...valid, corners: valid.corners.slice(0, 3) }).success).toBe(false);
    expect(CheckPhotoSchema.safeParse({ ...valid, corners: [...valid.corners, { x: 1, y: 1 }] }).success).toBe(false);
  });

  it('rejects a non-finite corner', () => {
    const corners = [...valid.corners];
    corners[2] = { x: Number.NaN, y: 4 };
    expect(CheckPhotoSchema.safeParse({ ...valid, corners }).success).toBe(false);
  });

  it('requires an owner and a reference', () => {
    expect(CheckPhotoSchema.safeParse({ ...valid, ownerId: 'nobody' }).success).toBe(false);
    expect(CheckPhotoSchema.safeParse({ ...valid, referenceId: undefined }).success).toBe(false);
  });

  it('only holds the image types the import path decodes', () => {
    expect(CheckPhotoSchema.safeParse({ ...valid, image: { ...valid.image, mimeType: 'image/heic' } }).success).toBe(false);
  });
});
