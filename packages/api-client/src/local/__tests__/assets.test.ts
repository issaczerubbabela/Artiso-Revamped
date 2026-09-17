import { beforeEach, describe, expect, it } from 'vitest';
import { findAssetByContentHash, getAsset, getAssetBlob, saveAsset } from '../assets';
import { resetTestDatabase } from './test-helpers';

beforeEach(resetTestDatabase);

function makeInput(overrides: Partial<Parameters<typeof saveAsset>[0]> = {}) {
  return {
    ownerId: '00000000-0000-0000-0000-000000000000',
    contentHash: 'hash-a',
    width: 800,
    height: 600,
    sizeBytes: 12345,
    originalBlob: new Blob(['original-bytes']),
    thumbnailBlob: new Blob(['thumb-bytes']),
    ...overrides,
  };
}

describe('saveAsset', () => {
  it('creates a new asset and stores both blobs', async () => {
    const asset = await saveAsset(makeInput());
    expect(await getAsset(asset.id)).toEqual(asset);

    const original = await getAssetBlob(asset.id, 'original');
    const thumbnail = await getAssetBlob(asset.id, 'thumbnail');
    expect(await original?.text()).toBe('original-bytes');
    expect(await thumbnail?.text()).toBe('thumb-bytes');
  });

  it('dedupes by content hash instead of creating a duplicate', async () => {
    const first = await saveAsset(makeInput());
    const second = await saveAsset(makeInput({ sizeBytes: 999 }));
    expect(second.id).toBe(first.id);
    expect(second.sizeBytes).toBe(first.sizeBytes);
  });

  it('creates a separate asset for different content', async () => {
    const first = await saveAsset(makeInput({ contentHash: 'hash-a' }));
    const second = await saveAsset(makeInput({ contentHash: 'hash-b' }));
    expect(second.id).not.toBe(first.id);
  });
});

describe('findAssetByContentHash', () => {
  it('returns undefined when nothing matches', async () => {
    expect(await findAssetByContentHash('missing')).toBeUndefined();
  });
});
