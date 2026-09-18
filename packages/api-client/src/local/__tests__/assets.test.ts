import { beforeEach, describe, expect, it } from 'vitest';
import { applyRemoteAsset, getAsset, getAssetBlob, saveAsset } from '../assets';
import { resetTestDatabase } from './test-helpers';

beforeEach(resetTestDatabase);

const ASSET_ID = '11111111-1111-4111-8111-111111111111';

function makeInput(overrides: Partial<Parameters<typeof saveAsset>[0]> = {}) {
  return {
    id: ASSET_ID,
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

  // The id is expected to already be content-derived (deterministicUuid over
  // ownerId+contentHash) by the time it reaches this layer -- saveAsset
  // itself just dedupes by id, trusting the caller got that part right.
  it('dedupes by id instead of creating a duplicate', async () => {
    const first = await saveAsset(makeInput());
    const second = await saveAsset(makeInput({ sizeBytes: 999 }));
    expect(second.id).toBe(first.id);
    expect(second.sizeBytes).toBe(first.sizeBytes);
  });

  it('creates a separate asset for a different id', async () => {
    const first = await saveAsset(makeInput({ id: ASSET_ID }));
    const second = await saveAsset(makeInput({ id: '22222222-2222-4222-8222-222222222222' }));
    expect(second.id).not.toBe(first.id);
  });
});

describe('applyRemoteAsset', () => {
  it('writes the asset and both blobs verbatim', async () => {
    const asset = {
      id: ASSET_ID,
      ownerId: '00000000-0000-0000-0000-000000000000',
      storageKey: 'owner/hash.jpg',
      contentHash: 'hash-a',
      width: 800,
      height: 600,
      sizeBytes: 12345,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    await applyRemoteAsset(asset, new Blob(['remote-original']), new Blob(['remote-thumb']));

    expect(await getAsset(ASSET_ID)).toEqual(asset);
    expect(await (await getAssetBlob(ASSET_ID, 'original'))?.text()).toBe('remote-original');
    expect(await (await getAssetBlob(ASSET_ID, 'thumbnail'))?.text()).toBe('remote-thumb');
  });
});
