import type { Asset } from '@artiso/shared-types';
import { getDb } from './db';

export interface SaveAssetInput {
  // Caller-provided, deterministic (core-engine's deterministicUuid over
  // `${ownerId}:${contentHash}`) rather than randomly generated -- an
  // Asset's identity is content-addressable, so the same (owner, content)
  // pair always resolves to the same id everywhere. This is what makes the
  // remote dedupe check in sync/asset.ts safe: two independently-created
  // local rows for identical content converge on one id instead of
  // diverging into two ids that reference the same bytes but not each
  // other, which is exactly the mismatch that broke Reference/Project rows
  // pointing at an asset id nothing ever inserted remotely.
  id: string;
  ownerId: string;
  contentHash: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalBlob: Blob;
  thumbnailBlob: Blob;
}

export async function saveAsset(input: SaveAssetInput): Promise<Asset> {
  const existing = await getAsset(input.id);
  if (existing) return existing;

  const asset: Asset = {
    id: input.id,
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

// Writes an Asset pulled from Supabase (plus its downloaded blobs) into
// local IndexedDB verbatim, keyed by the asset's own already-known id --
// the same "apply already-authoritative remote state" pattern as
// projects.ts's applyRemoteProject and references.ts's applyRemoteReference.
// Used when opening a Reference whose asset was uploaded from a different
// device and never downloaded to this one.
export async function applyRemoteAsset(asset: Asset, originalBlob: Blob, thumbnailBlob: Blob): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['assets', 'blobs'], 'readwrite');
  await Promise.all([
    tx.objectStore('assets').put(asset),
    tx.objectStore('blobs').put(originalBlob, `${asset.id}:original`),
    tx.objectStore('blobs').put(thumbnailBlob, `${asset.id}:thumbnail`),
    tx.done,
  ]);
}

export async function getAsset(id: string): Promise<Asset | undefined> {
  const db = await getDb();
  return db.get('assets', id);
}

export async function getAssetBlob(assetId: string, variant: 'original' | 'thumbnail'): Promise<Blob | undefined> {
  const db = await getDb();
  return db.get('blobs', `${assetId}:${variant}`);
}
