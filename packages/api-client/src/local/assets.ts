import type { Asset } from '@artiso/shared-types';
import { getDb } from './db';

export interface SaveAssetInput {
  ownerId: string;
  contentHash: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalBlob: Blob;
  thumbnailBlob: Blob;
}

// Dedupes by content hash, mirroring the `originals/{userId}/{contentHash}`
// storage-key convention Phase 2 will use server-side (docs/architecture/08)
// even though there's no server yet -- re-importing the same file locally
// doesn't create a second copy.
export async function saveAsset(input: SaveAssetInput): Promise<Asset> {
  const existing = await findAssetByContentHash(input.contentHash);
  if (existing) return existing;

  const asset: Asset = {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    storageKey: `local/${input.contentHash}`,
    contentHash: input.contentHash,
    width: input.width,
    height: input.height,
    sizeBytes: input.sizeBytes,
    createdAt: new Date().toISOString(),
  };

  const db = await getDb();
  const tx = db.transaction(['assets', 'blobs'], 'readwrite');
  await Promise.all([
    tx.objectStore('assets').put(asset),
    tx.objectStore('blobs').put(input.originalBlob, `${asset.id}:original`),
    tx.objectStore('blobs').put(input.thumbnailBlob, `${asset.id}:thumbnail`),
    tx.done,
  ]);

  return asset;
}

// Local-only scale (a handful of references), so a full table scan is fine;
// revisit with a dedicated index if this ever needs to handle a large
// library.
export async function findAssetByContentHash(contentHash: string): Promise<Asset | undefined> {
  const db = await getDb();
  const all = await db.getAll('assets');
  return all.find((asset) => asset.contentHash === contentHash);
}

export async function getAsset(id: string): Promise<Asset | undefined> {
  const db = await getDb();
  return db.get('assets', id);
}

export async function getAssetBlob(assetId: string, variant: 'original' | 'thumbnail'): Promise<Blob | undefined> {
  const db = await getDb();
  return db.get('blobs', `${assetId}:${variant}`);
}
